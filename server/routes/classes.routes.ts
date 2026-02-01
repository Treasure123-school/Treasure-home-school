/**
 * Classes Routes
 * 
 * Handles CRUD operations for school classes.
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { realtimeService } from "../realtime-service";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../utils/response-helpers";

const router = Router();

router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const classes = await storage.getClasses();
    sendSuccess(res, classes);
  } catch (error) {
    handleRouteError(res, error, 'classes.list');
  }
});

router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    if (!req.body.name) {
      return sendBadRequest(res, 'Class name is required');
    }
    
    const newClass = await storage.createClass(req.body);
    
    realtimeService.emitTableChange('classes', 'INSERT', newClass, undefined, req.user!.id);
    realtimeService.emitToRole('admin', 'class.created', newClass);
    realtimeService.emitToRole('teacher', 'class.created', newClass);
    
    sendSuccess(res, newClass);
  } catch (error) {
    handleRouteError(res, error, 'classes.create');
  }
});

router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
      return sendBadRequest(res, 'Invalid class ID');
    }

    const existingClass = await storage.getClass(classId);
    if (!existingClass) {
      return sendNotFound(res, 'Class not found');
    }

    const updatedClass = await storage.updateClass(classId, req.body);
    
    realtimeService.emitTableChange('classes', 'UPDATE', updatedClass, existingClass, req.user!.id);
    realtimeService.emitToRole('admin', 'class.updated', updatedClass);
    realtimeService.emitToRole('teacher', 'class.updated', updatedClass);
    
    sendSuccess(res, updatedClass);
  } catch (error) {
    handleRouteError(res, error, 'classes.update');
  }
});

router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const classId = parseInt(req.params.id);
    if (isNaN(classId)) {
      return sendBadRequest(res, 'Invalid class ID');
    }

    const existingClass = await storage.getClass(classId);
    if (!existingClass) {
      return sendNotFound(res, 'Class not found');
    }

    const success = await storage.deleteClass(classId);
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete class' });
    }
    
    realtimeService.emitTableChange('classes', 'DELETE', { id: classId }, existingClass, req.user!.id);
    realtimeService.emitToRole('admin', 'class.deleted', { ...existingClass, id: classId });
    realtimeService.emitToRole('teacher', 'class.deleted', { ...existingClass, id: classId });
    
    sendSuccess(res, { message: 'Class deleted successfully', id: classId, success: true });
  } catch (error: any) {
    if (error.code === '23503' || error.message?.includes('linked')) {
      return sendBadRequest(res, 'Cannot delete class because it has students or other records linked to it.');
    }
    handleRouteError(res, error, 'classes.delete');
  }
});

export default router;
