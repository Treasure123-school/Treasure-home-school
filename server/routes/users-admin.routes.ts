/** Reset password, role change, audit logs, create user, self-update — split from invites.routes.ts. */
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

export async function registerUserAdminRoutes(app: Express) {
  // Reset user password (Admin and Super Admin)
  app.post("/api/users/:id/reset-password", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword, forceChange } = z.object({
        newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
        forceChange: z.boolean().optional().default(true)
      }).parse(req.body);
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Generate temporary password if none provided
      let passwordToUse = newPassword;
      let generatedPassword: string | undefined;

      if (!newPassword) {
        const { generateTempPassword } = await import('../username-generator');
        generatedPassword = generateTempPassword();
        passwordToUse = generatedPassword;
      }
      // Hash the password
      const passwordHash = await bcrypt.hash(passwordToUse!, BCRYPT_ROUNDS);

      // Update user with new password and force change flag
      await storage.updateUser(id, {
        passwordHash,
        mustChangePassword: forceChange
      });

      // Log audit event
      await storage.createAuditLog({
        userId: adminUser.id,
        action: 'password_reset',
        entityType: 'user',
        entityId: '0',
        oldValue: JSON.stringify({ userId: user.id, mustChangePassword: user.mustChangePassword }),
        newValue: JSON.stringify({ userId: user.id, mustChangePassword: forceChange }),
        reason: `Admin ${adminUser.email} reset password for user ${user.email || user.username}${forceChange ? ' (force change on next login)' : ''}${generatedPassword ? ' (auto-generated)' : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash: _, ...safeUser } = user;

      res.json({
        message: `Password reset successfully${forceChange ? '. User must change password on next login.' : ''}`,
        user: { ...safeUser, email: user.email, username: user.username },
        ...(generatedPassword && { temporaryPassword: generatedPassword }) // Include generated password if auto-generated
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Change user role (Admin only)
  app.post("/api/users/:id/role", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const { roleId } = z.object({
        roleId: z.number().int().positive()
      }).parse(req.body);
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Validate role exists
      const newRole = await storage.getRole(roleId);
      if (!newRole) {
        return res.status(400).json({ message: "Invalid role" });
      }
      // Prevent changing your own role
      if (user.id === adminUser.id) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      const oldRole = await storage.getRole(user.roleId);

      // Update user role
      const updatedUser = await storage.updateUser(id, { roleId });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user role" });
      }
      // Log audit event
      await storage.createAuditLog({
        userId: adminUser.id,
        action: 'role_changed',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, roleId: user.roleId, roleName: oldRole?.name }),
        newValue: JSON.stringify({ userId: user.id, roleId: roleId, roleName: newRole.name }),
        reason: `Admin ${adminUser.email} changed role of user ${user.email || user.username} from ${oldRole?.name} to ${newRole.name}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: `User role updated to ${newRole.name}`,
        user: safeUser
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to change user role" });
    }
  });

  // Get audit logs (Admin only)
  app.get("/api/audit-logs", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { limit, action, entityType } = z.object({
        limit: z.coerce.number().int().positive().max(1000).optional().default(100),
        action: z.string().optional(),
        entityType: z.string().optional()
      }).parse(req.query);

      const logs = await storage.getAuditLogs({
        limit,
        action,
        entityType
      });

      // Enrich logs with user information
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const user = log.userId ? await storage.getUser(log.userId) : null;
        return {
          ...log,
          userEmail: user?.email,
          userName: `${user?.firstName} ${user?.lastName}`
        };
      }));

      res.json(enrichedLogs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/users", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      // Extract password from request and hash it before storage
      const { password, ...otherUserData } = req.body;

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // ========== ROLE HIERARCHY ENFORCEMENT ==========
      // Super Admin (1) can create: Admin (2), Teacher (3), Student (4), Parent (5)
      // Admin (2) can create: Teacher (3), Student (4), Parent (5) - NOT Super Admin or Admin
      // Teacher (3) can create: Student (4) only

      const creatorRoleId = req.user!.roleId;
      const targetRoleId = otherUserData.roleId;

      // Teachers can only create students
      if (creatorRoleId === ROLES.TEACHER && targetRoleId !== ROLES.STUDENT) {
        return res.status(403).json({ message: "Teachers can only create student accounts" });
      }

      // Admins cannot create Super Admins or other Admins
      if (creatorRoleId === ROLES.ADMIN) {
        if (targetRoleId === ROLES.SUPER_ADMIN) {
          return res.status(403).json({ message: "Admins cannot create Super Admin accounts" });
        }
        if (targetRoleId === ROLES.ADMIN) {
          return res.status(403).json({ message: "Admins cannot create other Admin accounts. Only Super Admins can create Admin accounts." });
        }
      }

      // Super Admin can create any role (no restrictions)
      // ========== END ROLE HIERARCHY ENFORCEMENT ==========

      // Generate username if not provided (based on roleId)
      let username = otherUserData.username;
      if (!username && otherUserData.roleId) {
        const { generateUsernameByRole } = await import('../username-generator');
        username = await generateUsernameByRole(otherUserData.roleId);
      }
      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Generate UUID for new user (required for PostgreSQL)
      const userId = randomUUID();

      // Prepare user data with hashed password and generated username
      // ✅ AUTO-APPROVE: Set status to 'active' since user is created by authorized admin or teacher
      // No approval needed when created by Super Admin, Admin, or Teacher
      const userData = {
        id: userId, // PostgreSQL requires explicit UUID
        ...insertUserSchema.parse({
          ...otherUserData,
          username,
          passwordHash,
          status: 'active', // ✅ AUTO-APPROVE: Direct creation by admin/teacher means instant approval
          isActive: true, // ✅ Enable account immediately
          mustChangePassword: true, // ✅ SECURITY: ALWAYS force password change on first login - cannot be overridden
          profileCompleted: otherUserData.profileCompleted ?? false, // 🔧 FIX: Default to false if not provided
          profileSkipped: otherUserData.profileSkipped ?? false, // 🔧 FIX: Default to false if not provided
          createdVia: creatorRoleId === ROLES.TEACHER ? 'teacher' : (creatorRoleId === ROLES.SUPER_ADMIN ? 'superadmin' : 'admin'), // Track who created the user
          createdBy: req.user!.id // Track creator user ID
        })
      };

      const user = await storage.createUser(userData as any);

      // If creating a student, also create the student record if classId and admissionNumber are provided
      if (otherUserData.roleId === ROLES.STUDENT && otherUserData.classId) {
        await storage.createStudent({
          id: user.id,
          admissionNumber: username, // Use username as admission number
          admissionDate: new Date().toISOString().split('T')[0], // Today's date as admission date
          classId: otherUserData.classId,
          parentId: otherUserData.parentId || null
        });
      }
      // Remove password hash from response for security
      const { passwordHash: _, ...userResponse } = user;

      // Emit realtime event for user creation
      realtimeService.emitUserEvent(user.id, 'created', userResponse, user.roleId?.toString());

      // Include temporary password in response for admin/teacher to share with user
      // This is only sent once and should be displayed to admin/teacher immediately
      res.json({
        ...userResponse,
        temporaryPassword: password
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const requestUser = req.user!;

      // Authorization: Users can update their own profile, admins can update any
      if (requestUser.id !== id && requestUser.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }
      // Extract password if provided for separate handling
      const { password, passwordHash, ...otherUserData } = req.body;

      // Prevent direct passwordHash manipulation
      if (passwordHash) {
        return res.status(400).json({ message: "Direct password hash modification not allowed" });
      }
      let updateData = otherUserData;

      // If password provided, hash it properly
      if (password) {
        if (typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        updateData = { ...otherUserData, passwordHash: hashedPassword };
      }
      const userData = insertUserSchema.partial().parse(updateData);
      const user = await storage.updateUser(id, userData);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Remove password hash from response for security
      const { passwordHash: _, ...userResponse } = user;

      // Emit realtime event for user update
      realtimeService.emitUserEvent(user.id, 'updated', userResponse, user.roleId?.toString());

      res.json(userResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(400).json({ message: "Invalid user data" });
    }
  });
}
