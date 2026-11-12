/** Auto-split from routes.ts — exams-analytics (orig lines 2213-2625). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { students, users } from '@shared/schema.pg';
import { and, desc, eq, sql } from 'drizzle-orm';
import session from 'express-session';

export async function registerExamsAnalyticsRoutes(app: Express) {
  // ==================== EXAM ANALYTICS ENDPOINT ====================
  app.get('/api/teacher/exam-analytics/:examId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Auth check for teachers
      if (req.user!.roleId === ROLES.TEACHER) {
        const teacherId = req.user!.id;
        const isCreator = exam.createdBy === teacherId;
        const isInCharge = exam.teacherInChargeId === teacherId;
        let isAssigned = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isAssigned = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch { /* silent */ }
        }
        if (!isCreator && !isInCharge && !isAssigned) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Fetch raw results
      const rawResults = await storage.getExamResultsByExam(examId);

      // Enrich with student names — batched into a single query instead of
      // one getStudent()+getUser() round-trip per result (was N+1).
      const studentMap = await storage.getStudentsByIds(rawResults.map((r: any) => r.studentId));
      const results = rawResults.map((r: any) => {
        try {
          const student = studentMap.get(r.studentId);
          const scoreVal = r.score ?? r.marksObtained ?? 0;
          const maxVal = r.maxScore ?? exam.totalMarks ?? 100;
          const pct = maxVal > 0 ? Math.round((scoreVal / maxVal) * 100) : 0;
          const passingPct = exam.passingScore ?? 50;
          const passed = pct >= passingPct;
          return {
            studentId: r.studentId,
            studentName: student?.firstName || student?.lastName
              ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
              : student?.username || 'Unknown',
            admissionNumber: student?.admissionNumber ?? null,
            score: scoreVal,
            maxScore: maxVal,
            scorePercent: pct,
            grade: r.grade ?? null,
            passed,
            timeTaken: r.timeTaken ?? null,
            submitted_at: r.submitted_at ?? r.createdAt ?? null,
          };
        } catch {
          return null;
        }
      });
      const validResults = results.filter(Boolean) as any[];

      // Overview metrics
      const total = validResults.length;
      const scores = validResults.map(r => r.scorePercent);
      const avgPercent = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
      const highestPercent = total > 0 ? Math.max(...scores) : 0;
      const lowestPercent = total > 0 ? Math.min(...scores) : 0;
      const passCount = validResults.filter(r => r.passed).length;
      const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

      // Score distribution in 10% buckets
      const buckets = ['0-10','10-20','20-30','30-40','40-50','50-60','60-70','70-80','80-90','90-100'];
      const scoreDistribution = buckets.map(label => {
        const [lo, hi] = label.split('-').map(Number);
        const count = validResults.filter(r => r.scorePercent >= lo && (hi === 100 ? r.scorePercent <= hi : r.scorePercent < hi)).length;
        return { range: `${label}%`, count };
      });

      // Top & low performers (sorted, top 5)
      const sorted = [...validResults].sort((a, b) => b.scorePercent - a.scorePercent);
      const topPerformers = sorted.slice(0, 5);
      const lowPerformers = sorted.slice(-5).reverse();

      // Question analysis via SQL
      let questionAnalysis: any[] = [];
      try {
        const questions = await storage.getExamQuestions(examId);
        const sessions = await storage.getExamSessionsByExam(examId);
        const completedSessionIds = sessions.filter((s: any) => s.status === 'submitted' || s.status === 'graded' || s.isCompleted).map((s: any) => s.id);
        if (completedSessionIds.length > 0 && questions.length > 0) {
          // For each question, count answers from completed sessions
          const answerRows = await db.select({
            questionId: schema.studentAnswers.questionId,
            isCorrect: schema.studentAnswers.isCorrect,
          }).from(schema.studentAnswers)
            .where(sql`${schema.studentAnswers.sessionId} = ANY(ARRAY[${sql.join(completedSessionIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])`);

          const byQuestion: Record<number, { total: number; correct: number }> = {};
          for (const row of answerRows) {
            if (!byQuestion[row.questionId]) byQuestion[row.questionId] = { total: 0, correct: 0 };
            byQuestion[row.questionId].total++;
            if (row.isCorrect) byQuestion[row.questionId].correct++;
          }
          questionAnalysis = questions.map((q: any) => {
            const stat = byQuestion[q.id] || { total: 0, correct: 0 };
            return {
              questionId: q.id,
              questionText: q.questionText,
              questionType: q.questionType,
              points: q.points,
              orderNumber: q.orderNumber,
              totalAttempted: stat.total,
              correctCount: stat.correct,
              correctPercent: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
            };
          }).sort((a: any, b: any) => a.orderNumber - b.orderNumber);
        } else {
          questionAnalysis = questions.map((q: any) => ({
            questionId: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            orderNumber: q.orderNumber,
            totalAttempted: 0,
            correctCount: 0,
            correctPercent: 0,
          }));
        }
      } catch (qErr: any) {
        console.warn('[ANALYTICS] Question analysis failed:', qErr?.message);
      }

      // Performance trends: other exams in same class/subject by this teacher
      let trends: any[] = [];
      try {
        const teacherExams = await db.select({
          id: schema.exams.id,
          name: schema.exams.name,
          date: schema.exams.date,
          totalMarks: schema.exams.totalMarks,
          passingScore: schema.exams.passingScore,
        }).from(schema.exams)
          .where(and(
            eq(schema.exams.classId, exam.classId!),
            eq(schema.exams.subjectId, exam.subjectId!),
          ))
          .orderBy(schema.exams.date);

        for (const te of teacherExams) {
          const teResults = await storage.getExamResultsByExam(te.id);
          if (teResults.length === 0) continue;
          const teScores = teResults.map((r: any) => {
            const s = r.score ?? r.marksObtained ?? 0;
            const m = r.maxScore ?? te.totalMarks ?? 100;
            return m > 0 ? (s / m) * 100 : 0;
          });
          const teAvg = Math.round(teScores.reduce((a: number, b: number) => a + b, 0) / teScores.length);
          const tePassing = te.passingScore ?? 50;
          const tePass = Math.round((teScores.filter(s => s >= tePassing).length / teScores.length) * 100);
          trends.push({
            examId: te.id,
            examName: te.name,
            date: te.date,
            avgPercent: teAvg,
            passRate: tePass,
            studentCount: teResults.length,
          });
        }
      } catch (tErr: any) {
        console.warn('[ANALYTICS] Trends failed:', tErr?.message);
      }

      // Enrich exam metadata: class, subject, term, teacher names
      let className = 'Unknown';
      let subjectName = 'Unknown';
      let termName = 'Unknown';
      let termYear = '';
      let teacherName = 'Not assigned';
      let totalClassStudents = 0;
      let totalQuestions = 0;

      try {
        const [classInfo, subjectInfo, termInfo] = await Promise.all([
          storage.getClass(exam.classId!),
          storage.getSubject(exam.subjectId!),
          storage.getAcademicTerm(exam.termId!),
        ]);
        if (classInfo) className = classInfo.name;
        if (subjectInfo) subjectName = subjectInfo.name;
        if (termInfo) { termName = termInfo.name; termYear = termInfo.year ?? ''; }

        if (exam.createdBy) {
          const teacher = await storage.getUser(exam.createdBy);
          if (teacher) teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.username || '';
        }

        const classStudents = await storage.getStudentsByClass(exam.classId!);
        totalClassStudents = classStudents.length;

        const questions = await storage.getExamQuestions(exam.id);
        totalQuestions = questions.length;
      } catch (metaErr: any) {
        console.warn('[ANALYTICS] Metadata enrichment error:', metaErr?.message);
      }

      // Grade distribution
      const gradeDistribution = [
        { grade: 'A', label: '≥70%', count: validResults.filter(r => r.scorePercent >= 70).length },
        { grade: 'B', label: '60–69%', count: validResults.filter(r => r.scorePercent >= 60 && r.scorePercent < 70).length },
        { grade: 'C', label: '50–59%', count: validResults.filter(r => r.scorePercent >= 50 && r.scorePercent < 60).length },
        { grade: 'D', label: '40–49%', count: validResults.filter(r => r.scorePercent >= 40 && r.scorePercent < 50).length },
        { grade: 'F', label: '<40%', count: validResults.filter(r => r.scorePercent < 40).length },
      ];

      const notAttempted = Math.max(0, totalClassStudents - total);

      return res.json({
        exam: {
          id: exam.id,
          name: exam.name,
          totalMarks: exam.totalMarks,
          passingScore: exam.passingScore ?? 50,
          date: exam.date,
          classId: exam.classId,
          subjectId: exam.subjectId,
          examType: exam.examType,
          timeLimit: exam.timeLimit,
          isPublished: exam.isPublished,
          createdAt: exam.createdAt,
          // enriched
          className,
          subjectName,
          termName,
          termYear,
          teacherName,
          totalQuestions,
        },
        overview: { totalStudents: total, avgPercent, highestPercent, lowestPercent, passRate, passCount, failCount: total - passCount },
        participation: { totalClassStudents, attempted: total, notAttempted, participationRate: totalClassStudents > 0 ? Math.round((total / totalClassStudents) * 100) : 0 },
        gradeDistribution,
        scoreDistribution,
        studentPerformance: validResults,
        questionAnalysis,
        topPerformers,
        lowPerformers,
        trends,
      });
    } catch (error: any) {
      console.error('[ANALYTICS] Error:', error?.message);
      return res.status(500).json({ message: 'Failed to fetch exam analytics' });
    }
  });
  // ==================== END EXAM ANALYTICS ENDPOINT ====================

  // ==================== SUBMISSIONS LIST ENDPOINT ====================
  app.get('/api/teacher/submissions', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const isTeacher = req.user!.roleId === ROLES.TEACHER;
      const { classId, subjectId, examId, status } = req.query as Record<string, string>;

      const conditions: any[] = [];
      if (examId) conditions.push(eq(schema.exams.id, parseInt(examId)));
      if (classId) conditions.push(eq(schema.exams.classId, parseInt(classId)));
      if (subjectId) conditions.push(eq(schema.exams.subjectId, parseInt(subjectId)));
      if (isTeacher) conditions.push(eq(schema.exams.createdBy, teacherId));

      const rows = await db.select({
        resultId: schema.examResults.id,
        studentId: schema.examResults.studentId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        username: schema.users.username,
        admissionNumber: schema.students.admissionNumber,
        examId: schema.exams.id,
        examName: schema.exams.name,
        totalMarks: schema.exams.totalMarks,
        passingScore: schema.exams.passingScore,
        classId: schema.exams.classId,
        className: schema.classes.name,
        subjectId: schema.exams.subjectId,
        subjectName: schema.subjects.name,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        marksObtained: schema.examResults.marksObtained,
        grade: schema.examResults.grade,
        remarks: schema.examResults.remarks,
        autoScored: schema.examResults.autoScored,
        submittedAt: schema.examResults.submittedAt,
        createdAt: schema.examResults.createdAt,
      })
      .from(schema.examResults)
      .leftJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
      .leftJoin(schema.users, eq(schema.examResults.studentId, schema.users.id))
      .leftJoin(schema.students, eq(schema.examResults.studentId, schema.students.id))
      .leftJoin(schema.classes, eq(schema.exams.classId, schema.classes.id))
      .leftJoin(schema.subjects, eq(schema.exams.subjectId, schema.subjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.examResults.createdAt));

      const submissions = rows.map((r: any) => {
        const scoreVal = r.score ?? r.marksObtained ?? null;
        const maxVal = r.maxScore ?? r.totalMarks ?? 100;
        const pct = (scoreVal !== null && maxVal > 0) ? Math.round((scoreVal / maxVal) * 100) : null;
        const isGraded = r.remarks !== null && r.remarks !== '';
        return {
          resultId: r.resultId,
          studentId: r.studentId,
          studentName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}`.trim() : r.username || 'Unknown',
          admissionNumber: r.admissionNumber ?? null,
          examId: r.examId,
          examName: r.examName ?? 'Unknown Exam',
          classId: r.classId,
          className: r.className ?? null,
          subjectId: r.subjectId,
          subjectName: r.subjectName ?? null,
          score: scoreVal,
          maxScore: maxVal,
          scorePercent: pct,
          grade: r.grade ?? null,
          remarks: r.remarks ?? null,
          autoScored: r.autoScored ?? false,
          submitted_at: r.submitted_at ?? r.createdAt ?? null,
          status: isGraded ? 'graded' : 'pending',
          passingScore: r.passingScore ?? 50,
          passed: pct !== null ? pct >= (r.passingScore ?? 50) : null,
        };
      }).filter((s: any) => {
        if (status === 'pending') return s.status === 'pending';
        if (status === 'graded') return s.status === 'graded';
        return true;
      });

      return res.json(submissions);
    } catch (error: any) {
      console.error('[SUBMISSIONS] Error:', error?.message);
      return res.status(500).json({ message: 'Failed to fetch submissions' });
    }
  });

  // Submission detail for grading panel
  app.get('/api/teacher/submissions/:resultId/detail', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const resultId = parseInt(req.params.resultId);
      if (isNaN(resultId)) return res.status(400).json({ message: 'Invalid result ID' });

      const result = await storage.getExamResultById(resultId);
      if (!result) return res.status(404).json({ message: 'Result not found' });

      const exam = await storage.getExamById(result.examId);
      if (!exam) return res.status(404).json({ message: 'Exam not found' });

      // Get questions for this exam
      const questions = await storage.getExamQuestions(result.examId);

      // Get question options
      const questionOptions = questions.length > 0 ? await db.select()
        .from(schema.questionOptions)
        .where(sql`${schema.questionOptions.questionId} = ANY(ARRAY[${sql.join(questions.map((q: any) => sql`${q.id}`), sql`, `)}]::int[])`)
        : [];

      // Get exam session for this student+exam
      const sessions = await storage.getExamSessionsByExam(result.examId);
      const session = sessions.find((s: any) => s.studentId === result.studentId);

      // Get student answers for the session
      let answers: any[] = [];
      if (session) {
        answers = await storage.getStudentAnswers(session.id);
      }

      // Build question breakdown
      const questionBreakdown = questions.map((q: any) => {
        const opts = questionOptions.filter((o: any) => o.questionId === q.id);
        const answer = answers.find((a: any) => a.questionId === q.id);
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points,
          orderNumber: q.orderNumber,
          options: opts.sort((a: any, b: any) => a.orderNumber - b.orderNumber),
          answer: answer ? {
            textAnswer: answer.textAnswer ?? null,
            selectedOptionId: answer.selectedOptionId ?? null,
            isCorrect: answer.isCorrect ?? null,
            pointsEarned: answer.pointsEarned ?? 0,
            feedbackText: answer.feedbackText ?? null,
          } : null,
        };
      }).sort((a: any, b: any) => a.orderNumber - b.orderNumber);

      return res.json({
        resultId: result.id,
        examId: result.examId,
        studentId: result.studentId,
        sessionId: session?.id ?? null,
        score: result.score ?? null,
        maxScore: result.maxScore ?? exam.totalMarks ?? null,
        grade: result.grade ?? null,
        remarks: result.remarks ?? null,
        submitted_at: result.submitted_at ?? null,
        questions: questionBreakdown,
      });
    } catch (error: any) {
      console.error('[SUBMISSION DETAIL] Error:', error?.message);
      return res.status(500).json({ message: 'Failed to fetch submission detail' });
    }
  });
  // ==================== END SUBMISSIONS ENDPOINTS ====================
}
