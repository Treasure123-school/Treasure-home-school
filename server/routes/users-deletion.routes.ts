/** Smart delete, bulk delete, orphan cleanup endpoints (super admin) — split from invites.routes.ts. */
/** Auto-split from routes.ts — invites (orig lines 7631-9354). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { contactSchema, BCRYPT_ROUNDS } from '../routes/upload-config';
import { upload, uploadCSV } from '../routes/upload-config';
import { generatePassword, generateUsername, getNextUserNumber } from '../auth-utils';
import { realtimeService } from '../realtime-service';
import { ROLES, SECRET_KEY, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { insertContactMessageSchema, insertUserSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { ZodError, z } from 'zod';

export async function registerUserDeletionRoutes(app: Express) {
  // Delete user with full details (returns comprehensive deletion report)
  app.delete("/api/users/:id/smart-delete", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
    const startTime = Date.now();
    const { force } = req.query;

    try {
      const { id } = req.params;
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.id === adminUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const isCurrentUserSuperAdmin = adminUser.roleId === ROLES.SUPER_ADMIN;
      if (!isCurrentUserSuperAdmin) {
        const settings = await storage.getSystemSettings();
        const hideAdminAccounts = settings?.hideAdminAccountsFromAdmins ?? true;

        if (hideAdminAccounts && (user.roleId === ROLES.SUPER_ADMIN || user.roleId === ROLES.ADMIN)) {
          return res.status(403).json({
            message: "You do not have permission to manage admin accounts.",
            code: "ADMIN_ACCOUNT_PROTECTED"
          });
        }
      }

      if (user.roleId === ROLES.SUPER_ADMIN && adminUser.roleId !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          message: "Only Super Admins can delete Super Admin accounts.",
          code: "SUPER_ADMIN_PROTECTED"
        });
      }

      if (user.roleId === ROLES.ADMIN && adminUser.roleId === ROLES.ADMIN) {
        return res.status(403).json({
          message: "Admins cannot delete other Admin accounts.",
          code: "ADMIN_PROTECTED"
        });
      }

      if (force !== 'true') {
        const validation = await storage.validateDeletion(id);
        if (!validation.canDelete) {
          return res.status(409).json({
            message: "Cannot delete user: Active resources exist that must be completed first",
            canDelete: false,
            reason: validation.reason,
            blockedBy: validation.blockedBy
          });
        }
      }

      const deletionResult = await storage.deleteUserWithDetails(id, adminUser.id);

      realtimeService.emitUserEvent(id, 'deleted', { id, email: user.email, username: user.username }, user.roleId?.toString());

      const totalTime = Date.now() - startTime;

      res.json({
        message: "User deleted successfully with smart deletion",
        success: deletionResult.success,
        userId: deletionResult.userId,
        userRole: deletionResult.userRole,
        userEmail: deletionResult.userEmail,
        deletedRecords: deletionResult.deletedRecords,
        deletedFiles: {
          total: deletionResult.deletedFiles.length,
          successful: deletionResult.deletedFiles.filter((f: { success: boolean }) => f.success).length,
          failed: deletionResult.deletedFiles.filter((f: { success: boolean }) => !f.success).length
        },
        errors: deletionResult.errors,
        duration: deletionResult.duration,
        summary: deletionResult.summary,
        executionTime: `${totalTime}ms`
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to delete user",
        error: error.message
      });
    }
  });

  // Bulk delete users
  app.post("/api/users/bulk-delete", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
      const { userIds } = z.object({
        userIds: z.array(z.string().uuid()).min(1).max(50)
      }).parse(req.body);

      const adminUser = req.user;
      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (userIds.includes(adminUser.id)) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const result = await storage.bulkDeleteUsers(userIds, adminUser.id);

      for (const userId of result.successful) {
        realtimeService.emitUserEvent(userId, 'deleted', { id: userId }, undefined);
      }

      res.json({
        message: `Bulk deletion completed: ${result.successful.length} successful, ${result.failed.length} failed`,
        successful: result.successful,
        failed: result.failed
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request", errors: error.errors });
      }
      res.status(500).json({ message: "Bulk deletion failed", error: error.message });
    }
  });

  // Cleanup orphan records (Super Admin only)
  app.post("/api/admin/cleanup-orphans", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
      const adminUser = req.user;
      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log(`[Orphan Cleanup] Started by ${adminUser.email}`);

      const results = await storage.cleanupOrphanRecords();

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

      await storage.createAuditLog({
        userId: adminUser.id,
        action: 'orphan_records_cleaned',
        entityType: 'system',
        entityId: '0',
        oldValue: null,
        newValue: JSON.stringify(results),
        reason: `Super Admin ${adminUser.email} cleaned up ${totalDeleted} orphan records`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        message: `Orphan cleanup completed: ${totalDeleted} records deleted`,
        results
      });
    } catch (error: any) {
      res.status(500).json({ message: "Orphan cleanup failed", error: error.message });
    }
  });
}
