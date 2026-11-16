/** Teacher exam results by exam endpoint — split from realtime-sync.routes.ts. */
/** Auto-split from routes.ts — realtime-sync (orig lines 1326-2212). See git history. */
import * as schema from '@shared/schema.pg';
import { getVisibleExamsForParent, getVisibleExamsForStudent, invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { validateTeacherCanCreateExam } from '../teacher-auth-middleware';
import { insertExamSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request } from 'express';
import session from 'express-session';
import { ZodError } from 'zod';


export async function registerSyncTeacherResultsRoutes(app: Express) {

  // Get exam results by exam ID - TEACHERS AND ADMINS
  app.get('/api/exam-results/exam/:examId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const teacherId = req.user!.id;

      // Validate exam ID
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Verify exam exists
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // For teachers, allow viewing results if they created the exam, are the teacher in charge,
      // or teach the class-subject combination
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        // Also check if teacher is assigned to this class-subject
        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail - continue with other checks
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only view results for exams you created, are assigned to, or teach' });
        }
      }

      // Get results with student info for better display
      const results = await storage.getExamResultsByExam(examId);

      // Enrich with student information — batched into a single query instead of
      // one getStudent()+getUser() round-trip per result (was N+1).
      const studentMap = await storage.getStudentsByIds(results.map((r: any) => r.studentId));
      const enrichedResults = results.map((result: any) => {
        const student = studentMap.get(result.studentId);
        return {
          ...result,
          studentName: student?.firstName && student?.lastName
            ? `${student.firstName} ${student.lastName}`
            : student?.username || 'Unknown Student',
          studentUsername: student?.username || null,
          admissionNumber: student?.admissionNumber || null
        };
      });

      res.json(enrichedResults);
    } catch (error: any) {
      console.error('[EXAM-RESULTS] Error fetching exam results:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam results' });
    }
  });
}
