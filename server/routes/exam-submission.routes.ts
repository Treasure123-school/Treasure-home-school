/** Student exam submission (scoring, timer validation, sync) — split from exams-management.routes.ts. */
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



export async function registerExamSubmissionRoutes(app: Express) {
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
}
