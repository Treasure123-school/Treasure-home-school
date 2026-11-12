/** Auto-split from routes.ts — student-timetable (orig lines 15427-15475). See git history. */
import * as schema from '@shared/schema.pg';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { users } from '@shared/schema.pg';
import { eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentTimetableRoutes(app: Express) {
  // ==================== STUDENT TIMETABLE ROUTE ====================
  app.get('/api/student/timetable', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const studentRecord = await storage.getStudentByUserId(userId);
      if (!studentRecord) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      const classId = (studentRecord as any).classId;
      if (!classId) {
        return res.json({ schedule: [], className: null, classInfo: null });
      }

      const classInfo = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1);

      const schedule = await db
        .select({
          id: schema.timetable.id,
          dayOfWeek: schema.timetable.dayOfWeek,
          startTime: schema.timetable.startTime,
          endTime: schema.timetable.endTime,
          location: schema.timetable.location,
          subjectId: schema.timetable.subjectId,
          subjectName: schema.subjects.name,
          subjectCode: schema.subjects.code,
          teacherId: schema.timetable.teacherId,
          teacherFirstName: schema.users.firstName,
          teacherLastName: schema.users.lastName,
        })
        .from(schema.timetable)
        .leftJoin(schema.subjects, eq(schema.timetable.subjectId, schema.subjects.id))
        .leftJoin(schema.users, eq(schema.timetable.teacherId, schema.users.id))
        .where(eq(schema.timetable.classId, classId))
        .orderBy(schema.timetable.dayOfWeek, schema.timetable.startTime);

      return res.json({
        schedule,
        className: classInfo[0]?.name || null,
        classInfo: classInfo[0] || null,
      });
    } catch (error: any) {
      console.error('Error fetching student timetable:', error);
      return res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
    }
  });
  // ==================== END STUDENT TIMETABLE ROUTE ====================

}
