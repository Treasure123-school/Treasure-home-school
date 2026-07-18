/**
 * Exam Scoring Helpers
 *
 * Standalone helper functions for exam auto-scoring, session management,
 * score merging, and comment generation.
 * Extracted from routes.ts for modularity.
 *
 * Functions that interact with the database accept `storage: any` as a
 * parameter so they can be used across different route modules without
 * coupling to a specific storage instance.
 */

import { storage as globalStorage } from '../storage';
import { reliableSyncService } from '../services/reliable-sync-service';
import { realtimeService } from '../realtime-service';
import { computeExamTiming, logExamTiming, EXAM_SESSION_STATUS } from '../utils/exam-timing';
import { ROLES } from '../routes/middleware';

// ─── Theory scoring ───────────────────────────────────────────────────────────

export async function scoreTheoryAnswer(
  studentAnswer: string,
  expectedAnswers: string[],
  sampleAnswer: string | null,
  points: number
): Promise<{ score: number; confidence: number; feedback: string; autoScored: boolean }> {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return { score: 0, confidence: 1.0, feedback: 'No answer provided.', autoScored: true };
  }
  const studentText = studentAnswer.toLowerCase().trim();

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

  let semanticScore = 0;
  if (sampleAnswer && sampleAnswer.trim().length > 0) {
    const sampleWords = sampleAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const studentWords = studentText.split(/\s+/).filter(w => w.length > 3);
    const commonWords = studentWords.filter(word => sampleWords.includes(word));
    semanticScore = sampleWords.length > 0 ? commonWords.length / sampleWords.length : 0;
  } else {
    semanticScore = keywordScore;
  }

  const hybridScore = (keywordScore * 0.6) + (semanticScore * 0.4);
  const calculatedPoints = Math.round(hybridScore * points * 100) / 100;

  const confidence = Math.min(
    keywordScore > 0.8 ? 0.9 : keywordScore > 0.5 ? 0.7 : 0.5,
    1.0
  );

  let feedback = '';
  if (hybridScore >= 0.8) {
    feedback = `Excellent answer! Key points identified: ${matchedKeywords.join(', ')}. `;
  } else if (hybridScore >= 0.5) {
    feedback = `Good effort. You covered: ${matchedKeywords.join(', ')}. `;
    if (missedKeywords.length > 0) {
      feedback += `Consider including: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  } else {
    feedback = 'Needs improvement. ';
    if (missedKeywords.length > 0) {
      feedback += `Missing key points: ${missedKeywords.slice(0, 3).join(', ')}. `;
    }
  }

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

// ─── Auto-scoring ─────────────────────────────────────────────────────────────

export async function autoScoreExamSession(sessionId: number, storage: any): Promise<void> {
  const startTime = Date.now();

  try {
    const scoringResult = await storage.getExamScoringData(sessionId);
    const { session, summary, scoringData } = scoringResult;

    const databaseQueryTime = Date.now() - startTime;

    const { totalQuestions, maxScore: maxPossibleScore, studentScore, autoScoredQuestions } = summary;

    const studentAnswers = await storage.getStudentAnswers(sessionId);
    const examQuestions = await storage.getExamQuestions(session.examId);

    let totalAutoScore = studentScore;

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

      if (q.questionType === 'multiple_choice') {
        questionDetail.pointsEarned = q.isCorrect ? q.points : 0;
        questionDetail.isCorrect = q.isCorrect;
        questionDetail.autoScored = true;
        questionDetail.feedback = q.isCorrect
          ? `Correct! You earned ${q.points} point${q.points !== 1 ? 's' : ''}.`
          : `Incorrect. This question was worth ${q.points} point${q.points !== 1 ? 's' : ''}.`;
      } else if (q.questionType === 'text' || q.questionType === 'essay') {
        if (studentAnswer && studentAnswer.textAnswer && question) {
          const aiResult = await scoreTheoryAnswer(
            studentAnswer.textAnswer,
            question.expectedAnswers || [],
            question.sampleAnswer || null,
            q.points
          );

          questionDetail.pointsEarned = aiResult.score;
          questionDetail.autoScored = aiResult.autoScored;
          questionDetail.aiSuggested = !aiResult.autoScored;
          questionDetail.confidence = aiResult.confidence;
          questionDetail.feedback = aiResult.feedback;

          if (aiResult.autoScored) {
            totalAutoScore += aiResult.score;
            questionDetail.isCorrect = aiResult.score >= (q.points * 0.5);
          }
        } else {
          questionDetail.feedback = 'This question requires manual review by your instructor.';
          questionDetail.aiSuggested = true;
        }
      }

      questionDetails.push(questionDetail);
    }

    // Persist all scores to student_answers for accurate score merging
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
            // Non-critical — continue
          }
        }
      }
    }

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

    if (!session.studentId) throw new Error('CRITICAL: Session missing studentId - cannot create exam result');
    if (!session.examId) throw new Error('CRITICAL: Session missing examId - cannot create exam result');

    const existingResults = await storage.getExamResultsByStudent(session.studentId);
    const existingResult = existingResults.find((r: any) => r.examId === session.examId);

    // Resolve a valid recordedBy user ID
    let SYSTEM_AUTO_SCORING_UUID: string;
    try {
      const adminUsers = await storage.getUsersByRole(ROLES.ADMIN);
      if (adminUsers && adminUsers.length > 0 && adminUsers[0].id) {
        SYSTEM_AUTO_SCORING_UUID = adminUsers[0].id;
      } else {
        try {
          const studentUser = await storage.getUser(session.studentId);
          if (studentUser && studentUser.id) {
            SYSTEM_AUTO_SCORING_UUID = studentUser.id;
          } else {
            throw new Error(`Student ${session.studentId} not found in users table`);
          }
        } catch {
          const allUsers = await storage.getAllUsers();
          const activeUser = allUsers.find((u: any) => u.isActive && u.id);
          if (activeUser && activeUser.id) {
            SYSTEM_AUTO_SCORING_UUID = activeUser.id;
          } else {
            throw new Error('CRITICAL: No valid user ID found for auto-scoring recordedBy');
          }
        }
      }
    } catch (userError) {
      throw new Error(`Auto-scoring failed: ${userError instanceof Error ? userError.message : String(userError)}`);
    }

    if (!SYSTEM_AUTO_SCORING_UUID || typeof SYSTEM_AUTO_SCORING_UUID !== 'string') {
      throw new Error(`CRITICAL: Invalid recordedBy UUID: ${SYSTEM_AUTO_SCORING_UUID}`);
    }

    let timeTaken = 0;
    if (session.metadata) {
      try {
        const metadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
        timeTaken = metadata.timeTakenSeconds || 0;
      } catch {
        console.warn('[AUTO-SCORE] Failed to parse session metadata for timeTaken');
      }
    }

    const resultData = {
      examId: session.examId,
      studentId: session.studentId,
      score: totalAutoScore,
      maxScore: maxPossibleScore,
      marksObtained: totalAutoScore,
      autoScored: breakdown.pendingManualReview === 0,
      recordedBy: SYSTEM_AUTO_SCORING_UUID,
      timeTaken,
    };

    let savedResultId: number | null = null;

    try {
      if (existingResult) {
        const updatedResult = await storage.updateExamResult(existingResult.id, resultData);
        if (!updatedResult) throw new Error(`Failed to update exam result ID: ${existingResult.id}`);
        savedResultId = existingResult.id;
      } else {
        const newResult = await storage.recordExamResult(resultData);
        if (!newResult || !newResult.id) throw new Error('Failed to create exam result - recordExamResult returned null/undefined');
        savedResultId = newResult.id;
      }

      // Fire-and-forget sync to report card.
      // Covers all callers (normal submit, timeout auto-submit, late-answer re-score).
      // Idempotency in ReliableSyncService prevents double-processing when the main submit
      // handler fires its own setImmediate sync within 5 seconds.
      if (breakdown.pendingManualReview === 0) {
        // Only sync when fully scored; essay-pending exams will be synced by mergeExamScores()
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

      try {
        await storage.updateExamSession(sessionId, {
          score: totalAutoScore,
          maxScore: maxPossibleScore,
          status: breakdown.pendingManualReview === 0 ? 'graded' : 'submitted'
        });
      } catch (sessionUpdateError) {
        console.warn('[AUTO-SCORE] Failed to update session with scores:', sessionUpdateError);
      }

      try {
        const verificationResults = await storage.getExamResultsByStudent(session.studentId);
        const savedResult = verificationResults.find((r: any) => Number(r.examId) === Number(session.examId));
        if (!savedResult) {
          console.warn(`[AUTO-SCORE] Verification warning: Could not find result, but ID ${savedResultId} was returned`);
        }
      } catch {
        console.warn('[AUTO-SCORE] Verification fetch failed, but result was saved with ID:', savedResultId);
      }

      const totalResponseTime = Date.now() - startTime;
      const scoringTime = totalResponseTime - databaseQueryTime;

      try {
        await storage.logPerformanceEvent({
          sessionId,
          eventType: 'auto_scoring',
          duration: totalResponseTime,
          goalAchieved: totalResponseTime <= 2000,
          metadata: JSON.stringify({ databaseQueryTime, scoringTime, studentId: session.studentId, examId: session.examId }),
          userId: session.studentId,
          clientSide: false
        });
      } catch {
        // Non-critical
      }

    } catch (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// ─── Server-authoritative timing ──────────────────────────────────────────────

export function withServerTiming(
  session: any,
  exam: { timeLimit?: number | null } | null | undefined
) {
  const timing = computeExamTiming(session, exam);
  return {
    ...session,
    serverTime: timing.serverNowMs,
    expiresAt: timing.expiresAtMs ? new Date(timing.expiresAtMs).toISOString() : null,
    remainingSeconds: timing.remainingSeconds,
    isExpired: timing.isExpired,
  };
}

// ─── Timeout auto-submit ──────────────────────────────────────────────────────

/**
 * Atomically claims + scores an expired exam session.
 * Safe to call concurrently — only one caller succeeds (claimExamSessionForSubmission is atomic).
 */
export async function autoSubmitExpiredSession(
  session: { id: number; examId: number; studentId: string },
  reason: string
): Promise<boolean> {
  try {
    const claimed = await globalStorage.claimExamSessionForSubmission(session.id, {
      submittedAt: new Date(),
      status: EXAM_SESSION_STATUS.SUBMITTED,
      metadata: JSON.stringify({ submissionReason: 'timeout', autoSubmittedByServer: true, expiryDetectedAt: reason }),
    });

    if (!claimed) {
      logExamTiming('auto-submit-skip-already-claimed', { sessionId: session.id, reason });
      return false;
    }

    logExamTiming('auto-submit-triggered', { sessionId: session.id, examId: session.examId, studentId: session.studentId, reason });
    await autoScoreExamSession(session.id, globalStorage);
    realtimeService.emitTableChange('exam_sessions', 'UPDATE', { id: session.id, isCompleted: true, status: EXAM_SESSION_STATUS.SUBMITTED }, undefined, session.studentId);
    return true;
  } catch (error) {
    logExamTiming('auto-submit-error', { sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// ─── Score merging (essay + MCQ) ─────────────────────────────────────────────

/**
 * Merges auto-scored MCQ scores with manually graded essay scores.
 * Only finalises and syncs when ALL essay questions have been graded.
 */
export async function mergeExamScores(answerId: number, storage: any): Promise<void> {
  try {
    const answer = await storage.getStudentAnswerById(answerId);
    if (!answer) return;

    const sessionId = answer.sessionId;
    const allAnswers = await storage.getStudentAnswers(sessionId);
    const session = await storage.getExamSessionById(sessionId);
    const examQuestions = await storage.getExamQuestions(session.examId);

    const essayQuestions = examQuestions.filter((q: any) =>
      q.questionType === 'text' || q.questionType === 'essay'
    );

    const gradedEssayAnswers = allAnswers.filter((a: any) => {
      const question = examQuestions.find((q: any) => q.id === a.questionId);
      const isEssay = question?.questionType === 'text' || question?.questionType === 'essay';
      return isEssay && a.pointsEarned !== null && a.pointsEarned !== undefined;
    });

    if (essayQuestions.length !== gradedEssayAnswers.length) return; // Not all graded yet

    let totalScore = 0;
    let maxScore = 0;

    for (const question of examQuestions) {
      maxScore += question.points || 0;
      const studentAnswer = allAnswers.find((a: any) => a.questionId === question.id);
      if (studentAnswer) {
        totalScore += studentAnswer.pointsEarned || 0;
      }
    }

    const existingResult = await storage.getExamResultByExamAndStudent(session.examId, session.studentId);

    let timeTaken = 0;
    if (session.metadata) {
      try {
        const metadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
        timeTaken = metadata.timeTakenSeconds || 0;
      } catch {
        console.warn('[MERGE-SCORES] Failed to parse session metadata for timeTaken');
      }
    }

    if (existingResult) {
      await storage.updateExamResult(existingResult.id, {
        score: totalScore,
        maxScore,
        marksObtained: totalScore,
        autoScored: false,
      });

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
      await storage.recordExamResult({
        examId: session.examId,
        studentId: session.studentId,
        score: totalScore,
        maxScore,
        marksObtained: totalScore,
        timeTaken,
        autoScored: false,
        recordedBy: session.studentId,
      });

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
    // Don't throw — log and return so grading flow is never blocked
    console.error('[MERGE-SCORES] Error:', error);
  }
}

// ─── Grading task creation ────────────────────────────────────────────────────

export async function createGradingTasksForSession(sessionId: number, examId: number, storage: any): Promise<void> {
  try {
    const exam = await storage.getExamById(examId);
    if (!exam) throw new Error(`Exam ${examId} not found`);

    const examQuestions = await storage.getExamQuestions(examId);
    const manualGradingQuestions = examQuestions.filter((q: any) =>
      q.questionType === 'text' || q.questionType === 'essay'
    );

    if (manualGradingQuestions.length === 0) return;

    const studentAnswers = await storage.getStudentAnswers(sessionId);

    let assignedTeacherId = exam.createdBy;
    if (exam.classId && exam.subjectId) {
      try {
        const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
        if (teachers && teachers.length > 0) assignedTeacherId = teachers[0].id;
      } catch {
        // Fall back to exam creator
      }
    }

    for (const question of manualGradingQuestions) {
      const studentAnswer = studentAnswers.find((a: any) => a.questionId === question.id);
      if (studentAnswer) {
        const existingTasks = await storage.getGradingTasksBySession(sessionId);
        const taskExists = existingTasks.some((t: any) => t.answerId === studentAnswer.id);
        if (!taskExists) {
          await storage.createGradingTask({
            sessionId,
            answerId: studentAnswer.id,
            assignedTeacherId,
            status: 'pending',
            priority: 0
          });
        }
      }
    }
  } catch (error) {
    throw error;
  }
}

// ─── Teacher / principal comment generators ───────────────────────────────────

export function generateTeacherComment(studentName: string, percentage: number): string {
  const nameParts = studentName.trim().split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

  if (percentage >= 70) {
    const comments = [
      `${lastName} has shown exceptional academic performance this term. Keep up the excellent work!`,
      `Outstanding achievement this term! ${lastName} demonstrates strong understanding and dedication to learning.`,
      `${lastName} has maintained an excellent standard throughout this term. A truly commendable performance.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 60) {
    const comments = [
      `${lastName} has performed very well this term. With a little more effort, excellence is within reach.`,
      `A very good performance from ${lastName}. Continue with the same dedication and aim higher.`,
      `${lastName} shows great potential and has done very well this term. Keep striving for the best.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 50) {
    const comments = [
      `${lastName} has shown good effort this term. There is room for improvement with more focus and hard work.`,
      `A satisfactory performance from ${lastName}. With extra effort, better results are achievable.`,
      `${lastName} is capable of more. Encourage consistent study habits for improved performance next term.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 40) {
    const comments = [
      `${lastName} needs to put in more effort. With additional support and dedication, improvement is possible.`,
      `${lastName} should focus more on studies. Regular revision and asking questions will help improve performance.`,
      `${lastName} has the potential to do better. Extra tutoring and more practice are recommended.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else {
    const comments = [
      `${lastName} needs significant improvement. Extra classes and consistent practice are strongly recommended.`,
      `${lastName} should seek additional help and focus on building strong foundations in all subjects.`,
      `${lastName} requires intensive support. Regular study sessions and parent involvement will be beneficial.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
}

export function generatePrincipalComment(studentName: string, percentage: number): string {
  const nameParts = studentName.trim().split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

  if (percentage >= 70) {
    const comments = [
      `${lastName} is a model student who consistently demonstrates excellence. The school is proud of this achievement.`,
      `Congratulations to ${lastName} on an outstanding performance. Continue to be an inspiration to others.`,
      `${lastName} has achieved excellent results. We look forward to continued success in future terms.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 60) {
    const comments = [
      `${lastName} has shown commendable effort and achieved very good results. Keep up the good work.`,
      `Well done to ${lastName} on a very good performance. The potential for excellence is evident.`,
      `${lastName} is on the right track. Continue working hard and aim for even greater heights.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 50) {
    const comments = [
      `${lastName} has shown satisfactory progress. With increased focus, even better results are attainable.`,
      `We encourage ${lastName} to continue making efforts. The school supports all students on their learning journey.`,
      `${lastName} has the ability to excel. We encourage more dedication to studies next term.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else if (percentage >= 40) {
    const comments = [
      `${lastName} should dedicate more time to academic work. The school will provide necessary support for improvement.`,
      `We urge ${lastName} to take studies more seriously. With proper guidance and effort, improvement is possible.`,
      `${lastName} needs to focus more on academics. We recommend parent-teacher collaboration for support.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  } else {
    const comments = [
      `${lastName} requires immediate academic intervention. We recommend scheduling a meeting to discuss a support plan.`,
      `The school is concerned about ${lastName}'s performance. A structured study plan and monitoring are recommended.`,
      `${lastName} needs intensive academic support. We encourage parents to work closely with teachers for improvement.`,
    ];
    return comments[Math.floor(Math.random() * comments.length)];
  }
}
