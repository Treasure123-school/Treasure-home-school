/** Grading boundaries + continuous assessment endpoints — split from assignment.routes.ts. */
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

router.get('/api/grading-boundaries', requireAuth, async (req: Request, res: Response) => {
  try {
    const { termId, classId, subjectId, defaultOnly } = req.query;
    let conditions: any[] = [];

    if (termId) conditions.push(eq(gradingBoundaries.termId, parseInt(termId as string)));
    if (classId) conditions.push(eq(gradingBoundaries.classId, parseInt(classId as string)));
    if (subjectId) conditions.push(eq(gradingBoundaries.subjectId, parseInt(subjectId as string)));
    if (defaultOnly === 'true') conditions.push(eq(gradingBoundaries.isDefault, true));

    const boundaries = await db
      .select()
      .from(gradingBoundaries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gradingBoundaries.minScore));

    res.json(boundaries);
  } catch (error) {
    console.error('Error fetching grading boundaries:', error);
    res.status(500).json({ message: 'Failed to fetch grading boundaries' });
  }
});

router.post('/api/grading-boundaries', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const data = gradingBoundarySchema.parse(req.body);

    if (data.minScore > data.maxScore) {
      return res.status(400).json({ message: 'Minimum score cannot be greater than maximum score' });
    }

    const [newBoundary] = await db.insert(gradingBoundaries).values({
      name: data.name,
      grade: data.grade,
      minScore: data.minScore,
      maxScore: data.maxScore,
      remark: data.remark || null,
      gradePoint: data.gradePoint || null,
      isDefault: data.isDefault || false,
      termId: data.termId || null,
      classId: data.classId || null,
      subjectId: data.subjectId || null,
      createdBy: user.id,
    }).returning();

    res.status(201).json(newBoundary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error creating grading boundary:', error);
    res.status(500).json({ message: 'Failed to create grading boundary' });
  }
});

router.post('/api/grading-boundaries/bulk', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const { boundaries, name, isDefault, termId, classId, subjectId } = req.body;

    if (!Array.isArray(boundaries) || boundaries.length === 0) {
      return res.status(400).json({ message: 'Boundaries array is required' });
    }

    const boundariesToInsert = boundaries.map(b => ({
      name: name || 'Standard',
      grade: b.grade,
      minScore: b.minScore,
      maxScore: b.maxScore,
      remark: b.remark || null,
      gradePoint: b.gradePoint || null,
      isDefault: isDefault || false,
      termId: termId || null,
      classId: classId || null,
      subjectId: subjectId || null,
      createdBy: user.id,
    }));

    const created = await db.insert(gradingBoundaries).values(boundariesToInsert).returning();

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating bulk grading boundaries:', error);
    res.status(500).json({ message: 'Failed to create grading boundaries' });
  }
});

router.patch('/api/grading-boundaries/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const boundaryId = parseInt(req.params.id);
    
    if (isNaN(boundaryId) || boundaryId <= 0) {
      return res.status(400).json({ message: 'Invalid boundary ID' });
    }

    const { name, grade, minScore, maxScore, remark, gradePoint, isDefault, termId, classId, subjectId } = req.body;

    if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) {
      return res.status(400).json({ message: 'Minimum score cannot be greater than maximum score' });
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (grade !== undefined) updateData.grade = grade;
    if (minScore !== undefined) updateData.minScore = minScore;
    if (maxScore !== undefined) updateData.maxScore = maxScore;
    if (remark !== undefined) updateData.remark = remark;
    if (gradePoint !== undefined) updateData.gradePoint = gradePoint;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    if (termId !== undefined) updateData.termId = termId;
    if (classId !== undefined) updateData.classId = classId;
    if (subjectId !== undefined) updateData.subjectId = subjectId;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided' });
    }

    const [updated] = await db.update(gradingBoundaries)
      .set(updateData)
      .where(eq(gradingBoundaries.id, boundaryId))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'Grading boundary not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating grading boundary:', error);
    res.status(500).json({ message: 'Failed to update grading boundary' });
  }
});

router.delete('/api/grading-boundaries/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const boundaryId = parseInt(req.params.id);
    await db.delete(gradingBoundaries).where(eq(gradingBoundaries.id, boundaryId));
    res.json({ message: 'Grading boundary deleted successfully' });
  } catch (error) {
    console.error('Error deleting grading boundary:', error);
    res.status(500).json({ message: 'Failed to delete grading boundary' });
  }
});

router.get('/api/continuous-assessment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    const { classId, subjectId, termId, studentId } = req.query;

    let conditions: any[] = [];

    if (user.roleId === ROLE_IDS.TEACHER) {
      const assignments = await getTeacherAssignments(user.id, termId ? parseInt(termId as string) : undefined);
      if (assignments.length === 0) {
        return res.json([]);
      }
      const classIds = [...new Set(assignments.map(a => a.classId))];
      const subjectIds = [...new Set(assignments.map(a => a.subjectId))];
      conditions.push(inArray(continuousAssessment.classId, classIds));
      conditions.push(inArray(continuousAssessment.subjectId, subjectIds));
    }

    if (classId) conditions.push(eq(continuousAssessment.classId, parseInt(classId as string)));
    if (subjectId) conditions.push(eq(continuousAssessment.subjectId, parseInt(subjectId as string)));
    if (termId) conditions.push(eq(continuousAssessment.termId, parseInt(termId as string)));
    if (studentId) conditions.push(eq(continuousAssessment.studentId, studentId as string));

    const assessments = await db
      .select({
        id: continuousAssessment.id,
        studentId: continuousAssessment.studentId,
        classId: continuousAssessment.classId,
        subjectId: continuousAssessment.subjectId,
        termId: continuousAssessment.termId,
        testScore: continuousAssessment.testScore,
        examScore: continuousAssessment.examScore,
        totalScore: continuousAssessment.totalScore,
        grade: continuousAssessment.grade,
        remark: continuousAssessment.remark,
        isLocked: continuousAssessment.isLocked,
        createdAt: continuousAssessment.createdAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(continuousAssessment)
      .leftJoin(students, eq(continuousAssessment.studentId, students.id))
      .leftJoin(users, eq(students.id, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(continuousAssessment.createdAt));

    res.json(assessments);
  } catch (error) {
    console.error('Error fetching continuous assessments:', error);
    res.status(500).json({ message: 'Failed to fetch assessments' });
  }
});

router.post('/api/continuous-assessment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    const data = continuousAssessmentSchema.parse(req.body);

    if (user.roleId === ROLE_IDS.TEACHER) {
      const hasAssignment = await checkTeacherAssignment(user.id, data.classId, data.subjectId);
      if (!hasAssignment) {
        await logUnauthorizedAccess(
          user.id,
          'enter_ca_score',
          '/api/continuous-assessment',
          data.classId,
          data.subjectId,
          'Teacher not assigned to this class/subject',
          req as any
        );
        return res.status(403).json({ message: 'You are not authorized to enter scores for this class/subject' });
      }
    }

    const totalScore = (data.testScore || 0) + (data.examScore || 0);
    
    const defaultBoundaries = await db
      .select()
      .from(gradingBoundaries)
      .where(eq(gradingBoundaries.isDefault, true))
      .orderBy(desc(gradingBoundaries.minScore));

    let grade = 'F';
    let remark = 'Fail';
    for (const boundary of defaultBoundaries) {
      if (totalScore >= boundary.minScore && totalScore <= boundary.maxScore) {
        grade = boundary.grade;
        remark = boundary.remark || '';
        break;
      }
    }

    const [existing] = await db
      .select()
      .from(continuousAssessment)
      .where(and(
        eq(continuousAssessment.studentId, data.studentId),
        eq(continuousAssessment.classId, data.classId),
        eq(continuousAssessment.subjectId, data.subjectId),
        eq(continuousAssessment.termId, data.termId)
      ));

    if (existing) {
      if (existing.isLocked) {
        return res.status(403).json({ message: 'This assessment record is locked and cannot be modified' });
      }

      const [updated] = await db
        .update(continuousAssessment)
        .set({
          testScore: data.testScore ?? existing.testScore,
          examScore: data.examScore ?? existing.examScore,
          totalScore,
          grade,
          remark,
          enteredBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(continuousAssessment.id, existing.id))
        .returning();

      return res.json(updated);
    }

    const [newAssessment] = await db.insert(continuousAssessment).values({
      studentId: data.studentId,
      classId: data.classId,
      subjectId: data.subjectId,
      termId: data.termId,
      testScore: data.testScore || null,
      examScore: data.examScore || null,
      totalScore,
      grade,
      remark,
      teacherId: user.roleId === ROLE_IDS.TEACHER ? user.id : null,
      enteredBy: user.id,
    }).returning();

    res.status(201).json(newAssessment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error saving continuous assessment:', error);
    res.status(500).json({ message: 'Failed to save assessment' });
  }
});

router.post('/api/continuous-assessment/:id/lock', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const assessmentId = parseInt(req.params.id);

    const [updated] = await db
      .update(continuousAssessment)
      .set({
        isLocked: true,
        lockedBy: user.id,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(continuousAssessment.id, assessmentId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error locking assessment:', error);
    res.status(500).json({ message: 'Failed to lock assessment' });
  }
});

router.post('/api/continuous-assessment/:id/unlock', requireAdmin, async (req: Request, res: Response) => {
  try {
    const assessmentId = parseInt(req.params.id);

    const [updated] = await db
      .update(continuousAssessment)
      .set({
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(continuousAssessment.id, assessmentId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error unlocking assessment:', error);
    res.status(500).json({ message: 'Failed to unlock assessment' });
  }
});

export default router;
