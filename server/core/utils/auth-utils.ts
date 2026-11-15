/**
 * THS Authentication Utilities
 * Username and password generation following THS simplified branding standards
 */

import crypto from 'crypto';
import { ROLE_CODES, ROLE_IDS } from '@shared/role-constants';

/**
 * Generate a cryptographically strong random string for passwords
 * Uses crypto.randomBytes for security
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
/**
 * Generate THS-branded username with NEW simplified format
 * @param roleId - User role ID (1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent)
 * @param number - Sequential number (e.g., 1, 2, 3...)
 * @returns THS-branded username in new simplified format (THS-ROLE-###)
 */
export function generateUsername(
  roleId: number,
  number: number
): string {
  const roleCode = ROLE_CODES[roleId as keyof typeof ROLE_CODES] || 'USR';
  const paddedNumber = String(number).padStart(3, '0');
  return `THS-${roleCode}-${paddedNumber}`;
}
/**
 * Generate THS-branded password with strong cryptographic randomness
 * Format: THS@<YEAR>#<RANDOM>
 * Example: THS@2025#aB3k9Mx2Pq7R
 * @param year - Academic year (e.g., '2025')
 * @returns THS-branded password (16+ characters total, cryptographically secure)
 */
export function generatePassword(year: string = new Date().getFullYear().toString()): string {
  // Generate 12 character cryptographically secure random string
  // This gives us 62^12 ≈ 3.2×10^21 possible combinations
  const randomPart = generateRandomString(12);
  return `THS@${year}#${randomPart}`;
}
/**
 * Generate student-specific username with NEW simplified format
 * @param nextNumber - Sequential number for this student
 * @returns Username in format THS-STU-###
 */
export function generateStudentUsername(nextNumber: number): string {
  return `THS-STU-${String(nextNumber).padStart(3, '0')}`;
}
/**
 * Generate student password with year
 */
export function generateStudentPassword(currentYear: string = new Date().getFullYear().toString()): string {
  // Format: THS@{YEAR}#{RANDOM}
  // Example: THS@2025#A7B3
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `THS@${currentYear}#${randomHex}`;
}
/**
 * Parse a THS username to extract components (supports both NEW and OLD formats)
 * @param username - THS username to parse
 * @returns Parsed username components or null if invalid
 */
export function parseUsername(username: string): {
  prefix: string;
  roleCode: string;
  format: 'new' | 'old';
  number: string;
  year?: string;
  optional?: string;
} | null {
  const parts = username.split('-');

  if (parts.length < 3 || parts[0] !== 'THS') {
    return null;
  }
  // NEW format: THS-ROLE-NUMBER (3 parts)
  if (parts.length === 3) {
    return {
      prefix: parts[0],
      roleCode: parts[1],
      format: 'new',
      number: parts[2],
    };
  }
  // OLD format: THS-ROLE-YEAR-NUMBER (4 parts)
  if (parts.length === 4) {
    return {
      prefix: parts[0],
      roleCode: parts[1],
      format: 'old',
      year: parts[2],
      number: parts[3],
    };
  }
  // OLD format: THS-ROLE-YEAR-OPTIONAL-NUMBER (5 parts)
  if (parts.length === 5) {
    return {
      prefix: parts[0],
      roleCode: parts[1],
      format: 'old',
      year: parts[2],
      optional: parts[3],
      number: parts[4],
    };
  }
  return null;
}
/**
 * Get the next available number for a given role (used for legacy purposes)
 * @param existingUsernames - Array of existing usernames to check against
 * @param roleId - User role ID
 * @returns Next available number
 */
export function getNextUserNumber(
  existingUsernames: string[],
  roleId: number
): number {
  const roleCode = ROLE_CODES[roleId as keyof typeof ROLE_CODES] || 'USR';
  const prefix = `THS-${roleCode}-`;

  const numbers = existingUsernames
    .filter(username => username.startsWith(prefix))
    .map(username => {
      const parts = username.split('-');
      const numStr = parts[parts.length - 1];
      return parseInt(numStr, 10);
    })
    .filter(num => !isNaN(num));

  if (numbers.length === 0) {
    return 1;
  }
  return Math.max(...numbers) + 1;
}
/**
 * Validate THS username format (supports both NEW and OLD formats)
 * Checks for proper format, valid role code, and numeric suffix
 * @param username - Username to validate
 * @returns true if valid THS format with all requirements met
 */
export function isValidThsUsername(username: string): boolean {
  const parsed = parseUsername(username);
  if (!parsed) return false;

  // Validate role code (includes SUP for Super Admin)
  const validRoleCodes = ['SUP', 'ADM', 'TCH', 'STU', 'PAR'];
  if (!validRoleCodes.includes(parsed.roleCode)) return false;

  // Validate number suffix (3 digits)
  if (!/^\d{3}$/.test(parsed.number)) return false;

  // For NEW format, no additional validation needed
  if (parsed.format === 'new') {
    return true;
  }
  // For OLD format, validate year and optional fields
  if (parsed.format === 'old') {
    // Validate year format (4 digits)
    if (parsed.year && !/^\d{4}$/.test(parsed.year)) return false;

    // If optional field exists, validate it (2-4 alphanumeric chars)
    if (parsed.optional && !/^[A-Z0-9]{2,4}$/i.test(parsed.optional)) return false;

    return true;
  }
  return false;
}
/**
 * Get role ID from role code
 * @param roleCode - Role code (ADM, TCH, STU, PAR)
 * @returns Role ID or null
 */
export function getRoleIdFromCode(roleCode: string): number | null {
  const entries = Object.entries(ROLE_CODES);
  for (const [id, code] of entries) {
    if (code === roleCode) {
      return parseInt(id, 10);
    }
  }
  return null;
}
