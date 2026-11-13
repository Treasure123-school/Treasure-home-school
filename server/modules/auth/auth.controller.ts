/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 * Thin layer - delegates business logic to auth service
 */
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ZodError } from 'zod';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * POST /api/auth/login - User login with credentials
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier, password } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      const result = await this.authService.login(identifier, password, clientIp, req.headers['user-agent']);
      
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: 'Invalid identifier or password format' });
        return;
      }
      
      const statusCode = error.statusCode || 500;
      const statusType = error.statusType || 'error';
      
      res.status(statusCode).json({
        message: error.message || 'Login failed. Please try again.',
        description: error.description,
        statusType
      });
    }
  };

  /**
   * POST /api/auth/change-password - Change user password (authenticated)
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      await this.authService.changePassword(userId, currentPassword, newPassword);

      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: 'Invalid password format' });
        return;
      }

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Password change failed. Please try again.'
      });
    }
  };

  /**
   * POST /api/auth/forgot-password - Request password reset
   */
  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'];

      const result = await this.authService.forgotPassword(identifier, ipAddress, userAgent);

      res.json({
        message: result.message,
        developmentMode: result.developmentMode,
        resetToken: result.resetToken,
        resetLink: result.resetLink,
        email: result.email,
        expiresIn: result.expiresIn,
        instructions: result.instructions
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to process password reset request'
      });
    }
  };

  /**
   * POST /api/auth/reset-password - Complete password reset with token
   */
  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'];

      await this.authService.resetPassword(token, newPassword, ipAddress, userAgent);

      res.json({ message: 'Password reset successfully' });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        });
        return;
      }

      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to reset password'
      });
    }
  };
}
