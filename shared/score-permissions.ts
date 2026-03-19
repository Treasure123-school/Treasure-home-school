/**
 * Shared utility for score editing permissions
 * Single source of truth for who can edit what scores
 * 
 * SECURITY: Permission is based on ownership OR assignment.
 * A teacher can edit scores if they created the exam OR are assigned to the subject.
 */

export interface ScorePermissionContext {
  loggedInUserId: string;
  loggedInRoleId: number;
  testExamCreatedBy: string | null;
  examExamCreatedBy: string | null;
  assignedTeacherId?: string | null;
}

export interface ScorePermissions {
  canEditTest: boolean;
  canEditExam: boolean;
  canEditRemarks: boolean;
  isAdmin: boolean;
  reason?: string;
}

/**
 * Admin role IDs that have full edit access
 */
const ADMIN_ROLE_IDS = [1, 2]; // Super Admin = 1, Admin = 2

/**
 * Calculates whether a user can edit specific score types for a report card item
 * 
 * Permission Rules:
 * 1. Admins (roleId 1 or 2) can edit ALL scores
 * 2. Teachers can edit test scores ONLY if:
 *    - They created the test exam (testExamCreatedBy matches their ID), OR
 *    - They are assigned to teach this class/subject (assignedTeacherId matches), OR
 *    - No test exam exists yet (testExamCreatedBy is null) - allows adding new scores
 * 3. Teachers can edit exam scores ONLY if:
 *    - They created the main exam (examExamCreatedBy matches their ID), OR
 *    - They are assigned to teach this class/subject (assignedTeacherId matches), OR
 *    - No main exam exists yet (examExamCreatedBy is null) - allows adding new scores
 * 4. Teachers can add remarks if they can edit at least one score type
 */
export function calculateScorePermissions(context: ScorePermissionContext): ScorePermissions {
  const { loggedInUserId, loggedInRoleId, testExamCreatedBy, examExamCreatedBy, assignedTeacherId } = context;
  
  // Admins can always edit everything
  const isAdmin = ADMIN_ROLE_IDS.includes(loggedInRoleId);
  if (isAdmin) {
    return {
      canEditTest: true,
      canEditExam: true,
      canEditRemarks: true,
      isAdmin: true,
      reason: 'Administrator access'
    };
  }
  
  // Check if teacher is assigned to this class/subject
  const isAssignedTeacher = assignedTeacherId === loggedInUserId;
  
  // For teachers: check OWNERSHIP or ASSIGNMENT (stricter logic)
  // Can edit test if:
  // - Teacher is assigned to this class/subject (primary check), OR
  // - Teacher created the test exam (ownership check), OR
  // - No test exam exists yet AND teacher is assigned to the subject
  // NOTE: Just having null testExamCreatedBy is NOT enough - teacher must be assigned or own it
  const canEditTest = isAssignedTeacher || testExamCreatedBy === loggedInUserId;
  
  // Can edit exam if:
  // - Teacher is assigned to this class/subject (primary check), OR
  // - Teacher created the main exam (ownership check), OR
  // - No main exam exists yet AND teacher is assigned to the subject
  // NOTE: Just having null examExamCreatedBy is NOT enough - teacher must be assigned or own it
  const canEditExam = isAssignedTeacher || examExamCreatedBy === loggedInUserId;
  
  // Can add remarks if they can edit at least one score type
  const canEditRemarks = canEditTest || canEditExam;
  
  // Provide helpful reason for debugging
  let reason = '';
  if (!canEditTest && !canEditExam) {
    reason = 'Not authorized: You are not assigned to this subject and did not create any exams for it';
  } else if (!canEditTest) {
    reason = 'Cannot edit test scores: Another teacher created the test and you are not assigned to this subject';
  } else if (!canEditExam) {
    reason = 'Cannot edit exam scores: Another teacher created the exam and you are not assigned to this subject';
  } else if (isAssignedTeacher) {
    reason = 'Authorized via subject assignment';
  } else if (testExamCreatedBy === loggedInUserId || examExamCreatedBy === loggedInUserId) {
    reason = 'Authorized as exam creator';
  }
  
  return {
    canEditTest,
    canEditExam,
    canEditRemarks,
    isAdmin: false,
    reason: reason || undefined
  };
}

/**
 * Validate score values - ensures scores are within valid ranges
 */
export interface ScoreValidation {
  isValid: boolean;
  errors: string[];
}

export function validateScoreData(data: {
  testScore?: number | null;
  testMaxScore?: number | null;
  examScore?: number | null;
  examMaxScore?: number | null;
}): ScoreValidation {
  const errors: string[] = [];
  
  // Validate test score
  if (data.testScore !== undefined && data.testScore !== null) {
    if (typeof data.testScore !== 'number' || isNaN(data.testScore)) {
      errors.push('Test score must be a valid number');
    } else if (data.testScore < 0) {
      errors.push('Test score cannot be negative');
    } else if (data.testMaxScore && data.testScore > data.testMaxScore) {
      errors.push('Test score cannot exceed maximum score');
    }
  }
  
  // Validate test max score
  if (data.testMaxScore !== undefined && data.testMaxScore !== null) {
    if (typeof data.testMaxScore !== 'number' || isNaN(data.testMaxScore)) {
      errors.push('Test maximum score must be a valid number');
    } else if (data.testMaxScore <= 0) {
      errors.push('Test maximum score must be greater than 0');
    }
  }
  
  // Validate exam score
  if (data.examScore !== undefined && data.examScore !== null) {
    if (typeof data.examScore !== 'number' || isNaN(data.examScore)) {
      errors.push('Exam score must be a valid number');
    } else if (data.examScore < 0) {
      errors.push('Exam score cannot be negative');
    } else if (data.examMaxScore && data.examScore > data.examMaxScore) {
      errors.push('Exam score cannot exceed maximum score');
    }
  }
  
  // Validate exam max score
  if (data.examMaxScore !== undefined && data.examMaxScore !== null) {
    if (typeof data.examMaxScore !== 'number' || isNaN(data.examMaxScore)) {
      errors.push('Exam maximum score must be a valid number');
    } else if (data.examMaxScore <= 0) {
      errors.push('Exam maximum score must be greater than 0');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate user-friendly error messages for permission denials
 * Permission is based on ownership OR assignment - teacher can edit if they created the exam or are assigned to the subject
 */
export function getPermissionDeniedMessage(
  action: 'test' | 'exam' | 'remarks',
  context: ScorePermissionContext
): string {
  const permissions = calculateScorePermissions(context);
  
  switch (action) {
    case 'test':
      if (!permissions.canEditTest) {
        return 'You cannot edit this test score because you did not create the test and are not assigned to this subject. Only the teacher who created the test, the assigned teacher, or an administrator can modify these scores.';
      }
      break;
    case 'exam':
      if (!permissions.canEditExam) {
        return 'You cannot edit this exam score because you did not create the exam and are not assigned to this subject. Only the teacher who created the exam, the assigned teacher, or an administrator can modify these scores.';
      }
      break;
    case 'remarks':
      if (!permissions.canEditRemarks) {
        return 'You can only add remarks for subjects where you created an exam or are assigned to teach. Contact an administrator if you need to update remarks.';
      }
      break;
  }
  
  return 'Permission denied';
}
