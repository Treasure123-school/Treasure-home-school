/** Soft-deleted user recovery — list, restore, permanent delete, expiry settings, cleanup.
/** Auto-split from routes.ts — super-admin (orig lines 10068-10779). See git history. */
import * as schema from '@shared/schema.pg';
import { upload } from '../routes/upload-config';
import { enhancedCache } from '../enhanced-cache';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { generateAdminUsername } from '../username-generator';
import { users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';
import path from 'path';
import sharp from 'sharp';
import { ZodError, z } from 'zod';


export function registerSuperAdminRecoveryRoutes(app: Express) {

  // ==================== USER RECOVERY ROUTES ====================

  // Get deleted users (Admin can see Teachers/Students/Parents, Super Admin can see all including Admins)
  app.get('/api/recovery/deleted-users', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const currentUser = req.user!;
      const isSuperAdmin = currentUser.roleId === ROLES.SUPER_ADMIN;

      // Admin can only see Teachers (3), Students (4), Parents (5)
      // Super Admin can see all roles including Admins (2)
      let roleFilter: number[] | undefined;
      if (!isSuperAdmin) {
        roleFilter = [3, 4, 5]; // Teacher, Student, Parent only
      }

      const deletedUsers = await storage.getDeletedUsers(roleFilter);

      // Get role information for each user
      const roles = await storage.getRoles();
      const roleMap = new Map(roles.map(r => [r.id, r.name]));

      // Get additional info based on role
      const enrichedUsers = await Promise.all(deletedUsers.map(async (user) => {
        const roleName = roleMap.get(user.roleId) || 'Unknown';
        let additionalInfo: any = {};

        if (user.roleId === 4) { // Student
          const student = await storage.getStudent(user.id);
          if (student) {
            additionalInfo.admissionNumber = student.admissionNumber;
            if (student.classId) {
              const cls = await storage.getClass(student.classId);
              additionalInfo.className = cls?.name;
            }
          }
        }

        // Calculate days until permanent deletion
        const settings = await storage.getSystemSettings();
        const retentionDays = settings?.deletedUserRetentionDays ?? 30;
        const deletedAt = new Date(user.deletedAt as Date);
        const expiresAt = new Date(deletedAt);
        expiresAt.setDate(expiresAt.getDate() + retentionDays);
        const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleName,
          roleId: user.roleId,
          deletedAt: user.deletedAt,
          deletedBy: user.deletedBy,
          daysRemaining,
          expiresAt: expiresAt.toISOString(),
          ...additionalInfo
        };
      }));

      res.json(enrichedUsers);
    } catch (error) {
      console.error('Error fetching deleted users:', error);
      res.status(500).json({ message: 'Failed to fetch deleted users' });
    }
  });

  // Restore a deleted user
  app.post('/api/recovery/restore/:userId', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user!;
      const isSuperAdmin = currentUser.roleId === ROLES.SUPER_ADMIN;

      // Get the user to restore
      const userToRestore = await storage.getUser(userId);
      if (!userToRestore) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is actually deleted
      if (!userToRestore.deletedAt) {
        return res.status(400).json({ message: 'User is not deleted' });
      }

      // Admin can only restore Teachers/Students/Parents, not other Admins or Super Admins
      if (!isSuperAdmin && (userToRestore.roleId === ROLES.ADMIN || userToRestore.roleId === ROLES.SUPER_ADMIN)) {
        return res.status(403).json({ message: 'Only Super Admin can restore Admin or Super Admin accounts' });
      }

      const restoredUser = await storage.restoreUser(userId, currentUser.id);
      if (!restoredUser) {
        return res.status(500).json({ message: 'Failed to restore user' });
      }

      // Log the action
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'user_restored',
        entityType: 'user',
        entityId: userId,
        reason: `User ${restoredUser.username || restoredUser.email} restored from deletion`,
      });

      // Emit realtime event
      realtimeService.emitTableChange('users', 'UPDATE', restoredUser, undefined, currentUser.id);

      res.json({
        message: 'User restored successfully',
        user: {
          id: restoredUser.id,
          username: restoredUser.username,
          email: restoredUser.email,
          firstName: restoredUser.firstName,
          lastName: restoredUser.lastName
        }
      });
    } catch (error) {
      console.error('Error restoring user:', error);
      res.status(500).json({ message: 'Failed to restore user' });
    }
  });

  // Permanently delete a user (no recovery possible)
  app.delete('/api/recovery/permanent/:userId', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user!;
      const isSuperAdmin = currentUser.roleId === ROLES.SUPER_ADMIN;

      // Get the user to delete
      const userToDelete = await storage.getUser(userId);
      if (!userToDelete) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin can only permanently delete Teachers/Students/Parents, not Admins or Super Admins
      if (!isSuperAdmin && (userToDelete.roleId === ROLES.ADMIN || userToDelete.roleId === ROLES.SUPER_ADMIN)) {
        return res.status(403).json({ message: 'Only Super Admin can permanently delete Admin or Super Admin accounts' });
      }

      // Store info before deletion for logging
      const userInfo = {
        username: userToDelete.username,
        email: userToDelete.email,
        roleId: userToDelete.roleId
      };

      const success = await storage.permanentlyDeleteUser(userId);
      if (!success) {
        return res.status(500).json({ message: 'Failed to permanently delete user' });
      }

      // Log the action
      await storage.createAuditLog({
        userId: currentUser.id,
        action: 'user_permanently_deleted',
        entityType: 'user',
        entityId: userId,
        reason: `User ${userInfo.username || userInfo.email} permanently deleted`,
      });

      res.json({ message: 'User permanently deleted successfully' });
    } catch (error) {
      console.error('Error permanently deleting user:', error);
      res.status(500).json({ message: 'Failed to permanently delete user' });
    }
  });

  // Get retention settings
  app.get('/api/recovery/settings', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({
        deletedUserRetentionDays: settings?.deletedUserRetentionDays ?? 30
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch retention settings' });
    }
  });

  // Update retention settings (Super Admin only)
  app.put('/api/recovery/settings', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const { deletedUserRetentionDays } = req.body;

      if (typeof deletedUserRetentionDays !== 'number' || deletedUserRetentionDays < 1 || deletedUserRetentionDays > 365) {
        return res.status(400).json({ message: 'Retention days must be between 1 and 365' });
      }

      const settings = await storage.updateSystemSettings({
        deletedUserRetentionDays,
        updatedBy: req.user!.id
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'retention_settings_updated',
        entityType: 'system_settings',
        entityId: String(settings.id),
        reason: `Deleted user retention period changed to ${deletedUserRetentionDays} days`,
      });

      res.json({
        message: 'Retention settings updated successfully',
        deletedUserRetentionDays: settings.deletedUserRetentionDays
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update retention settings' });
    }
  });

  // Manually trigger cleanup of expired deleted users (Super Admin only)
  app.post('/api/recovery/cleanup-expired', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSystemSettings();
      const retentionDays = settings?.deletedUserRetentionDays ?? 30;

      const result = await storage.permanentlyDeleteExpiredUsers(retentionDays);

      if (result.deleted > 0) {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: 'expired_users_cleanup',
          entityType: 'system',
          entityId: 'cleanup',
          reason: `Manually triggered cleanup: ${result.deleted} expired deleted users permanently removed`,
        });
      }

      res.json({
        message: `Cleanup completed. ${result.deleted} expired users permanently deleted.`,
        deleted: result.deleted,
        errors: result.errors
      });
    } catch (error) {
      console.error('Error cleaning up expired users:', error);
      res.status(500).json({ message: 'Failed to cleanup expired users' });
    }
  });
}
