/**
 * Report Cards Module Routes
 * Mounts all report card controllers
 */
import { Router } from 'express';
import { ReportCardsController } from './report-cards.controller';
import { GradingController } from './grading.controller';
import { authenticateUser, authorizeRoles, ROLES } from '../../shared/middleware';

const router = Router();

// Initialize controllers
const reportCardsController = new ReportCardsController();
const gradingController = new GradingController();

// ==================== GRADING CONFIGURATION ====================
router.get('/grading-config', authenticateUser, gradingController.getGradingConfig);
router.put('/grading-settings', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.updateGradingSettings);
router.get('/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.getPositioningMethod);
router.patch('/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.updatePositioningMethod);

// ==================== CORE REPORT CARDS ====================
router.get('/reports/student-report-card/:studentId', authenticateUser, reportCardsController.getStudentReportCard);
router.get('/reports/class/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), reportCardsController.getClassReportCards);
router.post('/reports/generate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), reportCardsController.generateReportCard);

export default router;
