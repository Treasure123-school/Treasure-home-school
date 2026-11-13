/**
 * Teacher-specific authorization middleware
 * Consolidated from teacher-auth-middleware.ts
 * Handles teacher class/subject assignment validation
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { teacherClassAssignments, unauthorizedAccessLogs, exams, students } from '@shared/schema.pg';
import { eq, and, isNull, or, gte, sql } from 'drizzle-orm';
import { ROLE_IDS } from '@shared/role-constants';

function sanitizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const sanitized = ip.replace(/[^a-fA-F0-9.:,\s]/g, '').substring(0, 45);
  return sanitized || null;
}

interface TeacherAuthRequest {
  user?: {
    userId: string;
    roleId: number;
    roleName?: string;
  };
  headers: {
    'x-forwarded-for'?: string;
    'user-agent'?: string;
  };
  ip?: string;
}

export interface TeacherAssignmentCheck {
  teacherId: string;
  classId?: number;
  subjectId?: number;
  termId?: number;
}

/**
 * Check if teacher is assigned to specific class/subject/term
 */
export async function checkTeacherAssignment(
  teacherId: string,
  classId?: number,
  subjectId?: number,
  termId?: number
): Promise<boolean> {
  try {
    const now = new Date();
    
    const conditions = [
      eq(teacherClassAssignments.teacherId, teacherId),
      eq(teacherClassAssignments.isActive, true),
      or(
        isNull(teacherClassAssignments.validUntil),
        gte(teacherClassAssignments.validUntil, now)
      )
    ];

    if (classId) {
      conditions.push(eq(teacherClassAssignments.classId, classId));
    }
    if (subjectId) {
      conditions.push(eq(teacherClassAssignments.subjectId, subjectId));
    }
    if (termId) {
      conditions.push(eq(teacherClassAssignments.termId, termId));
    }

    const assignments = await db
      .select()
      .from(teacherClassAssignments)
      .where(and(...conditions))
      .limit(1);

    return assignments.length > 0;
  } catch (error) {
    console.error('Error checking teacher assignment:', error);
    return false;
  }
}

/**
 * Get all assignments for a teacher (optionally filtered by term)
 */
export async function getTeacherAssignments(
  teacherId: string,
  termId?: number
): Promise<typeof teacherClassAssignments.$inferSelect[]> {
  try {
    const now = new Date();
    
    const conditions = [
      eq(teacherClassAssignments.teacherId, teacherId),
      eq(teacherClassAssignments.isActive, true),
      or(
        isNull(teacherClassAssignments.validUntil),
        gte(teacherClassAssignments.validUntil, now)
      )
    ];

    if (termId) {
      conditions.push(eq(teacherClassAssignments.termId, termId));
    }

    return await db
      .select()
      .from(teacherClassAssignments)
      .where(and(...conditions));
  } catch (error) {
    console.error('Error getting teacher assignments:', error);
    return [];
  }
}

/**
 * Log unauthorized access attempt
 */
async function logUnauthorizedAccess(
  req: TeacherAuthRequest,
  resourceType: string,
  resourceId: string,
  reason: string
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return;

    const ipAddress = sanitizeIp(
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip
    );
    const userAgent = req.headers['user-agent']?.substring(0, 255);

    await db.insert(unauthorizedAccessLogs).values({
      userId,
      attemptedAction: resourceType,
      attemptedResource: resourceId,
      reason,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    });
  } catch (error) {
    console.error('Failed to log unauthorized access:', error);
  }
}

/**
 * Middleware: Require teacher to be assigned to a specific class
 */
export const requireClassAssignment = (getClassId: (req: Request) => number | undefined) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admins and Super Admins bypass assignment checks
      if (user.roleId === ROLE_IDS.ADMIN || user.roleId === ROLE_IDS.SUPER_ADMIN) {
        return next();
      }

      // Only teachers need assignment check
      if (user.roleId !== ROLE_IDS.TEACHER) {
        return res.status(403).json({ message: 'This endpoint is for teachers only' });
      }

      const classId = getClassId(req);
      if (!classId) {
        return res.status(400).json({ message: 'Class ID is required' });
      }

      const hasAssignment = await checkTeacherAssignment(user.id, classId);
      
      if (!hasAssignment) {
        await logUnauthorizedAccess(
          req as any,
          'class',
          String(classId),
          'Teacher not assigned to this class'
        );
        return res.status(403).json({ 
          message: 'You are not assigned to teach this class' 
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireClassAssignment middleware:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

/**
 * Middleware: Require teacher to be assigned to a specific subject in a class
 */
export const requireSubjectAssignment = (
  getClassId: (req: Request) => number | undefined,
  getSubjectId: (req: Request) => number | undefined
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Admins and Super Admins bypass assignment checks
      if (user.roleId === ROLE_IDS.ADMIN || user.roleId === ROLE_IDS.SUPER_ADMIN) {
        return next();
      }

      // Only teachers need assignment check
      if (user.roleId !== ROLE_IDS.TEACHER) {
        return res.status(403).json({ message: 'This endpoint is for teachers only' });
      }

      const classId = getClassId(req);
      const subjectId = getSubjectId(req);

      if (!classId || !subjectId) {
        return res.status(400).json({ message: 'Class ID and Subject ID are required' });
      }

      const hasAssignment = await checkTeacherAssignment(user.id, classId, subjectId);
      
      if (!hasAssignment) {
        await logUnauthorizedAccess(
          req as any,
          'class_subject',
          `${classId}_${subjectId}`,
          'Teacher not assigned to this class and subject'
        );
        return res.status(403).json({ 
          message: 'You are not assigned to teach this subject in this class' 
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireSubjectAssignment middleware:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

/**
 * Middleware: Require teacher to own or be assigned to an exam
 */
export const requireExamAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Admins and Super Admins have full access
    if (user.roleId === ROLE_IDS.ADMIN || user.roleId === ROLE_IDS.SUPER_ADMIN) {
      return next();
    }

    // Only teachers can access exams
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'This endpoint is for teachers only' });
    }

    const examId = parseInt(req.params.examId || req.params.id);
    if (isNaN(examId)) {
      return res.status(400).json({ message: 'Valid exam ID is required' });
    }

    // Get exam details
    const [exam] = await db
      .select()
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1);

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Check if teacher created the exam or is the teacher in charge
    const isCreator = exam.createdBy === user.id;
    const isTeacherInCharge = exam.teacherInChargeId === user.id;

    // Check if teacher is assigned to the class and subject
    let isAssigned = false;
    if (exam.classId && exam.subjectId) {
      isAssigned = await checkTeacherAssignment(user.id, exam.classId, exam.subjectId);
    }

    if (!isCreator && !isTeacherInCharge && !isAssigned) {
      await logUnauthorizedAccess(
        req as any,
        'exam',
        String(examId),
        'Teacher does not have access to this exam'
      );
      return res.status(403).json({ 
        message: 'You do not have permission to access this exam' 
      });
    }

    next();
  } catch (error) {
    console.error('Error in requireExamAccess middleware:', error);
    res.status(500).json({ message: 'Authorization check failed' });
  }
};
