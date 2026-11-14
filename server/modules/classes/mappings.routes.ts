/**
 * Class Subject Mappings Routes
 * Separate router for class-subject mapping endpoints
 */
import { Router } from 'express';
import { ClassesController } from './classes.controller';
import { authenticateUser, authorizeRoles, ROLES } from '../../shared/middleware';

const router = Router();

// Initialize controller
const classesController = new ClassesController();

// ==================== CLASS-SUBJECT MAPPINGS ====================
router.get('/:classId', authenticateUser, classesController.getClassSubjectMappings);
router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), classesController.createClassSubjectMapping);
router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), classesController.deleteClassSubjectMapping);

export default router;
