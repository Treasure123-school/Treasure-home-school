/** User update (admin PUT), delete, deletion validation endpoints — split from invites.routes.ts. */
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

export async function registerUserCrudRoutes(app: Express) {
  // Update user (Super Admin and Admin only)
  app.put("/api/users/:id", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Validate request body
      const updateSchema = z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
      });

      const validatedData = updateSchema.parse(req.body);

      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // SECURITY: Check if admin can access this user account
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

      // Prepare update data
      const updateData: any = {};
      if (validatedData.firstName) updateData.firstName = validatedData.firstName;
      if (validatedData.lastName) updateData.lastName = validatedData.lastName;
      if (validatedData.email) updateData.email = validatedData.email;

      // Hash password if provided
      if (validatedData.password) {
        const hashedPassword = await bcrypt.hash(validatedData.password, BCRYPT_ROUNDS);
        updateData.passwordHash = hashedPassword;
      }
      // Update user in database
      const updatedUser = await storage.updateUser(id, updateData);

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user" });
      }
      // Log audit event
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_updated',
        entityType: 'user',
        entityId: '0',
        oldValue: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }),
        newValue: JSON.stringify(updateData),
        reason: `Admin ${adminUser.email} updated user ${user.email || user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "User updated successfully",
        user: safeUser
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (permanent removal - Super Admin and Admin only) - ENHANCED with retry logic and comprehensive error handling
  app.delete("/api/users/:id", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
    const startTime = Date.now();

    try {
      const { id } = req.params;
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Prevent deleting your own account
      if (user.id === adminUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      // CRITICAL SECURITY: Check system settings for admin account protection
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

      // CRITICAL SECURITY: Only Super Admins can delete Super Admin accounts
      if (user.roleId === ROLES.SUPER_ADMIN && adminUser.roleId !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          message: "Only Super Admins can delete Super Admin accounts.",
          code: "SUPER_ADMIN_PROTECTED"
        });
      }
      // CRITICAL SECURITY: Admins cannot delete other Admin accounts
      if (user.roleId === ROLES.ADMIN && adminUser.roleId === ROLES.ADMIN) {
        return res.status(403).json({
          message: "Admins cannot delete other Admin accounts.",
          code: "ADMIN_PROTECTED"
        });
      }

      // RETRY LOGIC: Attempt delete with retries for transient errors
      let deleted = false;
      let lastError = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          deleted = await storage.deleteUser(id);

          if (deleted) {
            break;
          } else {
          }
        } catch (deleteError: any) {
          lastError = deleteError;

          // Check for permission or database errors
          if (deleteError?.code === '42501' || deleteError?.message?.includes('permission denied')) {
            return res.status(403).json({
              message: "Database permission error: Cannot delete user due to Row Level Security policies. Please check database RLS settings or use 'Disable Account' instead.",
              technicalDetails: "RLS_PERMISSION_DENIED"
            });
          }
          // If it's not a transient error, break the retry loop
          if (deleteError?.code !== 'ECONNRESET' && !deleteError?.message?.includes('timeout')) {
            break;
          }
          // Wait before retry (TRUE exponential backoff: 100ms, 200ms, 400ms)
          if (attempt < maxRetries) {
            const backoffMs = 100 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }
      if (!deleted) {
        const errorMsg = lastError?.message || "Unknown error";

        // Provide specific error messages
        if (lastError?.cause?.code === '23503' || errorMsg.includes('foreign key')) {
          const relatedTable = lastError?.cause?.table_name || 'related records';
          return res.status(409).json({
            message: `Cannot delete user: This user has associated ${relatedTable}. Please disable the account instead.`,
            technicalDetails: "FOREIGN_KEY_CONSTRAINT"
          });
        }
        return res.status(500).json({
          message: "Failed to delete user after multiple attempts",
          technicalDetails: errorMsg
        });
      }
      // Verify deletion was successful
      const verifyUser = await storage.getUser(id);
      if (verifyUser) {
        return res.status(500).json({
          message: "Delete operation completed but user still exists. This may be a database policy issue.",
          technicalDetails: "DELETE_VERIFICATION_FAILED"
        });
      }

      // PERFORMANCE: Log audit event asynchronously (non-blocking for instant response)
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_deleted',
        entityType: 'user',
        entityId: '0',
        oldValue: JSON.stringify({
          userId: user.id,
          email: user.email,
          username: user.username,
          roleId: user.roleId
        }),
        newValue: null,
        reason: `Admin ${adminUser.email} permanently deleted user ${user.email || user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Emit realtime event for user deletion
      realtimeService.emitUserEvent(id, 'deleted', { id, email: user.email, username: user.username }, user.roleId?.toString());

      const totalTime = Date.now() - startTime;

      res.json({
        message: "User deleted successfully",
        deletedUserId: id,
        executionTime: `${totalTime}ms`
      });
    } catch (error: any) {
      const totalTime = Date.now() - startTime;

      res.status(500).json({
        message: "An unexpected error occurred while deleting user",
        technicalDetails: error.message
      });
    }
  });

  // Validate deletion before proceeding (Preview what will be deleted)
  app.get("/api/users/:id/validate-deletion", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
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

      const isCurrentUserSuperAdmin = adminUser.roleId === ROLES.SUPER_ADMIN;
      if (!isCurrentUserSuperAdmin) {
        const settings = await storage.getSystemSettings();
        const hideAdminAccounts = settings?.hideAdminAccountsFromAdmins ?? true;

        if (hideAdminAccounts && (user.roleId === ROLES.SUPER_ADMIN || user.roleId === ROLES.ADMIN)) {
          return res.status(403).json({
            canDelete: false,
            reason: "You do not have permission to manage admin accounts.",
            code: "ADMIN_ACCOUNT_PROTECTED"
          });
        }
      }

      if (user.roleId === ROLES.SUPER_ADMIN && adminUser.roleId !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({
          canDelete: false,
          reason: "Only Super Admins can delete Super Admin accounts.",
          code: "SUPER_ADMIN_PROTECTED"
        });
      }

      if (user.roleId === ROLES.ADMIN && adminUser.roleId === ROLES.ADMIN) {
        return res.status(403).json({
          canDelete: false,
          reason: "Admins cannot delete other Admin accounts.",
          code: "ADMIN_PROTECTED"
        });
      }

      const validation = await storage.validateDeletion(id);

      const userRole = user.roleId === 1 ? 'Super Admin' :
        user.roleId === 2 ? 'Admin' :
          user.roleId === 3 ? 'Teacher' :
            user.roleId === 4 ? 'Student' :
              user.roleId === 5 ? 'Parent' : 'Unknown';

      res.json({
        canDelete: validation.canDelete,
        reason: validation.reason,
        blockedBy: validation.blockedBy,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: userRole,
          firstName: user.firstName,
          lastName: user.lastName
        },
        affectedRecords: validation.affectedRecords,
        filesToDelete: validation.filesToDelete?.length || 0
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to validate deletion", error: error.message });
    }
  });
}
