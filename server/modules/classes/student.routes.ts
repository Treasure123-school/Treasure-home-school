/**
 * Student Class Rank Route
 * Separate router for student-specific class ranking
 */
import { Router } from 'express';
import { ClassesController } from './classes.controller';
import { authenticateUser } from '../../shared/middleware';

const router = Router();

// Initialize controller
const classesController = new ClassesController();

// ==================== STUDENT CLASS RANK ====================
router.get('/class-rank', authenticateUser, classesController.getStudentClassRank);

export default router;
