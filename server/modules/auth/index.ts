/**
 * Authentication Module
 *
 * Owns credential login, session token issuance, and password flows.
 *
 * Routers: authRouter → mounted at /api/auth
 *   POST /login            — credential login (rate limited, JWT)
 *   POST /change-password  — authenticated password change
 *   POST /forgot-password  — request reset token (email)
 *   POST /reset-password   — complete reset with token (email + audit)
 */

export { default as authRouter } from './auth.routes';
