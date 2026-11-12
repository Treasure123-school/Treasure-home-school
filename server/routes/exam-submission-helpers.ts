/** Auto-split from routes.ts module scope — exam-submission-helpers. See git history. */
import { realtimeService } from '../realtime-service';
import { autoScoreExamSession } from '../routes/exam-scoring';
import { reliableSyncService } from '../services/reliable-sync-service';
import { storage } from '../storage';
import { EXAM_SESSION_STATUS, computeExamTiming, logExamTiming } from '../utils/exam-timing';
import { and } from 'drizzle-orm';
import session from 'express-session';

export function withServerTiming(session: any, exam: { timeLimit?: number | null } | null | undefined) {
  const timing = computeExamTiming(session, exam);
  return {
    ...session,
    serverTime: timing.serverNowMs,
    expiresAt: timing.expiresAtMs ? new Date(timing.expiresAtMs).toISOString() : null,
    remainingSeconds: timing.remainingSeconds,
    isExpired: timing.isExpired,
  };
}

// SERVER-AUTHORITATIVE EXPIRY: Atomically claim + auto-submit + score a session whose
// server-computed deadline has passed. Safe to call from multiple code paths (progress
// save, answer save, submit, background sweep) concurrently — claimExamSessionForSubmission
// only succeeds once, so only one caller actually performs the scoring.

export async function autoSubmitExpiredSession(
  session: { id: number; examId: number; studentId: string },
  reason: string
): Promise<boolean> {
  try {
    const claimed = await storage.claimExamSessionForSubmission(session.id, {
      submittedAt: new Date(),
      status: EXAM_SESSION_STATUS.SUBMITTED,
      metadata: JSON.stringify({ submissionReason: 'timeout', autoSubmittedByServer: true, expiryDetectedAt: reason }),
    });

    if (!claimed) {
      // Another request already claimed/submitted this session — nothing to do.
      logExamTiming('auto-submit-skip-already-claimed', { sessionId: session.id, reason });
      return false;
    }

    logExamTiming('auto-submit-triggered', { sessionId: session.id, examId: session.examId, studentId: session.studentId, reason });
    await autoScoreExamSession(session.id, storage);
    realtimeService.emitTableChange('exam_sessions', 'UPDATE', { id: session.id, isCompleted: true, status: EXAM_SESSION_STATUS.SUBMITTED }, undefined, session.studentId);
    return true;
  } catch (error) {
    logExamTiming('auto-submit-error', { sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// Score Merging Function: Combine auto-scored + manually graded results

export async function mergeExamScores(answerId: number, storage: any): Promise<void> {
  try {

    // Get the answer details to find session and exam info
    const answer = await storage.getStudentAnswerById(answerId);
    if (!answer) {
      return;
    }
    const sessionId = answer.sessionId;

    // Get all answers and questions for this session
    const allAnswers = await storage.getStudentAnswers(sessionId);
    const session = await storage.getExamSessionById(sessionId);
    const examQuestions = await storage.getExamQuestions(session.examId);

    // Check if all essay questions are graded
    const essayQuestions = examQuestions.filter((q: any) =>
      q.questionType === 'text' || q.questionType === 'essay'
    );

    const gradedEssayAnswers = allAnswers.filter((a: any) => {
      const question = examQuestions.find((q: any) => q.id === a.questionId);
      const isEssay = question?.questionType === 'text' || question?.questionType === 'essay';
      return isEssay && a.pointsEarned !== null && a.pointsEarned !== undefined;
    });

    const allEssaysGraded = essayQuestions.length === gradedEssayAnswers.length;

    if (!allEssaysGraded) {
      return;
    }

    // Calculate total score by summing all points earned
    let totalScore = 0;
    let maxScore = 0;

    for (const question of examQuestions) {
      maxScore += question.points || 0;

      const studentAnswer = allAnswers.find((a: any) => a.questionId === question.id);
      if (studentAnswer) {
        // Treat undefined/null as 0 to be safe
        totalScore += studentAnswer.pointsEarned || 0;
      }
    }


    // Update or create the exam result with merged score
    const existingResult = await storage.getExamResultByExamAndStudent(session.examId, session.studentId);

    // Extract timeTaken before branching (needed in both paths)
    let timeTaken = 0;
    if (session.metadata) {
      try {
        const metadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
        timeTaken = metadata.timeTakenSeconds || 0;
      } catch (e) {
        console.warn('[MERGE-SCORES] Failed to parse session metadata for timeTaken', e);
      }
    }

    if (existingResult) {
      // Update existing result with merged score
      await storage.updateExamResult(existingResult.id, {
        score: totalScore,
        maxScore: maxScore,
        marksObtained: totalScore,
        autoScored: false, // Now includes manual scores
      });

      // Sync merged score to report card (fire-and-forget)
      reliableSyncService.syncExamScoreToReportCardReliable(
        session.studentId,
        session.examId,
        totalScore,
        maxScore,
        { syncType: 'exam_submit', triggeredBy: session.studentId }
      ).catch((e: any) =>
        console.error('[MERGE-SCORES] Background report-card sync failed:', e.message)
      );
    } else {
      // No existing result — create one now (rare: session scored before result row exists)
      await storage.recordExamResult({
        examId: session.examId,
        studentId: session.studentId,
        score: totalScore,
        maxScore: maxScore,
        marksObtained: totalScore,
        timeTaken: timeTaken,
        autoScored: false,
        recordedBy: session.studentId,
      });

      // Sync newly-created result to report card
      reliableSyncService.syncExamScoreToReportCardReliable(
        session.studentId,
        session.examId,
        totalScore,
        maxScore,
        { syncType: 'exam_submit', triggeredBy: session.studentId }
      ).catch((e: any) =>
        console.error('[MERGE-SCORES] Background report-card sync (new result) failed:', e.message)
      );
    }

  } catch (error) {
    // Don't throw - log and return so grading flow isn't blocked
    // The merge can be retried later or triggered manually
  }
}

// Create Grading Tasks Function: Triggered after auto-scoring or manual grading

export async function createGradingTasksForSession(sessionId: number, examId: number, storage: any): Promise<void> {
  try {

    // Get exam details to find the assigned teacher
    const exam = await storage.getExamById(examId);
    if (!exam) {
      throw new Error(`Exam ${examId} not found`);
    }
    // Get all questions for this exam
    const examQuestions = await storage.getExamQuestions(examId);

    // Filter for essay/theory questions that require manual grading
    const manualGradingQuestions = examQuestions.filter((q: any) => {
      return q.questionType === 'text' || q.questionType === 'essay';
    });

    if (manualGradingQuestions.length === 0) {
      return;
    }

    // Get student answers for this session
    const studentAnswers = await storage.getStudentAnswers(sessionId);

    // Determine the teacher to assign tasks to
    let assignedTeacherId = exam.createdBy; // Default to exam creator

    // Try to get the class-subject teacher if available
    if (exam.classId && exam.subjectId) {
      try {
        const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
        if (teachers && teachers.length > 0) {
          assignedTeacherId = teachers[0].id; // Assign to first teacher found
        } else {
        }
      } catch (error) {
      }
    } else {
    }
    // Create grading tasks for each essay answer
    let tasksCreated = 0;
    for (const question of manualGradingQuestions) {
      const studentAnswer = studentAnswers.find((a: any) => a.questionId === question.id);

      if (studentAnswer) {
        // Check if task already exists to avoid duplicates
        const existingTasks = await storage.getGradingTasksBySession(sessionId);
        const taskExists = existingTasks.some((t: any) => t.answerId === studentAnswer.id);

        if (!taskExists) {
          await storage.createGradingTask({
            sessionId: sessionId,
            answerId: studentAnswer.id,
            assignedTeacherId: assignedTeacherId,
            status: 'pending',
            priority: 0 // Default priority
          });
          tasksCreated++;
        } else {
        }
      } else {
      }
    }

  } catch (error) {
    throw error; // Re-throw to indicate failure
  }
}

// Generate encouraging teacher comments based on performance level
// Uses lastName as per school convention
