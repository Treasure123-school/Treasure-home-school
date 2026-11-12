/** Auto-split from routes.ts — unified-subject-assignments (orig lines 14003-14174). See git history. */
import * as schema from '@shared/schema.pg';
import { invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { invalidateSubjectMappingsAndSync } from '../routes/upload-config';
import { SubjectAssignmentService } from '../services/subject-assignment-service';
import { storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerUnifiedSubjectAssignmentsRoutes(app: Express) {
  // ==================== UNIFIED SUBJECT ASSIGNMENT ROUTES ====================
  // Single source of truth for all subject visibility across the system

  // Get all subject assignments (for the unified configuration page)
  app.get('/api/unified-subject-assignments', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const allMappings = await storage.getAllClassSubjectMappings();
      res.json(allMappings);
    } catch (error: any) {
      console.error('Error fetching unified subject assignments:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch subject assignments' });
    }
  });

  // Bulk update subject assignments (additions and removals)
  app.put('/api/unified-subject-assignments', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { additions, removals } = req.body;

      // Validate input
      if (!Array.isArray(additions) && !Array.isArray(removals)) {
        return res.status(400).json({ message: 'additions and/or removals arrays are required' });
      }

      // Use the bulk update method for atomic operation
      const result = await storage.bulkUpdateClassSubjectMappings(
        additions || [],
        removals || []
      );

      // CRITICAL: Use shared helper for comprehensive cache invalidation, sync, and cleanup
      // FIX: Explicitly set addMissingSubjects when subjects are added to ensure report cards are updated
      const syncResult = await invalidateSubjectMappingsAndSync(
        result.affectedClassIds,
        { cleanupReportCards: result.removed > 0, addMissingSubjects: result.added > 0 }
      );
      console.log(`[UNIFIED-SUBJECT-ASSIGNMENT] Updated: ${result.added} added, ${result.removed} removed, ${result.affectedClassIds.length} classes affected`);

      // Emit websocket event for real-time propagation to all connected clients
      const socketIO = realtimeService.getIO();
      if (socketIO && result.affectedClassIds.length > 0) {
        socketIO.emit('subject-assignments-updated', {
          eventType: 'subject-assignments-updated',
          affectedClassIds: result.affectedClassIds,
          added: result.added,
          removed: result.removed,
          studentsSynced: syncResult.studentsSynced,
          reportCardItemsRemoved: syncResult.reportCardItemsRemoved,
          reportCardItemsAdded: syncResult.reportCardItemsAdded,
          timestamp: new Date().toISOString()
        });
        console.log(`[UNIFIED-SUBJECT-ASSIGNMENT] Emitted websocket event to all clients`);
      }

      res.json({
        message: 'Subject assignments updated successfully',
        added: result.added,
        removed: result.removed,
        affectedClasses: result.affectedClassIds.length,
        studentsSynced: syncResult.studentsSynced,
        reportCardItemsRemoved: syncResult.reportCardItemsRemoved,
        reportCardItemsAdded: syncResult.reportCardItemsAdded,
        syncErrors: syncResult.syncErrors.length > 0 ? syncResult.syncErrors : undefined
      });
    } catch (error: any) {
      console.error('Error updating unified subject assignments:', error);
      res.status(500).json({ message: error.message || 'Failed to update subject assignments' });
    }
  });

  // Get subject visibility for a specific class (used by exam creation, report cards, etc.)
  app.get('/api/subject-visibility/:classId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { department } = req.query;

      const mappings = await storage.getClassSubjectMappings(
        Number(classId),
        department as string | undefined
      );

      // Get full subject details for each mapping
      const subjectIds = mappings.map(m => m.subjectId);
      const subjects = await Promise.all(
        subjectIds.map(id => storage.getSubject(id))
      );

      const visibleSubjects = subjects.filter(Boolean).map((subject, index) => ({
        ...subject,
        isCompulsory: mappings[index]?.isCompulsory || false,
        department: mappings[index]?.department
      }));

      res.json(visibleSubjects);
    } catch (error: any) {
      console.error('Error fetching subject visibility:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch subject visibility' });
    }
  });

  // Get subjects by category (general, science, art, commercial)
  app.get('/api/subjects/by-category/:category', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { category } = req.params;

      const subjects = await storage.getSubjectsByCategory(category);

      res.json(subjects);
    } catch (error: any) {
      console.error('Error fetching subjects by category:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch subjects' });
    }
  });

  // ADMIN: Sync all students with class_subject_mappings
  // Use this to fix existing students who have incorrect subject assignments
  app.post('/api/admin/sync-all-student-subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      console.log('[ADMIN-SYNC] Starting full sync of all students with class_subject_mappings...');

      const result = await storage.syncAllStudentsWithMappings();

      // Also cleanup report cards after syncing
      const cleanupResult = await storage.cleanupAllReportCards();

      // Invalidate all visibility caches
      invalidateVisibilityCache({ all: true });
      SubjectAssignmentService.invalidateAllCaches();

      console.log(`[ADMIN-SYNC] Completed: ${result.synced} students synced, ${cleanupResult.itemsRemoved} report card items removed, ${result.errors.length} errors`);

      res.json({
        message: 'Student subject sync completed',
        studentsSynced: result.synced,
        reportCardItemsRemoved: cleanupResult.itemsRemoved,
        errors: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
        totalErrors: result.errors.length
      });
    } catch (error: any) {
      console.error('[ADMIN-SYNC] Error syncing students:', error);
      res.status(500).json({ message: error.message || 'Failed to sync students' });
    }
  });

  // ADMIN: Cleanup report cards - remove items for subjects no longer in class_subject_mappings
  // Use this to fix existing report cards that have extra subjects
  app.post('/api/admin/cleanup-report-cards', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      console.log('[ADMIN-CLEANUP] Starting report card cleanup...');

      const result = await storage.cleanupAllReportCards();

      console.log(`[ADMIN-CLEANUP] Completed: ${result.itemsRemoved} items removed from ${result.studentsProcessed} students`);

      res.json({
        message: 'Report card cleanup completed',
        studentsProcessed: result.studentsProcessed,
        itemsRemoved: result.itemsRemoved,
        errors: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
        totalErrors: result.errors.length
      });
    } catch (error: any) {
      console.error('[ADMIN-CLEANUP] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to cleanup report cards' });
    }
  });

  // NOTE: repair-profile-completion, repair-report-cards, report-cards/generate-missing,
  // sync-all-missing-exam-scores, and force-resync-all-exams are now in
  // server/routes/maintenance.routes.ts (mounted above). They have an 8-minute
  // per-route timeout and the force-resync uses bulk SQL instead of a serial N+1 loop.

}
