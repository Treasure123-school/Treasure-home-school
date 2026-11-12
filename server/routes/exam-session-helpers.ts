/** Auto-split from routes.ts module scope — exam-session-helpers. See git history. */
import { autoScoreExamSession } from '../routes/exam-scoring';
import { storage } from '../storage';
import { EXAM_SESSION_STATUS, logExamTiming } from '../utils/exam-timing';
import { and } from 'drizzle-orm';
import session from 'express-session';

export async function autoPublishScheduledExams(): Promise<void> {
  try {

    const now = new Date();
    const scheduledExams = await storage.getScheduledExamsToPublish(now);

    if (scheduledExams.length > 0) {

      for (const exam of scheduledExams) {
        try {

          await storage.updateExam(exam.id, {
            isPublished: true
          });

        } catch (error) {
          console.error(`[AUTO-PUBLISH] Failed to auto-publish exam ${exam.id} (${exam.name}):`, error);
        }
      }
    }
  } catch (error) {
    console.error('[AUTO-PUBLISH] Failed to fetch/process scheduled exams:', error);
  }
}

// BACKGROUND TIMEOUT CLEANUP SERVICE - Prevents infinite waiting

export async function cleanupExpiredExamSessions(): Promise<void> {
  try {

    // PERFORMANCE IMPROVEMENT: Get only expired sessions directly from database
    // instead of fetching all active sessions and filtering in memory
    const now = new Date();
    const rawResult = await storage.getExpiredExamSessions(now, 50);
    const expiredSessions = Array.isArray(rawResult) ? rawResult : []; // Ensure it's always an array

    if (expiredSessions.length > 0) {
      logExamTiming('background-sweep-found', { count: expiredSessions.length, sessionIds: expiredSessions.map((s: any) => s.id) });
    }

    // Process in smaller batches to avoid overwhelming the database.
    // IMPORTANT: Use claimExamSessionForSubmission (atomic WHERE isCompleted=false update) instead
    // of updateExamSession — this ensures the sweep never races with the per-request auto-submit
    // paths (answer-save, progress-update) and never double-scores a session.
    for (const session of expiredSessions) {
      try {

        const claimed = await storage.claimExamSessionForSubmission(session.id, {
          submittedAt: now,
          status: EXAM_SESSION_STATUS.SUBMITTED,
          metadata: JSON.stringify({
            submissionReason: 'timeout',
            autoSubmittedByServer: true,
            expiryDetectedAt: 'background-sweep',
          }),
        });

        if (!claimed) {
          // Another request (answer-save, progress-update, or a parallel sweep) already
          // claimed this session — nothing to do.
          logExamTiming('background-sweep-skip-already-claimed', { sessionId: session.id });
          continue;
        }

        logExamTiming('background-sweep-submitted', { sessionId: session.id, examId: session.examId, studentId: session.studentId });

        // Auto-score the session using our optimized scoring
        await autoScoreExamSession(session.id, storage);

      } catch (error) {
        // Continue with other sessions even if one fails
        logExamTiming('background-sweep-error', { sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) {
    logExamTiming('background-sweep-fatal', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Start auto-publishing service (runs every minute)
const autoPublishInterval = 60 * 1000; // 1 minute
setInterval(autoPublishScheduledExams, autoPublishInterval);
autoPublishScheduledExams(); // Run immediately on startup

// PERFORMANCE FIX: Reduce cleanup frequency from 30s to 3 minutes to prevent database contention
const cleanupInterval = 3 * 60 * 1000; // 3 minutes (was 30 seconds)
const jitter = Math.random() * 30000; // Add 0-30s random jitter to prevent thundering herd
setTimeout(() => {
  setInterval(cleanupExpiredExamSessions, cleanupInterval);
  cleanupExpiredExamSessions(); // Run immediately after jitter delay
}, jitter);

// AI-assisted theory scoring helper
