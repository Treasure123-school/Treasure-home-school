/** Teacher exam result update, sync-to-reportcard, allow-retake — split from exams-management.routes.ts. */
/** Auto-split from routes.ts — exams-management (orig lines 2626-3701). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { autoScoreExamSession } from '../routes/exam-scoring';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { reliableSyncService } from '../services/reliable-sync-service';
import { storage } from '../storage';
import { logExamAccess, validateExamTimeWindow } from '../teacher-auth-middleware';
import { computeExamTiming, logExamTiming } from '../utils/exam-timing';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import session from 'express-session';
import { Server } from 'http';
import { z } from 'zod';



export async function registerExamResultsRoutes(app: Express) {
  // Update exam result - TEACHERS ONLY (update test score, remarks)
  app.patch('/api/teacher/exam-results/:resultId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const resultId = parseInt(req.params.resultId);
      const teacherId = req.user!.id;

      if (isNaN(resultId) || resultId <= 0) {
        return res.status(400).json({ message: 'Invalid result ID' });
      }

      // Zod schema validation for input
      const updateExamResultSchema = z.object({
        testScore: z.number().min(0).nullable().optional(),
        remarks: z.string().max(500).optional()
      });

      const parseResult = updateExamResultSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: 'Invalid input',
          errors: parseResult.error.flatten().fieldErrors
        });
      }

      const { testScore, remarks } = parseResult.data;

      // Get the exam result to verify it exists
      const result = await storage.getExamResultById(resultId);
      if (!result) {
        return res.status(404).json({ message: 'Exam result not found' });
      }

      // Get the exam to verify teacher ownership
      const exam = await storage.getExamById(result.examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Validate testScore is within bounds of exam.totalMarks
      if (testScore !== undefined && testScore !== null) {
        const maxScore = result.maxScore || exam.totalMarks || 100;
        if (testScore > maxScore) {
          return res.status(400).json({
            message: `Test score cannot exceed maximum score of ${maxScore}`
          });
        }
      }

      // For teachers, verify ownership of the exam
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail - if we can't check, we fall back to other ownership checks
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only update results for exams you created, are assigned to, or teach' });
        }
      }

      // Update the exam result
      const updateData: any = {};
      if (testScore !== undefined) {
        updateData.score = testScore;
        updateData.marksObtained = testScore;
        updateData.resultReleasedAt = new Date();
      }
      if (remarks !== undefined) {
        updateData.remarks = remarks;
      }

      const updatedResult = await storage.updateExamResult(resultId, updateData);

      // Emit realtime event
      realtimeService.emitTableChange('exam_results', 'UPDATE', updatedResult, result, teacherId);

      res.json(updatedResult);

      // ── BUG-FIX: auto-sync updated score to report card (fire-and-forget) ──
      // Previously: score was saved in DB but never propagated to report_card_items.
      if (testScore !== undefined && testScore !== null) {
        const scoreVal = typeof testScore === 'number' ? testScore : Number(testScore) || 0;
        const maxVal = result.maxScore || exam.totalMarks || 100;
        reliableSyncService.syncExamScoreToReportCardReliable(
          result.studentId,
          result.examId,
          scoreVal,
          maxVal,
          { syncType: 'manual_sync', triggeredBy: teacherId }
        ).catch((e: any) =>
          console.error('[EXAM-RESULTS-PATCH] Background report-card sync failed:', e.message)
        );
      }
    } catch (error: any) {
      console.error('[EXAM-RESULTS] Error updating exam result:', error?.message);
      res.status(500).json({ message: 'Failed to update exam result' });
    }
  });

  // Sync exam result to report card - TEACHERS ONLY
  app.post('/api/teacher/exam-results/:resultId/sync-reportcard', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const resultId = parseInt(req.params.resultId);
      const teacherId = req.user!.id;

      if (isNaN(resultId) || resultId <= 0) {
        return res.status(400).json({ message: 'Invalid result ID' });
      }

      // Get the exam result
      const result = await storage.getExamResultById(resultId);
      if (!result) {
        return res.status(404).json({ message: 'Exam result not found' });
      }

      // Get the exam
      const exam = await storage.getExamById(result.examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // For teachers, verify ownership
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only sync results for exams you created, are assigned to, or teach' });
        }
      }

      // Use the reliable sync service with audit logging
      const syncResult = await reliableSyncService.syncExamScoreToReportCardReliable(
        result.studentId,
        result.examId,
        result.score || 0,
        result.maxScore || exam.totalMarks || 100,
        {
          syncType: 'manual_sync',
          triggeredBy: teacherId
        }
      );

      if (!syncResult.success) {
        return res.status(400).json({
          message: syncResult.message,
          errorCode: syncResult.errorCode,
          auditLogId: syncResult.auditLogId
        });
      }

      // Emit realtime event (already handled by reliable sync service, but emit extra for UI consistency)
      if (syncResult.reportCardId) {
        realtimeService.emitTableChange('report_cards', 'UPDATE', { id: syncResult.reportCardId }, undefined, teacherId);
      }

      res.json({
        message: syncResult.message,
        reportCardId: syncResult.reportCardId,
        reportCardItemId: syncResult.reportCardItemId,
        isNewReportCard: syncResult.isNewReportCard,
        auditLogId: syncResult.auditLogId
      });
    } catch (error: any) {
      console.error('[EXAM-RESULTS] Error syncing to report card:', error?.message);
      res.status(500).json({ message: 'Failed to sync to report card' });
    }
  });

  // Allow student to retake an exam - TEACHERS AND ADMINS
  // This archives the previous submission and removes session/result data so student can retake
  app.post('/api/teacher/exams/:examId/allow-retake/:studentId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const studentId = req.params.studentId;
      const teacherId = req.user!.id;

      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required' });
      }

      // Get the exam
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Verify the student exists
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // For teachers, verify ownership of the exam
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only allow retakes for exams you created, are assigned to, or teach' });
        }
      }

      // Call the storage method to allow retake
      const result = await storage.allowExamRetake(examId, studentId, teacherId);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      // Emit realtime events to notify the student
      realtimeService.emitToUser(studentId, 'exam.retake.allowed', {
        examId,
        examTitle: exam.name,
        message: 'You have been allowed to retake this exam'
      });

      // Log the action
      await storage.createAuditLog({
        userId: teacherId,
        action: 'ALLOW_EXAM_RETAKE',
        entityType: 'exam',
        entityId: examId.toString(),
        newValue: JSON.stringify({
          examId,
          studentId,
          examTitle: exam.name,
          archivedSubmissionId: result.archivedSubmissionId
        })
      });

      res.json({
        success: true,
        message: result.message,
        archivedSubmissionId: result.archivedSubmissionId
      });
    } catch (error: any) {
      console.error('[EXAM-RETAKE] Error allowing exam retake:', error?.message);
      res.status(500).json({ message: 'Failed to allow exam retake' });
    }
  });
}
