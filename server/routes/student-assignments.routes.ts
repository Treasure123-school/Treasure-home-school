/** Auto-split from routes.ts — student-assignments (orig lines 15119-15324). See git history. */
import * as schema from '@shared/schema.pg';
import { uploadAssignment } from '../routes/upload-config';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { users } from '@shared/schema.pg';
import { and, desc, eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentAssignmentsRoutes(app: Express) {
  // ==================== STUDENT ASSIGNMENTS ROUTES ====================

  // List assignments for the student's class with submission status
  app.get('/api/student/assignments', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const studentRecord = await storage.getStudentByUserId(userId);
      if (!studentRecord) return res.status(404).json({ message: 'Student record not found' });
      const classId = (studentRecord as any).classId;
      if (!classId) return res.json([]);

      const rows = await db
        .select({
          id: schema.assignments.id,
          title: schema.assignments.title,
          instructions: schema.assignments.instructions,
          classId: schema.assignments.classId,
          subjectId: schema.assignments.subjectId,
          subjectName: schema.subjects.name,
          subjectCode: schema.subjects.code,
          teacherId: schema.assignments.teacherId,
          teacherFirstName: schema.users.firstName,
          teacherLastName: schema.users.lastName,
          termId: schema.assignments.termId,
          dueDate: schema.assignments.dueDate,
          dueTime: schema.assignments.dueTime,
          maxScore: schema.assignments.maxScore,
          attachments: schema.assignments.attachments,
          createdAt: schema.assignments.createdAt,
          submissionId: schema.assignmentSubmissions.id,
          textAnswer: schema.assignmentSubmissions.textAnswer,
          fileUrl: schema.assignmentSubmissions.fileUrl,
          fileName: schema.assignmentSubmissions.fileName,
          fileType: schema.assignmentSubmissions.fileType,
          submittedAt: schema.assignmentSubmissions.submittedAt,
          score: schema.assignmentSubmissions.score,
          feedback: schema.assignmentSubmissions.feedback,
          gradedAt: schema.assignmentSubmissions.gradedAt,
        })
        .from(schema.assignments)
        .leftJoin(schema.subjects, eq(schema.assignments.subjectId, schema.subjects.id))
        .leftJoin(schema.users, eq(schema.assignments.teacherId, schema.users.id))
        .leftJoin(
          schema.assignmentSubmissions,
          and(
            eq(schema.assignmentSubmissions.assignmentId, schema.assignments.id),
            eq(schema.assignmentSubmissions.studentId, userId)
          )
        )
        .where(and(eq(schema.assignments.classId, classId), eq(schema.assignments.isActive, true)))
        .orderBy(desc(schema.assignments.dueDate));

      return res.json(rows);
    } catch (error: any) {
      console.error('Error fetching student assignments:', error);
      return res.status(500).json({ message: 'Failed to fetch assignments', error: error.message });
    }
  });

  // Get a single assignment with full details
  app.get('/api/student/assignments/:id', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const assignmentId = parseInt(req.params.id, 10);
      if (isNaN(assignmentId)) return res.status(400).json({ message: 'Invalid assignment id' });

      const studentRecord = await storage.getStudentByUserId(userId);
      if (!studentRecord) return res.status(404).json({ message: 'Student record not found' });
      const classId = (studentRecord as any).classId;

      const [assignment] = await db
        .select({
          id: schema.assignments.id,
          title: schema.assignments.title,
          instructions: schema.assignments.instructions,
          classId: schema.assignments.classId,
          subjectId: schema.assignments.subjectId,
          subjectName: schema.subjects.name,
          teacherFirstName: schema.users.firstName,
          teacherLastName: schema.users.lastName,
          dueDate: schema.assignments.dueDate,
          dueTime: schema.assignments.dueTime,
          maxScore: schema.assignments.maxScore,
          attachments: schema.assignments.attachments,
          createdAt: schema.assignments.createdAt,
        })
        .from(schema.assignments)
        .leftJoin(schema.subjects, eq(schema.assignments.subjectId, schema.subjects.id))
        .leftJoin(schema.users, eq(schema.assignments.teacherId, schema.users.id))
        .where(and(eq(schema.assignments.id, assignmentId), eq(schema.assignments.classId, classId)))
        .limit(1);

      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

      const [submission] = await db
        .select()
        .from(schema.assignmentSubmissions)
        .where(and(
          eq(schema.assignmentSubmissions.assignmentId, assignmentId),
          eq(schema.assignmentSubmissions.studentId, userId)
        ))
        .limit(1);

      return res.json({ ...assignment, submission: submission || null });
    } catch (error: any) {
      console.error('Error fetching assignment detail:', error);
      return res.status(500).json({ message: 'Failed to fetch assignment', error: error.message });
    }
  });

  // Submit or update an assignment submission
  app.post('/api/student/assignments/:id/submit', authenticateUser, authorizeRoles(ROLES.STUDENT), uploadAssignment.single('file'), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const assignmentId = parseInt(req.params.id, 10);
      if (isNaN(assignmentId)) return res.status(400).json({ message: 'Invalid assignment id' });

      const studentRecord = await storage.getStudentByUserId(userId);
      if (!studentRecord) return res.status(404).json({ message: 'Student record not found' });
      const classId = (studentRecord as any).classId;

      const [assignment] = await db
        .select()
        .from(schema.assignments)
        .where(and(eq(schema.assignments.id, assignmentId), eq(schema.assignments.classId, classId)))
        .limit(1);
      if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

      // Check deadline (allow submissions up to end of due date)
      const now = new Date();
      const dueDateTime = new Date(`${assignment.dueDate}T${assignment.dueTime || '23:59'}:00`);
      const isLate = now > dueDateTime;

      const textAnswer = req.body.textAnswer || null;
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;

      if (req.file) {
        const result = await uploadFileToStorage(req.file, {
          uploadType: 'general',
          userId,
          category: 'assignments',
        });
        if (result.success && result.url) {
          fileUrl = result.url;
          fileName = req.file.originalname;
          fileType = req.file.mimetype;
        }
      }

      // Upsert submission
      const [existing] = await db
        .select()
        .from(schema.assignmentSubmissions)
        .where(and(
          eq(schema.assignmentSubmissions.assignmentId, assignmentId),
          eq(schema.assignmentSubmissions.studentId, userId)
        ))
        .limit(1);

      const submittedAt = now;

      if (existing) {
        if (existing.gradedAt) {
          return res.status(403).json({ message: 'Cannot edit a graded submission' });
        }
        if (isLate && existing.submittedAt) {
          return res.status(403).json({ message: 'Deadline has passed. You cannot re-submit.' });
        }
        await db
          .update(schema.assignmentSubmissions)
          .set({
            textAnswer: textAnswer ?? existing.textAnswer,
            fileUrl: fileUrl ?? existing.fileUrl,
            fileName: fileName ?? existing.fileName,
            fileType: fileType ?? existing.fileType,
            submittedAt,
            updatedAt: now,
          })
          .where(eq(schema.assignmentSubmissions.id, existing.id));
        const [updated] = await db.select().from(schema.assignmentSubmissions).where(eq(schema.assignmentSubmissions.id, existing.id)).limit(1);
        return res.json({ submission: updated, isLate });
      } else {
        const [created] = await db
          .insert(schema.assignmentSubmissions)
          .values({
            assignmentId,
            studentId: userId,
            textAnswer,
            fileUrl,
            fileName,
            fileType,
            submittedAt,
          })
          .returning();
        return res.status(201).json({ submission: created, isLate });
      }
    } catch (error: any) {
      console.error('Error submitting assignment:', error);
      return res.status(500).json({ message: 'Failed to submit assignment', error: error.message });
    }
  });

  // ==================== END STUDENT ASSIGNMENTS ROUTES ====================

}
