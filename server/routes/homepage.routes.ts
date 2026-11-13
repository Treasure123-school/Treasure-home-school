/** Auto-split from routes.ts — homepage (orig lines 6353-7377). See git history. */
import * as schema from '@shared/schema.pg';
import { upload } from '../routes/upload-config';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { users } from '@shared/schema.pg';
import { randomUUID } from 'crypto';
import { and } from 'drizzle-orm';
import { type Express, type Request } from 'express';
import path from 'path';

export async function registerHomepageRoutes(app: Express) {
  // ==================== HOMEPAGE CONTENT MANAGEMENT ROUTES ====================

  // Homepage image upload endpoint (using organized storage system) - DEPRECATED: Use /api/upload instead
  app.post('/api/upload/homepage-deprecated', authenticateUser, authorizeRoles(ROLES.ADMIN), upload.single('homePageImage'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      if (!req.body.contentType) {
        return res.status(400).json({ message: 'Content type is required' });
      }

      // Determine category based on content type (hero, featured, about, slider)
      const category = req.body.contentType || 'general';

      // Use new organized upload system
      const result = await uploadFileToStorage(req.file, {
        uploadType: 'homepage',
        category,
        maxSizeMB: 5,
      });

      if (!result.success) {
        return res.status(500).json({
          message: result.error || 'Failed to upload homepage image'
        });
      }

      const content = await storage.createHomePageContent({
        contentType: req.body.contentType,
        imageUrl: result.url!,
        altText: req.body.altText || '',
        caption: req.body.caption || null,
        displayOrder: parseInt(req.body.displayOrder) || 0,
        isActive: true,
      });

      // Emit realtime event for homepage content creation
      realtimeService.emitHomepageContentEvent('created', content, req.user!.id);

      res.json(content);
    } catch (error: any) {
      res.status(500).json({
        message: error.message || 'Failed to upload homepage image',
        error: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      });
    }
  });

  // Get all homepage content
  app.get('/api/homepage-content', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { contentType } = req.query;
      const content = await storage.getHomePageContent(contentType as string);
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage content' });
    }
  });

  // Update homepage content
  app.put('/api/homepage-content/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { altText, caption, displayOrder, isActive } = req.body;

      const updated = await storage.updateHomePageContent(id, {
        altText,
        caption,
        displayOrder,
        isActive
      });

      if (!updated) {
        return res.status(404).json({ message: 'Homepage content not found' });
      }

      // Emit realtime event for homepage content update
      realtimeService.emitHomepageContentEvent('updated', updated, req.user!.id);

      res.json({
        message: 'Homepage content updated successfully',
        content: updated
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update homepage content' });
    }
  });

  // Delete homepage content (file deletion now handled in storage.deleteHomePageContent)
  app.delete('/api/homepage-content/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get the content first for the realtime event
      const contentList = await storage.getHomePageContent();
      const content = contentList.find((c: any) => c.id === id);

      if (!content) {
        return res.status(404).json({ message: 'Homepage content not found' });
      }

      // deleteHomePageContent now handles file deletion from Cloudinary/local storage
      const deleted = await storage.deleteHomePageContent(id);

      if (!deleted) {
        return res.status(404).json({ message: 'Homepage content not found' });
      }

      // Emit realtime event for homepage content deletion
      realtimeService.emitHomepageContentEvent('deleted', { ...content, id }, req.user!.id);

      res.json({ message: 'Homepage content deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete homepage content' });
    }
  });

  // ─── Homepage Sections API ────────────────────────────────────────────────

  // Public: get all enabled homepage sections (for public website)
  app.get('/api/public/homepage-sections', async (req, res) => {
    try {
      const sections = await storage.getHomepageSections();
      res.json(sections);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage sections' });
    }
  });

  // Admin: get all homepage sections (authenticated)
  app.get('/api/homepage-sections', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const sections = await storage.getHomepageSections();
      res.json(sections);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage sections' });
    }
  });

  // Admin: upsert a homepage section (supports draft/publish workflow)
  app.put('/api/homepage-sections/:sectionKey', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { sectionKey } = req.params;
      const { sectionTitle, isEnabled, displayOrder, content, draftContent, status } = req.body;
      const section = await storage.upsertHomepageSection(sectionKey, { sectionTitle, isEnabled, displayOrder, content, draftContent, status }, req.user!.id);
      res.json({ message: status === 'draft' ? 'Draft saved' : 'Section published successfully', section });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to save section' });
    }
  });

  // Admin: batch reorder homepage sections
  app.put('/api/homepage-sections-order', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { sections } = req.body as { sections: { sectionKey: string; displayOrder: number }[] };
      await storage.updateHomepageSectionsOrder(sections);
      res.json({ message: 'Section order updated' });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update order' });
    }
  });

  // Admin: get all homepage content (both admin-owned and active)
  app.get('/api/homepage-content/all', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const content = await storage.getHomePageContent();
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage content' });
    }
  });

  // ─── End Homepage Sections API ────────────────────────────────────────────

  // Public endpoint to get all active homepage content (no auth required)
  app.get('/api/public/homepage-content', async (req, res) => {
    try {
      // Use cache for homepage content (rarely changes, high read frequency)
      const content = await performanceCache.getOrSet(
        PerformanceCache.keys.homepageContent(),
        () => storage.getHomePageContent(),
        PerformanceCache.TTL.MEDIUM // 5 minute cache
      );
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage content' });
    }
  });

  // Public homepage content endpoint by type (no auth required for public website)
  app.get('/api/homepage-content/:contentType', async (req, res) => {
    try {
      const { contentType } = req.params;
      const content = await storage.getHomePageContent(contentType);
      res.json(content);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get homepage content' });
    }
  });

  // Public endpoint to get announcements (only published)
  app.get('/api/announcements', async (req, res) => {
    try {
      const { targetRole } = req.query;
      // Public view never includes drafts
      const announcements = await storage.getAnnouncements(targetRole as string, false);
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get announcements' });
    }
  });

  // Consolidated endpoint for fetching announcements
  app.get('/api/admin/announcements', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      const { targetRole, includeDrafts } = req.query;
      const announcements = await storage.getAnnouncements(targetRole as string, includeDrafts === 'true');
      res.json(announcements);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  // Create a new announcement
  app.post('/api/announcements', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      const { title, content, targetRoles, targetClasses, priority, announcementType, publishOption, scheduledAt, expiryDate, attachments, coverImageUrl, notificationSettings, allowComments, allowEdit, status, isPublished, publishedAt } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: 'Title and content are required' });
      }

      const announcementData = {
        title,
        content,
        authorId: req.user!.id,
        targetRoles: Array.isArray(targetRoles) ? JSON.stringify(targetRoles) : targetRoles || JSON.stringify(['All']),
        targetClasses: Array.isArray(targetClasses) ? JSON.stringify(targetClasses) : targetClasses || JSON.stringify([]),
        priority: priority || 'normal',
        announcementType: announcementType || 'general',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        attachments: Array.isArray(attachments) ? JSON.stringify(attachments) : attachments || JSON.stringify([]),
        coverImageUrl: coverImageUrl || null,
        notificationSettings: typeof notificationSettings === 'object' ? JSON.stringify(notificationSettings) : notificationSettings || JSON.stringify({ inApp: true, email: false, sms: false }),
        allowComments: allowComments ?? false,
        allowEdit: allowEdit ?? true,
        status: status || 'published',
        isPublished: isPublished ?? true,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        createdBy: req.user!.id,
        isActive: true
      };

      const newAnnouncement = await storage.createAnnouncement(announcementData);

      // Explicitly broadcast using the dedicated announcement event emitter
      realtimeService.emitAnnouncementEvent('created', newAnnouncement, req.user!.id);

      res.status(201).json(newAnnouncement);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create announcement' });
    }
  });

  // Update an announcement - Admin only
  app.put('/api/announcements/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      const announcementId = parseInt(req.params.id);

      if (isNaN(announcementId)) {
        return res.status(400).json({ message: 'Invalid announcement ID' });
      }

      const existingAnnouncement = await storage.getAnnouncementById(announcementId);
      if (!existingAnnouncement) {
        return res.status(404).json({ message: 'Announcement not found' });
      }

      const {
        title, content, targetRoles, targetClasses, priority,
        announcementType, scheduledAt, expiryDate, attachments,
        coverImageUrl, notificationSettings, allowComments, allowEdit,
        status, isPublished, publishedAt
      } = req.body;

      const updatedAnnouncement = await storage.updateAnnouncement(announcementId, {
        title,
        content,
        targetRoles: Array.isArray(targetRoles) ? JSON.stringify(targetRoles) : targetRoles,
        targetClasses: Array.isArray(targetClasses) ? JSON.stringify(targetClasses) : targetClasses,
        priority,
        announcementType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        attachments: Array.isArray(attachments) ? JSON.stringify(attachments) : attachments,
        coverImageUrl,
        notificationSettings: typeof notificationSettings === 'object' ? JSON.stringify(notificationSettings) : notificationSettings,
        allowComments,
        allowEdit,
        status,
        isPublished,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined
      });

      // Emit realtime event for announcement update
      realtimeService.emitAnnouncementEvent('updated', updatedAnnouncement, req.user!.id);

      res.json(updatedAnnouncement);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update announcement' });
    }
  });

  // Delete an announcement - Admin and Teacher (own only)
  app.delete('/api/announcements/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    try {
      const announcementId = parseInt(req.params.id);

      if (isNaN(announcementId)) {
        return res.status(400).json({ message: 'Invalid announcement ID' });
      }

      const existingAnnouncement = await storage.getAnnouncementById(announcementId);
      if (!existingAnnouncement) {
        return res.status(404).json({ message: 'Announcement not found' });
      }

      const success = await storage.deleteAnnouncement(announcementId);

      if (!success) {
        return res.status(500).json({ message: 'Failed to delete announcement' });
      }

      // Emit realtime event for announcement deletion
      if (existingAnnouncement) {
        realtimeService.emitAnnouncementEvent('deleted', { ...existingAnnouncement, id: announcementId }, req.user!.id);
      }

      res.json({ message: 'Announcement deleted successfully' });
    } catch (error: any) {
      console.error('[ANNOUNCEMENT-DELETE] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to delete announcement' });
    }
  });

  // Attendance routes are mounted above via attendanceRoutes router

  // Public file serving for homepage uploads (no auth required)
  app.get('/uploads/homepage/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.resolve('uploads', 'homepage', filename);

    // Security: Prevent path traversal attacks
    if (!filePath.startsWith(path.resolve('uploads', 'homepage'))) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: "File not found" });
      }
    });
  });

  // Secure file serving for other uploads - require authentication
  app.get('/uploads/:filename', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), (req, res) => {
    const { filename } = req.params;
    const filePath = path.resolve('uploads', filename);

    // Security: Prevent path traversal attacks
    if (!filePath.startsWith(path.resolve('uploads'))) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: "File not found" });
      }
    });
  });

  // Setup/Demo data route (for development) - Admin only for security
  app.post("/api/setup-demo", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      // Seed roles if none exist
      const existingRoles = await storage.getRoles();
      if (existingRoles.length === 0) {
        console.log('📦 Seeding roles for development...');
        const roleNames = ['Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'];
        for (const name of roleNames) {
          await db.insert(schema.roles).values({ name, permissions: '[]' });
        }
      }

      // First check if roles exist, if not this will tell us about database structure
      try {
        const existingRoles = await storage.getRoles();

        // If no roles, we can't proceed without proper role creation method
        // For now, let's just log what we found and return a helpful message
        if (existingRoles.length === 0) {
          return res.json({
            message: "No roles found. Database tables may need to be created first.",
            rolesCount: 0
          });
        }
        // Try to create demo users if roles exist
        const demoUsers = [
          {
            email: 'student@demo.com',
            firstName: 'John',
            lastName: 'Doe',
            roleId: existingRoles.find(r => r.name === 'Student')?.id || existingRoles[0].id,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: Demo users start with incomplete profile
          },
          {
            email: 'teacher@demo.com',
            firstName: 'Jane',
            lastName: 'Smith',
            roleId: existingRoles.find(r => r.name === 'Teacher')?.id || existingRoles[0].id,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: Demo users start with incomplete profile
          },
          {
            email: 'parent@demo.com',
            firstName: 'Bob',
            lastName: 'Johnson',
            roleId: existingRoles.find(r => r.name === 'Parent')?.id || existingRoles[0].id,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: Demo users start with incomplete profile
          },
          {
            email: 'admin@demo.com',
            firstName: 'Admin',
            lastName: 'User',
            roleId: existingRoles.find(r => r.name === 'Admin')?.id || existingRoles[0].id,
            profileCompleted: false, // 🔧 FIX: Explicitly set profile fields
            profileSkipped: false // 🔧 FIX: Demo users start with incomplete profile
          }
        ];

        let createdCount = 0;
        for (const userData of demoUsers) {
          try {
            // Check if user already exists
            const existingUser = await storage.getUserByEmail(userData.email);
            if (!existingUser) {
              // Generate UUID for demo user (required for PostgreSQL)
              const userId = randomUUID();
              await storage.createUser({ id: userId, ...userData } as any);
              createdCount++;
            } else {
            }
          } catch (userError) {
          }
        }

        res.json({
          message: "Demo setup completed",
          rolesCount: existingRoles.length,
          usersCreated: createdCount,
          roles: existingRoles.map(r => r.name)
        });

      } catch (dbError) {
        res.status(500).json({
          message: "Database connection failed",
          error: dbError instanceof Error ? dbError.message : "Unknown database error"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Setup failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
}
