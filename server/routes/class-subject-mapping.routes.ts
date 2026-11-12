/** Auto-split from routes.ts — class-subject-mapping (orig lines 13858-14002). See git history. */
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { invalidateSubjectMappingsAndSync } from '../routes/upload-config';
import { storage } from '../storage';
import { and } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerClassSubjectMappingRoutes(app: Express) {
  // ==================== CLASS SUBJECT MAPPING ROUTES ====================

  // Get subjects available for a class (with optional department filter)
  app.get('/api/classes/:classId/available-subjects', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { department } = req.query;

      // Get the class info
      const classInfo = await storage.getClass(Number(classId));
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }

      // Get subjects based on class level and department
      const subjects = await storage.getSubjectsForClassLevel(
        classInfo.level,
        department as string | undefined
      );

      res.json(subjects);
    } catch (error: any) {
      console.error('Error fetching available subjects:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch available subjects' });
    }
  });

  // Create class-subject mapping
  app.post('/api/class-subject-mappings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId, subjectId, department, isCompulsory } = req.body;

      if (!classId || !subjectId) {
        return res.status(400).json({ message: 'classId and subjectId are required' });
      }

      const mapping = await storage.createClassSubjectMapping({
        classId,
        subjectId,
        department: department || null,
        isCompulsory: isCompulsory || false
      });

      // CRITICAL: Use shared helper for comprehensive cache invalidation and sync
      // FIX: Explicitly set addMissingSubjects: true to ensure new mappings are added to existing report cards
      const syncResult = await invalidateSubjectMappingsAndSync([classId], { cleanupReportCards: false, addMissingSubjects: true });
      console.log(`[CLASS-SUBJECT-MAPPING] Created mapping for class ${classId}`);

      // Emit websocket event for real-time UI propagation
      const socketIO = realtimeService.getIO();
      if (socketIO) {
        socketIO.emit('subject-assignments-updated', {
          eventType: 'subject-assignments-updated',
          affectedClassIds: [classId],
          added: 1,
          removed: 0,
          studentsSynced: syncResult.studentsSynced,
          timestamp: new Date().toISOString()
        });
      }

      res.status(201).json(mapping);
    } catch (error: any) {
      console.error('Error creating class-subject mapping:', error);
      res.status(500).json({ message: error.message || 'Failed to create mapping' });
    }
  });

  // Get class-subject mappings
  app.get('/api/class-subject-mappings/:classId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { department } = req.query;

      const mappings = await storage.getClassSubjectMappings(
        Number(classId),
        department as string | undefined
      );

      // Enrich with subject details
      const enrichedMappings = await Promise.all(mappings.map(async (mapping) => {
        const subject = await storage.getSubject(mapping.subjectId);
        return {
          ...mapping,
          subjectName: subject?.name,
          subjectCode: subject?.code,
          category: subject?.category
        };
      }));

      res.json(enrichedMappings);
    } catch (error: any) {
      console.error('Error fetching class-subject mappings:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch mappings' });
    }
  });

  // Delete class-subject mapping
  app.delete('/api/class-subject-mappings/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get the mapping first to know the classId for cache invalidation
      const mappingToDelete = await storage.getClassSubjectMappingById(Number(id));

      if (!mappingToDelete) {
        return res.status(404).json({ message: 'Mapping not found' });
      }

      const classId = mappingToDelete.classId;
      const success = await storage.deleteClassSubjectMapping(Number(id));

      if (!success) {
        return res.status(500).json({ message: 'Failed to delete mapping' });
      }

      // CRITICAL: Use shared helper for comprehensive cache invalidation, sync, and cleanup
      const syncResult = await invalidateSubjectMappingsAndSync([classId], { cleanupReportCards: true });
      console.log(`[CLASS-SUBJECT-MAPPING] Deleted mapping for class ${classId}`);

      // Emit websocket event for real-time UI propagation
      const socketIO = realtimeService.getIO();
      if (socketIO) {
        socketIO.emit('subject-assignments-updated', {
          eventType: 'subject-assignments-updated',
          affectedClassIds: [classId],
          added: 0,
          removed: 1,
          studentsSynced: syncResult.studentsSynced,
          reportCardItemsRemoved: syncResult.reportCardItemsRemoved,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        message: 'Mapping deleted successfully',
        studentsSynced: syncResult.studentsSynced,
        reportCardItemsRemoved: syncResult.reportCardItemsRemoved
      });
    } catch (error: any) {
      console.error('Error deleting class-subject mapping:', error);
      res.status(500).json({ message: error.message || 'Failed to delete mapping' });
    }
  });

}
