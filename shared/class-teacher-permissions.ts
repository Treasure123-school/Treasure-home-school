/**
 * Class Teacher Permission Utilities
 * 
 * Handles authorization for class teacher-specific actions such as:
 * - Rating psychomotor skills
 * - Rating affective traits
 * - Writing class teacher comments
 * - Other class-wide student evaluations
 * 
 * DISTINCTION FROM SUBJECT TEACHER ASSIGNMENTS:
 * - Subject Teacher: Assigned to teach specific subjects in specific classes.
 *   Can only create exams, input scores for their assigned subjects.
 * - Class Teacher: The primary teacher responsible for a class.
 *   Can rate skills, write comments, and manage class-wide student records.
 */

/** Admin role IDs that bypass class teacher checks */
const ADMIN_ROLE_IDS = [1, 2]; // Super Admin = 1, Admin = 2

export interface ClassTeacherPermissionContext {
  loggedInUserId: string;
  loggedInRoleId: number;
  classTeacherId: string | null;
}

export interface ClassTeacherPermissions {
  canRateSkills: boolean;
  canWriteClassTeacherComment: boolean;
  canManageClassRecords: boolean;
  isAdmin: boolean;
  isClassTeacher: boolean;
  reason?: string;
}

/**
 * Calculates whether a user can perform class teacher actions
 * 
 * Permission Rules:
 * 1. Admins (roleId 1 or 2) can perform all actions
 * 2. Only the assigned class teacher can:
 *    - Rate psychomotor and affective skills
 *    - Write class teacher comments
 *    - Manage class-wide student records
 * 3. Subject teachers CANNOT perform these actions unless they are also the class teacher
 */
export function calculateClassTeacherPermissions(
  context: ClassTeacherPermissionContext
): ClassTeacherPermissions {
  const { loggedInUserId, loggedInRoleId, classTeacherId } = context;
  
  const isAdmin = ADMIN_ROLE_IDS.includes(loggedInRoleId);
  
  if (isAdmin) {
    return {
      canRateSkills: true,
      canWriteClassTeacherComment: true,
      canManageClassRecords: true,
      isAdmin: true,
      isClassTeacher: false,
      reason: 'Administrator access'
    };
  }
  
  const isClassTeacher = classTeacherId === loggedInUserId;
  
  if (isClassTeacher) {
    return {
      canRateSkills: true,
      canWriteClassTeacherComment: true,
      canManageClassRecords: true,
      isAdmin: false,
      isClassTeacher: true,
      reason: 'Authorized as class teacher'
    };
  }
  
  return {
    canRateSkills: false,
    canWriteClassTeacherComment: false,
    canManageClassRecords: false,
    isAdmin: false,
    isClassTeacher: false,
    reason: 'Only the assigned class teacher or administrators can perform this action'
  };
}

/**
 * Generate user-friendly error messages for class teacher permission denials
 */
export function getClassTeacherPermissionDeniedMessage(
  action: 'skills' | 'comment' | 'records'
): string {
  switch (action) {
    case 'skills':
      return 'Only the assigned class teacher or an administrator can rate student skills. ' +
             'If you believe you should have access, please contact an administrator.';
    case 'comment':
      return 'Only the assigned class teacher or an administrator can write class teacher comments. ' +
             'If you believe you should have access, please contact an administrator.';
    case 'records':
      return 'Only the assigned class teacher or an administrator can manage class records. ' +
             'If you believe you should have access, please contact an administrator.';
    default:
      return 'Permission denied. This action requires class teacher authorization.';
  }
}
