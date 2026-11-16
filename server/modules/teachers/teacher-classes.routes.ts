/** Teacher portal: my-classes, classes-with-stats, my-students, my-subjects, dashboard stats, all-students — split from assignment.routes.ts. */
import { Router, Request, Response } from 'express';
import { db } from '../../core/config/database';
import { storage } from '../../storage';
import jwt from 'jsonwebtoken';
import { 
  teacherClassAssignments, 
  teacherAssignmentHistory, 
  gradingBoundaries, 
  continuousAssessment,
  classes,
  subjects,
  users,
  academicTerms,
  students,
  classSubjectMappings
} from '@shared/schema.pg';
import { eq, and, desc, sql, isNull, or, gte, inArray } from 'drizzle-orm';
import { ROLE_IDS } from '@shared/role-constants';
import { z } from 'zod';
import { 
  checkTeacherAssignment, 
  getTeacherAssignments, 
  logUnauthorizedAccess 
} from './auth.middleware';

// JWT secret - must match the one in routes.ts
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  gradingBoundarySchema,
  continuousAssessmentSchema,
  requireAuth,
  requireAdmin,
  sanitizeIp,
  normalizeUuid,
  JWT_SECRET,
} from './teacher-routes.shared';

const router = Router();

router.get('/api/teacher/my-classes', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const now = new Date();
    const assignments = await db
      .select({
        assignmentId: teacherClassAssignments.id,
        classId: teacherClassAssignments.classId,
        subjectId: teacherClassAssignments.subjectId,
        termId: teacherClassAssignments.termId,
        session: teacherClassAssignments.session,
        className: classes.name,
        classLevel: classes.level,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        termName: academicTerms.name,
        termYear: academicTerms.year,
      })
      .from(teacherClassAssignments)
      .innerJoin(classes, eq(teacherClassAssignments.classId, classes.id))
      .innerJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
      .leftJoin(academicTerms, eq(teacherClassAssignments.termId, academicTerms.id))
      .where(and(
        eq(teacherClassAssignments.teacherId, user.id),
        eq(teacherClassAssignments.isActive, true),
        or(
          isNull(teacherClassAssignments.validUntil),
          gte(teacherClassAssignments.validUntil, now)
        )
      ));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ message: 'Failed to fetch assigned classes' });
  }
});

router.get('/api/teacher/classes-with-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const now = new Date();
    // Join with class_subject_mappings so each class card only shows subjects
    // that are BOTH assigned to this teacher AND currently active in the
    // subject setup page. This ensures the subject setup page is the
    // single source of truth for what appears on class cards.
    const assignments = await db
      .select({
        assignmentId: teacherClassAssignments.id,
        classId: teacherClassAssignments.classId,
        subjectId: teacherClassAssignments.subjectId,
        className: classes.name,
        classLevel: classes.level,
        classCapacity: classes.capacity,
        subjectName: subjects.name,
        teacherDept: teacherClassAssignments.department,
      })
      .from(teacherClassAssignments)
      .innerJoin(classes, eq(teacherClassAssignments.classId, classes.id))
      .innerJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
      // Only include subjects that exist in the class subject setup for this class.
      // Department matching: include if csm.department is null (general) OR matches teacher's dept.
      .innerJoin(
        classSubjectMappings,
        and(
          eq(classSubjectMappings.classId, teacherClassAssignments.classId),
          eq(classSubjectMappings.subjectId, teacherClassAssignments.subjectId),
          or(
            isNull(classSubjectMappings.department),
            isNull(teacherClassAssignments.department),
            eq(classSubjectMappings.department, teacherClassAssignments.department)
          )
        )
      )
      .where(and(
        eq(teacherClassAssignments.teacherId, user.id),
        eq(teacherClassAssignments.isActive, true),
        or(
          isNull(teacherClassAssignments.validUntil),
          gte(teacherClassAssignments.validUntil, now)
        )
      ));

    const classMap = new Map<number, { id: number; name: string; level: string; capacity: number | null; studentCount: number; subjects: { id: number; name: string }[] }>();
    const studentCountCache = new Map<number, number>();

    for (const a of assignments) {
      if (!classMap.has(a.classId)) {
        if (!studentCountCache.has(a.classId)) {
          const studentRows = await storage.getStudentsByClass(a.classId);
          studentCountCache.set(a.classId, studentRows.length);
        }
        classMap.set(a.classId, {
          id: a.classId,
          name: a.className,
          level: a.classLevel || '',
          capacity: a.classCapacity ?? null,
          studentCount: studentCountCache.get(a.classId) || 0,
          subjects: [],
        });
      }
      const entry = classMap.get(a.classId)!;
      if (!entry.subjects.some(s => s.id === a.subjectId)) {
        entry.subjects.push({ id: a.subjectId, name: a.subjectName });
      }
    }

    res.json(Array.from(classMap.values()));
  } catch (error) {
    console.error('Error fetching teacher classes with stats:', error);
    res.status(500).json({ message: 'Failed to fetch teacher classes' });
  }
});

router.get('/api/teacher/my-students/:classId/:subjectId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    const classId = parseInt(req.params.classId);
    const subjectId = parseInt(req.params.subjectId);
    
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const hasAssignment = await checkTeacherAssignment(user.id, classId, subjectId);
    if (!hasAssignment) {
      await logUnauthorizedAccess(
        user.id,
        'view_students',
        req.originalUrl,
        classId,
        subjectId,
        'Teacher not assigned to this class/subject',
        req as any
      );
      return res.status(403).json({ message: 'You are not authorized to view students for this class/subject' });
    }

    const studentList = await db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        department: students.department,
      })
      .from(students)
      .innerJoin(users, eq(students.id, users.id))
      .where(eq(students.classId, classId))
      .orderBy(users.firstName, users.lastName);

    res.json(studentList);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// Get teacher's assigned subjects (scoped endpoint)
router.get('/api/teacher/my-subjects', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const now = new Date();
    const assignedSubjects = await db
      .selectDistinct({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        description: subjects.description,
        category: subjects.category,
      })
      .from(teacherClassAssignments)
      .innerJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
      .where(and(
        eq(teacherClassAssignments.teacherId, user.id),
        eq(teacherClassAssignments.isActive, true),
        or(
          isNull(teacherClassAssignments.validUntil),
          gte(teacherClassAssignments.validUntil, now)
        )
      ));

    res.json(assignedSubjects);
  } catch (error) {
    console.error('Error fetching teacher subjects:', error);
    res.status(500).json({ message: 'Failed to fetch assigned subjects' });
  }
});

// Get teacher's dashboard statistics (scoped endpoint)
router.get('/api/teacher/my-dashboard-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const now = new Date();
    
    // Get teacher's active assignments
    const assignments = await db
      .select({
        classId: teacherClassAssignments.classId,
        subjectId: teacherClassAssignments.subjectId,
      })
      .from(teacherClassAssignments)
      .where(and(
        eq(teacherClassAssignments.teacherId, user.id),
        eq(teacherClassAssignments.isActive, true),
        or(
          isNull(teacherClassAssignments.validUntil),
          gte(teacherClassAssignments.validUntil, now)
        )
      ));

    // Get unique class and subject counts
    const uniqueClassIds = [...new Set(assignments.map(a => a.classId))];
    const uniqueSubjectIds = [...new Set(assignments.map(a => a.subjectId))];

    // Get student count for assigned classes
    let studentCount = 0;
    if (uniqueClassIds.length > 0) {
      const studentData = await db
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(inArray(students.classId, uniqueClassIds));
      studentCount = Number(studentData[0]?.count || 0);
    }

    res.json({
      totalClasses: uniqueClassIds.length,
      totalSubjects: uniqueSubjectIds.length,
      totalStudents: studentCount,
      assignmentCount: assignments.length,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// Get teacher's assigned students (all students across all assignments)
router.get('/api/teacher/my-all-students', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    
    if (user.roleId !== ROLE_IDS.TEACHER) {
      return res.status(403).json({ message: 'Only teachers can access this endpoint' });
    }

    const now = new Date();
    
    // Get teacher's assigned class IDs
    const assignments = await db
      .select({ classId: teacherClassAssignments.classId })
      .from(teacherClassAssignments)
      .where(and(
        eq(teacherClassAssignments.teacherId, user.id),
        eq(teacherClassAssignments.isActive, true),
        or(
          isNull(teacherClassAssignments.validUntil),
          gte(teacherClassAssignments.validUntil, now)
        )
      ));

    const classIds = [...new Set(assignments.map(a => a.classId))];
    
    if (classIds.length === 0) {
      return res.json([]);
    }

    const studentList = await db
      .select({
        id: students.id,
        admissionNumber: students.admissionNumber,
        classId: students.classId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        department: students.department,
        className: classes.name,
        classLevel: classes.level,
      })
      .from(students)
      .innerJoin(users, eq(students.id, users.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(inArray(students.classId, classIds))
      .orderBy(classes.name, users.firstName, users.lastName);

    res.json(studentList);
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

export default router;
