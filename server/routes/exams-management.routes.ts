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

export async function registerExamsManagementRoutes(app: Express) {

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

  // Update exam - TEACHERS ONLY (creator or teacher in charge) with assignment validation
  app.patch('/api/exams/:id', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const teacherId = req.user!.id;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Admins and Super Admins can edit any exam, teachers need to be creator or assigned
      const isAdmin = req.user!.roleId === ROLES.ADMIN;
      const isCreator = existingExam.createdBy === teacherId;
      const isTeacherInCharge = existingExam.teacherInChargeId === teacherId;
      if (!isAdmin && !isCreator && !isTeacherInCharge) {
        return res.status(403).json({ message: 'You can only edit exams you created or are assigned to' });
      }

      // SECURITY: Validate teacherInChargeId whenever it's present in request
      // This prevents privilege escalation by assigning to non-teacher or inactive accounts
      if (req.body.teacherInChargeId !== undefined) {
        // If teacherInChargeId is provided, validate it's a valid active teacher
        const assignedUser = await storage.getUser(req.body.teacherInChargeId);
        if (!assignedUser) {
          return res.status(400).json({ message: 'Assigned teacher not found' });
        }
        if (assignedUser.roleId !== ROLES.TEACHER) {
          return res.status(400).json({ message: 'teacherInChargeId must be a teacher' });
        }
        if (!assignedUser.isActive) {
          return res.status(400).json({ message: 'Assigned teacher is not active' });
        }
      }

      // Only pass allowed fields to prevent unexpected field updates
      const allowedFields = ['name', 'description', 'date', 'timeLimit', 'totalMarks',
        'classId', 'subjectId', 'teacherInChargeId', 'isPublished', 'instructions',
        'passingScore', 'maxAttempts', 'showResults', 'shuffleQuestions', 'shuffleOptions',
        'showCorrectAnswers', 'autoGradingEnabled', 'instantFeedback', 'gradingScale',
        'timerMode'];
      const sanitizedData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          sanitizedData[field] = req.body[field];
        }
      }

      const exam = await storage.updateExam(examId, sanitizedData);

      if (!exam) {
        return res.status(500).json({ message: 'Failed to update exam' });
      }

      // CRITICAL: When exam subject changes, sync report card items to use new subject
      // This ensures report cards reflect the updated exam subject
      let reportCardSyncResult = { updated: 0, errors: [] as string[] };
      if (sanitizedData.subjectId !== undefined && sanitizedData.subjectId !== existingExam.subjectId) {
        console.log(`[EXAM-UPDATE] Subject changed from ${existingExam.subjectId} to ${sanitizedData.subjectId} for exam ${examId}. Syncing report cards...`);
        try {
          reportCardSyncResult = await storage.syncReportCardItemsOnExamSubjectChange(examId, existingExam.subjectId!,
            sanitizedData.subjectId
          );
          console.log(`[EXAM-UPDATE] Report card sync complete: ${reportCardSyncResult.updated} items updated`);
        } catch (syncError: any) {
          console.error(`[EXAM-UPDATE] Failed to sync report card items:`, syncError?.message);
          // Don't fail the request, just log the error - exam was still updated
        }
      }

      // Invalidate exam visibility cache when exam is updated
      invalidateVisibilityCache({ examId: exam.id });

      // Emit realtime event for exam update
      realtimeService.emitTableChange('exams', 'UPDATE', exam, existingExam, teacherId);
      // Emit to the specific exam room — students currently taking this exam are subscribed here
      realtimeService.emitToExam(exam.id, 'exam.updated', exam);
      if (exam.classId) {
        // Emit to the class room — students in this class who have the exam page open receive this
        realtimeService.emitToClass(exam.classId.toString(), 'exam.updated', exam);
      }

      res.json({
        ...exam,
        reportCardSync: reportCardSyncResult.updated > 0 ? reportCardSyncResult : undefined
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exam' });
    }
  });

  // Delete exam - Admins (any exam) and Teachers (own exams only)
  // Implements comprehensive smart deletion with cascade, audit logging, and cleanup
  app.delete('/api/exams/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    const startTime = Date.now();
    try {
      const examId = parseInt(req.params.id);
      const deletedBy = req.user!;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        // Exam already deleted — respond with 200 so the client treats it as success
        return res.status(200).json({ message: 'Exam already deleted', alreadyDeleted: true });
      }

      // Admins can delete any exam; teachers can only delete their own
      const isAdmin = deletedBy.roleId === ROLES.ADMIN;
      if (!isAdmin && existingExam.createdBy !== deletedBy.id) {
        return res.status(403).json({ message: 'You can only delete exams you created' });
      }

      // Get additional context for audit log
      const examClass = await storage.getClass(existingExam.classId!);
      const examSubject = await storage.getSubject(existingExam.subjectId!);

      // Perform comprehensive smart deletion
      const deletionResult = await storage.deleteExam(examId);

      if (!deletionResult.success) {
        return res.status(500).json({ message: 'Failed to delete exam' });
      }

      // Invalidate exam visibility cache
      invalidateVisibilityCache({ examId: examId });

      const duration = Date.now() - startTime;

      // Create audit log for accountability
      try {
        await storage.createAuditLog({
          userId: deletedBy.id,
          action: 'exam_deleted',
          entityType: 'exam',
          entityId: examId.toString(),
          oldValue: JSON.stringify({
            exam: existingExam,
            className: examClass?.name,
            subjectName: examSubject?.name
          }),
          newValue: JSON.stringify({
            deletedAt: new Date().toISOString(),
            deletedCounts: deletionResult.deletedCounts,
            duration: `${duration}ms`
          }),
          reason: `Exam "${existingExam.name}" permanently deleted by ${deletedBy.email || (deletedBy as any).username}. Cascade deleted: ${deletionResult.deletedCounts.questions} questions, ${deletionResult.deletedCounts.questionOptions} options, ${deletionResult.deletedCounts.sessions} sessions, ${deletionResult.deletedCounts.studentAnswers} student answers, ${deletionResult.deletedCounts.results} results. ${deletionResult.deletedCounts.filesDeleted} files removed from storage. ${deletionResult.deletedCounts.reportCardRefsCleared} report card references cleared.`,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        console.error('[SmartDeletion] Error creating audit log:', auditError);
        // Don't fail the deletion if audit logging fails
      }

      // Emit realtime events for cache invalidation and UI updates
      realtimeService.emitTableChange('exams', 'DELETE', { id: examId }, existingExam, deletedBy.id);
      if (existingExam.classId) {
        realtimeService.emitToClass(existingExam.classId.toString(), 'exam.deleted', {
          ...existingExam,
          deletedCounts: deletionResult.deletedCounts
        });
      }

      // Also emit to teachers and admins for subject-specific views
      if (existingExam.subjectId) {
        realtimeService.emitToRole('teacher', 'subject.exam.deleted', {
          subjectId: existingExam.subjectId,
          examId: examId,
          examName: existingExam.name
        });
        realtimeService.emitToRole('admin', 'subject.exam.deleted', {
          subjectId: existingExam.subjectId,
          examId: examId,
          examName: existingExam.name
        });
      }

      console.log(`[SmartDeletion] Exam ${examId} "${existingExam.name}" deleted in ${duration}ms by ${deletedBy.email || (deletedBy as any).username}`);

      res.status(200).json({
        message: 'Exam deleted successfully',
        deletedCounts: deletionResult.deletedCounts,
        duration: `${duration}ms`
      });
    } catch (error: any) {
      console.error('[SmartDeletion] Error deleting exam:', error);
      res.status(500).json({ message: error?.message || 'Failed to delete exam' });
    }
  });

  // Toggle exam publish status - Teachers (creator or teacher in charge) and Admins only
  app.patch('/api/exams/:id/publish', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const teacherId = req.user!.id;
      const { isPublished } = req.body;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Admins and Super Admins can publish any exam, teachers need to be creator or assigned
      const isAdmin = req.user!.roleId === ROLES.ADMIN;
      const isCreator = existingExam.createdBy === teacherId;
      const isTeacherInCharge = existingExam.teacherInChargeId === teacherId;
      if (!isAdmin && !isCreator && !isTeacherInCharge) {
        return res.status(403).json({ message: 'You can only publish/unpublish exams you created or are assigned to' });
      }
      const exam = await storage.updateExam(examId, { isPublished });

      if (!exam) {
        return res.status(500).json({ message: 'Failed to update exam publish status' });
      }

      // Invalidate exam visibility cache when publish status changes
      invalidateVisibilityCache({ examId: exam.id });

      // Use dedicated exam publish/unpublish emit method for comprehensive realtime updates
      realtimeService.emitExamPublishEvent(examId, isPublished, exam, teacherId);

      res.json(exam);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exam publish status' });
    }
  });

  // Submit exam - synchronous with instant scoring and enhanced reliability
  // ENHANCED: Added server-side timer validation, duplicate prevention, transaction safety, and time-window validation
  app.post('/api/exams/:examId/submit', authenticateUser, authorizeRoles(ROLES.STUDENT), logExamAccess, validateExamTimeWindow, async (req, res) => {
    const startTime = Date.now();
    let sessionId: number | null = null;

    try {
      const examId = parseInt(req.params.examId);
      const studentId = req.user!.id;
      const { forceSubmit, violationCount, clientTimeRemaining, submissionReason, pendingAnswers } = req.body;

      // Validate submission reason (may be overridden below once we know the server-side timing)
      const validReasons = ['manual', 'timeout', 'violation'];
      let reason: 'manual' | 'timeout' | 'violation' = validReasons.includes(submissionReason) ? submissionReason : 'manual';

      // Validate exam ID
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID provided' });
      }

      // Verify the exam exists
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Find the active exam session
      const sessions = await storage.getExamSessionsByStudent(studentId);
      const activeSession = sessions.find(s => s.examId === examId && !s.isCompleted);

      // SERVER-SIDE TIMER VALIDATION: Prevent time manipulation cheating.
      // Submission is always accepted (the student is trying to end the exam), but we
      // never trust the client-reported `submissionReason` for whether time actually
      // ran out — that is derived from the server's own clock only.
      let reasonOverride: 'manual' | 'timeout' | 'violation' | null = null;
      if (activeSession) {
        const timing = computeExamTiming(activeSession, exam);
        if (timing.isExpired) {
          logExamTiming('submit-detected-expired', { sessionId: activeSession.id, remainingMs: timing.remainingMs });
          reasonOverride = 'timeout';
        }
      }
      // Server-detected expiry always wins over whatever the client claimed.
      if (reasonOverride) {
        reason = reasonOverride;
      }

      if (!activeSession) {
        // Check if already submitted - return existing results
        const completedSession = sessions.find(s => s.examId === examId && s.isCompleted);
        if (completedSession) {
          // If the client sent pending answers, upsert them and re-score.
          // This handles the case where network failed mid-submission and some answers
          // never reached the server before the session was marked complete.
          if (Array.isArray(pendingAnswers) && pendingAnswers.length > 0) {
            try {
              let flushedCount = 0;
              for (const pa of pendingAnswers) {
                try {
                  const { questionId, answer, questionType } = pa;
                  if (!questionId || answer === undefined || answer === null || answer === '') continue;
                  const answerData: any = {};
                  if (questionType === 'multiple_choice') {
                    const optId = typeof answer === 'number' ? answer : parseInt(answer);
                    if (!isNaN(optId)) answerData.selectedOptionId = optId;
                  } else {
                    answerData.textAnswer = String(answer);
                  }
                  await storage.upsertStudentAnswer(completedSession.id, questionId, answerData);
                  flushedCount++;
                } catch (flushError) {
                  console.error(`[SUBMIT] Failed to flush late answer for question ${pa?.questionId} on session ${completedSession.id}:`, flushError);
                }
              }
              if (flushedCount > 0) {
                console.log(`[SUBMIT] Flushed ${flushedCount} late answers for already-completed session ${completedSession.id}. Re-scoring...`);
                await autoScoreExamSession(completedSession.id, storage);
              }
            } catch (flushErr) {
              console.warn(`[SUBMIT] Late-answer flush failed for session ${completedSession.id}:`, flushErr);
            }
          }

          const existingResult = await storage.getExamResultByExamAndStudent(examId, studentId);
          const studentAnswers = await storage.getStudentAnswers(completedSession.id);
          const examQuestions = await storage.getExamQuestions(examId);

          const questionDetails = await Promise.all(examQuestions.map(async (q) => {
            const answer = studentAnswers.find(a => a.questionId === q.id);
            const options = q.questionType === 'multiple_choice' ? await storage.getQuestionOptions(q.id) : [];

            // Student Answer Text
            let studentAnswerText = "No answer provided";
            if (answer) {
              if (q.questionType === 'multiple_choice' && answer.selectedOptionId) {
                const selectedOption = options.find(o => o.id === answer.selectedOptionId);
                studentAnswerText = selectedOption?.optionText || "Option not found";
              } else if (answer.textAnswer) {
                studentAnswerText = answer.textAnswer;
              }
            }

            // Correct Answer Text from Teacher's setup
            let correctAnswerText = "Not available";
            let isCorrect = answer?.isCorrect || false;
            let pointsAwarded = answer?.pointsEarned || 0;

            if (q.questionType === 'multiple_choice') {
              const correctOption = options.find(o => o.isCorrect);
              correctAnswerText = correctOption?.optionText || "Not specified";

              // Re-verify correctness if it's missing or needs enforcement
              if (answer && answer.selectedOptionId && correctOption) {
                isCorrect = answer.selectedOptionId === correctOption.id;
              }
            } else {
              try {
                const expected = typeof q.expectedAnswers === 'string'
                  ? JSON.parse(q.expectedAnswers)
                  : q.expectedAnswers;
                correctAnswerText = Array.isArray(expected) ? expected.join(", ") : String(expected || "Not specified");
              } catch (e) {
                correctAnswerText = String(q.expectedAnswers || "Not specified");
              }
            }

            const showAnswers = exam.showCorrectAnswers ?? true;
            return {
              questionId: q.id,
              questionText: q.questionText,
              questionType: q.questionType,
              points: q.points,
              studentAnswer: studentAnswerText,
              selectedOptionId: answer?.selectedOptionId || null,
              isCorrect: isCorrect,
              pointsAwarded: pointsAwarded,
              correctAnswer: showAnswers ? correctAnswerText : undefined,
              explanation: showAnswers ? q.explanationText : undefined,
              feedback: answer?.feedbackText || null
            };
          }));

          const filteredQuestionDetailsExisting = (exam.showCorrectAnswers ?? true) ? questionDetails : [];

          return res.json({
            submitted: true,
            alreadySubmitted: true,
            message: 'Exam was previously submitted. Returning existing results.',
            result: {
              sessionId: completedSession.id,
              score: existingResult?.score || completedSession.score || 0,
              maxScore: existingResult?.maxScore || completedSession.maxScore || exam.totalMarks || 0,
              percentage: existingResult?.maxScore
                ? ((existingResult.score || 0) / existingResult.maxScore) * 100
                : completedSession.maxScore
                  ? ((completedSession.score || 0) / completedSession.maxScore) * 100
                  : 0,
              submittedAt: completedSession.submittedAt?.toISOString() || new Date().toISOString(),
              showCorrectAnswers: exam.showCorrectAnswers ?? true,
              questionDetails: filteredQuestionDetailsExisting,
              breakdown: {
                totalQuestions: examQuestions.length,
                answered: studentAnswers.filter(a => a.textAnswer || a.selectedOptionId).length,
                correct: studentAnswers.filter(a => a.isCorrect).length,
                autoScored: studentAnswers.filter(a => a.isCorrect !== null).length
              }
            }
          });
        }
        return res.status(404).json({ message: 'No active exam session found. Please start a new exam session.' });
      }

      sessionId = activeSession.id;
      const now = new Date();

      // Calculate time taken
      const sessionStartTime = new Date(activeSession.startedAt).getTime();
      const timeTakenSeconds = Math.floor((now.getTime() - sessionStartTime) / 1000);

      // Build metadata with submission details
      const existingMetadata = activeSession.metadata ? JSON.parse(activeSession.metadata) : {};
      const sessionMetadata = {
        ...existingMetadata,
        submissionReason: reason,
        submittedVia: forceSubmit ? 'auto' : 'manual',
        violationCount: violationCount || 0,
        timeTakenSeconds,
        clientTimeRemaining: clientTimeRemaining || 0,
        serverTimestamp: now.toISOString()
      };

      // IDEMPOTENCY: Atomically claim this session for submission. The update only
      // succeeds if the session is still not completed (WHERE isCompleted = false at the
      // DB level), so if two requests race for the same session (e.g. the student clicks
      // Submit right as the timer auto-submits, or a retried request from a flaky network
      // overlaps with the original), only one can win. The loser falls through to the
      // "already submitted" branch below and returns the winner's result instead of
      // re-scoring and double-processing.
      const claimedSession = await storage.claimExamSessionForSubmission(activeSession.id, {
        submittedAt: now,
        status: reason === 'manual' ? 'submitted' : `auto_${reason}`,
        metadata: JSON.stringify(sessionMetadata)
      });

      if (!claimedSession) {
        console.log(`[SUBMIT] Session ${activeSession.id} was already claimed by a concurrent request. Returning existing result.`);
        const existingResult = await storage.getExamResultByExamAndStudent(examId, studentId);
        const completedSession = await storage.getExamSessionById(activeSession.id);
        return res.json({
          submitted: true,
          alreadySubmitted: true,
          message: 'Exam was already submitted by a concurrent request. Returning existing results.',
          result: {
            sessionId: activeSession.id,
            score: existingResult?.score || completedSession?.score || 0,
            maxScore: existingResult?.maxScore || completedSession?.maxScore || exam.totalMarks || 0,
            percentage: existingResult?.maxScore
              ? ((existingResult.score || 0) / existingResult.maxScore) * 100
              : completedSession?.maxScore
                ? ((completedSession.score || 0) / completedSession.maxScore) * 100
                : 0,
            submittedAt: completedSession?.submittedAt?.toISOString() || now.toISOString(),
            showCorrectAnswers: exam.showCorrectAnswers ?? true
          }
        });
      }

      // PENDING ANSWER FLUSH: Upsert any answers the client sent in the submit payload.
      // These are the full localStorage snapshot, acting as a safety net for answers that
      // hadn't finished syncing to the server before submission (e.g. after network recovery).
      // We do this BEFORE reading studentAnswers so scoring sees the complete set.
      if (Array.isArray(pendingAnswers) && pendingAnswers.length > 0) {
        let flushedCount = 0;
        for (const pa of pendingAnswers) {
          try {
            const { questionId, answer, questionType } = pa;
            if (!questionId || answer === undefined || answer === null || answer === '') continue;
            const answerData: any = {};
            if (questionType === 'multiple_choice') {
              const optId = typeof answer === 'number' ? answer : parseInt(answer);
              if (!isNaN(optId)) answerData.selectedOptionId = optId;
            } else {
              answerData.textAnswer = String(answer);
            }
            await storage.upsertStudentAnswer(activeSession.id, questionId, answerData);
            flushedCount++;
          } catch (flushError) {
            console.error(`[SUBMIT] Failed to flush pending answer for question ${pa?.questionId} on session ${activeSession.id}:`, flushError);
          }
        }
        if (flushedCount > 0) {
          console.log(`[SUBMIT] Flushed ${flushedCount} pending answers for session ${activeSession.id} before scoring.`);
        }
      }

      // Calculate correct answers count manually - ensure accuracy
      const studentAnswers = await storage.getStudentAnswers(activeSession.id);
      const examQuestions = await storage.getExamQuestions(examId);

      let correctAnswersCount = 0;
      for (const question of examQuestions) {
        const answer = studentAnswers.find(a => a.questionId === question.id);
        if (!answer) continue;

        if (question.questionType === 'multiple_choice') {
          const options = await storage.getQuestionOptions(question.id);
          const correctOption = options.find(o => o.isCorrect);
          if (correctOption && answer.selectedOptionId === correctOption.id) {
            correctAnswersCount++;
          }
        } else if (question.questionType === 'true_false' || question.questionType === 'fill_blank') {
          // Basic comparison for text-based auto-gradable questions
          if (answer.textAnswer?.trim().toLowerCase() === question.expectedAnswers?.trim().toLowerCase()) {
            correctAnswersCount++;
          }
        }
      }

      // Update exam result with correct answers count and time taken
      const existingResults = await storage.getExamResultsByStudent(studentId);
      const existingResult = existingResults.find((r: any) => r.examId === examId);

      const minsTaken = Math.floor(timeTakenSeconds / 60);
      const secsTaken = timeTakenSeconds % 60;
      const timeTakenStr = `${minsTaken} min${minsTaken !== 1 ? 's' : ''} ${secsTaken} sec${secsTaken !== 1 ? 's' : ''}`;

      if (existingResult) {
        await storage.updateExamResult(existingResult.id, {
          correctAnswers: correctAnswersCount,
          totalQuestions: examQuestions.length,
          timeTaken: timeTakenSeconds,
          submittedAt: now
        });
      }

      // Auto-score the exam with error recovery
      const scoringStartTime = Date.now();
      let scoringSuccessful = false;
      let scoringError: Error | null = null;

      try {
        await autoScoreExamSession(activeSession.id, storage);
        scoringSuccessful = true;
      } catch (scoreError: any) {
        console.error(`[SUBMIT] Auto-scoring failed for session ${activeSession.id}:`, scoreError?.message);
        scoringError = scoreError;
        // Continue - we'll still return results even if scoring fails
      }

      const scoringTime = Date.now() - scoringStartTime;

      // Get the updated session with scores
      const updatedSession = await storage.getExamSessionById(activeSession.id);

      // Calculate score from answers if session score is missing
      let totalScore = updatedSession?.score || 0;
      let maxScore = updatedSession?.maxScore || exam.totalMarks || 0;

      if (totalScore === 0 && studentAnswers.length > 0) {
        // Fallback: Calculate score from individual answer scores
        totalScore = studentAnswers.reduce((sum, ans) => sum + (ans.pointsEarned || 0), 0);
      }

      if (maxScore === 0 && examQuestions.length > 0) {
        // Fallback: Calculate max score from questions
        maxScore = examQuestions.reduce((sum, q) => sum + (q.points || 0), 0);
      }

      // Update session with calculated scores if they were missing
      if ((updatedSession?.score !== totalScore || updatedSession?.maxScore !== maxScore) && totalScore > 0) {
        try {
          await storage.updateExamSession(activeSession.id, {
            score: totalScore,
            maxScore: maxScore,
            status: 'graded'
          });
        } catch (updateError) {
          console.warn('[SUBMIT] Failed to update session with calculated scores:', updateError);
        }
      }

      // Build question details for frontend.
      // FAULT-TOLERANT: Each question's detail is built independently — if one options
      // query fails (e.g. transient DB pool exhaustion), we degrade that single entry
      // instead of failing the whole submission response. The exam is already durably
      // committed at this point; a 500 here would wrongly tell the student their
      // submission failed.
      const questionDetails = await Promise.all(examQuestions.map(async (q) => {
        try {
          const answer = studentAnswers.find(a => a.questionId === q.id);
          const options = q.questionType === 'multiple_choice' ? await storage.getQuestionOptions(q.id) : [];

          // Student Answer Text
          let studentAnswerText = "No answer provided";
          if (answer) {
            if (q.questionType === 'multiple_choice' && answer.selectedOptionId) {
              const selectedOption = options.find(o => o.id === answer.selectedOptionId);
              studentAnswerText = selectedOption?.optionText || "Option not found";
            } else if (answer.textAnswer) {
              studentAnswerText = answer.textAnswer;
            }
          }

          // Correct Answer Text from Teacher's setup
          let correctAnswerText = "Not available";
          let isCorrect = answer?.isCorrect || false;
          let pointsAwarded = answer?.pointsEarned || 0;

          if (q.questionType === 'multiple_choice') {
            const correctOption = options.find(o => o.isCorrect);
            correctAnswerText = correctOption?.optionText || "Not specified";

            // Re-verify correctness if it's missing or needs enforcement
            if (answer && answer.selectedOptionId && correctOption) {
              isCorrect = answer.selectedOptionId === correctOption.id;
            }
          } else {
            try {
              const expected = typeof q.expectedAnswers === 'string'
                ? JSON.parse(q.expectedAnswers)
                : q.expectedAnswers;
              correctAnswerText = Array.isArray(expected) ? expected.join(", ") : String(expected || "Not specified");
            } catch (e) {
              correctAnswerText = String(q.expectedAnswers || "Not specified");
            }
          }

          const showAnswers = exam.showCorrectAnswers ?? true;
          return {
            questionId: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            studentAnswer: studentAnswerText,
            selectedOptionId: answer?.selectedOptionId || null,
            isCorrect: isCorrect,
            pointsAwarded: pointsAwarded,
            // Only expose the correct answer if the teacher has enabled it
            correctAnswer: showAnswers ? correctAnswerText : undefined,
            explanation: showAnswers ? q.explanationText : undefined,
            feedback: answer?.feedbackText || null
          };
        } catch (detailError: any) {
          console.error(`[SUBMIT] Failed to build details for question ${q.id}:`, detailError?.message);
          return {
            questionId: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            studentAnswer: "Details unavailable",
            selectedOptionId: null,
            isCorrect: false,
            pointsAwarded: 0,
            correctAnswer: undefined,
            explanation: undefined,
            feedback: null
          };
        }
      }));

      // If showCorrectAnswers is off, clear the details so no breakdown is sent
      const filteredQuestionDetails = (exam.showCorrectAnswers ?? true) ? questionDetails : [];

      const totalTime = Date.now() - startTime;
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

      // NOTE: Report card sync, and realtime notifications are executed AFTER the response
      // is sent (see below, post res.json()). The exam session was already marked completed
      // and scored above — that write is the durable "submission" state. Running the
      // (slower) sync/audit/notification pipeline synchronously here was the root cause of
      // the "Connection Error after submit, but exam was already submitted" bug: the client's
      // fetch would time out waiting on this tail work even though the submission had already
      // been safely committed to the database. We now respond immediately once scoring is
      // done, and process the rest in the background.
      const reportCardSync: { success: boolean; message: string; reportCardId?: number; isNewReportCard?: boolean; auditLogId?: number } = {
        success: true,
        message: 'Report card sync is processing in the background.'
      };

      // Format time taken for display
      const formatTimeTaken = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs} seconds`;
        return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
      };

      // Emit realtime event for exam submission (fire-and-forget, non-blocking)
      realtimeService.emitExamEvent(examId, 'submitted', {
        sessionId: activeSession.id,
        studentId,
        examId,
        classId: exam.classId,
        score: totalScore,
        maxScore,
        percentage: Math.round(percentage * 100) / 100,
        submissionReason: reason,
      });

      // Return instant results with enhanced metadata.
      // IMPORTANT: The submission is already durably committed at this point (session marked
      // completed + scored above). We respond now so the student sees success immediately,
      // then run the slower report-card sync in the background below.
      res.json({
        submitted: true,
        scoringSuccessful,
        submissionReason: reason,
        timedOut: reason === 'timeout',
        violationSubmit: reason === 'violation',
        message: scoringSuccessful
          ? `Exam submitted successfully! Your score: ${totalScore}/${maxScore}`
          : 'Exam submitted. Score calculation in progress.',
        result: {
          sessionId: activeSession.id,
          score: totalScore,
          maxScore: maxScore,
          percentage: Math.round(percentage * 100) / 100,
          submittedAt: now.toISOString(),
          timeTakenSeconds,
          timeTakenFormatted: formatTimeTaken(timeTakenSeconds),
          submissionReason: reason,
          violationCount: violationCount || 0,
          showCorrectAnswers: exam.showCorrectAnswers ?? true,
          questionDetails: filteredQuestionDetails,
          breakdown: {
            totalQuestions: examQuestions.length,
            answered: studentAnswers.filter(a => a.textAnswer || a.selectedOptionId).length,
            correct: studentAnswers.filter(a => a.isCorrect === true).length,
            incorrect: studentAnswers.filter(a => a.isCorrect === false).length,
            autoScored: studentAnswers.filter(a => a.autoScored === true).length,
            pendingReview: studentAnswers.filter(a => a.isCorrect === null).length
          }
        },
        performance: {
          totalTime,
          scoringTime
        },
        reportCardSync: {
          synced: reportCardSync.success,
          failed: !reportCardSync.success,
          message: reportCardSync.message,
          // Include context for failed syncs to help with debugging and manual intervention
          ...(reportCardSync.success ? {} : {
            context: {
              studentId,
              examId,
              classId: exam.classId,
              termId: exam.termId,
              score: totalScore,
              maxScore
            },
            warning: 'Report card sync failed. Teachers may need to manually sync this result using the "Sync to Report Card" button.'
          })
        }
      });

      // BACKGROUND: Report card sync, audit logging, and dashboard notifications.
      // Runs after the response has already been sent to the student, so a slow sync
      // (report card creation/aggregation + audit log + retries) can never cause the
      // frontend to see a false "Connection Error" for an already-committed submission.
      setImmediate(async () => {
        const bgLabel = `[SUBMIT:BG session=${activeSession.id} student=${studentId} exam=${examId}]`;
        try {
          console.log(`${bgLabel} Starting background report card sync, score ${totalScore}/${maxScore}`);
          const bgSync = await reliableSyncService.syncExamScoreToReportCardReliable(
            studentId,
            examId,
            totalScore,
            maxScore,
            {
              syncType: 'exam_submit',
              triggeredBy: studentId
            }
          );

          if (bgSync.success) {
            console.log(`${bgLabel} Sync successful: ${bgSync.message} (auditLogId: ${bgSync.auditLogId})`);

            if (bgSync.reportCardId) {
              const eventType = bgSync.isNewReportCard ? 'created' : 'updated';
              realtimeService.emitReportCardEvent(bgSync.reportCardId, eventType, {
                studentId,
                examId,
                classId: exam.classId,
                score: totalScore,
                maxScore,
                percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0,
                isNewReportCard: bgSync.isNewReportCard,
                autoGenerated: bgSync.isNewReportCard
              });
            }

            const tableOperation = bgSync.isNewReportCard ? 'INSERT' : 'UPDATE';
            realtimeService.emitTableChange('report_cards', tableOperation, {
              reportCardId: bgSync.reportCardId,
              studentId,
              examId,
              classId: exam.classId,
              score: totalScore,
              maxScore,
              isNewReportCard: bgSync.isNewReportCard
            }, undefined, studentId);
          } else {
            console.error(`${bgLabel} Sync failed: ${bgSync.message} (auditLogId: ${bgSync.auditLogId}). Retryable via admin tools.`);
          }
        } catch (syncError: any) {
          console.error(`${bgLabel} Unhandled background sync error:`, syncError?.message);
        }
      });
    } catch (error: any) {
      console.error('[SUBMIT] Exam submission error:', error?.message, { sessionId });

      // Provide helpful error messages based on error type
      let userMessage = 'Failed to submit exam';
      let statusCode = 500;

      if (error?.message?.includes('not found')) {
        userMessage = 'Session not found. Please refresh and try again.';
        statusCode = 404;
      } else if (error?.message?.includes('already')) {
        userMessage = 'This exam has already been submitted.';
        statusCode = 409;
      } else if (error?.message?.includes('database') || error?.message?.includes('connection')) {
        userMessage = 'Database connection issue. Please try again in a moment.';
        statusCode = 503;
      } else if (error?.message) {
        userMessage = error.message;
      }

      res.status(statusCode).json({
        message: userMessage,
        submitted: false,
        sessionId
      });
    }
  });

  // Exam questions routes
  // Get exam questions
}
