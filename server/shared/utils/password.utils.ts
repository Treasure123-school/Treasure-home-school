/**
 * Password utilities
 * Hashing and verification using bcrypt
 */
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate a random token (for password reset, etc.)
 */
export function generateToken(length: number = 32): string {
  return require('crypto').randomBytes(length).toString('hex');
}
