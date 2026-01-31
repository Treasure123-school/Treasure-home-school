import { db } from './storage';
import { counters } from '../shared/schema.pg';
import { sql } from 'drizzle-orm';
import { ROLE_IDS } from '@shared/role-constants';

const ROLE_CODE_STRINGS = {
  SUPER_ADMIN: 'SUP',
  ADMIN: 'ADM',
  TEACHER: 'TCH',
  STUDENT: 'STU',
  PARENT: 'PAR',
} as const;

/**
 * Atomically generates next sequential number for a role
 * Uses PostgreSQL ON CONFLICT for atomic increment
 */
async function getNextSequenceForRole(roleCode: string): Promise<number> {
  const currentYear = new Date().getFullYear().toString();
  
  const result = await db
    .insert(counters)
    .values({
      roleCode,
      classCode: 'N/A',
      year: currentYear,
      sequence: 1
    })
    .onConflictDoUpdate({
      target: [counters.roleCode],
      set: {
        sequence: sql`${counters.sequence} + 1`,
        updatedAt: new Date()
      }
    })
    .returning();

  return result[0].sequence;
}
/**
 * Generates student username
 * Format: THS-STU-###
 * Example: THS-STU-021
 */
export async function generateStudentUsername(): Promise<string> {
  const sequence = await getNextSequenceForRole(ROLE_CODE_STRINGS.STUDENT);
  return `THS-${ROLE_CODE_STRINGS.STUDENT}-${String(sequence).padStart(3, '0')}`;
}
/**
 * Generates parent username
 * Format: THS-PAR-###
 * Example: THS-PAR-012
 */
export async function generateParentUsername(): Promise<string> {
  const sequence = await getNextSequenceForRole(ROLE_CODE_STRINGS.PARENT);
  return `THS-${ROLE_CODE_STRINGS.PARENT}-${String(sequence).padStart(3, '0')}`;
}
/**
 * Generates teacher username
 * Format: THS-TCH-###
 * Example: THS-TCH-005
 */
export async function generateTeacherUsername(): Promise<string> {
  const sequence = await getNextSequenceForRole(ROLE_CODE_STRINGS.TEACHER);
  return `THS-${ROLE_CODE_STRINGS.TEACHER}-${String(sequence).padStart(3, '0')}`;
}
/**
 * Generates admin username
 * Format: THS-ADM-###
 * Example: THS-ADM-001
 */
export async function generateAdminUsername(): Promise<string> {
  const sequence = await getNextSequenceForRole(ROLE_CODE_STRINGS.ADMIN);
  return `THS-${ROLE_CODE_STRINGS.ADMIN}-${String(sequence).padStart(3, '0')}`;
}
/**
 * Generates Super Admin username
 * Format: THS-SUP-###
 * Example: THS-SUP-001
 */
export async function generateSuperAdminUsername(): Promise<string> {
  const sequence = await getNextSequenceForRole(ROLE_CODE_STRINGS.SUPER_ADMIN);
  return `THS-${ROLE_CODE_STRINGS.SUPER_ADMIN}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generates username for any role by role ID
 * IMPORTANT: Role IDs must match database roles in shared/role-constants.ts
 * @param roleId - User role ID (1=SuperAdmin, 2=Admin, 3=Teacher, 4=Student, 5=Parent)
 */
export async function generateUsernameByRole(roleId: number): Promise<string> {
  switch (roleId) {
    case ROLE_IDS.SUPER_ADMIN: // 1 - Super Admin
      return generateSuperAdminUsername();
    case ROLE_IDS.ADMIN: // 2 - Admin
      return generateAdminUsername();
    case ROLE_IDS.TEACHER: // 3 - Teacher
      return generateTeacherUsername();
    case ROLE_IDS.STUDENT: // 4 - Student
      return generateStudentUsername();
    case ROLE_IDS.PARENT: // 5 - Parent
      return generateParentUsername();
    default:
      throw new Error(`Invalid role ID: ${roleId}. Valid IDs are 1-5.`);
  }
}

/**
 * Generates temporary password
 * Format: THS@{YEAR}#{RAND4}
 * Example: THS@2025#8372
 */
export function generateTempPassword(year: number = new Date().getFullYear()): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `THS@${year}#${random4}`;
}
/**
 * Validates username format (supports both old and new formats)
 * New format: THS-{ROLE}-###
 * Old format: THS-{ROLE}-{YEAR}-{OPTIONAL}-###
 */
export function validateUsername(username: string): { 
  valid: boolean; 
  type?: 'superadmin' | 'student' | 'parent' | 'teacher' | 'admin'; 
  format?: 'new' | 'old';
  error?: string 
} {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }
  // New simplified format: THS-ROLE-###
  const newSuperAdminPattern = /^THS-SUP-\d{3}$/;
  const newAdminPattern = /^THS-ADM-\d{3}$/;
  const newTeacherPattern = /^THS-TCH-\d{3}$/;
  const newStudentPattern = /^THS-STU-\d{3}$/;
  const newParentPattern = /^THS-PAR-\d{3}$/;

  // Old format: THS-ROLE-YEAR-CLASS-### or THS-ROLE-YEAR-###
  const oldStudentPattern = /^THS-STU-\d{4}-[A-Z0-9]+-\d{3}$/;
  const oldParentPattern = /^THS-PAR-\d{4}-\d{3}$/;
  const oldTeacherPattern = /^THS-TCH-\d{4}-[A-Z0-9]+-\d{3}$/;
  const oldAdminPattern = /^THS-ADM-\d{4}-\d{3}$/;

  // Check new format first (preferred)
  if (newSuperAdminPattern.test(username)) {
    return { valid: true, type: 'superadmin', format: 'new' };
  }
  if (newAdminPattern.test(username)) {
    return { valid: true, type: 'admin', format: 'new' };
  }
  if (newTeacherPattern.test(username)) {
    return { valid: true, type: 'teacher', format: 'new' };
  }
  if (newStudentPattern.test(username)) {
    return { valid: true, type: 'student', format: 'new' };
  }
  if (newParentPattern.test(username)) {
    return { valid: true, type: 'parent', format: 'new' };
  }
  // Check old format for backwards compatibility
  if (oldStudentPattern.test(username)) {
    return { valid: true, type: 'student', format: 'old' };
  }
  if (oldParentPattern.test(username)) {
    return { valid: true, type: 'parent', format: 'old' };
  }
  if (oldTeacherPattern.test(username)) {
    return { valid: true, type: 'teacher', format: 'old' };
  }
  if (oldAdminPattern.test(username)) {
    return { valid: true, type: 'admin', format: 'old' };
  }
  return { valid: false, error: 'Invalid username format' };
}
