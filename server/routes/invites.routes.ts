/** Auto-split from routes.ts — invites (orig lines 7631-9354). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { contactSchema, BCRYPT_ROUNDS } from '../routes/upload-config';
import { upload, uploadCSV } from '../routes/upload-config';
import { generatePassword, generateUsername, getNextUserNumber } from '../auth-utils';
import { realtimeService } from '../realtime-service';
import { ROLES, SECRET_KEY, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { insertContactMessageSchema, insertUserSchema } from '@shared/schema';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { ZodError, z } from 'zod';

export async function registerInvitesRoutes(app: Express) {
  // ==================== INVITE SYSTEM ENDPOINTS ====================

  // Create invite (Admin only)
  app.post("/api/invites", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { email, roleId } = z.object({
        email: z.string().email(),
        roleId: z.number()
      }).parse(req.body);

      // Validate role exists and is either Admin or Teacher
      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(400).json({ message: "Invalid role" });
      }
      if (roleId !== ROLES.ADMIN && roleId !== ROLES.TEACHER) {
        return res.status(400).json({ message: "Invites can only be sent for Admin or Teacher roles" });
      }
      // Check if user already exists with this email
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      // Check for pending invite
      const existingInvite = await storage.getPendingInviteByEmail(email);
      if (existingInvite) {
        return res.status(400).json({ message: "Pending invite already exists for this email" });
      }
      // Generate secure token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiry to 7 days from now
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Create invite
      const invite = await storage.createInvite({
        email,
        roleId,
        token,
        createdBy: req.user!.id,
        expiresAt
      });

      // In production, send email with invite link
      // For development, return the token
      const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/invite/${token}`;

      if (process.env.NODE_ENV === 'development') {
        return res.json({
          message: "Invite created successfully",
          invite: {
            id: invite.id,
            email: invite.email,
            roleId: invite.roleId,
            token: invite.token,
            inviteLink,
            expiresAt: invite.expiresAt
          },
          developmentOnly: true
        });
      }
      res.json({
        message: "Invite sent successfully",
        invite: {
          id: invite.id,
          email: invite.email,
          roleId: invite.roleId,
          expiresAt: invite.expiresAt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request format" });
      }
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  // List all invites (Admin only)
  app.get("/api/invites", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const invites = await storage.getAllInvites();
      res.json(invites);
    } catch (error) {
      res.status(500).json({ message: "Failed to list invites" });
    }
  });

  // List pending invites (Admin only)
  app.get("/api/invites/pending", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const invites = await storage.getPendingInvites();
      res.json(invites);
    } catch (error) {
      res.status(500).json({ message: "Failed to list pending invites" });
    }
  });

  // Get invite by token (public - for verification)
  app.get("/api/invites/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const invite = await storage.getInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid or expired invite" });
      }
      // Return invite info without sensitive data
      res.json({
        email: invite.email,
        roleId: invite.roleId,
        expiresAt: invite.expiresAt
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get invite" });
    }
  });

  // Accept invite (public)
  app.post("/api/invites/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      const { firstName, lastName, password } = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        password: z.string().min(6).max(100)
      }).parse(req.body);

      // Verify invite exists and is valid
      const invite = await storage.getInviteByToken(token);
      if (!invite) {
        return res.status(400).json({ message: "Invalid or expired invite" });
      }
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invite.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      // Generate THS username for the new staff member
      const { generateUsername, getNextUserNumber } = await import('../auth-utils');
      const currentYear = new Date().getFullYear().toString();
      const allUsers = await storage.getAllUsers();
      const existingUsernames = allUsers.map(u => u.username).filter((u): u is string => !!u);
      const nextNumber = getNextUserNumber(existingUsernames, invite.roleId);
      const username = generateUsername(invite.roleId, nextNumber);

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Generate UUID for invited user (required for PostgreSQL)
      const userId = randomUUID();

      // Create user account
      const user = await storage.createUser({
        id: userId, // PostgreSQL requires explicit UUID
        email: invite.email,
        username,
        firstName,
        lastName,
        roleId: invite.roleId,
        passwordHash,
        authProvider: 'local',
        status: 'active',
        createdVia: 'invite',
        mustChangePassword: true, // ✅ SECURITY: Force password change on first login even for invited users
        profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
        profileSkipped: false // 🔧 FIX: New staff start with incomplete profile
      } as any);

      // Mark invite as accepted
      await storage.markInviteAsAccepted(invite.id, user.id);

      // Generate JWT token
      const token_jwt = jwt.sign(
        { userId: user.id, roleId: user.roleId },
        SECRET_KEY,
        { expiresIn: '24h' }
      );


      res.json({
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId
        },
        token: token_jwt
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request format" });
      }
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  // Cancel/Delete invite (Admin only)
  app.delete("/api/invites/:id", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const inviteId = parseInt(req.params.id);

      const deleted = await storage.deleteInvite(inviteId);
      if (!deleted) {
        return res.status(404).json({ message: "Invite not found" });
      }
      res.json({ message: "Invite deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete invite" });
    }
  });

  // Health check endpoint for monitoring
  app.get("/api/health", async (_req, res) => {
    try {
      // Simple database connection check using drizzle query
      await db.select().from(schema.roles).limit(1);

      res.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        render: !!process.env.RENDER
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Public contact form with 100% PostgreSQL persistence
  app.post("/api/contact", async (req, res) => {
    try {
      const data = contactSchema.parse(req.body);

      // Save to PostgreSQL database permanently
      const contactMessageData = insertContactMessageSchema.parse({
        name: data.name,
        email: data.email,
        message: data.message,
        subject: data.subject || null,
        isRead: false
      });

      const savedMessage = await storage.createContactMessage(contactMessageData);

      res.json({
        message: "Message sent successfully! We'll get back to you soon.",
        id: savedMessage.id
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      res.status(500).json({ message: "Failed to send message. Please try again." });
    }
  });

  // Analytics overview endpoint - Admin only
  app.get("/api/analytics/overview", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      // Fetch all roles for ID lookups
      const allRoles = await storage.getRoles();
      const roleMap = new Map(allRoles.map(r => [r.name.toLowerCase(), r.id]));

      // Get role IDs
      const studentRoleId = roleMap.get('student');
      const teacherRoleId = roleMap.get('teacher');

      // Parallel fetch for performance
      const [
        allStudentsRaw,
        allTeachersRaw,
        allClasses
      ] = await Promise.all([
        studentRoleId ? storage.getUsersByRole(studentRoleId) : [],
        teacherRoleId ? storage.getUsersByRole(teacherRoleId) : [],
        storage.getAllClasses()
      ]);

      // Filter to only include ACTIVE users - this ensures consistency with Student Management page
      const allStudents = allStudentsRaw.filter(student => student.isActive === true);
      const allTeachers = allTeachersRaw.filter(teacher => teacher.isActive === true);

      // Calculate students added this month (only counting active students)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newStudentsThisMonth = allStudents.filter(student => {
        if (!student.createdAt) return false;
        const createdAt = new Date(student.createdAt);
        return createdAt >= startOfMonth;
      }).length;

      // Calculate teachers added this term (approximation: last 3 months, only active)
      const startOfTerm = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const newTeachersThisTerm = allTeachers.filter(teacher => {
        if (!teacher.createdAt) return false;
        const createdAt = new Date(teacher.createdAt);
        return createdAt >= startOfTerm;
      }).length;

      res.json({
        totalStudents: allStudents.length,
        totalTeachers: allTeachers.length,
        totalClasses: allClasses.length,
        recentActivity: {
          newStudentsThisMonth,
          newTeachersThisTerm
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // User management - Admin only - OPTIMIZED for speed
  app.get("/api/users", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT), async (req, res) => {
    try {
      const { role } = req.query;
      const currentUser = req.user;

      if (!currentUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Teachers can only fetch Teacher or Student data (for messaging/exam purposes)
      if (currentUser.roleId === ROLES.TEACHER) {
        if (!role || (role !== 'Teacher' && role !== 'Student')) {
          return res.status(403).json({ message: "Teachers can only view Teacher and Student user lists" });
        }
      }

      // Students and Parents can only fetch Teacher data (for messaging purposes)
      if (currentUser.roleId === ROLES.STUDENT || currentUser.roleId === ROLES.PARENT) {
        if (!role || role !== 'Teacher') {
          return res.status(403).json({ message: "Students and Parents can only see the Teacher list" });
        }
      }

      let users: any[] = [];

      if (role && typeof role === 'string') {
        const userRole = await storage.getRoleByName(role);
        if (userRole) {
          users = await storage.getUsersByRole(userRole.id);
        } else {
          users = [];
        }
      } else {
        // PERFORMANCE: Get all users in parallel instead of sequential
        const allRoles = await storage.getRoles();
        const userPromises = allRoles.map(userRole => storage.getUsersByRole(userRole.id));
        const userArrays = await Promise.all(userPromises);
        users = userArrays.flat();
      }
      // SECURITY: Filter admin accounts based on user role and system settings
      const isCurrentUserSuperAdmin = currentUser.roleId === ROLES.SUPER_ADMIN;

      if (!isCurrentUserSuperAdmin) {
        // Get system settings to check if admin accounts should be hidden
        const settings = await storage.getSystemSettings();
        const hideAdminAccounts = settings?.hideAdminAccountsFromAdmins ?? true; // Default to true for security

        if (hideAdminAccounts) {
          // Filter out Super Admin and Admin accounts for non-Super Admin users
          users = users.filter(user =>
            user.roleId !== ROLES.SUPER_ADMIN && user.roleId !== ROLES.ADMIN
          );
        }
      }

      // PERFORMANCE: Fetch roles once for enrichment
      const allRoles = await storage.getRoles();
      const roleMap = new Map(allRoles.map(r => [r.id, r.name]));

      // Remove sensitive data and add role names
      const sanitizedUsers = users.map(user => {
        const { passwordHash, ...safeUser } = user;
        return {
          ...safeUser,
          roleName: roleMap.get(user.roleId) || 'Unknown'
        };
      });
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });


  // Verify user (Admin only) - Activates user account
  app.post("/api/users/:id/verify", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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

      const oldStatus = user.status;

      // Update the user status to active
      const updatedUser = await storage.updateUserStatus(id, 'active', adminUser.id, 'User verified by admin');

      // PERFORMANCE: Log audit event asynchronously
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_verified',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, status: oldStatus }),
        newValue: JSON.stringify({ userId: user.id, status: 'active' }),
        reason: `Admin ${adminUser.email} verified user ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "User verified and activated successfully",
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify user" });
    }
  });

  // Unverify user (Admin only) - Moves user back to pending status
  app.post("/api/users/:id/unverify", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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

      const oldStatus = user.status;

      // Update the user status to pending
      const updatedUser = await storage.updateUserStatus(id, 'pending', adminUser.id, 'User unverified by admin - awaiting approval');

      // PERFORMANCE: Log audit event asynchronously (non-critical)
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_unverified',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, status: oldStatus }),
        newValue: JSON.stringify({ userId: user.id, status: 'pending' }),
        reason: `Admin ${adminUser.email} unverified user ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "User unverified and moved to pending status",
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to unverify user" });
    }
  });

  // Suspend user (Admin only) - Temporarily blocks access
  app.post("/api/users/:id/suspend", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
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

      const oldStatus = user.status;

      // Update the user status to suspended
      const updatedUser = await storage.updateUserStatus(id, 'suspended', adminUser.id, reason || 'Account suspended by admin');

      // PERFORMANCE: Log audit event asynchronously (non-blocking for instant response)
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_suspended',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, status: oldStatus }),
        newValue: JSON.stringify({ userId: user.id, status: 'suspended' }),
        reason: reason || `Admin ${adminUser.email} suspended user ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "User suspended successfully",
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  // Unsuspend user (Admin only) - Restores access
  app.post("/api/users/:id/unsuspend", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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

      const oldStatus = user.status;

      // Restore both status and isActive (isActive may have been set false by student block action)
      await storage.setUserActive(id, true);
      const updatedUser = await storage.updateUserStatus(id, 'active', adminUser.id, 'Suspension lifted by admin');

      // PERFORMANCE: Log audit event asynchronously
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_unsuspended',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, status: oldStatus }),
        newValue: JSON.stringify({ userId: user.id, status: 'active' }),
        reason: `Admin ${adminUser.email} unsuspended user ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: "User unsuspended successfully",
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to unsuspend user" });
    }
  });

  // Update user status (reject, suspend, disable)
  app.post("/api/users/:id/status", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      const adminUser = req.user;

      if (!adminUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Validate status
      const validStatuses = ['pending', 'active', 'suspended', 'disabled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const oldStatus = user.status;

      // Update the user status
      const updatedUser = await storage.updateUserStatus(id, status, adminUser.id, reason);

      // PERFORMANCE: Log audit event asynchronously (non-blocking for instant response)
      storage.createAuditLog({
        userId: adminUser.id,
        action: 'user_status_changed',
        entityType: 'user',
        entityId: '0', // Placeholder, needs proper entity ID if applicable
        oldValue: JSON.stringify({ userId: user.id, status: oldStatus }),
        newValue: JSON.stringify({ userId: user.id, status }),
        reason: reason || `Admin ${adminUser.email} changed status of user ${user.email || user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = updatedUser;

      res.json({
        message: `User status updated to ${status}`,
        user: safeUser
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

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

  // CSV Upload for bulk user provisioning
  app.post("/api/admin/upload-users-csv", authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('csvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "CSV file is required" });
      }
      // Read and parse CSV file (uploadCSV uses multer memoryStorage, so the
      // file is an in-memory buffer — there is no req.file.path on disk)
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV file must contain header and at least one row" });
      }
      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      // Expected columns: studentName, class, parentName, parentEmail
      const requiredColumns = ['studentname', 'class', 'parentname', 'parentemail'];
      const hasRequiredColumns = requiredColumns.every(col => headers.includes(col));

      if (!hasRequiredColumns) {
        return res.status(400).json({
          message: "CSV must contain columns: studentName, class, parentName, parentEmail"
        });
      }
      const currentYear = new Date().getFullYear().toString();
      const { generateUsername, generatePassword } = await import('../auth-utils');

      // Get all existing usernames to ensure uniqueness
      const allUsers = await storage.getAllUsers();
      const existingUsernames = allUsers.map(u => u.username).filter((u): u is string => !!u);
      const createdUsers: any[] = [];
      const errors: string[] = [];

      // Get roles
      const studentRoleData = await storage.getRoleByName('Student');
      const parentRoleData = await storage.getRoleByName('Parent');

      if (!studentRoleData || !parentRoleData) {
        return res.status(500).json({ message: "Required roles (Student, Parent) not found in database" });
      }
      // Parse each row
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        try {
          // Extract data
          const studentName = row['studentname'];
          const className = row['class'];
          const rollNo = row['rollno'] || String(i);
          const parentName = row['parentname'];
          const parentEmail = row['parentemail'];

          if (!studentName || !className || !parentName || !parentEmail) {
            errors.push(`Row ${i + 1}: Missing required fields`);
            continue;
          }
          // Split student name
          const [studentFirstName, ...studentLastParts] = studentName.split(' ');
          const studentLastName = studentLastParts.join(' ') || studentFirstName;

          // Split parent name
          const [parentFirstName, ...parentLastParts] = parentName.split(' ');
          const parentLastName = parentLastParts.join(' ') || parentFirstName;

          // Check if parent already exists
          let parent = await storage.getUserByEmail(parentEmail);
          let parentId: string;
          let parentCredentials = null;

          if (!parent) {
            // Create parent account - calculate correct sequence number
            const parentCount = existingUsernames.filter(u => u.startsWith(`THS-PAR-`)).length + 1;
            const parentUsername = generateUsername(parentRoleData.id, parentCount);
            const parentPassword = generatePassword(currentYear);
            const parentPasswordHash = await bcrypt.hash(parentPassword, BCRYPT_ROUNDS);

            // Generate UUID for parent (required for PostgreSQL)
            const csvParentId = randomUUID();

            parent = await storage.createUser({
              id: csvParentId, // PostgreSQL requires explicit UUID
              username: parentUsername,
              email: parentEmail,
              passwordHash: parentPasswordHash,
              roleId: parentRoleData.id,
              firstName: parentFirstName,
              lastName: parentLastName,
              mustChangePassword: true,
              profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
              profileSkipped: false // 🔧 FIX: CSV import parents start with incomplete profile
            } as any);

            // CRITICAL: Track newly created username to prevent duplicates in same batch
            existingUsernames.push(parentUsername);
            parentCredentials = { username: parentUsername, password: parentPassword };
            parentId = parent.id;
          } else {
            parentId = parent.id;
          }
          // Get class (including inactive classes to allow CSV uploads to any existing class)
          const classObj = await storage.getAllClasses(true);
          const studentClass = classObj.find(c => c.name.toLowerCase() === className.toLowerCase());

          if (!studentClass) {
            errors.push(`Row ${i + 1}: Class "${className}" not found`);
            continue;
          }
          // Create student account - calculate correct sequence number
          const studentCount = existingUsernames.filter(u => u.startsWith(`THS-STU-`)).length + 1;
          const studentUsername = generateUsername(studentRoleData.id, studentCount);
          const studentPassword = generatePassword(currentYear);
          const studentPasswordHash = await bcrypt.hash(studentPassword, BCRYPT_ROUNDS);

          // Generate UUID for student (required for PostgreSQL)
          const csvStudentId = randomUUID();

          const studentUser = await storage.createUser({
            id: csvStudentId, // PostgreSQL requires explicit UUID
            username: studentUsername,
            email: '', // No auto-generated email; user can add real email via profile
            passwordHash: studentPasswordHash,
            roleId: studentRoleData.id,
            firstName: studentFirstName,
            lastName: studentLastName,
            mustChangePassword: true,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: CSV import students start with incomplete profile
          } as any);

          // CRITICAL: Track newly created username to prevent duplicates in same batch
          existingUsernames.push(studentUsername);

          // Create student record
          const admissionNumber = studentUsername;
          await storage.createStudent({
            id: studentUser.id,
            admissionNumber,
            admissionDate: new Date().toISOString().split('T')[0], // Today's date as admission date
            classId: studentClass.id,
            parentId: parentId
          });

          createdUsers.push({
            type: 'student',
            name: studentName,
            username: studentUsername,
            password: studentPassword,
            class: className,
            parent: {
              name: parentName,
              email: parentEmail,
              credentials: parentCredentials
            }
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Successfully created ${createdUsers.length} users`,
        users: createdUsers,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to process CSV file" });
    }
  });

  // Preview CSV import (validate and return preview)
  app.post('/api/admin/import/preview', authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      // uploadCSV uses multer memoryStorage — read from the in-memory buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const { previewCSVImport } = await import('../csv-import-service');

      const preview = await previewCSVImport(csvContent);

      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to preview CSV' });
    }
  });

  // Preview CSV import (student endpoint - same as admin/import/preview)
  app.post('/api/students/csv-preview', authenticateUser, authorizeRoles(ROLES.ADMIN), uploadCSV.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      // uploadCSV uses multer memoryStorage — read from the in-memory buffer
      const csvContent = req.file.buffer.toString('utf-8');
      const { previewCSVImport } = await import('../csv-import-service');

      const preview = await previewCSVImport(csvContent);

      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to preview CSV' });
    }
  });

  // Commit CSV import (create users from validated CSV)
  app.post('/api/students/csv-commit', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { validRows } = req.body;

      if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
        return res.status(400).json({ message: 'No valid rows to import' });
      }
      const { commitCSVImport } = await import('../csv-import-service');
      const adminUserId = req.user!.id;

      const result = await commitCSVImport(validRows, adminUserId);

      // Log audit event
      await storage.createAuditLog({
        userId: adminUserId,
        action: 'bulk_student_import',
        entityType: 'student',
        entityId: '0', // Bulk operation
        newValue: JSON.stringify({ count: result.successCount, failed: result.failedRows.length }),
        reason: `Bulk imported ${result.successCount} students via CSV`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null
      });

      res.json({
        message: `Successfully imported ${result.successCount} students`,
        successCount: result.successCount,
        failedRows: result.failedRows,
        credentials: result.credentials
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to import students' });
    }
  });

}
