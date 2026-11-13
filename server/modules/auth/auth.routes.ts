/**
 * Authentication Module Routes
 * Uses controller pattern for clean separation of concerns
 */
import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateUser } from '../../shared/middleware';

const router = Router();
const authController = new AuthController();

/**
 * POST /api/auth/login
 * User login with credentials (rate limited, JWT issuance)
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/change-password
 * Change password (authenticated users only)
 */
router.post('/change-password', authenticateUser, authController.changePassword);

/**
 * POST /api/auth/forgot-password
 * Request password reset token (rate limited, email sent)
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Complete password reset with token (audit + email notification)
 */
router.post('/reset-password', authController.resetPassword);

export default router;
