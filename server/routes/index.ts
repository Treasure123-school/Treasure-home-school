/**
 * Routes Module Structure
 * 
 * This folder contains shared middleware and will contain modular route files
 * as the codebase is progressively refactored.
 * 
 * Current Structure:
 * - middleware.ts: Shared authentication & authorization middleware
 *   - authenticateUser: JWT authentication middleware
 *   - authorizeRoles: Role-based authorization middleware
 *   - normalizeUuid: UUID normalization helper
 *   - SECRET_KEY, JWT_EXPIRES_IN: JWT configuration
 *   - ROLES: Role ID constants
 *   - AuthenticatedUser: User type interface
 * 
 * Future Route Modules (to be extracted from routes.ts):
 * - auth.routes.ts: Login, logout, password reset, change password
 * - users.routes.ts: User CRUD operations
 * - students.routes.ts: Student-specific operations
 * - exams.routes.ts: Exams, questions, sessions, results
 * - reports.routes.ts: Report cards
 * - admin.routes.ts: Admin operations
 * - academic.routes.ts: Terms, classes, subjects
 * - content.routes.ts: Announcements, homepage, notifications
 * - attendance.routes.ts: Attendance tracking
 * - public.routes.ts: Public API endpoints
 * 
 * Route Categories in routes.ts (by count):
 * - admin: 32 routes
 * - reports: 21 routes
 * - users: 13 routes
 * - teacher: 11 routes
 * - students: 8 routes
 * - terms: 6 routes
 * - exam-sessions: 6 routes
 * - exams: 6 routes
 * - auth: 5 routes
 * - notifications: 4 routes
 * - classes: 4 routes
 * - attendance: 4 routes
 */

export * from './middleware';
