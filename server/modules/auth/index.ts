/**
 * Authentication Module
 * 
 * Handles user authentication and password management
 * 
 * Endpoints:
 *   POST /api/auth/login            - Credential login with rate limiting
 *   POST /api/auth/change-password  - Change password (authenticated)
 *   POST /api/auth/forgot-password  - Request password reset
 *   POST /api/auth/reset-password   - Complete password reset with token
 * 
 * Architecture:
 *   - auth.routes.ts: Route definitions
 *   - auth.controller.ts: HTTP request handling
 *   - auth.service.ts: Business logic
 */

export { default as authRouter } from './auth.routes';
export { AuthController } from './auth.controller';
export { AuthService } from './auth.service';
