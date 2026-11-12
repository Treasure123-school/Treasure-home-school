/** Auto-split from routes.ts — exam-sessions (orig lines 4119-4548). See git history. */
import type { Express } from 'express';
import { realtimeService } from '../realtime-service';
import { autoSubmitExpiredSession, withServerTiming } from '../routes/exam-submission-helpers';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { logExamAccess, validateExamTimeWindow } from '../teacher-auth-middleware';
import { EXAM_SESSION_STATUS, computeExamTiming, logExamTiming } from '../utils/exam-timing';
import { InsertStudentAnswer } from '@shared/schema';
import { and } from 'drizzle-orm';
import session from 'express-session';

export async function registerExamSessionsRoutes(app: Express) {
  app.get('/api/server-time', authenticateUser, async (req, res) => {
    res.json({ serverTime: Date.now() });
  });

  // Start exam - Create new exam session (with re-entry prevention and time-window validation)
  app.post('/api/exam-sessions', authenticateUser, authorizeRoles(ROLES.STUDENT), logExamAccess, validateExamTimeWindow, async (req, res) => {
    try {
      const { examId } = req.body;
      const studentId = req.user!.id;

      if (!examId) {
        return res.status(400).json({ message: 'Exam ID is required' });
      }

      // Get exam details to calculate end time
      const exam = await storage.getExamById(examId);

      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }
      if (!exam.isPublished) {
        return res.status(403).json({ message: 'Exam is not published yet' });
      }

      // SECURITY: Verify student belongs to the exam's class
      const student = await storage.getStudent(studentId);
      if (!student || !student.classId) {
        return res.status(403).json({ message: 'You are not enrolled in any class' });
      }
      if (student.classId !== exam.classId) {
        return res.status(403).json({ message: 'This exam is not available for your class' });
      }

      // PAYMENT CHECK: Block access if exam fee is required and unpaid
      const sysSettings = await storage.getSystemSettings();
      if (sysSettings?.requireExamPayment) {
        // Guard against legacy exams saved before termId defaulting was added — fall back
        // to the active term instead of passing undefined into the payment lookup.
        const paymentTermId = exam.termId ?? (await storage.getCurrentTerm())?.id;
        const payment = paymentTermId ? await storage.getExamPayment(studentId, paymentTermId) : undefined;
        if (!payment) {
          return res.status(402).json({
            message: 'Exam fee payment required',
            paymentRequired: true,
            termId: paymentTermId ?? exam.termId,
            feeAmount: sysSettings.examFeeAmount ?? 0,
          });
        }
      }

      // RE-ENTRY PREVENTION: Check if student already has a completed session for this exam
      const existingSessions = await storage.getExamSessionsByStudent(studentId);
      const completedSession = existingSessions.find(s => s.examId === examId && s.isCompleted);

      if (completedSession) {
        // Exam already completed - return existing results with redirect flag
        const existingResult = await storage.getExamResultByExamAndStudent(examId, studentId);
        const studentAnswers = await storage.getStudentAnswers(completedSession.id);
        const examQuestions = await storage.getExamQuestions(examId);

        // Parse metadata for submission details
        let submissionReason = 'manual';
        let timeTakenSeconds = 0;
        let violationCount = 0;

        if (completedSession.metadata) {
          try {
            const metadata = JSON.parse(completedSession.metadata);
            submissionReason = metadata.submissionReason || 'manual';
            timeTakenSeconds = metadata.timeTakenSeconds || 0;
            violationCount = metadata.violationCount || 0;
          } catch (e) { }
        }

        // Format time taken for display
        const formatTimeTaken = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (mins === 0) return `${secs} seconds`;
          return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
        };

        const questionDetails = examQuestions.map(q => {
          const answer = studentAnswers.find(a => a.questionId === q.id);
          return {
            questionId: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            studentAnswer: answer?.textAnswer || null,
            selectedOptionId: answer?.selectedOptionId || null,
            isCorrect: answer?.isCorrect || false,
            pointsAwarded: answer?.pointsEarned || 0,
            feedback: answer?.feedbackText || null
          };
        });

        return res.status(200).json({
          alreadyCompleted: true,
          redirectToResults: true,
          message: 'You have already completed this exam. Redirecting to your results.',
          result: {
            sessionId: completedSession.id,
            score: existingResult?.score || completedSession.score || 0,
            maxScore: existingResult?.maxScore || completedSession.maxScore || exam.totalMarks || 0,
            percentage: completedSession.maxScore && completedSession.score
              ? Math.round((completedSession.score / completedSession.maxScore) * 100 * 100) / 100
              : 0,
            submittedAt: completedSession.submittedAt?.toISOString() || new Date().toISOString(),
            timeTakenSeconds,
            timeTakenFormatted: formatTimeTaken(timeTakenSeconds),
            submissionReason,
            violationCount,
            questionDetails,
            breakdown: {
              totalQuestions: examQuestions.length,
              answered: studentAnswers.filter(a => a.textAnswer || a.selectedOptionId).length,
              correct: studentAnswers.filter(a => a.isCorrect === true).length,
              incorrect: studentAnswers.filter(a => a.isCorrect === false).length,
              autoScored: studentAnswers.filter(a => a.autoScored === true).length
            }
          }
        });
      }

      const now = new Date();
      const endTime = new Date(now.getTime() + (exam.timeLimit || 60) * 60 * 1000);

      const sessionData = {
        examId,
        studentId,
        startedAt: now,
        timeRemaining: (exam.timeLimit || 60) * 60,
        isCompleted: false,
        status: 'in_progress' as const,
        endTime,
        maxScore: exam.totalMarks || 0,
      };

      // Use idempotent session creation to prevent duplicates
      const session = await storage.createOrGetActiveExamSession(examId, studentId, sessionData);

      // Emit realtime event for exam session started
      realtimeService.emitTableChange('exam_sessions', 'INSERT', session, undefined, studentId);
      realtimeService.emitExamEvent(examId, 'started', {
        sessionId: session.id,
        studentId,
        classId: exam.classId
      });

      logExamTiming('session-started', { sessionId: session.id, examId, studentId, timeLimit: exam.timeLimit });
      res.status(201).json(withServerTiming(session, exam));
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to start exam' });
    }
  });

  // Get active exam session for student
  app.get('/api/exam-sessions/student/:studentId/active', authenticateUser, async (req, res) => {
    try {
      const studentId = req.params.studentId;

      // Ensure student can only access their own session
      if (req.user!.id !== studentId && req.user!.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'Unauthorized access to parent records' });
      }
      // Get active session for this student
      const allSessions = await storage.getExamSessionsByStudent(studentId);
      const session = allSessions.find(s => !s.isCompleted) || null;

      if (!session) {
        return res.json(null);
      }
      const exam = await storage.getExamById(session.examId);
      res.json(withServerTiming(session, exam));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch active session' });
    }
  });

  // Get all exam sessions for student (includes completed exams)
  app.get('/api/exam-sessions/student/:studentId', authenticateUser, async (req, res) => {
    try {
      const studentId = req.params.studentId;

      // Ensure student can only access their own sessions
      if (req.user!.id !== studentId && req.user!.roleId !== ROLES.ADMIN && req.user!.roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: 'Unauthorized access to session records' });
      }

      // Get all sessions for this student
      const allSessions = await storage.getExamSessionsByStudent(studentId);
      res.json(allSessions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch exam sessions' });
    }
  });

  // Get exam session by ID
  app.get('/api/exam-sessions/:id', authenticateUser, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getExamSessionById(sessionId);

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      // Ensure student can only access their own session
      if (req.user!.id !== session.studentId && req.user!.roleId !== ROLES.ADMIN && req.user!.roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const exam = await storage.getExamById(session.examId);
      res.json(withServerTiming(session, exam));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch exam session' });
    }
  });

  // Update exam session metadata (tab switches, violations)
  // MERGE: incoming fields are merged into existing metadata so nothing is lost.
  app.patch('/api/exam-sessions/:id/metadata', authenticateUser, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { metadata } = req.body;

      // Fetch current session so we can merge metadata safely
      const existing = await storage.getExamSessionById(sessionId);
      if (!existing) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Parse both existing and incoming metadata and deep-merge them
      let existingMeta: Record<string, any> = {};
      try {
        if (existing.metadata) {
          existingMeta = typeof existing.metadata === 'string'
            ? JSON.parse(existing.metadata)
            : existing.metadata;
        }
      } catch (_) {}

      let incomingMeta: Record<string, any> = {};
      try {
        if (metadata) {
          incomingMeta = typeof metadata === 'string'
            ? JSON.parse(metadata)
            : metadata;
        }
      } catch (_) {}

      // Incoming values always win (they are newer)
      const mergedMeta = { ...existingMeta, ...incomingMeta };

      const session = await storage.updateExamSession(sessionId, {
        metadata: JSON.stringify(mergedMeta)
      });

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update session metadata' });
    }
  });

  // Update exam session progress (current question, time remaining)
  // DEFENSIVE BACKEND CHECK: every progress write is preceded by a server-side
  // expiry check. A client whose timer has stalled, drifted, or been tampered
  // with can never keep updating progress past the real deadline.
  app.patch('/api/exam-sessions/:id/progress', authenticateUser, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { currentQuestionIndex, timeRemaining, tabSwitchCount, violationPenalty } = req.body;

      const existing = await storage.getExamSessionById(sessionId);
      if (!existing) {
        return res.status(404).json({ message: 'Session not found' });
      }
      if (req.user!.id !== existing.studentId) {
        return res.status(403).json({ message: 'Unauthorized access to this exam session' });
      }

      if (existing.isCompleted) {
        return res.status(409).json({ status: EXAM_SESSION_STATUS.SUBMITTED, message: 'Exam already submitted' });
      }

      const exam = await storage.getExamById(existing.examId);
      const timing = computeExamTiming(existing, exam);

      if (timing.isExpired) {
        logExamTiming('late-progress-rejected', { sessionId, studentId: existing.studentId });
        await autoSubmitExpiredSession(existing, 'progress-update');
        return res.status(409).json({
          status: EXAM_SESSION_STATUS.EXPIRED,
          message: 'Exam time has expired. Your exam has been automatically submitted.',
        });
      }

      const updates: any = {};

      if (currentQuestionIndex !== undefined) updates.currentQuestionIndex = currentQuestionIndex;
      if (timeRemaining !== undefined) updates.timeRemaining = timeRemaining;
      if (tabSwitchCount !== undefined) updates.tabSwitchCount = tabSwitchCount;
      if (violationPenalty !== undefined) updates.violationPenalty = violationPenalty;

      const session = await storage.updateExamSession(sessionId, updates);

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      res.json(withServerTiming(session, exam));
    } catch (error) {
      res.status(500).json({ message: 'Failed to update session progress' });
    }
  });

  // Save student answer during exam
  app.post('/api/student-answers', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const { sessionId, questionId, selectedOptionId, textAnswer } = req.body;
      const studentId = req.user!.id;

      // Validate required fields
      if (!sessionId || !questionId) {
        return res.status(400).json({ message: 'Missing required fields: sessionId and questionId' });
      }
      // Verify the session belongs to this student
      const session = await storage.getExamSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Exam session not found' });
      }
      if (session.studentId !== studentId) {
        return res.status(403).json({ message: 'Unauthorized access to this exam session' });
      }
      if (session.isCompleted) {
        return res.status(409).json({ status: EXAM_SESSION_STATUS.SUBMITTED, message: 'Cannot save answer - exam is already completed' });
      }

      // DEFENSIVE BACKEND CHECK: reject late answer edits/autosaves after the
      // server-computed deadline, even if the client's own timer hasn't caught up yet.
      const examForTiming = await storage.getExamById(session.examId);
      const timing = computeExamTiming(session, examForTiming);
      if (timing.isExpired) {
        logExamTiming('late-answer-rejected', { sessionId, questionId, studentId: session.studentId });
        await autoSubmitExpiredSession(session, 'answer-save');
        return res.status(409).json({
          status: EXAM_SESSION_STATUS.EXPIRED,
          message: 'Exam time has expired. Your exam has been automatically submitted and this answer was not saved.',
        });
      }
      // Get the question to validate
      const question = await storage.getExamQuestionById(questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      // CRITICAL SECURITY CHECK: Verify question belongs to the exam in this session
      if (question.examId !== session.examId) {
        return res.status(403).json({ message: 'Question does not belong to this exam' });
      }
      // Prepare answer data based on what was provided
      let answerData: Partial<InsertStudentAnswer> = {};

      if (selectedOptionId !== undefined && selectedOptionId !== null) {
        // Multiple choice answer - validate question type
        if (question.questionType !== 'multiple_choice') {
          return res.status(400).json({ message: 'Cannot submit multiple choice answer for non-MCQ question' });
        }
        const optionId = typeof selectedOptionId === 'number' ? selectedOptionId : parseInt(selectedOptionId);

        const option = await storage.getQuestionOptionById(optionId);
        if (!option) {
          return res.status(400).json({ message: 'Invalid option selected' });
        }
        if (option.questionId !== questionId) {
          return res.status(400).json({ message: 'Selected option does not belong to this question' });
        }
        answerData.selectedOptionId = optionId;
        answerData.textAnswer = null;
      } else if (textAnswer !== undefined) {
        // Text/essay answer - validate question type
        if (question.questionType === 'multiple_choice') {
          return res.status(400).json({ message: 'Cannot submit text answer for multiple choice question' });
        }
        answerData.textAnswer = textAnswer || '';
        answerData.selectedOptionId = null;
      } else {
        return res.status(400).json({ message: 'No answer provided' });
      }
      // Upsert the student answer
      const savedAnswer = await storage.upsertStudentAnswer(
        sessionId,
        questionId,
        answerData
      );

      res.json({
        success: true,
        data: {
          answerId: savedAnswer.id,
          questionId: savedAnswer.questionId,
          sessionId: savedAnswer.sessionId,
          status: 'saved'
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to save answer' });
    }
  });

  // Get student answers for a session
  app.get('/api/student-answers/session/:sessionId', authenticateUser, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getExamSessionById(sessionId);

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      // Ensure student can only access their own answers
      if (req.user!.id !== session.studentId && req.user!.roleId !== ROLES.ADMIN && req.user!.roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const answers = await storage.getStudentAnswers(sessionId);
      res.json(answers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch student answers' });
    }
  });

}
