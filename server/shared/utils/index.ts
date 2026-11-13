/**
 * Shared Utilities - Barrel Export
 */

// Authentication utilities
export {
  generateUsername,
  generatePassword,
  generateStudentUsername,
  generateStudentPassword,
  parseUsername,
  getNextUserNumber,
  isValidThsUsername
} from './auth.utils';

// Password utilities
export {
  hashPassword,
  verifyPassword,
  generateToken
} from './password.utils';
