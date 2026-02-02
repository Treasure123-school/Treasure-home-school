/**
 * Centralized role constants for the entire application
 * CRITICAL: These IDs MUST match the database role IDs in the roles table
 * 
 * Role IDs in database:
 * - 1: Super Admin
 * - 2: Admin  
 * - 3: Teacher
 * - 4: Student
 * - 5: Parent
 */

export const ROLE_IDS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  TEACHER: 3,
  STUDENT: 4,
  PARENT: 5
} as const;

export const ROLE_CODES = {
  [ROLE_IDS.SUPER_ADMIN]: 'SUP',
  [ROLE_IDS.ADMIN]: 'ADM',
  [ROLE_IDS.TEACHER]: 'TCH',
  [ROLE_IDS.STUDENT]: 'STU',
  [ROLE_IDS.PARENT]: 'PAR'
} as const;

export const ROLE_CODE_NAMES = {
  SUP: 'SUPER_ADMIN',
  ADM: 'ADMIN',
  TCH: 'TEACHER',
  STU: 'STUDENT',
  PAR: 'PARENT'
} as const;

export const ROLE_NAMES = {
  [ROLE_IDS.SUPER_ADMIN]: 'Super Admin',
  [ROLE_IDS.ADMIN]: 'Admin',
  [ROLE_IDS.TEACHER]: 'Teacher',
  [ROLE_IDS.STUDENT]: 'Student',
  [ROLE_IDS.PARENT]: 'Parent'
} as const;

export const ROLE_PORTALS = {
  [ROLE_IDS.SUPER_ADMIN]: '/portal/superadmin',
  [ROLE_IDS.ADMIN]: '/portal/admin',
  [ROLE_IDS.TEACHER]: '/portal/teacher',
  [ROLE_IDS.STUDENT]: '/portal/student',
  [ROLE_IDS.PARENT]: '/portal/parent'
} as const;

export type RoleId = typeof ROLE_IDS[keyof typeof ROLE_IDS];
export type RoleName = typeof ROLE_NAMES[keyof typeof ROLE_NAMES];

/**
 * Get role name by ID
 */
export const getRoleNameById = (roleId: number): string => {
  return ROLE_NAMES[roleId as keyof typeof ROLE_NAMES] || 'Unknown';
};

/**
 * Get portal path by role ID
 */
export const getPortalByRoleId = (roleId: number): string => {
  return ROLE_PORTALS[roleId as keyof typeof ROLE_PORTALS] || '/portal/student';
};

/**
 * Check if role is valid
 */
export const isValidRoleId = (roleId: number): boolean => {
  return roleId in ROLE_NAMES;
};
