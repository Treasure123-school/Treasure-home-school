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

export async function registerSuperAdminRoutes(app: Express) {
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

  // Get public system settings
  app.get('/api/public/settings', async (_req: Request, res: Response) => {
    try {
      const cacheKey = 'public:settings';
      const cached = enhancedCache.get(cacheKey);
      if (cached) {
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        return res.json(cached);
      }

      const settings = await storage.getSystemSettings();
      if (settings) {
        enhancedCache.set(cacheKey, settings, 3600); // 1 hour cache
      }
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch public settings' });
    }
  });

  // Get audit logs (Super Admin only)
  app.get('/api/superadmin/logs', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  // Get system settings (Super Admin only)
  app.get('/api/superadmin/settings', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch system settings' });
    }
  });

  // Update system settings (Super Admin only)
  // Logo and Favicon upload for Super Admin
  app.post("/api/superadmin/branding/upload", authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), upload.single("file"), async (req: any, res) => {
    try {
      console.log("[BRANDING] Received upload request", {
        uploadType: req.body.uploadType,
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          hasBuffer: !!req.file.buffer
        } : "null"
      });

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const uploadType = req.body.uploadType || 'logo';
      const isFavicon = uploadType === 'favicon' || (req.file.originalname && req.file.originalname.toLowerCase().includes('favicon'));

      // Use buffer for serverless compatibility (Vercel/Render)
      let fileToUpload = req.file;
      try {
        const imageBuffer = req.file.buffer;
        if (imageBuffer) {
          console.log("[BRANDING] Processing image with sharp...");
          let sharpInstance = sharp(imageBuffer);

          if (isFavicon) {
            sharpInstance = sharpInstance.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
          } else {
            sharpInstance = sharpInstance.resize(800, 800, { fit: 'inside', withoutEnlargement: true });
          }

          // Force conversion to png for favicons and webp for logos to ensure compatibility
          const format = isFavicon ? 'png' : 'webp';
          const mimetype = isFavicon ? 'image/png' : 'image/webp';

          const compressedBuffer = await sharpInstance
            .ensureAlpha()
            .toFormat(format, { quality: 100 })
            .toBuffer();

          fileToUpload = {
            ...req.file,
            buffer: compressedBuffer,
            originalname: `${path.parse(req.file.originalname || 'upload').name}.${isFavicon ? 'png' : 'webp'}`,
            mimetype: mimetype,
            size: compressedBuffer.length
          };
          console.log("[BRANDING] Image processed successfully", { newSize: compressedBuffer.length, format });
        } else {
          console.warn("[BRANDING] No buffer available in req.file");
        }
      } catch (err) {
        console.error("[BRANDING] Image compression failed:", err);
        // Fallback to original file if sharp fails
        fileToUpload = req.file;
      }

      const options = {
        uploadType: uploadType, // Use the actual upload type from request
        userId: req.user.id
      };

      console.log("[BRANDING] Sending to storage service...", options);
      const result = await uploadFileToStorage(fileToUpload, options);
      console.log("[BRANDING] Storage result:", JSON.stringify({
        success: result.success,
        url: result.url,
        isCloudinary: result.isCloudinary,
        error: result.error
      }));

      if (result.success && result.url) {

        console.log("[BRANDING] Upload successful, updating settings...");
        // Ensure we're using a full URL if it's a relative path in production
        let finalUrl = result.url;
        if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
          finalUrl = '/' + finalUrl;
        }
        const settings = await storage.getSystemSettings();
        if (!settings) {
          console.error("[BRANDING] System settings not found in database");
          return res.status(404).json({ message: "System settings not found" });
        }

        const updateData: any = {
          updatedAt: new Date(),
          updatedBy: req.user.id
        };

        if (isFavicon) {
          updateData.favicon = finalUrl;
        } else {
          updateData.schoolLogo = finalUrl;
        }

        console.log("[BRANDING] Updating system settings in database", updateData);
        await storage.updateSystemSettings(updateData);

        // Clear caches
        if (enhancedCache && typeof (enhancedCache as any).invalidate === 'function') {
          (enhancedCache as any).invalidate(/^public:settings/);
          (enhancedCache as any).invalidate(/^superadmin:settings/);
        }

        // Also invalidate performanceCache if it exists
        if (performanceCache && typeof (performanceCache as any).invalidate === 'function') {
          (performanceCache as any).invalidate(PerformanceCache.keys.homepageContent());
        }
        return res.json({
          success: true,
          url: result.url,
          message: `${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} updated successfully`
        });
      } else {
        console.error("[BRANDING] Upload failed:", result.error);
        return res.status(500).json({
          message: result.error || "Failed to upload branding asset",
          details: result.error
        });
      }
    } catch (error: any) {
      console.error("[BRANDING] Error in upload route:", error);
      return res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  app.put('/api/superadmin/settings', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const settingsData = { ...req.body };

      // Remove id and timestamps to avoid trying to update them
      delete settingsData.id;
      delete settingsData.createdAt;
      delete settingsData.updatedAt;

      const settings = await storage.updateSystemSettings(settingsData);

      // Invalidate all related caches to ensure immediate updates across the site
      if (typeof (enhancedCache as any).invalidate === 'function') {
        (enhancedCache as any).invalidate(/^superadmin:settings/);
        (enhancedCache as any).invalidate(/^public:settings/);
        (enhancedCache as any).invalidate(/\/api\/superadmin\/settings/);
      }

      // Broadcast the update via Socket.IO for real-time frontend updates
      try {
        // Notify all clients about settings update via socket.io
        if (realtimeService && typeof (realtimeService as any).broadcastSettingsUpdate === 'function') {
          (realtimeService as any).broadcastSettingsUpdate(settings);
        }

        const rs = realtimeService as any;
        if (rs && typeof rs.broadcastSystemSettingsUpdate === 'function') {
          rs.broadcastSystemSettingsUpdate(settings);
        }

        realtimeService.emitTableChange('system_settings', 'UPDATE', settings, undefined, req.user!.id);
      } catch (ioError) {
        console.error('Error broadcasting settings update:', ioError);
      }

      // Log the settings change
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'settings_updated',
        entityType: 'system_settings',
        entityId: String(settings.id),
        reason: 'System settings updated by Super Admin',
      });

      res.json(settings);
    } catch (error) {
      console.error('Failed to update system settings:', error);
      res.status(500).json({
        message: 'Failed to update system settings',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ==================== PRINCIPAL DESIGNATION ROUTES ====================

  // GET /api/superadmin/principal — return current designated principal + all admin users for selection
  app.get('/api/superadmin/principal', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const [sysSettings] = await db.select().from(schema.systemSettings).limit(1);
      const designatedPrincipalId = (sysSettings as any)?.designatedPrincipalId || null;

      // Direct JOIN — no reliance on storage.getUser()
      const adminRows = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        })
        .from(schema.adminProfiles)
        .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
        .orderBy(schema.users.firstName);

      const admins = adminRows.map((row: any) => ({
        id: row.id,
        username: row.username,
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username,
      }));

      res.json({ designatedPrincipalId, admins });
    } catch (error: any) {
      console.error('[principal route] error:', error);
      res.status(500).json({ message: 'Failed to fetch principal settings', detail: error?.message });
    }
  });

  // PUT /api/superadmin/principal — set the designated principal
  app.put('/api/superadmin/principal', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const { designatedPrincipalId } = req.body;
      // Validate: must be an existing admin (or null to clear)
      if (designatedPrincipalId) {
        const [adminProfile] = await db
          .select({ userId: schema.adminProfiles.userId })
          .from(schema.adminProfiles)
          .where(eq(schema.adminProfiles.userId, designatedPrincipalId))
          .limit(1);
        if (!adminProfile) return res.status(400).json({ message: 'Selected user is not an admin' });
      }
      await storage.updateSystemSettings({ designatedPrincipalId: designatedPrincipalId || null } as any);
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'principal_designated',
        entityType: 'system_settings',
        entityId: designatedPrincipalId || 'none',
        reason: `Principal designation updated by Super Admin`,
      });
      res.json({ success: true, designatedPrincipalId: designatedPrincipalId || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update principal designation' });
    }
  });

  // ==================== SCHOOL LEADERSHIP ROUTES (Admin + Super Admin) ====================

  // GET /api/leadership/principal — current designation + all admins with signature info
  app.get('/api/leadership/principal', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const [sysSettings] = await db.select().from(schema.systemSettings).limit(1);
      const designatedPrincipalId = (sysSettings as any)?.designatedPrincipalId || null;

      const adminRows = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          signatureUrl: schema.adminProfiles.signatureUrl,
        })
        .from(schema.adminProfiles)
        .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
        .orderBy(schema.users.firstName);

      const admins = adminRows.map((row: any) => ({
        id: row.id,
        username: row.username,
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username,
        signatureUrl: row.signatureUrl || null,
        hasSignature: !!(row.signatureUrl && row.signatureUrl.trim()),
      }));

      const currentPrincipal = designatedPrincipalId
        ? (admins.find((a: any) => a.id === designatedPrincipalId) ?? null)
        : null;

      res.json({ designatedPrincipalId, admins, currentPrincipal });
    } catch (error: any) {
      console.error('[leadership/principal GET] error:', error);
      res.status(500).json({ message: 'Failed to fetch leadership settings' });
    }
  });

  // PUT /api/leadership/principal — assign or clear the designated principal
  app.put('/api/leadership/principal', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { designatedPrincipalId } = req.body;
      if (designatedPrincipalId) {
        const [adminProfile] = await db
          .select({ userId: schema.adminProfiles.userId })
          .from(schema.adminProfiles)
          .where(eq(schema.adminProfiles.userId, designatedPrincipalId))
          .limit(1);
        if (!adminProfile) return res.status(400).json({ message: 'Selected user is not a school admin' });
      }
      await storage.updateSystemSettings({ designatedPrincipalId: designatedPrincipalId || null } as any);
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'principal_designated',
        entityType: 'system_settings',
        entityId: designatedPrincipalId || 'none',
        reason: `Principal designation updated by ${(req.user as any)?.role || 'admin'}`,
      });
      res.json({ success: true, designatedPrincipalId: designatedPrincipalId || null });
    } catch (error: any) {
      console.error('[leadership/principal PUT] error:', error);
      res.status(500).json({ message: error.message || 'Failed to update principal designation' });
    }
  });

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

  // ==================== END SUPER ADMIN ROUTES ====================

}
