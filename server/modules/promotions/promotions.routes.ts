/**
 * Promotions Module Routes
 * Student Promotion & Academic Year Rollover — admin only
 */
import { Router } from 'express';
import { PromotionsController } from './promotions.controller';
import { authenticateUser, authorizeRoles, ROLES } from '../../shared/middleware';

const router = Router();
const promotionsController = new PromotionsController();

// All promotion operations are administrator-controlled
router.get('/preview', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.getPreview);
router.get('/mappings', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.getMappings);
router.put('/mappings', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.updateMappings);
router.post('/execute', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.execute);
router.get('/history', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.getHistory);
router.get('/history/:batchId', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.getBatchDetail);
router.patch('/records/:recordId', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.correctRecord);
router.post('/rollover-activate', authenticateUser, authorizeRoles(ROLES.ADMIN), promotionsController.rolloverActivate);

export default router;
