/** Teacher class-subject assignments CRUD + assignment history — split from assignment.routes.ts. */
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

router.get('/api/teacher-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string; roleId: number };
    const { teacherId, classId, subjectId, termId, active, includeInactive } = req.query;
    const now = new Date();

    let conditions: any[] = [];

    if (user.roleId === ROLE_IDS.TEACHER) {
      conditions.push(eq(teacherClassAssignments.teacherId, user.id));
      conditions.push(eq(teacherClassAssignments.isActive, true));
      conditions.push(or(
        isNull(teacherClassAssignments.validUntil),
        gte(teacherClassAssignments.validUntil, now)
      ));
    } else {
      if (teacherId && typeof teacherId === 'string') {
        conditions.push(eq(teacherClassAssignments.teacherId, teacherId));
      }
      if (active === 'true' || includeInactive !== 'true') {
        conditions.push(eq(teacherClassAssignments.isActive, true));
      }
    }

    if (classId) {
      conditions.push(eq(teacherClassAssignments.classId, parseInt(classId as string)));
    }
    if (subjectId) {
      conditions.push(eq(teacherClassAssignments.subjectId, parseInt(subjectId as string)));
    }
    if (termId) {
      conditions.push(eq(teacherClassAssignments.termId, parseInt(termId as string)));
    }

    const assignments = await db
      .select({
        id: teacherClassAssignments.id,
        teacherId: teacherClassAssignments.teacherId,
        classId: teacherClassAssignments.classId,
        subjectId: teacherClassAssignments.subjectId,
        department: teacherClassAssignments.department,
        termId: teacherClassAssignments.termId,
        session: teacherClassAssignments.session,
        isActive: teacherClassAssignments.isActive,
        validUntil: teacherClassAssignments.validUntil,
        createdAt: teacherClassAssignments.createdAt,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
        className: classes.name,
        classLevel: classes.level,
        subjectName: subjects.name,
        subjectCode: subjects.code,
      })
      .from(teacherClassAssignments)
      .leftJoin(users, eq(teacherClassAssignments.teacherId, users.id))
      .leftJoin(classes, eq(teacherClassAssignments.classId, classes.id))
      .leftJoin(subjects, eq(teacherClassAssignments.subjectId, subjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(teacherClassAssignments.createdAt));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
});

router.post('/api/teacher-assignments', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const data = createAssignmentSchema.parse(req.body);

    const existingAssignment = await db
      .select()
      .from(teacherClassAssignments)
      .where(and(
        eq(teacherClassAssignments.teacherId, data.teacherId),
        eq(teacherClassAssignments.classId, data.classId),
        eq(teacherClassAssignments.subjectId, data.subjectId),
        eq(teacherClassAssignments.isActive, true),
        data.termId ? eq(teacherClassAssignments.termId, data.termId) : isNull(teacherClassAssignments.termId)
      ))
      .limit(1);

    if (existingAssignment.length > 0) {
      const existing = existingAssignment[0];
      return res.status(409).json({ 
        message: 'This teacher is already assigned to this class/subject combination',
        existingAssignment: {
          id: existing.id,
          termId: existing.termId,
          session: existing.session,
          validUntil: existing.validUntil
        },
        hint: 'You can update the existing assignment or deactivate it before creating a new one.'
      });
    }

    let newAssignment;
    try {
      [newAssignment] = await db.insert(teacherClassAssignments).values({
        teacherId: data.teacherId,
        classId: data.classId,
        subjectId: data.subjectId,
        termId: data.termId || null,
        session: data.session || null,
        department: data.department || null,
        assignedBy: user.id,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: true,
      }).returning();
    } catch (dbError: any) {
      if (dbError.code === '23505') {
        return res.status(409).json({ 
          message: 'A duplicate assignment already exists for this teacher-class-subject combination.',
          hint: 'Please check existing assignments or update the current one.'
        });
      }
      throw dbError;
    }

    await db.insert(teacherAssignmentHistory).values({
      assignmentId: newAssignment.id,
      teacherId: data.teacherId,
      classId: data.classId,
      subjectId: data.subjectId,
      action: 'created',
      newValues: JSON.stringify(newAssignment),
      performedBy: user.id,
      ipAddress: sanitizeIp(req.headers['x-forwarded-for'] as string) || sanitizeIp(req.ip),
    });

    res.status(201).json(newAssignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error creating teacher assignment:', error);
    res.status(500).json({ message: 'Failed to create assignment' });
  }
});

router.put('/api/teacher-assignments/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const assignmentId = parseInt(req.params.id);
    const data = updateAssignmentSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(teacherClassAssignments)
      .where(eq(teacherClassAssignments.id, assignmentId));

    if (!existing) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.termId !== undefined) updateData.termId = data.termId;
    if (data.session !== undefined) updateData.session = data.session;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.validUntil !== undefined) {
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    }

    const [updated] = await db
      .update(teacherClassAssignments)
      .set(updateData)
      .where(eq(teacherClassAssignments.id, assignmentId))
      .returning();

    await db.insert(teacherAssignmentHistory).values({
      assignmentId,
      teacherId: existing.teacherId,
      classId: existing.classId,
      subjectId: existing.subjectId,
      action: 'updated',
      previousValues: JSON.stringify(existing),
      newValues: JSON.stringify(updated),
      performedBy: user.id,
      ipAddress: sanitizeIp(req.headers['x-forwarded-for'] as string) || sanitizeIp(req.ip),
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error updating teacher assignment:', error);
    res.status(500).json({ message: 'Failed to update assignment' });
  }
});

router.delete('/api/teacher-assignments/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: string };
    const assignmentId = parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(teacherClassAssignments)
      .where(eq(teacherClassAssignments.id, assignmentId));

    if (!existing) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    await db.insert(teacherAssignmentHistory).values({
      assignmentId,
      teacherId: existing.teacherId,
      classId: existing.classId,
      subjectId: existing.subjectId,
      action: 'deleted',
      previousValues: JSON.stringify(existing),
      performedBy: user.id,
      reason: req.body.reason || null,
      ipAddress: sanitizeIp(req.headers['x-forwarded-for'] as string) || sanitizeIp(req.ip),
    });

    await db
      .delete(teacherClassAssignments)
      .where(eq(teacherClassAssignments.id, assignmentId));

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting teacher assignment:', error);
    res.status(500).json({ message: 'Failed to delete assignment' });
  }
});
router.get('/api/teacher-assignments/history', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { teacherId, limit = '50' } = req.query;
    let conditions: any[] = [];

    if (teacherId) {
      conditions.push(eq(teacherAssignmentHistory.teacherId, teacherId as string));
    }

    const history = await db
      .select({
        id: teacherAssignmentHistory.id,
        assignmentId: teacherAssignmentHistory.assignmentId,
        teacherId: teacherAssignmentHistory.teacherId,
        classId: teacherAssignmentHistory.classId,
        subjectId: teacherAssignmentHistory.subjectId,
        action: teacherAssignmentHistory.action,
        previousValues: teacherAssignmentHistory.previousValues,
        newValues: teacherAssignmentHistory.newValues,
        reason: teacherAssignmentHistory.reason,
        createdAt: teacherAssignmentHistory.createdAt,
        performedByFirstName: users.firstName,
        performedByLastName: users.lastName,
      })
      .from(teacherAssignmentHistory)
      .leftJoin(users, eq(teacherAssignmentHistory.performedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(teacherAssignmentHistory.createdAt))
      .limit(parseInt(limit as string));

    res.json(history);
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

export default router;
