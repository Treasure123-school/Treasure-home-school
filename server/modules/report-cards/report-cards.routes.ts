/**
 * Report Cards Module Routes
 * Mounts all report card controllers
 */
import { Router } from 'express';
import { ReportCardsController } from './report-cards.controller';
import { GradingController } from './grading.controller';
import { EnhancedController } from './enhanced.controller';
import { SkillsController } from './skills.controller';
import { CommentsController } from './comments.controller';
import { authenticateUser, authorizeRoles, ROLES } from '../../shared/middleware';

const router = Router();

// Initialize controllers
const reportCardsController = new ReportCardsController();
const gradingController = new GradingController();
const enhancedController = new EnhancedController();
const skillsController = new SkillsController();
const commentsController = new CommentsController();

// ==================== GRADING CONFIGURATION ====================
router.get('/grading-config', authenticateUser, gradingController.getGradingConfig);
router.put('/grading-settings', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.updateGradingSettings);
router.get('/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.getPositioningMethod);
router.patch('/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), gradingController.updatePositioningMethod);

// ==================== CORE REPORT CARDS ====================
router.get('/reports/student-report-card/:studentId', authenticateUser, reportCardsController.getStudentReportCard);
router.get('/reports/class/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), reportCardsController.getClassReportCards);
router.post('/reports/generate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), reportCardsController.generateReportCard);

// ==================== ENHANCED REPORT CARDS (TEACHER PORTAL) ====================
router.get('/teacher/my-report-cards', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.getMyReportCards);
router.get('/reports/class-term/:classId/:termId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.getReportCardsByClassTerm);
router.get('/reports/:reportCardId/full', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.getReportCardFull);
router.post('/reports/:reportCardId/generate-enhanced', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.generateEnhanced);
router.post('/reports/:reportCardId/auto-populate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.autoPopulate);
router.patch('/reports/:reportCardId/items/:itemId/score', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.overrideItemScore);
router.patch('/reports/:reportCardId/status', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.updateStatus);
router.patch('/reports/:reportCardId/remarks', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.updateRemarks);
router.post('/reports/:reportCardId/default-comments', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), enhancedController.getDefaultComments);
router.post('/reports/backfill-comments', authenticateUser, authorizeRoles(ROLES.ADMIN), enhancedController.backfillComments);

// ==================== SKILLS ASSESSMENT ====================
router.get('/reports/:reportCardId/skills', authenticateUser, skillsController.getSkills);
router.post('/reports/:reportCardId/skills', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), skillsController.saveSkills);

// ==================== COMMENT TEMPLATES (ADMIN) ====================
router.get('/admin/report-comment-templates', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.getTemplates);
router.get('/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.getTemplate);
router.post('/admin/report-comment-templates', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.createTemplate);
router.patch('/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.updateTemplate);
router.delete('/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.deleteTemplate);

// ==================== ADMIN BULK OPERATIONS ====================
router.get('/admin/report-cards/finalized', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.getFinalizedReportCards);
router.post('/admin/report-cards/bulk-publish', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.bulkPublish);
router.post('/admin/report-cards/:id/reject', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.rejectReportCard);
router.post('/admin/resync-exam-score', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.resyncExamScore);
router.post('/admin/resync-report-card-subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), commentsController.resyncReportCardSubjects);

// ==================== TEACHER EXAM SYNC ====================
router.post('/teacher/exams/:examId/sync-all-to-reportcards', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), commentsController.bulkSyncExamResults);
router.get('/teacher/exams/:examId/sync-status', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), commentsController.getSyncStatus);

export default router;
