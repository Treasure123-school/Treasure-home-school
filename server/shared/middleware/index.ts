/**
 * Shared Middleware - Barrel Export
 * Consolidated middleware for authentication, authorization, validation, and error handling
 */

// Authentication & Authorization
export {
  authenticateUser,
  authorizeRoles,
  normalizeUuid,
  SECRET_KEY,
  JWT_EXPIRES_IN,
  ROLES,
  type AuthenticatedUser
} from './auth.middleware';

// Teacher-specific Authorization
export {
  checkTeacherAssignment,
  getTeacherAssignments,
  requireClassAssignment,
  requireSubjectAssignment,
  requireExamAccess,
  type TeacherAssignmentCheck
} from './teacher-auth.middleware';

// Error Handling
export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  OperationalError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  type AppError
} from './error.middleware';

// Validation
export {
  validate,
  sanitizeInput,
  type ValidationSchema
} from './validation.middleware';
