/** Auto-split from routes.ts — subjects (orig lines 6019-6352). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { BCRYPT_ROUNDS } from '../routes/upload-config';
import { upload } from '../routes/upload-config';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { and } from 'drizzle-orm';

export async function registerSubjectsRoutes(app: Express) {
  app.get('/api/subjects/all', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res) => {
    try {
      const subjects = await performanceCache.getOrSet(
        PerformanceCache.keys.subjects(),
        () => storage.getSubjects(),
        PerformanceCache.TTL.MEDIUM
      );
      res.json(subjects);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch subjects' });
    }
  });

  // GET /api/subjects — returns only ACTIVE subjects (for all dropdowns and selectors)
  app.get('/api/subjects', async (req, res) => {
    try {
      const { category, department } = req.query;

      // Use cache for active subjects (excludes archived)
      let subjects = await performanceCache.getOrSet(
        PerformanceCache.keys.activeSubjects(),
        () => storage.getActiveSubjects(),
        PerformanceCache.TTL.MEDIUM
      );

      // Filter by category if provided (general, science, art, commercial)
      if (category && typeof category === 'string') {
        const normalizedCategory = category.trim().toLowerCase();
        subjects = subjects.filter((s: any) => (s.category || '').trim().toLowerCase() === normalizedCategory);
      }

      // Filter by department for senior secondary students
      if (department && typeof department === 'string') {
        const normalizedDept = department.trim().toLowerCase();
        const validDepartments = ['science', 'art', 'commercial'];
        if (validDepartments.includes(normalizedDept)) {
          subjects = subjects.filter((s: any) => {
            const subjectCategory = (s.category || '').trim().toLowerCase();
            return subjectCategory === 'general' || subjectCategory === normalizedDept;
          });
        }
      }

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch subjects' });
    }
  });

  // Create a new subject - Admin only
  app.post('/api/subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const { name, code, description, category } = req.body;

      if (!name || !code) {
        return res.status(400).json({ message: 'Name and code are required' });
      }

      // Validate category if provided
      const validCategories = ['general', 'science', 'art', 'commercial'];
      const normalizedCategory = category ? category.trim().toLowerCase() : 'general';
      if (!validCategories.includes(normalizedCategory)) {
        return res.status(400).json({ message: 'Invalid category. Must be one of: general, science, art, commercial' });
      }

      const subjectData = {
        name,
        code,
        description: description || null,
        category: normalizedCategory,
        isActive: true
      };

      const newSubject = await storage.createSubject(subjectData);

      // Invalidate subjects cache
      performanceCache.invalidate(PerformanceCache.keys.subjects());
      performanceCache.invalidate(PerformanceCache.keys.activeSubjects());

      // Emit realtime event for subject creation
      realtimeService.emitSubjectEvent('created', newSubject, req.user!.id);

      res.status(201).json(newSubject);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ message: 'A subject with this code already exists' });
      }
      res.status(500).json({ message: 'Failed to create subject' });
    }
  });

  // Update a subject - Admin only
  app.put('/api/subjects/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);

      if (isNaN(subjectId)) {
        return res.status(400).json({ message: 'Invalid subject ID' });
      }

      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) {
        return res.status(404).json({ message: 'Subject not found' });
      }

      const { name, code, description, category, isActive } = req.body;

      // Validate category if provided
      if (category !== undefined) {
        const validCategories = ['general', 'science', 'art', 'commercial'];
        const normalizedCategory = category ? category.trim().toLowerCase() : null;
        if (normalizedCategory && !validCategories.includes(normalizedCategory)) {
          return res.status(400).json({ message: 'Invalid category. Must be one of: general, science, art, commercial' });
        }
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category ? category.trim().toLowerCase() : null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedSubject = await storage.updateSubject(subjectId, updateData);

      // Invalidate subjects cache
      performanceCache.invalidate(PerformanceCache.keys.subjects());
      performanceCache.invalidate(PerformanceCache.keys.activeSubjects());

      // Emit realtime event for subject update
      realtimeService.emitSubjectEvent('updated', updatedSubject, req.user!.id);

      res.json(updatedSubject);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ message: 'A subject with this code already exists' });
      }
      res.status(500).json({ message: 'Failed to update subject' });
    }
  });

  // Audit a subject — returns linked record counts across all tables
  app.get('/api/subjects/:id/audit', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: 'Invalid subject ID' });
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: 'Subject not found' });
      const audit = await storage.getSubjectAudit(subjectId);
      res.json(audit);
    } catch (error: any) {
      console.error('[subjects.audit]', error?.message);
      res.status(500).json({ message: 'Failed to audit subject' });
    }
  });

  // Archive a subject — hides it from dropdowns but preserves all historical data
  app.patch('/api/subjects/:id/archive', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: 'Invalid subject ID' });
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: 'Subject not found' });
      if (subject.status === 'archived') return res.status(409).json({ message: 'Subject is already archived' });
      const updated = await storage.archiveSubject(subjectId, req.user!.id);
      performanceCache.invalidate(PerformanceCache.keys.subjects());
      performanceCache.invalidate(PerformanceCache.keys.activeSubjects());
      realtimeService.emitSubjectEvent('updated', updated, req.user!.id);
      res.json({ message: 'Subject archived successfully', subject: updated });
    } catch (error: any) {
      console.error('[subjects.archive]', error?.message);
      res.status(500).json({ message: 'Failed to archive subject' });
    }
  });

  // Restore an archived subject — makes it active and visible in dropdowns again
  app.patch('/api/subjects/:id/restore', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: 'Invalid subject ID' });
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: 'Subject not found' });
      if (subject.status !== 'archived') return res.status(409).json({ message: 'Subject is not archived' });
      const updated = await storage.restoreSubject(subjectId, req.user!.id);
      performanceCache.invalidate(PerformanceCache.keys.subjects());
      performanceCache.invalidate(PerformanceCache.keys.activeSubjects());
      realtimeService.emitSubjectEvent('updated', updated, req.user!.id);
      res.json({ message: 'Subject restored successfully', subject: updated });
    } catch (error: any) {
      console.error('[subjects.restore]', error?.message);
      res.status(500).json({ message: 'Failed to restore subject' });
    }
  });

  // Permanently delete a subject — only allowed when zero linked records exist
  app.delete('/api/subjects/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: 'Invalid subject ID' });

      const existingSubject = await storage.getSubject(subjectId);
      if (!existingSubject) return res.status(404).json({ message: 'Subject not found' });

      const success = await storage.deleteSubject(subjectId, req.user!.id);
      if (!success) return res.status(500).json({ message: 'Failed to delete subject' });

      performanceCache.invalidate(PerformanceCache.keys.subjects());
      performanceCache.invalidate(PerformanceCache.keys.activeSubjects());
      realtimeService.emitSubjectEvent('deleted', { ...existingSubject, id: subjectId }, req.user!.id);

      res.json({ message: 'Subject permanently deleted', id: subjectId });
    } catch (error: any) {
      if (error?.message === 'SUBJECT_HAS_LINKED_RECORDS') {
        return res.status(409).json({
          message: 'Deletion not allowed. This subject still has linked records. Remove, archive, or reassign the linked data before deleting.',
          code: 'SUBJECT_HAS_LINKED_RECORDS',
        });
      }
      console.error('[subjects.delete]', req.params.id, error?.message || error);
      res.status(500).json({ message: 'Failed to delete subject' });
    }
  });


  // Delete demo accounts - admin only
  app.post("/api/admin/delete-demo-accounts", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const demoEmails = ['admin@demo.com', 'teacher@demo.com', 'admin@treasure.com'];
      const deletedUsers = [];
      const errors = [];

      for (const email of demoEmails) {
        try {
          const user = await storage.getUserByEmail(email);
          if (user) {
            // Delete user (will cascade delete related records)
            await storage.deleteUser(user.id);
            deletedUsers.push(email);
          } else {
          }
        } catch (error) {
          errors.push(`${email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({
        message: `Deleted ${deletedUsers.length} demo accounts`,
        deletedUsers,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "Failed to delete demo accounts"
      });
    }
  });

  // Secure admin-only route to reset weak passwords
  app.post("/api/admin/reset-weak-passwords", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {

      // Get all users to check for weak passwords
      const allRoles = await storage.getRoles();
      let allUsers: any[] = [];
      for (const role of allRoles) {
        const roleUsers = await storage.getUsersByRole(role.id);
        allUsers.push(...roleUsers);
      }
      // Check users who might have the weak default password by attempting to verify against 'password123'
      const usersToUpdate = [];
      for (const user of allUsers) {
        if (user.passwordHash) {
          try {
            const hasWeakPassword = await bcrypt.compare('password123', user.passwordHash);
            if (hasWeakPassword) {
              usersToUpdate.push(user);
            }
          } catch (error) {
            // Skip users with invalid password hashes
          }
        }
      }

      if (usersToUpdate.length === 0) {
        return res.json({
          message: "No users found with weak passwords",
          updatedCount: 0
        });
      }
      // Generate strong unique passwords and update users
      const passwordUpdates = [];
      let updateCount = 0;

      for (const user of usersToUpdate) {
        try {
          // Generate a strong random password
          const strongPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + Math.floor(Math.random() * 100);
          const hashedPassword = await bcrypt.hash(strongPassword, BCRYPT_ROUNDS);

          // Update user with new password
          const updatedUser = await storage.updateUser(user.id, { passwordHash: hashedPassword });

          if (updatedUser) {
            passwordUpdates.push({
              email: user.email,
              name: `${user.firstName} ${user.lastName}`,
              newPassword: strongPassword
            });
            updateCount++;
          }
        } catch (error) {
        }
      }

      // Return results - Note: In production, consider more secure ways to communicate new passwords
      res.json({
        message: `Successfully updated ${updateCount} user passwords`,
        updatedCount: updateCount,
        warning: "Please securely communicate new passwords to users",
        passwordUpdates: passwordUpdates
      });

    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "Failed to reset passwords"
      });
    }
  });

  // NOTE: Profile image upload is handled by the centralized /api/upload route (line ~1013)
  // which uses upload.single('file') and saves profileImageUrl to the user record.

}
