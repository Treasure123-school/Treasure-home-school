/**
 * Subjects Routes
 * 
 * Handles CRUD operations for school subjects.
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { realtimeService } from "../realtime-service";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../utils/response-helpers";

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const subjects = await storage.getSubjects();
    sendSuccess(res, subjects);
  } catch (error) {
    handleRouteError(res, error, 'subjects.list');
  }
});

router.get('/by-category/:category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const subjects = await storage.getSubjectsByCategory(category);
    sendSuccess(res, subjects);
  } catch (error) {
    handleRouteError(res, error, 'subjects.byCategory');
  }
});

router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    if (!req.body.name) {
      return sendBadRequest(res, 'Subject name is required');
    }
    
    const subject = await storage.createSubject(req.body);
    
    realtimeService.emitTableChange('subjects', 'INSERT', subject, undefined, req.user!.id);
    realtimeService.emitToRole('admin', 'subject.created', subject);
    realtimeService.emitToRole('teacher', 'subject.created', subject);
    
    sendSuccess(res, subject);
  } catch (error) {
    handleRouteError(res, error, 'subjects.create');
  }
});

router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const subjectId = parseInt(req.params.id);
    if (isNaN(subjectId)) {
      return sendBadRequest(res, 'Invalid subject ID');
    }

    const existingSubject = await storage.getSubject(subjectId);
    if (!existingSubject) {
      return sendNotFound(res, 'Subject not found');
    }

    const updatedSubject = await storage.updateSubject(subjectId, req.body);
    
    realtimeService.emitTableChange('subjects', 'UPDATE', updatedSubject, existingSubject, req.user!.id);
    realtimeService.emitToRole('admin', 'subject.updated', updatedSubject);
    realtimeService.emitToRole('teacher', 'subject.updated', updatedSubject);
    
    sendSuccess(res, updatedSubject);
  } catch (error) {
    handleRouteError(res, error, 'subjects.update');
  }
});

router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const subjectId = parseInt(req.params.id);
    if (isNaN(subjectId)) {
      return sendBadRequest(res, 'Invalid subject ID');
    }

    const existingSubject = await storage.getSubject(subjectId);
    if (!existingSubject) {
      return sendNotFound(res, 'Subject not found');
    }

    const success = await storage.deleteSubject(subjectId);
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete subject' });
    }
    
    realtimeService.emitTableChange('subjects', 'DELETE', { id: subjectId }, existingSubject, req.user!.id);
    realtimeService.emitToRole('admin', 'subject.deleted', { ...existingSubject, id: subjectId });
    realtimeService.emitToRole('teacher', 'subject.deleted', { ...existingSubject, id: subjectId });
    
    sendSuccess(res, { message: 'Subject deleted successfully', id: subjectId, success: true });
  } catch (error: any) {
    if (error.code === '23503' || error.message?.includes('linked')) {
      return sendBadRequest(res, 'Cannot delete subject because it has records linked to it.');
    }
    handleRouteError(res, error, 'subjects.delete');
  }
});

export default router;
