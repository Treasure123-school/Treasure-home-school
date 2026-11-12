/** Auto-split from routes.ts — recovery (orig lines 7378-7630). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { lockoutViolations, BCRYPT_ROUNDS } from '../routes/upload-config';
import { generatePassword } from '../auth-utils';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { and } from 'drizzle-orm';
import path from 'path';
import { ZodError, z } from 'zod';

export async function registerRecoveryRoutes(app: Express) {
  // ==================== ADMIN RECOVERY POWERS ENDPOINTS ====================

  // Admin reset user password (ENHANCED WITH AUDIT & NOTIFICATION)
  app.post("/api/admin/reset-user-password", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      const { userId, newPassword, forceChange } = z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
        forceChange: z.boolean().optional().default(true)
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Generate new password if not provided
      const { generatePassword } = await import('../auth-utils');
      const currentYear = new Date().getFullYear().toString();
      const password = newPassword || generatePassword(currentYear);

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Use the enhanced admin reset method with audit logging
      await storage.adminResetUserPassword(userId, passwordHash, req.user!.id, forceChange);

      // Send notification to user
      const recoveryEmail = user.recoveryEmail || user.email;
      const notificationSubject = 'THS Portal - Password Reset by Administrator';
      const notificationBody = `
Hello ${user.firstName} ${user.lastName},

Your password was reset by an administrator on THS Portal.

Details:
- Reset at: ${new Date().toLocaleString()}
- Reset by: Admin (${req.user?.email})
- Temporary Password: ${password}
${forceChange ? '- You will be required to change this password at next login' : ''}

Please login and ${forceChange ? 'change your password immediately' : 'update your password for security'}.

If you did not request this password reset, please contact the school administration immediately.

Thank you,
School Management System Administration
`;

      // In development, log the notification
      if (process.env.NODE_ENV === 'development') {
      }
      // TODO: In production, send actual email
      // await sendEmail({ to: recoveryEmail, subject: notificationSubject, text: notificationBody });

      console.log(`✅ Admin ${req.user?.email} reset password for user ${userId}`);

      res.json({
        message: "Password reset successfully",
        tempPassword: password,
        username: user.username || user.email,
        email: recoveryEmail
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Admin update recovery email
  app.post("/api/admin/update-recovery-email", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { userId, recoveryEmail } = z.object({
        userId: z.string().uuid(),
        recoveryEmail: z.string().email()
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Update recovery email with audit logging
      const success = await storage.updateRecoveryEmail(userId, recoveryEmail, req.user!.id);

      if (!success) {
        return res.status(500).json({ message: "Failed to update recovery email" });
      }

      res.json({
        message: "Recovery email updated successfully",
        oldEmail: user.recoveryEmail || user.email,
        newEmail: recoveryEmail
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      res.status(500).json({ message: "Failed to update recovery email" });
    }
  });

  // User update own recovery email endpoint
  app.post("/api/users/:id/recovery-email", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { recoveryEmail } = z.object({
        recoveryEmail: z.string().email()
      }).parse(req.body);
      const userId = req.user!.id;

      // Only allow users to update their own recovery email or admins to update any
      if (id !== userId && req.user!.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: "You can only update your own recovery email" });
      }
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Update the user with new recovery email
      const updatedUser = await storage.updateUser(id, {
        recoveryEmail
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update recovery email" });
      }
      // Log audit event
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'recovery_email_updated',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, recoveryEmail: user.recoveryEmail }),
        newValue: JSON.stringify({ userId: user.id, recoveryEmail }),
        reason: `User ${req.user!.email} updated recovery email`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });


      res.json({
        message: "Recovery email updated successfully",
        user: { ...updatedUser, recoveryEmail: updatedUser.recoveryEmail } // Explicitly return updated recoveryEmail
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to update recovery email" });
    }
  });

  // Admin unlock account
  app.post("/api/admin/unlock-account", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { userId } = z.object({
        userId: z.string().uuid()
      }).parse(req.body);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Unlock the account
      const success = await storage.unlockAccount(userId);

      if (!success) {
        return res.status(500).json({ message: "Failed to unlock account" });
      }
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'account_unlocked',
        entityType: 'user',
        entityId: '0',
        oldValue: JSON.stringify({ accountLockedUntil: user.accountLockedUntil }),
        newValue: JSON.stringify({ accountLockedUntil: null }),
        reason: 'Account manually unlocked by admin',
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || null,
      });

      console.log(`✅ Admin ${req.user?.email} unlocked account for user ${userId}`);

      res.json({
        message: "Account unlocked successfully",
        username: user.username || user.email
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock account" });
    }
  });

  // ==================== ACCOUNT LOCKOUT MANAGEMENT ENDPOINTS ====================

  // Get all suspended accounts (Admin only)
  app.get("/api/admin/suspended-accounts", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const suspendedUsers = await storage.getUsersByStatus('suspended');

      // Remove sensitive data
      const sanitizedUsers = suspendedUsers.map(user => {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
      });

      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suspended accounts" });
    }
  });

  // Unlock/unsuspend account (Admin only)
  app.post("/api/admin/unlock-account/:userId", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.status !== 'suspended') {
        return res.status(400).json({ message: "Account is not suspended" });
      }
      // Unlock account by changing status to active
      const updatedUser = await storage.updateUserStatus(
        userId,
        'active',
        req.user!.id,
        reason || `Account unlocked by admin ${req.user!.email}`
      );

      // Clear any lockout violations for this user
      if (user.email) lockoutViolations.delete(user.email);
      if (user.username) lockoutViolations.delete(user.username);


      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "Account unlocked successfully",
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to unlock account" });
    }
  });

}
