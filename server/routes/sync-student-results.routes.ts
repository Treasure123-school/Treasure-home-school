/** Student exam results endpoints — split from realtime-sync.routes.ts. */
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

function formatDate(dateValue: any): string | null {
  if (!dateValue) return null;
  try {
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }
    return new Date(dateValue).toISOString();
  } catch (e) {
    return String(dateValue);
  }
}

export async function registerSyncStudentResultsRoutes(app: Express) {

  // Get exam results for the current logged-in student - STUDENTS ONLY
  // This endpoint returns all completed exam results for the student permanently stored in the database
  // IMPORTANT: This endpoint is designed to be robust - it always returns results from exam_results table
  // even if exam enrichment temporarily fails, ensuring students never see their scores disappear
  app.get('/api/exam-results', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const studentId = req.user!.id;

      // Get all exam results for this student from the database (permanent storage)
      const results = await storage.getExamResultsByStudent(studentId);

      // Pre-fetch all student sessions once for efficiency
      let studentSessions: any[] = [];
      try {
        studentSessions = await storage.getExamSessionsByStudent(studentId);
      } catch (sessionError) {
        console.warn('[STUDENT-EXAM-RESULTS] Could not fetch sessions, continuing with results only');
      }

      // Enrich results with exam and subject information
      // CRITICAL: Even if enrichment fails, we MUST return the core result data
      const enrichedResults = await Promise.all(results.map(async (result: any) => {
        // Start with guaranteed base data from exam_results table
        const score = result.score || result.marksObtained || 0;
        const maxScore = result.maxScore || 100;
        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const submittedAtFormatted = formatDate(result.createdAt);

        // Base result that we always return (guaranteed from database)
        const baseResult: {
          id: number;
          examId: number;
          studentId: string;
          score: number;
          maxScore: number;
          percentage: number;
          grade: string | null;
          remarks: string | null;
          submittedAt: string | null;
          timeTakenSeconds: number;
          submissionReason: string;
          violationCount: number;
          examTitle: string;
          subjectName: string;
          className: string;
          showCorrectAnswers: boolean;
          autoGradingEnabled: boolean;
          resultReleasedAt: string | null;
          pendingManualGrading: boolean;
          exam: {
            id: number;
            title: string;
            totalMarks: number;
            timeLimit: number | null;
            date: string | null;
          };
        } = {
          id: result.id,
          examId: result.examId,
          studentId: result.studentId,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          grade: result.grade || null,
          remarks: result.remarks || null,
          submittedAt: submittedAtFormatted,
          timeTakenSeconds: 0,
          submissionReason: 'manual',
          violationCount: 0,
          examTitle: `Exam #${result.examId}`,
          subjectName: 'Unknown Subject',
          className: 'Unknown Class',
          showCorrectAnswers: true,
          autoGradingEnabled: true,
          resultReleasedAt: formatDate((result as any).resultReleasedAt),
          pendingManualGrading: false,
          exam: {
            id: result.examId,
            title: `Exam #${result.examId}`,
            totalMarks: maxScore,
            timeLimit: null,
            date: null
          }
        };

        try {
          // Try to enrich with exam details
          const exam = await storage.getExamById(result.examId);

          // DESIGN DECISION: Exam results ALWAYS persist and are shown to students
          // The isPublished flag controls whether students can TAKE the exam, NOT view their results
          // Results should only disappear if the exam is explicitly deleted from the system
          // This ensures students never see their scores "disappear" unexpectedly

          // If exam found, enrich the result
          if (exam) {
            baseResult.examTitle = exam.name;
            baseResult.maxScore = result.maxScore || exam.totalMarks || 100;
            baseResult.percentage = baseResult.maxScore > 0 ? Math.round((score / baseResult.maxScore) * 100) : 0;
            baseResult.showCorrectAnswers = exam.showCorrectAnswers ?? true;
            baseResult.autoGradingEnabled = exam.autoGradingEnabled !== false;
            baseResult.resultReleasedAt = formatDate((result as any).resultReleasedAt);
            baseResult.pendingManualGrading = !baseResult.autoGradingEnabled && !baseResult.resultReleasedAt;
            baseResult.exam = {
              id: exam.id,
              title: exam.name,
              totalMarks: exam.totalMarks,
              timeLimit: exam.timeLimit ?? null,
              date: exam.date ?? null
            };

            // Try to get subject and class info
            try {
              if (exam.subjectId) {
                const subject = await storage.getSubject(exam.subjectId!);
                if (subject) baseResult.subjectName = subject.name;
              }
              if (exam.classId) {
                const examClass = await storage.getClass(exam.classId!);
                if (examClass) baseResult.className = examClass.name;
              }
            } catch (lookupError) {
              // Keep default values on lookup failure
            }
          }

          // Try to get session details for additional metadata
          const session = studentSessions.find((s: any) => s.examId === result.examId && s.isCompleted);
          if (session) {
            if (session.submittedAt) {
              baseResult.submittedAt = formatDate(session.submittedAt) || baseResult.submittedAt;
            }

            // Parse session metadata for submission details
            if (session.metadata) {
              try {
                const metadata = typeof session.metadata === 'string'
                  ? JSON.parse(session.metadata)
                  : session.metadata;
                baseResult.submissionReason = metadata.submissionReason || 'manual';
                baseResult.violationCount = metadata.violationCount || 0;
                baseResult.timeTakenSeconds = metadata.timeTakenSeconds || 0;
              } catch (e) {
                // Ignore parse errors - keep defaults
              }
            }

            // If timeTakenSeconds still 0, try computing from session start/submit times
            if (baseResult.timeTakenSeconds === 0 && session.startedAt && session.submittedAt) {
              try {
                const start = new Date(session.startedAt).getTime();
                const end = new Date(session.submittedAt).getTime();
                if (start > 0 && end > start) {
                  baseResult.timeTakenSeconds = Math.floor((end - start) / 1000);
                }
              } catch (e) { /* ignore */ }
            }
          }

          // Add formatted time for display
          if (baseResult.timeTakenSeconds > 0) {
            const mins = Math.floor(baseResult.timeTakenSeconds / 60);
            const secs = baseResult.timeTakenSeconds % 60;
            (baseResult as any).timeTakenFormatted = mins === 0
              ? `${secs} seconds`
              : `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
          }

          return baseResult;
        } catch (enrichError) {
          console.warn('[STUDENT-EXAM-RESULTS] Enrichment failed for result:', result.id, '- returning base data');
          // On ANY enrichment error, return the base result with data we have from database
          return baseResult;
        }
      }));

      // All results should be valid - we no longer filter based on publish status
      // Results only disappear if explicitly deleted, not when unpublished
      const validResults = enrichedResults.filter((r: any) => r !== null);

      // Sort by submission date (most recent first)
      validResults.sort((a: any, b: any) => {
        const dateA = new Date(a.submittedAt || 0).getTime();
        const dateB = new Date(b.submittedAt || 0).getTime();
        return dateB - dateA;
      });

      res.json(validResults);
    } catch (error: any) {
      console.error('[STUDENT-EXAM-RESULTS] Error fetching student exam results:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam results' });
    }
  });

  // STRICT MATCHING: Get a SINGLE exam result for the current student by exact exam ID
  // This endpoint guarantees the score displayed corresponds to the EXACT exam clicked
  // No fallback logic - returns 404 if no result exists for this specific exam
  app.get('/api/exam-results/student/:examId', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const studentId = req.user!.id;

      console.log(`[STRICT-EXAM-RESULT] Student ${studentId} requesting result for exam ${examId}`);

      // Validate exam ID
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Get the exam to verify it exists and get subject/class info
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // STRICT QUERY: Get ONLY the result for THIS specific exam and THIS student
      // Uses getExamResultByExamAndStudent which queries: WHERE exam_id = ? AND student_id = ?
      const result = await storage.getExamResultByExamAndStudent(examId, studentId);

      if (!result) {
        console.log(`[STRICT-EXAM-RESULT] No result found for student ${studentId}, exam ${examId}`);
        return res.status(404).json({
          message: 'No result found for this exam',
          examId: examId,
          subjectName: exam.subjectId ? (await storage.getSubject(exam.subjectId!))?.name : 'Unknown'
        });
      }

      console.log(`[STRICT-EXAM-RESULT] Found result ID ${result.id} for student ${studentId}, exam ${examId}`);

      // Map new schema fields for the frontend
      const responseData = {
        ...result,
        correct_answers: (result as any).correctAnswers ?? 0,
        incorrect_answers: (result as any).incorrectAnswers ?? 0,
        total_questions: (result as any).totalQuestions ?? 0,
        time_taken: (result as any).timeTaken ?? 0,
        submitted_at: (result as any).submittedAt ?? (result as any).createdAt
      };

      // Get subject and class information for display
      let subjectName = 'Unknown Subject';
      let className = 'Unknown Class';

      if (exam.subjectId) {
        const subject = await storage.getSubject(exam.subjectId!);
        subjectName = subject?.name || 'Unknown Subject';
      }

      if (exam.classId) {
        const classInfo = await storage.getClass(exam.classId!);
        className = classInfo?.name || 'Unknown Class';
      }

      // Get session info for time taken and submission details
      let timeTakenSeconds = 0;
      let submissionReason = 'manual';
      let violationCount = 0;

      try {
        const sessions = await storage.getExamSessionsByStudent(studentId);
        // BUG FIX: was checking s.status === 'completed' but status is 'submitted'/'graded', never 'completed'
        // Use s.isCompleted (boolean) which IS correctly set to true on submission
        const matchingSession = sessions.find((s: any) => s.examId === examId && s.isCompleted);
        if (matchingSession) {
          const metadata = typeof matchingSession.metadata === 'string'
            ? JSON.parse(matchingSession.metadata)
            : matchingSession.metadata;
          timeTakenSeconds = metadata?.timeTakenSeconds || 0;
          submissionReason = metadata?.submissionReason || 'manual';
          violationCount = metadata?.violationCount || 0;

          // Fallback: compute from session start/submit times if metadata didn't have it
          if (timeTakenSeconds === 0 && matchingSession.startedAt && matchingSession.submittedAt) {
            try {
              const start = new Date(matchingSession.startedAt).getTime();
              const end = new Date(matchingSession.submittedAt).getTime();
              if (start > 0 && end > start) {
                timeTakenSeconds = Math.floor((end - start) / 1000);
              }
            } catch (e) { /* ignore */ }
          }
        }
      } catch (sessionError) {
        // Session enrichment failed, use defaults
      }

      // Calculate score values
      const score = result.score ?? result.marksObtained ?? 0;
      const maxScore = result.maxScore ?? exam.totalMarks ?? 100;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const autoGradingEnabled = exam.autoGradingEnabled !== false;
      const showAnswers = exam.showCorrectAnswers ?? true;
      const resultReleasedAt = formatDate((result as any).resultReleasedAt);
      const pendingManualGrading = !autoGradingEnabled && !resultReleasedAt;

      // Get all student answers for this session
      const allSessions = await storage.getExamSessionsByStudent(studentId);
      // Look for any session for this exam, prioritizing completed ones
      const matchingSession = allSessions.find((s: any) => s.examId === examId && s.isCompleted) ||
        allSessions.find((s: any) => s.examId === examId);

      let questionDetails: any[] = [];
      if (matchingSession) {
        console.log(`[STRICT-EXAM-RESULT] Using session ${matchingSession.id} for question breakdown`);
        const answers = await storage.getStudentAnswers(matchingSession.id);
        const questions = await storage.getExamQuestions(examId);

        questionDetails = await Promise.all(questions.map(async (q: any) => {
          const studentAns = answers.find((a: any) => a.questionId === q.id);
          const options = q.questionType === 'multiple_choice' ? await storage.getQuestionOptions(q.id) : [];
          const correctOption = options.find((o: any) => o.isCorrect);

          // CRITICAL FIX: Direct mapping of student answer text
          let studentAnswerText = "No answer provided";
          let isCorrect: boolean | null = pendingManualGrading ? null : false;
          let pointsEarned = 0;

          if (studentAns) {
            isCorrect = pendingManualGrading ? null : (studentAns.isCorrect || false);
            pointsEarned = pendingManualGrading ? 0 : (studentAns.pointsEarned || 0);

            if (q.questionType === 'multiple_choice' && studentAns.selectedOptionId) {
              const studentOption = options.find((o: any) => o.id === studentAns.selectedOptionId);
              studentAnswerText = studentOption?.optionText || `Option (ID: ${studentAns.selectedOptionId})`;
            } else if (studentAns.textAnswer) {
              studentAnswerText = studentAns.textAnswer;
            }
          }

          // Determine correct answer text
          let correctAnswerText = "Not available";
          if (q.questionType === 'multiple_choice') {
            const correctOption = options.find((o: any) => o.isCorrect);
            correctAnswerText = correctOption?.optionText || "Not specified";
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

          return {
            questionId: q.id,
            questionText: q.questionText,
            isCorrect: isCorrect,
            pointsAwarded: pointsEarned,
            maxPoints: q.points,
            studentAnswer: studentAnswerText,
            // Only expose correct answer if the teacher has enabled it
            correctAnswer: showAnswers && !pendingManualGrading ? correctAnswerText : undefined,
          };
        }));

        if (!showAnswers || pendingManualGrading) {
          questionDetails = [];
        }
      }

      // Format time taken for display
      const finalTimeTaken = (result as any).timeTaken || timeTakenSeconds;
      const formatTimeTaken = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs} seconds`;
        return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
      };

      // Return the EXACT result for this specific exam - no mixing with other exams
      const enrichedResult = {
        id: result.id,
        examId: result.examId,
        studentId: result.studentId,
        score: score,
        maxScore: maxScore,
        percentage: percentage,
        grade: result.grade || null,
        remarks: result.remarks || null,
        submittedAt: (result as any).submittedAt?.toISOString() || (result as any).createdAt?.toISOString() || null,
        correct_answers: (result as any).correctAnswers ?? 0,
        incorrect_answers: (result as any).incorrectAnswers ?? 0,
        total_questions: (result as any).totalQuestions ?? 0,
        time_taken: finalTimeTaken,
        timeTakenSeconds: finalTimeTaken,
        timeTakenFormatted: finalTimeTaken > 0 ? formatTimeTaken(finalTimeTaken) : null,
        submissionReason: submissionReason,
        violationCount: violationCount,
        examTitle: exam.name,
        subjectName: subjectName,
        className: className,
        questionDetails: questionDetails,
        showCorrectAnswers: exam.showCorrectAnswers ?? true,
        autoGradingEnabled,
        resultReleasedAt,
        pendingManualGrading,
        // Include exam details for verification
        exam: {
          id: exam.id,
          title: exam.name,
          totalMarks: exam.totalMarks,
          timeLimit: exam.timeLimit,
          date: exam.date,
          subjectId: exam.subjectId,
          classId: exam.classId
        },
      };

      console.log(`[STRICT-EXAM-RESULT] Returning result: exam="${exam.name}", subject="${subjectName}", score=${score}/${maxScore}`);

      res.json(enrichedResult);
    } catch (error: any) {
      console.error('[STRICT-EXAM-RESULT] Error:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam result' });
    }
  });
}
