/**
 * Authentication Utilities
 * Username and password generation following THS branding standards
 */
import crypto from 'crypto';
import { ROLE_CODES, ROLE_IDS } from '@shared/role-constants';

/**
 * Generate a cryptographically strong random string for passwords
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
 * Generate THS-branded username
 * Format: THS-ROLE-### (e.g., THS-STU-001)
 */
export function generateUsername(roleId: number, number: number): string {
  const roleCode = ROLE_CODES[roleId as keyof typeof ROLE_CODES] || 'USR';
  const paddedNumber = String(number).padStart(3, '0');
  return `THS-${roleCode}-${paddedNumber}`;
}

/**
 * Generate THS-branded password
 * Format: THS@<YEAR>#<RANDOM> (e.g., THS@2025#aB3k9Mx2Pq7R)
 */
export function generatePassword(year: string = new Date().getFullYear().toString()): string {
  const randomPart = generateRandomString(12);
  return `THS@${year}#${randomPart}`;
}

/**
 * Generate student-specific username
 */
export function generateStudentUsername(nextNumber: number): string {
  return `THS-STU-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Generate student password
 */
export function generateStudentPassword(currentYear: string = new Date().getFullYear().toString()): string {
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `THS@${currentYear}#${randomHex}`;
}

/**
 * Parse THS username to extract components
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
  if (parts.length < 3 || parts[0] !== 'THS') return null;

  const roleCode = parts[1];

  if (parts.length === 3) {
    return { prefix: parts[0], roleCode, format: 'new', number: parts[2] };
  }
  if (parts.length === 4) {
    return { prefix: parts[0], roleCode, format: 'old', year: parts[2], number: parts[3] };
  }
  if (parts.length === 5) {
    return { prefix: parts[0], roleCode, format: 'old', year: parts[2], optional: parts[3], number: parts[4] };
  }
  return null;
}

/**
 * Get next available number for a role
 */
export function getNextUserNumber(existingUsernames: string[], roleId: number): number {
  const roleCode = ROLE_CODES[roleId as keyof typeof ROLE_CODES] || 'USR';
  const prefix = `THS-${roleCode}-`;

  const numbers = existingUsernames
    .filter(username => username.startsWith(prefix))
    .map(username => parseInt(username.split('-').pop() || '0', 10))
    .filter(num => !isNaN(num));

  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

/**
 * Validate THS username format
 */
export function isValidThsUsername(username: string): boolean {
  const parsed = parseUsername(username);
  if (!parsed) return false;

  const validRoleCodes: string[] = Object.values(ROLE_CODES);
  if (!validRoleCodes.includes(parsed.roleCode)) return false;

  return /^\d+$/.test(parsed.number);
}
