/**
 * Homepage Module Routes
 *
 * Owns the public-website content domain (extracted from routes/homepage.routes.ts):
 *   Homepage content (hero/featured/about/slider images):
 *     POST /api/upload/homepage-deprecated — legacy image upload (use /api/upload)
 *     GET  /api/homepage-content           — admin list (filterable by contentType)
 *     GET  /api/homepage-content/all       — admin list, everything
 *     PUT  /api/homepage-content/:id       — admin update
 *     DELETE /api/homepage-content/:id     — admin delete (removes file too)
 *     GET  /api/public/homepage-content    — public list (5-min cache)
 *     GET  /api/homepage-content/:contentType — public list by type
 *   Homepage sections (draft/publish workflow):
 *     GET  /api/public/homepage-sections   — public enabled sections
 *     GET  /api/homepage-sections          — admin list
 *     PUT  /api/homepage-sections/:sectionKey — admin upsert (draft or publish)
 *     PUT  /api/homepage-sections-order    — admin batch reorder
 *   Announcements:
 *     GET    /api/announcements            — public published only
 *     GET    /api/admin/announcements      — admin/teacher list (+drafts opt-in)
 *     POST   /api/announcements            — admin/teacher create
 *     PUT    /api/announcements/:id        — admin/teacher update
 *     DELETE /api/announcements/:id        — admin/teacher delete
 *
 * NOTE: route order matters — /api/homepage-content/all is registered before
 * /api/homepage-content/:contentType so "all" isn't captured as a contentType.
 */

import { Router } from 'express';
import { upload } from '../../routes/upload-config';
import { PerformanceCache, performanceCache } from '../../performance-cache';
import { realtimeService } from '../../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../../routes/middleware';
import { storage } from '../../storage';
import { uploadFileToStorage } from '../../upload-service';

const router = Router();
export default router;

// ==================== HOMEPAGE CONTENT MANAGEMENT ROUTES ====================

// Homepage image upload endpoint (using organized storage system) - DEPRECATED: Use /api/upload instead
router.post('/api/upload/homepage-deprecated', authenticateUser, authorizeRoles(ROLES.ADMIN), upload.single('homePageImage'), async (req, res) => {
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
router.get('/api/homepage-content', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { contentType } = req.query;
    const content = await storage.getHomePageContent(contentType as string);
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get homepage content' });
  }
});

// Update homepage content
router.put('/api/homepage-content/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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
router.delete('/api/homepage-content/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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
router.get('/api/public/homepage-sections', async (req, res) => {
  try {
    const sections = await storage.getHomepageSections();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get homepage sections' });
  }
});

// Admin: get all homepage sections (authenticated)
router.get('/api/homepage-sections', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const sections = await storage.getHomepageSections();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get homepage sections' });
  }
});

// Admin: upsert a homepage section (supports draft/publish workflow)
router.put('/api/homepage-sections/:sectionKey', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
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
router.put('/api/homepage-sections-order', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { sections } = req.body as { sections: { sectionKey: string; displayOrder: number }[] };
    await storage.updateHomepageSectionsOrder(sections);
    res.json({ message: 'Section order updated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update order' });
  }
});

// Admin: get all homepage content (both admin-owned and active)
router.get('/api/homepage-content/all', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const content = await storage.getHomePageContent();
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get homepage content' });
  }
});

// ─── End Homepage Sections API ────────────────────────────────────────────

// Public endpoint to get all active homepage content (no auth required)
router.get('/api/public/homepage-content', async (req, res) => {
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
router.get('/api/homepage-content/:contentType', async (req, res) => {
  try {
    const { contentType } = req.params;
    const content = await storage.getHomePageContent(contentType);
    res.json(content);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get homepage content' });
  }
});

// Public endpoint to get announcements (only published)
router.get('/api/announcements', async (req, res) => {
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
router.get('/api/admin/announcements', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
  try {
    const { targetRole, includeDrafts } = req.query;
    const announcements = await storage.getAnnouncements(targetRole as string, includeDrafts === 'true');
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcements' });
  }
});

// Create a new announcement
router.post('/api/announcements', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
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
router.put('/api/announcements/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
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
router.delete('/api/announcements/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
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
