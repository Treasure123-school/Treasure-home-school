/**
 * Classes Controller
 * HTTP handlers for class management, subject mappings, and student rankings
 */
import { Request, Response } from 'express';
import { ClassesService } from './classes.service';
import { realtimeService } from '../../realtime-service';

export class ClassesController {
  private service: ClassesService;

  constructor() {
    this.service = new ClassesService();
  }

  /**
   * GET /api/classes
   * Get all classes (optionally include inactive)
   */
  getClasses = async (req: Request, res: Response) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const classes = await this.service.getClasses(includeInactive);
      res.json(classes);
    } catch (error: any) {
      console.error('[CLASSES] Error fetching classes:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to fetch classes' });
    }
  };

  /**
   * GET /api/classes/:id
   * Get single class by ID
   */
  getClass = async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.id);
      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const classInfo = await this.service.getClass(classId);
      res.json(classInfo);
    } catch (error: any) {
      console.error('[CLASSES] Error fetching class:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to fetch class' });
    }
  };

  /**
   * POST /api/classes
   * Create new class (Admin only)
   */
  createClass = async (req: Request, res: Response) => {
    try {
      const { name, level, classTeacherId, capacity, isActive } = req.body;

      const newClass = await this.service.createClass({
        name,
        level,
        classTeacherId,
        capacity,
        isActive
      });

      // Emit realtime events
      realtimeService.emitTableChange('classes', 'INSERT', newClass, undefined, req.user!.id);
      realtimeService.emitClassEvent(newClass.id.toString(), 'created', newClass, req.user!.id);
      realtimeService.emitToRole('admin', 'class.created', newClass);
      realtimeService.emitToRole('teacher', 'class.created', newClass);

      res.status(201).json(newClass);
    } catch (error: any) {
      console.error('[CLASSES] Error creating class:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to create class' });
    }
  };

  /**
   * PUT /api/classes/:id
   * Update existing class (Admin only)
   */
  updateClass = async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.id);
      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const existingClass = await this.service.getClass(classId);
      const { name, level, classTeacherId, capacity, isActive } = req.body;

      const updatedClass = await this.service.updateClass(classId, {
        name,
        level,
        classTeacherId: classTeacherId || null,
        capacity,
        isActive
      });

      // Emit realtime events
      realtimeService.emitTableChange('classes', 'UPDATE', updatedClass, existingClass, req.user!.id);
      realtimeService.emitClassEvent(classId.toString(), 'updated', updatedClass, req.user!.id);
      realtimeService.emitToRole('admin', 'class.updated', updatedClass);
      realtimeService.emitToRole('teacher', 'class.updated', updatedClass);

      res.json(updatedClass);
    } catch (error: any) {
      console.error('[CLASSES] Error updating class:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to update class' });
    }
  };

  /**
   * DELETE /api/classes/:id
   * Delete class (Admin only)
   */
  deleteClass = async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.id);
      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const result = await this.service.deleteClass(classId);

      // Emit realtime events
      realtimeService.emitTableChange('classes', 'DELETE', { id: classId }, result.deletedClass, req.user!.id);
      realtimeService.emitClassEvent(classId.toString(), 'deleted', { ...result.deletedClass, id: classId }, req.user!.id);
      realtimeService.emitToRole('admin', 'class.deleted', { ...result.deletedClass, id: classId });
      realtimeService.emitToRole('teacher', 'class.deleted', { ...result.deletedClass, id: classId });

      res.json({ 
        message: 'Class deleted successfully', 
        id: classId, 
        success: true 
      });
    } catch (error: any) {
      console.error('[CLASSES] Error deleting class:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to delete class' });
    }
  };

  /**
   * GET /api/classes/:classId/available-subjects
   * Get subjects available for a class (with optional department filter)
   */
  getAvailableSubjects = async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.classId);
      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const { department } = req.query;
      const subjects = await this.service.getAvailableSubjects(classId, department as string | undefined);

      res.json(subjects);
    } catch (error: any) {
      console.error('[CLASSES] Error fetching available subjects:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to fetch available subjects' });
    }
  };

  /**
   * GET /api/class-subject-mappings/:classId
   * Get class-subject mappings with enriched details
   */
  getClassSubjectMappings = async (req: Request, res: Response) => {
    try {
      const classId = parseInt(req.params.classId);
      if (isNaN(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const { department } = req.query;
      const mappings = await this.service.getClassSubjectMappings(classId, department as string | undefined);

      res.json(mappings);
    } catch (error: any) {
      console.error('[CLASSES] Error fetching class-subject mappings:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to fetch mappings' });
    }
  };

  /**
   * POST /api/class-subject-mappings
   * Create class-subject mapping (Admin only)
   */
  createClassSubjectMapping = async (req: Request, res: Response) => {
    try {
      const { classId, subjectId, department, isCompulsory } = req.body;

      const result = await this.service.createClassSubjectMapping({
        classId,
        subjectId,
        department,
        isCompulsory
      });

      // Emit websocket event for real-time UI propagation
      const socketIO = realtimeService.getIO();
      if (socketIO) {
        socketIO.emit('subject-assignments-updated', {
          eventType: 'subject-assignments-updated',
          affectedClassIds: [classId],
          added: 1,
          removed: 0,
          studentsSynced: result.syncResult.studentsSynced,
          timestamp: new Date().toISOString()
        });
      }

      res.status(201).json(result.mapping);
    } catch (error: any) {
      console.error('[CLASSES] Error creating class-subject mapping:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to create mapping' });
    }
  };

  /**
   * DELETE /api/class-subject-mappings/:id
   * Delete class-subject mapping (Admin only)
   */
  deleteClassSubjectMapping = async (req: Request, res: Response) => {
    try {
      const mappingId = parseInt(req.params.id);
      if (isNaN(mappingId)) {
        return res.status(400).json({ message: 'Invalid mapping ID' });
      }

      const result = await this.service.deleteClassSubjectMapping(mappingId);

      // Emit websocket event for real-time UI propagation
      const socketIO = realtimeService.getIO();
      if (socketIO) {
        socketIO.emit('subject-assignments-updated', {
          eventType: 'subject-assignments-updated',
          affectedClassIds: [result.classId],
          added: 0,
          removed: 1,
          studentsSynced: result.syncResult.studentsSynced,
          reportCardItemsRemoved: result.syncResult.reportCardItemsRemoved,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        message: 'Mapping deleted successfully',
        studentsSynced: result.syncResult.studentsSynced,
        reportCardItemsRemoved: result.syncResult.reportCardItemsRemoved
      });
    } catch (error: any) {
      console.error('[CLASSES] Error deleting class-subject mapping:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Failed to delete mapping' });
    }
  };

  /**
   * GET /api/student/class-rank
   * Get student's rank within their class
   */
  getStudentClassRank = async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;
      const result = await this.service.getStudentClassRank(studentId);
      res.json(result);
    } catch (error: any) {
      console.error('[CLASSES] Error fetching class rank:', error);
      res.status(500).json({ message: 'Failed to fetch class rank' });
    }
  };
}
