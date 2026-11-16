/** GET /api/users — optimized user listing for all roles — split from invites.routes.ts. */
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

export async function registerUserListRoutes(app: Express) {
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
}
