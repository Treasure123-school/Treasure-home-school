/** Super admin — system stats + admin account management.
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


export function registerSuperAdminCrudRoutes(app: Express) {
  // ==================== SUPER ADMIN ROUTES ====================

  // Get system statistics (Super Admin only)
  app.get('/api/superadmin/stats', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const stats = await storage.getSuperAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch system statistics' });
    }
  });

  // Get all admins (Super Admin only)
  app.get('/api/superadmin/admins', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const admins = await storage.getUsersByRole(ROLES.ADMIN);
      res.json(admins);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch administrators' });
    }
  });

  // Create new admin (Super Admin only)
  app.post('/api/superadmin/admins', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      // Zod validation schema for creating admin (username and password are auto-generated)
      const createAdminSchema = z.object({
        firstName: z.string().min(1, "First name is required").trim(),
        lastName: z.string().min(1, "Last name is required").trim(),
        email: z.string().email("Invalid email address").toLowerCase().trim(),
      });

      // Validate and parse request body
      const validatedData = createAdminSchema.parse(req.body);
      const { firstName, lastName, email } = validatedData;

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      // Auto-generate username using username generator
      const { generateAdminUsername, generateTempPassword } = await import('../username-generator');
      const username = await generateAdminUsername();
      const tempPassword = generateTempPassword();

      // Generate UUID for new admin (required for PostgreSQL)
      const adminId = randomUUID();

      // Hash password
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Create admin user
      const newAdmin = await storage.createUser({
        id: adminId, // PostgreSQL requires explicit UUID
        username,
        email,
        passwordHash,
        roleId: ROLES.ADMIN,
        firstName,
        lastName,
        status: 'active',
        isActive: true,
        mustChangePassword: true, // User must change password after first login
        createdVia: 'admin',
        createdBy: req.user!.id,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      } as any);


      // Create admin profile
      await storage.createAdminProfile({
        userId: newAdmin.id,
        department: 'Administration',
        accessLevel: 'standard',
      });

      // Log the admin creation
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'admin_created',
        entityType: 'user',
        entityId: newAdmin.id,
        reason: `New admin created: ${username} (auto-generated credentials)`,
      });


      res.status(201).json({
        message: 'Admin created successfully with auto-generated credentials',
        admin: {
          id: newAdmin.id,
          username: newAdmin.username,
          email: newAdmin.email,
          firstName: newAdmin.firstName,
          lastName: newAdmin.lastName,
        },
        credentials: {
          username: username,
          password: tempPassword,
          role: 'Admin',
        }
      });
    } catch (error) {

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: error.errors[0].message || 'Validation error',
          errors: error.errors
        });
      }
      res.status(500).json({ message: 'Failed to create administrator' });
    }
  });
}
