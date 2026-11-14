/**
 * Classes Module Routes
 * Mounts all class management endpoints
 */
import { Router } from 'express';
import { ClassesController } from './classes.controller';
import { authenticateUser, authorizeRoles, ROLES } from '../../shared/middleware';

const router = Router();

// Initialize controller
const classesController = new ClassesController();

// ==================== CLASS CRUD ====================
router.get('/', authenticateUser, classesController.getClasses);
router.get('/:id', authenticateUser, classesController.getClass);
router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), classesController.createClass);
router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), classesController.updateClass);
router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), classesController.deleteClass);

// ==================== CLASS-SUBJECT MAPPINGS ====================
router.get('/:classId/available-subjects', authenticateUser, classesController.getAvailableSubjects);

export default router;
