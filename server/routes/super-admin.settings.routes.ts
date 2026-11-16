/** Super admin — public settings, logs, platform settings, branding upload.
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


export function registerSuperAdminSettingsRoutes(app: Express) {

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
}
