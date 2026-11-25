/** Auto-split from routes.ts module scope — exam-scoring. See git history. */
import * as schema from '@shared/schema.pg';
import { mergeExamScores } from '../routes/exam-submission-helpers';
import { ROLES } from '../routes/middleware';
import { reliableSyncService } from '../services/reliable-sync-service';
import { storage } from '../storage';
import { users } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import session from 'express-session';
import { Server } from 'http';

export async function scoreTheoryAnswer(
  studentAnswer: string,
  expectedAnswers: string[],
  sampleAnswer: string | null,
  points: number
): Promise<{ score: number; confidence: number; feedback: string; autoScored: boolean }> {
  // If no student answer, return 0
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      score: 0,
      confidence: 1.0,
      feedback: 'No answer provided.',
      autoScored: true
    };
  }
  const studentText = studentAnswer.toLowerCase().trim();

  // Keyword matching (60% weight)
  let keywordScore = 0;
  const matchedKeywords: string[] = [];
  const missedKeywords: string[] = [];

  if (expectedAnswers && expectedAnswers.length > 0) {
    expectedAnswers.forEach(keyword => {
      const keywordLower = keyword.toLowerCase().trim();
      if (studentText.includes(keywordLower)) {
        matchedKeywords.push(keyword);
      } else {
        missedKeywords.push(keyword);
      }
    });

    keywordScore = matchedKeywords.length / expectedAnswers.length;
  }
  // Simple semantic similarity (40% weight) - basic word overlap
  let semanticScore = 0;
  if (sampleAnswer && sampleAnswer.trim().length > 0) {
    const sampleWords = sampleAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const studentWords = studentText.split(/\s+/).filter(w => w.length > 3);

    const commonWords = studentWords.filter(word => sampleWords.includes(word));
    semanticScore = sampleWords.length > 0 ? commonWords.length / sampleWords.length : 0;
  } else {
    // If no sample answer, use keyword score for both
    semanticScore = keywordScore;
  }
  // Hybrid score calculation
  const hybridScore = (keywordScore * 0.6) + (semanticScore * 0.4);
  const calculatedPoints = Math.round(hybridScore * points * 100) / 100; // Round to 2 decimals

  // Confidence calculation
  const confidence = Math.min(
    keywordScore > 0.8 ? 0.9 : keywordScore > 0.5 ? 0.7 : 0.5,
    1.0
  );

  // Generate feedback
  let feedback = '';
  if (hybridScore >= 0.8) {
    feedback = `Excellent answer! Key points identified: ${matchedKeywords.join(', ')}. `;
  } else if (hybridScore >= 0.5) {
    feedback = `Good effort. You covered: ${matchedKeywords.join(', ')}. `;
    if (missedKeywords.length > 0) {
      feedback += `Consider including: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  } else {
    feedback = `Needs improvement. `;
    if (missedKeywords.length > 0) {
      feedback += `Missing key points: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  }

  // Auto-score if confidence is high, otherwise flag for manual review
  const shouldAutoScore = confidence >= 0.7 && hybridScore >= 0.3;

  if (!shouldAutoScore) {
    feedback += 'This answer has been flagged for teacher review.';
  }
  return {
    score: shouldAutoScore ? calculatedPoints : 0,
    confidence,
    feedback,
    autoScored: shouldAutoScore
  };
}

// OPTIMIZED Auto-scoring function for <2 second performance goal
export async function autoScoreExamSession(sessionId: number, storage: any): Promise<void> {
  const startTime = Date.now();

  try {

    // Get scoring data efficiently with detailed question breakdown
    const scoringResult = await storage.getExamScoringData(sessionId);
    const { session, summary, scoringData } = scoringResult;

    const examForScoring = await storage.getExamById(session.examId);
    const autoGradingEnabled = examForScoring ? examForScoring.autoGradingEnabled !== false : true;

    const databaseQueryTime = Date.now() - startTime;

    const { totalQuestions, maxScore: maxPossibleScore, studentScore, autoScoredQuestions } = summary; // Renamed maxScore to maxPossibleScore

    // Get all student answers for theory scoring
    const studentAnswers = await storage.getStudentAnswers(sessionId);
    const examQuestions = await storage.getExamQuestions(session.examId);

    let totalAutoScore = autoGradingEnabled ? studentScore : 0;
    const hasMultipleChoiceQuestions = autoScoredQuestions > 0;
    const hasEssayQuestions = totalQuestions > autoScoredQuestions;


    // Enhanced question-by-question breakdown for detailed feedback
    const questionDetails = [];

    for (const q of scoringData) {
      const question = examQuestions.find((examQ: any) => examQ.id === q.questionId);
      const studentAnswer = studentAnswers.find((ans: any) => ans.questionId === q.questionId);

      let questionDetail: any = {
        questionId: q.questionId,
        questionType: q.questionType,
        points: q.points,
        maxPoints: q.points,
        pointsEarned: 0,
        isCorrect: null,
        autoScored: false,
        feedback: null,
        aiSuggested: false,
        confidence: 0
      };

      if (!autoGradingEnabled) {
        questionDetail.pointsEarned = 0;
        questionDetail.isCorrect = null;
        questionDetail.autoScored = false;
        questionDetail.aiSuggested = true;
        questionDetail.feedback = 'Pending manual review by your instructor.';
        questionDetails.push(questionDetail);
        continue;
      }

      // Multiple choice - already scored
      if (q.questionType === 'multiple_choice') {
        questionDetail.pointsEarned = q.isCorrect ? q.points : 0;
        questionDetail.isCorrect = q.isCorrect;
        questionDetail.autoScored = true;
        questionDetail.feedback = q.isCorrect
          ? `Correct! You earned ${q.points} point${q.points !== 1 ? 's' : ''}.`
          : `Incorrect. This question was worth ${q.points} point${q.points !== 1 ? 's' : ''}.`;
      }
      // Theory questions - AI-assisted scoring
      else if (q.questionType === 'text' || q.questionType === 'essay') {
        if (studentAnswer && studentAnswer.textAnswer && question) {
          const aiResult = await scoreTheoryAnswer(
            studentAnswer.textAnswer,
            question.expectedAnswers || [],
            question.sampleAnswer || null,
            q.points
          );

          questionDetail.pointsEarned = aiResult.score;
          questionDetail.autoScored = aiResult.autoScored;
          questionDetail.aiSuggested = !aiResult.autoScored; // Flag for teacher review if not auto-scored
          questionDetail.confidence = aiResult.confidence;
          questionDetail.feedback = aiResult.feedback;

          if (aiResult.autoScored) {
            totalAutoScore += aiResult.score;
            questionDetail.isCorrect = aiResult.score >= (q.points * 0.5); // 50% threshold for "correct"
          }
        } else {
          questionDetail.feedback = 'This question requires manual review by your instructor.';
          questionDetail.aiSuggested = true; // Flag for manual review
        }
      }

      questionDetails.push(questionDetail);
    }
    // CRITICAL FIX: Persist all scores to student_answers for accurate score merging
    for (const detail of questionDetails) {
      if (detail.questionId) {
        const studentAnswer = studentAnswers.find((ans: any) => ans.questionId === detail.questionId);
        if (studentAnswer) {
          try {
            await storage.updateStudentAnswer(studentAnswer.id, {
              pointsEarned: detail.pointsEarned,
              isCorrect: detail.isCorrect,
              autoScored: detail.autoScored,
              feedbackText: detail.feedback
            });
          } catch (updateError) {
          }
        }
      }
    }

    // Calculate detailed breakdown
    const aiSuggestedCount = questionDetails.filter((q: any) => q.aiSuggested === true).length;
    const breakdown = {
      totalQuestions,
      autoScoredQuestions: questionDetails.filter((q: any) => q.autoScored === true).length,
      aiSuggestedQuestions: aiSuggestedCount,
      correctAnswers: questionDetails.filter((q: any) => q.isCorrect === true).length,
      incorrectAnswers: questionDetails.filter((q: any) => q.isCorrect === false).length,
      pendingManualReview: questionDetails.filter((q: any) => q.isCorrect === null || q.aiSuggested === true).length,
      maxScore: maxPossibleScore,
      earnedScore: totalAutoScore
    };

    // Log detailed scoring for debugging
    if (process.env.NODE_ENV === 'development') {
      questionDetails.forEach((q: any, index: number) => {
      });
    }
    // Create or update exam result - CRITICAL for instant feedback

    // ENHANCED ERROR HANDLING: Add validation before database operations
    if (!session.studentId) {
      throw new Error('CRITICAL: Session missing studentId - cannot create exam result');
    }
    if (!session.examId) {
      throw new Error('CRITICAL: Session missing examId - cannot create exam result');
    }
    if (maxPossibleScore === 0 && totalQuestions > 0) {
    }
    const existingResults = await storage.getExamResultsByStudent(session.studentId);

    const existingResult = existingResults.find((r: any) => r.examId === session.examId);
    if (existingResult) {
    } else {
    }
    // CRITICAL FIX: Ensure recordedBy uses a valid user ID that exists in users table
    let SYSTEM_AUTO_SCORING_UUID: string;

    // STRATEGY: Try multiple fallbacks to find a valid user ID
    // 1. Try to find an admin user first (best practice)
    // 2. Verify the student ID exists in users table
    // 3. Find any active user as last resort
    try {
      const adminUsers = await storage.getUsersByRole(ROLES.ADMIN);
      if (adminUsers && adminUsers.length > 0 && adminUsers[0].id) {
        SYSTEM_AUTO_SCORING_UUID = adminUsers[0].id;
      } else {
        // No admin found, verify student ID exists in users table

        try {
          const studentUser = await storage.getUser(session.studentId);
          if (studentUser && studentUser.id) {
            SYSTEM_AUTO_SCORING_UUID = studentUser.id;
          } else {
            throw new Error(`Student ${session.studentId} not found in users table`);
          }
        } catch (studentError) {
          // Last resort: Find ANY active user

          const allUsers = await storage.getAllUsers();
          const activeUser = allUsers.find((u: any) => u.isActive && u.id);

          if (activeUser && activeUser.id) {
            SYSTEM_AUTO_SCORING_UUID = activeUser.id;
          } else {
            throw new Error('CRITICAL: No valid user ID found for auto-scoring recordedBy - cannot save exam result');
          }
        }
      }
    } catch (userError) {
      throw new Error(`Auto-scoring failed: Cannot find valid user ID for recordedBy. Error: ${userError instanceof Error ? userError.message : String(userError)}`);
    }
    // Validate UUID before using
    if (!SYSTEM_AUTO_SCORING_UUID || typeof SYSTEM_AUTO_SCORING_UUID !== 'string') {
      throw new Error(`CRITICAL: Invalid recordedBy UUID: ${SYSTEM_AUTO_SCORING_UUID}`);
    }

    // Extract timeTaken from session.metadata if available
    let timeTaken = 0;
    if (session.metadata) {
      try {
        const metadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
        timeTaken = metadata.timeTakenSeconds || 0;
      } catch (e) {
        console.warn('[AUTO-SCORE] Failed to parse session metadata for timeTaken', e);
      }
    }

    // Only include fields that are in the database schema
    const resultData = {
      examId: session.examId,
      studentId: session.studentId,
      score: totalAutoScore,
      maxScore: maxPossibleScore,
      marksObtained: totalAutoScore,
      autoScored: autoGradingEnabled && breakdown.pendingManualReview === 0,
      recordedBy: SYSTEM_AUTO_SCORING_UUID,
      timeTaken: timeTaken,
    };

    let savedResultId: number | null = null;

    try {
      if (existingResult) {
        // Update existing result
        const updatedResult = await storage.updateExamResult(existingResult.id, resultData);
        if (!updatedResult) {
          console.error(`[AUTO-SCORE] Failed to update exam result ID: ${existingResult.id}`);
          throw new Error(`Failed to update exam result ID: ${existingResult.id}`);
        }
        savedResultId = existingResult.id;
      } else {
        // Create new result
        const newResult = await storage.recordExamResult(resultData);
        if (!newResult || !newResult.id) {
          console.error('[AUTO-SCORE] recordExamResult returned null/undefined or missing ID');
          throw new Error('Failed to create exam result - recordExamResult returned null/undefined or missing ID');
        }
        savedResultId = newResult.id;
      }

      // Fire-and-forget sync to report card — all callers of autoScoreExamSession
      // (normal submit, timeout auto-submit, late-answer re-score) get this automatically.
      // The reliable sync service's idempotency window prevents double-processing when the
      // main submit handler fires its own setImmediate sync within 5 seconds.
      if (autoGradingEnabled && breakdown.pendingManualReview === 0) {
        // Only sync when fully auto-scored; essay exams still pending teacher review
        // will be synced by mergeExamScores() once all essays are graded.
        reliableSyncService.syncExamScoreToReportCardReliable(
          session.studentId,
          session.examId,
          totalAutoScore,
          maxPossibleScore,
          { syncType: 'exam_submit', triggeredBy: session.studentId }
        ).catch((e: any) =>
          console.error('[AUTO-SCORE] Background report-card sync failed:', e.message)
        );
      }

      // CRITICAL: Update the exam session with the calculated scores
      try {
        await storage.updateExamSession(sessionId, {
          score: totalAutoScore,
          maxScore: maxPossibleScore,
          status: autoGradingEnabled && breakdown.pendingManualReview === 0 ? 'graded' : 'submitted'
        });
      } catch (sessionUpdateError) {
        console.warn('[AUTO-SCORE] Failed to update session with scores:', sessionUpdateError);
        // Don't throw - the exam result was saved successfully
      }

      // Verification is optional - if it fails, log but don't throw
      // The result was already confirmed saved by the insert/update returning
      try {
        const verificationResults = await storage.getExamResultsByStudent(session.studentId);
        const savedResult = verificationResults.find((r: any) => Number(r.examId) === Number(session.examId));

        if (!savedResult) {
          console.warn(`[AUTO-SCORE] Verification warning: Could not find result in verification fetch, but ID ${savedResultId} was returned from insert/update`);
        }
      } catch (verifyError) {
        console.warn('[AUTO-SCORE] Verification fetch failed, but result was saved with ID:', savedResultId);
      }

      // ENHANCED PERFORMANCE MONITORING - Track 2-second submission goal
      const totalResponseTime = Date.now() - startTime;
      const scoringTime = totalResponseTime - databaseQueryTime;

      // Performance metrics tracking
      const performanceMetrics = {
        sessionId,
        startTime: new Date(startTime).toISOString(),
        databaseQueryTime: databaseQueryTime,
        scoringTime: scoringTime,
        totalResponseTime: totalResponseTime,
        goalAchieved: totalResponseTime <= 2000
      };

      // Alert if submission exceeds 2-second goal
      if (totalResponseTime > 2000) {
      } else {
      }
      // Store performance event in database for monitoring
      try {
        await storage.logPerformanceEvent({
          sessionId,
          eventType: 'auto_scoring',
          duration: totalResponseTime,
          goalAchieved: totalResponseTime <= 2000,
          metadata: JSON.stringify({
            databaseQueryTime,
            scoringTime,
            studentId: session.studentId,
            examId: session.examId
          }),
          userId: session.studentId, // Track which student's exam was auto-scored
          clientSide: false // Server-side auto-scoring
        });
      } catch (perfLogError) {
        // Don't throw - this shouldn't break the auto-scoring process
      }
      // Log detailed metrics in development
      if (process.env.NODE_ENV === 'development') {
      }

    } catch (error) {
      const totalErrorTime = Date.now() - startTime;
      throw error;
    }
  } catch (error) {
    const totalErrorTime = Date.now() - startTime;
    throw error;
  }
}

// Attach server-authoritative timing fields to a session payload before sending it to the
// client. The client must treat `serverTime` / `expiresAt` / `remainingSeconds` as the
// source of truth instead of counting down on its own from a value it received once.
