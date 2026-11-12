/** Auto-split from routes.ts — homepage (orig lines 6353-7377). See git history. */
import * as schema from '@shared/schema.pg';
import { loginSchema, changePasswordSchema, loginAttempts, lockoutViolations, MAX_LOGIN_ATTEMPTS, RATE_LIMIT_WINDOW, LOCKOUT_VIOLATION_WINDOW, MAX_RATE_LIMIT_VIOLATIONS, BCRYPT_ROUNDS } from '../routes/upload-config';
import { upload } from '../routes/upload-config';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { JWT_EXPIRES_IN, ROLES, SECRET_KEY, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and } from 'drizzle-orm';
import { type Express, type Request } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import { ZodError, z } from 'zod';

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

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);

      // Rate limiting to prevent brute force attacks
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const attemptKey = `${clientIp}:${identifier || 'no-identifier'}`;
      const now = Date.now();

      // Clean up old attempts
      for (const [key, data] of Array.from(loginAttempts.entries())) {
        if (now - data.lastAttempt > RATE_LIMIT_WINDOW) {
          loginAttempts.delete(key);
        }
      }

      // Check rate limit - Message 12: Account Temporarily Locked (show once, then suspension message)
      const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };
      if (attempts.count >= MAX_LOGIN_ATTEMPTS && (now - attempts.lastAttempt) < RATE_LIMIT_WINDOW) {

        // Track violation for account lockout with timestamp
        if (identifier) {
          // Clean up expired violations
          const violationData = lockoutViolations.get(identifier) || { count: 0, timestamps: [] };
          const recentViolations = violationData.timestamps.filter((ts: number) => now - ts < LOCKOUT_VIOLATION_WINDOW);

          // Add current violation
          recentViolations.push(now);
          lockoutViolations.set(identifier, { count: recentViolations.length, timestamps: recentViolations });

          // Suspend account after threshold violations within the window
          if (recentViolations.length >= MAX_RATE_LIMIT_VIOLATIONS) {
            try {
              // Find and suspend the user
              let userToSuspend;
              if (identifier.includes('@')) {
                userToSuspend = await storage.getUserByEmail(identifier);
              } else {
                userToSuspend = await storage.getUserByUsername(identifier);
              }
              if (userToSuspend && userToSuspend.status !== 'suspended') {
                await storage.updateUserStatus(userToSuspend.id, 'suspended', 'system', `Automatic suspension due to ${recentViolations.length} rate limit violations within 1 hour`);
                lockoutViolations.delete(identifier); // Clear violations after suspension

                // Get user role to provide appropriate message - SHOW DETAILED SUSPENSION MESSAGE
                const userRoleForSuspension = await storage.getRole(userToSuspend.roleId);
                const roleNameForSuspension = userRoleForSuspension?.name?.toLowerCase();
                const isStaffForSuspension = roleNameForSuspension === 'admin' || roleNameForSuspension === 'teacher';
                const isParentForSuspension = roleNameForSuspension === 'parent';

                if (isStaffForSuspension) {
                  return res.status(403).json({
                    message: "Account Suspended",
                    description: "Access denied. Your account has been suspended by the school administrator due to security concerns.",
                    statusType: "suspended_staff"
                  });
                } else if (isParentForSuspension) {
                  // Detailed message for suspended parent accounts
                  return res.status(403).json({
                    message: "Account Suspended - Security Alert",
                    description: "Your parent account has been automatically suspended due to multiple failed login attempts. This security measure protects your child's information from unauthorized access.\n\n📞 To Restore Your Account:\nContact School Administrator:\n📧 Email: treasurehomeschool@gmail.com\n📞 Call: School office during working hours\n\n💡 Have your child's information ready for verification.",
                    statusType: "suspended_parent"
                  });
                } else {
                  return res.status(403).json({
                    message: "Account Suspended",
                    description: "Your account has been suspended. Please contact your class teacher or the school administrator to resolve this issue.",
                    statusType: "suspended_student"
                  });
                }
              }
            } catch (err) {
            }
          }
        }
        // Show "temporarily locked" message ONLY on first rate limit hit (when violations < 3)
        const currentViolations = lockoutViolations.get(identifier);
        if (currentViolations && currentViolations.count < MAX_RATE_LIMIT_VIOLATIONS) {
          return res.status(429).json({
            message: "Account Temporarily Locked",
            description: "Too many failed login attempts. Your account has been temporarily locked for security reasons. Please wait 15 minutes before trying again, or use 'Forgot Password' to reset.",
            statusType: "rate_limited"
          });
        }
        // After suspension threshold reached, show nothing here - let the actual suspension check handle it
        // This allows the user to see their account is actually suspended with proper message
      }
      // Try to find user by email or username FIRST to check suspension
      let user;
      if (identifier.includes('@')) {
        // Looks like an email
        user = await storage.getUserByEmail(identifier);
      } else {
        // Try username first
        user = await storage.getUserByUsername(identifier);
        // Fallback to email if username not found
        if (!user) {
          user = await storage.getUserByEmail(identifier);
        }
      }

      if (!user) {
        // Increment attempt counter only after confirming user doesn't exist
        loginAttempts.set(attemptKey, {
          count: attempts.count + 1,
          lastAttempt: now
        });

        return res.status(401).json({
          message: "Invalid username or password. Please check your credentials and try again.",
          hint: "Make sure CAPS LOCK is off and you're using the correct username and password."
        });
      }
      // 🔧 DEBUG: Log profile status for troubleshooting (dev only)
      // Get user role for various checks
      const userRole = await storage.getRole(user.roleId);
      const roleName = userRole?.name?.toLowerCase();
      const isStaffAccount = roleName === 'admin' || roleName === 'teacher';

      // SECURITY CHECK: Block suspended accounts BEFORE incrementing attempts
      // This shows the detailed suspension message on all subsequent login attempts
      if (user.status === 'suspended') {

        if (isStaffAccount) {
          // Message 9: Staff Account Suspended
          return res.status(403).json({
            message: "Account Suspended",
            description: "Access denied. Your account has been suspended by the school administrator due to security concerns. Please contact the school administrator to resolve this issue.",
            statusType: "suspended_staff"
          });
        } else if (roleName === 'parent') {
          // Detailed message for suspended parent accounts - shown on every attempt after suspension
          return res.status(403).json({
            message: "Account Suspended - Security Alert",
            description: "Your parent account has been automatically suspended due to multiple failed login attempts. This security measure protects your child's information from unauthorized access.\n\n📞 To Restore Your Account:\nContact School Administrator:\n📧 Email: treasurehomeschool@gmail.com\n📞 Call: School office during working hours\n\n💡 Have your child's information ready for verification.",
            statusType: "suspended_parent"
          });
        } else {
          // Message 10: Student Account Suspended
          return res.status(403).json({
            message: "Account Suspended",
            description: "Your account has been suspended. Please contact your class teacher or the school administrator to resolve this issue.",
            statusType: "suspended_student"
          });
        }
      }

      // Now increment attempt counter for valid users who aren't suspended
      loginAttempts.set(attemptKey, {
        count: attempts.count + 1,
        lastAttempt: now
      });

      // SECURITY CHECK: Block pending accounts - Message 4 & 5
      if (user.status === 'pending') {

        if (isStaffAccount) {
          // Message 4: Admin/Teacher Pending Approval
          return res.status(403).json({
            message: "Account Pending Approval",
            description: "Your Admin/Teacher account has been created and is awaiting approval by the school administrator. You will be notified via email once your account is verified. For urgent access needs, please contact the school administrator.",
            statusType: "pending_staff"
          });
        } else {
          // Message 5: Student/Parent Pending Setup
          return res.status(403).json({
            message: "Account Pending Setup",
            description: "Your account is being set up by the school administrator. You will receive a notification once your account is ready. Please check back soon.",
            statusType: "pending_setup"
          });
        }
      }

      // SECURITY CHECK: Block disabled accounts - Message 11
      if (user.status === 'disabled') {
        return res.status(403).json({
          message: "Account Disabled",
          description: "Your account has been disabled and is no longer active. Please contact the school administrator if you believe this is an error.",
          statusType: "disabled"
        });
      }
      // STRICT ENFORCEMENT: Admin/Teacher with Google OAuth CANNOT use password login - Message 8
      if ((roleName === 'admin' || roleName === 'teacher') && user.authProvider === 'google') {
        return res.status(401).json({
          message: "Google Sign-In Required",
          description: "Admins and Teachers must sign in using their authorized Google account. Please click the 'Sign in with Google' button below to access your account.",
          statusType: "google_required"
        });
      }
      // CRITICAL: Verify password hash with bcrypt
      if (!user.passwordHash) {
        // If user is admin/teacher without password but with Google, direct them to Google login
        if ((roleName === 'admin' || roleName === 'teacher') && user.authProvider === 'google') {
          return res.status(401).json({
            message: "Google Sign-In Required",
            description: "Please use Google Sign-In for admin/teacher accounts.",
            statusType: "google_required"
          });
        }
        return res.status(401).json({
          message: "Account Setup Incomplete",
          description: "Your account setup is incomplete. Please contact the school administrator for assistance.",
          statusType: "setup_incomplete"
        });
      }
      // Compare provided password with stored hash - Message 1 (Invalid Credentials)
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Invalid Credentials",
          description: "Invalid username or password. Please check your credentials and try again. Make sure CAPS LOCK is off and you're using the correct username and password.",
          statusType: "invalid_credentials"
        });
      }
      // Password verification successful - reset rate limit and clear lockout violations
      loginAttempts.delete(attemptKey);
      if (identifier) {
        lockoutViolations.delete(identifier);
      }

      // Collect authorized resource scopes for realtime subscriptions
      let authorizedClasses: string[] = [];
      let authorizedStudentIds: string[] = [];

      // For teachers: get their assigned classes
      if (roleName === 'teacher') {
        const teacherProfile = await storage.getTeacherProfile(user.id);
        if (teacherProfile?.assignedClasses) {
          try {
            const parsed = typeof teacherProfile.assignedClasses === 'string'
              ? JSON.parse(teacherProfile.assignedClasses)
              : teacherProfile.assignedClasses;
            if (Array.isArray(parsed)) {
              authorizedClasses = parsed.map((c: any) => String(c));
            }
          } catch {
            authorizedClasses = [];
          }
        }
      }

      // For students: get their own student ID
      if (roleName === 'student') {
        const student = await storage.getStudentByUserId(user.id);
        if (student) {
          authorizedStudentIds = [student.id.toString()];
          if (student.classId) {
            authorizedClasses = [student.classId.toString()];
          }
        }
      }

      // For parents: get their linked student IDs
      if (roleName === 'parent') {
        const linkedStudents = await storage.getLinkedStudents(user.id);
        if (linkedStudents && linkedStudents.length > 0) {
          authorizedStudentIds = linkedStudents.map(s => s.id.toString());
          authorizedClasses = linkedStudents
            .filter(s => s.classId)
            .map(s => s.classId!.toString());
        }
      }

      // Generate JWT token with user claims and resource scopes
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
        roleName: roleName,
        authorizedClasses: authorizedClasses,
        authorizedStudentIds: authorizedStudentIds,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });


      // Ensure mustChangePassword is included in the response
      res.json({
        token,
        mustChangePassword: user.mustChangePassword || false, // Include password change flag
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          profileImageUrl: user.profileImageUrl,
          mustChangePassword: user.mustChangePassword || false, // Also include in user object
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid identifier or password format" });
      }
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  // Password change endpoint
  app.post("/api/auth/change-password", authenticateUser, async (req, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const userId = req.user!.id;

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ message: "User not found" });
      }
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // Update password and clear mustChangePassword flag
      await storage.updateUser(userId, {
        passwordHash: newPasswordHash,
        mustChangePassword: false
      });


      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid password format" });
      }
      res.status(500).json({ message: "Password change failed. Please try again." });
    }
  });

  // Forgot password - Request reset token (ENHANCED WITH RATE LIMITING & EMAIL)
  app.post("/api/auth/forgot-password", async (req, res) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      const { identifier } = z.object({ identifier: z.string().min(1) }).parse(req.body);

      // RATE LIMITING: Check recent reset attempts (max 3 per hour per identifier)
      const recentAttempts = await storage.getRecentPasswordResetAttempts(identifier, 60);

      if (recentAttempts.length >= 3) {
        console.log(`🚨 Rate limit exceeded for password reset: ${identifier} from IP ${ipAddress}`);

        // Track failed attempt
        await storage.createPasswordResetAttempt(identifier, ipAddress, false);

        // Check for suspicious activity (5+ attempts in 60 min = lock account temporarily)
        const suspiciousAttempts = await storage.getRecentPasswordResetAttempts(identifier, 60);
        if (suspiciousAttempts.length >= 5) {
          const user = await storage.getUserByEmail(identifier) || await storage.getUserByUsername(identifier);
          if (user) {
            const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
            await storage.lockAccount(user.id, lockUntil);
            console.log(`🔒 Account temporarily locked due to suspicious password reset activity: ${user.id}`);

            // Create audit log
            await storage.createAuditLog({
              userId: user.id,
              action: 'account_locked_suspicious_activity',
              entityType: 'user',
              entityId: '0',
              oldValue: null,
              newValue: JSON.stringify({ reason: 'Excessive password reset attempts', lockUntil }),
              reason: 'Suspicious password reset activity detected',
              ipAddress,
              userAgent: req.headers['user-agent'] || null,
            });
          }
        }

        return res.status(429).json({
          message: "Too many password reset attempts. Please try again later."
        });
      }
      // Find user by email or username
      let user = await storage.getUserByEmail(identifier);
      if (!user) {
        user = await storage.getUserByUsername(identifier);
      }
      // Track attempt
      await storage.createPasswordResetAttempt(identifier, ipAddress, !!user);

      // Don't reveal if user exists or not (security best practice)
      if (!user) {
        return res.json({
          message: "If an account exists with that email/username, a password reset link will be sent."
        });
      }
      // Check if account is locked
      const isLocked = await storage.isAccountLocked(user.id);
      if (isLocked) {
        return res.status(423).json({
          message: "Your account is temporarily locked. Please contact the administrator or try again later."
        });
      }
      // Generate secure random token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Token expires in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Save token to database with IP tracking
      await storage.createPasswordResetToken(user.id, resetToken, expiresAt, ipAddress);

      // Get recovery email (fallback to primary email if not set)
      const recoveryEmail = user.recoveryEmail || user.email;

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: 'password_reset_requested',
        entityType: 'user',
        entityId: '0',
        newValue: JSON.stringify({ requestedAt: new Date(), ipAddress }),
        reason: 'User requested password reset',
        ipAddress,
        userAgent: req.headers['user-agent'] || null,
      });

      // Send email with reset link
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

      // Import email service
      const { sendEmail, getPasswordResetEmailHTML } = await import('../email-service');

      // Send email with HTML template
      const emailSent = await sendEmail({
        to: recoveryEmail,
        subject: 'THS Portal - Password Reset Request',
        html: getPasswordResetEmailHTML(`${user.firstName} ${user.lastName}`, resetLink)
      });

      if (!emailSent && process.env.NODE_ENV === 'production') {
        console.log(`❌ Failed to send password reset email to ${recoveryEmail}`);
        return res.status(500).json({
          message: "Failed to send password reset email. Please try again later or contact administrator."
        });
      }
      // In development without API key, show the reset code/token for testing
      if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
        console.log(`📧 DEV MODE - Password Reset Token: ${resetToken}`);
        console.log(`📧 DEV MODE - Reset Link: ${resetLink}`);

        return res.json({
          message: "Password reset code generated (Development Mode).",
          developmentMode: true,
          resetToken: resetToken, // The actual code
          resetLink: resetLink,
          email: recoveryEmail,
          expiresIn: "15 minutes",
          instructions: "Use the resetToken as your reset code, or click the resetLink"
        });
      }
      console.log(`✅ Password reset email sent to ${recoveryEmail} for user ${user.id}`);

      res.json({
        message: "If an account exists with that email/username, a password reset link will be sent."
      });
    } catch (error) {

      // Track failed attempt
      try {
        const { identifier } = req.body;
        if (identifier) {
          await storage.createPasswordResetAttempt(identifier, ipAddress, false);
        }
      } catch (trackError) {
      }
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password with token (ENHANCED WITH NOTIFICATIONS & AUDIT)
  app.post("/api/auth/reset-password", async (req, res) => {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    try {
      const { token, newPassword } = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8).max(100)
          .refine(pwd => /[A-Z]/.test(pwd), "Must contain at least one uppercase letter")
          .refine(pwd => /[a-z]/.test(pwd), "Must contain at least one lowercase letter")
          .refine(pwd => /[0-9]/.test(pwd), "Must contain at least one number")
          .refine(pwd => /[!@#$%^&*]/.test(pwd), "Must contain at least one special character (!@#$%^&*)")
      }).parse(req.body);

      // Verify token exists and is valid
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      // Get user details for notification
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // Update user password
      await storage.updateUser(resetToken.userId, {
        passwordHash: newPasswordHash,
        mustChangePassword: false
      });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);

      // Create audit log
      await storage.createAuditLog({
        userId: resetToken.userId,
        action: 'password_reset_completed',
        entityType: 'user',
        entityId: '0',
        newValue: JSON.stringify({ completedAt: new Date(), ipAddress }),
        reason: 'Password was successfully reset via reset token',
        ipAddress,
        userAgent: req.headers['user-agent'] || null,
      });

      // Send notification email to user
      const recoveryEmail = user.recoveryEmail || user.email;
      const { sendEmail, getPasswordChangedEmailHTML } = await import('../email-service');

      await sendEmail({
        to: recoveryEmail,
        subject: 'THS Portal - Password Changed',
        html: getPasswordChangedEmailHTML(`${user.firstName} ${user.lastName}`, ipAddress)
      });

      console.log(`✅ Password reset successfully for user ${resetToken.userId} from IP ${ipAddress}`);
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
        });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

}
