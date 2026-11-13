/** Storage layer: exam↔bank links, AI grading tasks, exam sessions.
 *  Chain: DatabaseStorageExamSessions → extends into student-answers-scoring.ts */
import { db, schema } from '../storage/helpers';
import { getActiveGradingConfig } from '../grade-scale-service';
import { calculateGradeFromConfig, calculateWeightedScore } from '../grading-config';
import { Exam, ExamQuestionBankLink, ExamResult, ExamSession, InsertExamQuestionBankLink, InsertExamSession, QuestionBankItem, ReportCard, Student, StudentAnswer, Subject } from '@shared/schema.pg';
import { and, asc, desc, eq, inArray, or, sql, sql as dsql } from 'drizzle-orm';
import { DatabaseStorageQuestionBanks } from './question-banks-syllabus'
import type { IStorage } from './types'

export class DatabaseStorageExamSessions extends DatabaseStorageQuestionBanks {
  async generateQuestionsFromBank(criteria: {
    bankId?: number; classId?: number; subjectId?: number; termId?: number;
    distribution: Array<{ topicId?: number; difficulty?: string; count: number }>;
  }): Promise<{ questions: QuestionBankItem[]; shortfalls: string[] }> {
    const questions: QuestionBankItem[] = [];
    const shortfalls: string[] = [];
    const usedIds = new Set<number>();

    for (const dist of criteria.distribution) {
      const conditions: any[] = [inArray(schema.questionBankItems.status, ['active', 'published', 'approved'])];
      if (criteria.bankId) conditions.push(eq(schema.questionBankItems.bankId, criteria.bankId));
      if (criteria.classId) conditions.push(eq(schema.questionBankItems.classId, criteria.classId));
      if (criteria.termId) conditions.push(eq(schema.questionBankItems.termId, criteria.termId));
      if (dist.topicId) conditions.push(eq(schema.questionBankItems.topicId, dist.topicId));
      if (dist.difficulty) conditions.push(eq(schema.questionBankItems.difficulty, dist.difficulty));

      // Subject filter via bank
      if (criteria.subjectId) {
        const bankIds = await db.select({ id: schema.questionBanks.id })
          .from(schema.questionBanks)
          .where(eq(schema.questionBanks.subjectId, criteria.subjectId));
        if (bankIds.length > 0) {
          conditions.push(inArray(schema.questionBankItems.bankId, bankIds.map((b: { id: number }) => b.id)));
        }
      }

      const pool = await db.select().from(schema.questionBankItems)
        .where(and(...conditions));

      // Filter out already-used questions
      const available = pool.filter((q: QuestionBankItem) => !usedIds.has(q.id));

      // Shuffle and pick
      const shuffled = available.sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, dist.count);

      if (picked.length < dist.count) {
        shortfalls.push(`Needed ${dist.count} questions (topic=${dist.topicId || 'any'}, difficulty=${dist.difficulty || 'any'}), found ${picked.length}`);
      }

      for (const q of picked) {
        usedIds.add(q.id);
        questions.push(q);
      }
    }

    return { questions, shortfalls };
  }

  // Track exam-bank links

  async createExamQuestionBankLink(link: InsertExamQuestionBankLink): Promise<ExamQuestionBankLink> {
    const result = await db.insert(schema.examQuestionBankLinks).values(link).returning();
    // Increment usage count
    await db.update(schema.questionBankItems)
      .set({ usageCount: sql`${schema.questionBankItems.usageCount} + 1` })
      .where(eq(schema.questionBankItems.id, link.bankItemId));
    return result[0];
  }

  async getExamQuestionBankLinks(examId: number): Promise<ExamQuestionBankLink[]> {
    return await db.select().from(schema.examQuestionBankLinks)
      .where(eq(schema.examQuestionBankLinks.examId, examId));
  }

  async getAISuggestedGradingTasks(teacherId: string, status?: string): Promise<any[]> {
    try {
      // Get teacher's assigned classes and subjects
      const assignments = await this.db.select()
        .from(schema.teacherClassAssignments)
        .where(and(
          eq(schema.teacherClassAssignments.teacherId, teacherId),
          eq(schema.teacherClassAssignments.isActive, true)
        ));

      if (assignments.length === 0) {
        return [];
      }
      const classIds = assignments.map((a: any) => a.classId);
      const subjectIds = assignments.map((a: any) => a.subjectId);

      // Get exams for these classes/subjects
      const exams = await this.db.select()
        .from(schema.exams)
        .where(and(
          inArray(schema.exams.classId, classIds),
          inArray(schema.exams.subjectId, subjectIds)
        ));

      const examIds = exams.map((e: any) => e.id);
      if (examIds.length === 0) {
        return [];
      }
      // Get sessions for these exams
      const sessions = await this.db.select()
        .from(schema.examSessions)
        .where(and(
          inArray(schema.examSessions.examId, examIds),
          eq(schema.examSessions.isCompleted, true)
        ));

      const sessionIds = sessions.map((s: any) => s.id);
      if (sessionIds.length === 0) {
        return [];
      }
      // Get student answers that are AI-suggested (not auto-scored, has points)
      let query = this.db.select({
        id: schema.studentAnswers.id,
        sessionId: schema.studentAnswers.sessionId,
        questionId: schema.studentAnswers.questionId,
        textAnswer: schema.studentAnswers.textAnswer,
        pointsEarned: schema.studentAnswers.pointsEarned,
        feedbackText: schema.studentAnswers.feedbackText,
        autoScored: schema.studentAnswers.autoScored,
        manualOverride: schema.studentAnswers.manualOverride,
        answeredAt: schema.studentAnswers.answeredAt,
        questionText: schema.examQuestions.questionText,
        questionType: schema.examQuestions.questionType,
        points: schema.examQuestions.points,
        expectedAnswers: schema.examQuestions.expectedAnswers,
        studentId: schema.examSessions.studentId,
        examId: schema.examSessions.examId,
        examName: schema.exams.name
      })
        .from(schema.studentAnswers)
        .innerJoin(schema.examQuestions, eq(schema.studentAnswers.questionId, schema.examQuestions.id))
        .innerJoin(schema.examSessions, eq(schema.studentAnswers.sessionId, schema.examSessions.id))
        .innerJoin(schema.exams, eq(schema.examSessions.examId, schema.exams.id))
        .where(and(
          inArray(schema.studentAnswers.sessionId, sessionIds),
          sql`${schema.examQuestions.questionType} = 'essay'`,
          sql`${schema.studentAnswers.textAnswer} IS NOT NULL`
        ));

      // Filter by status if provided
      if (status === 'pending') {
        query = query.where(sql`${schema.studentAnswers.autoScored} = false AND ${schema.studentAnswers.manualOverride} = false`);
      } else if (status === 'reviewed') {
        query = query.where(sql`(${schema.studentAnswers.autoScored} = true OR ${schema.studentAnswers.manualOverride} = true)`);
      }
      const results = await query;

      // Get student names
      const studentIds = Array.from(new Set(results.map((r: any) => r.studentId))) as string[];
      const students = await this.db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName
      })
        .from(schema.users)
        .where(inArray(schema.users.id, studentIds));

      // Enrich results with student names
      return results.map((r: any) => ({
        ...r,
        studentName: `${students.find((s: any) => s.id === r.studentId)?.firstName} ${students.find((s: any) => s.id === r.studentId)?.lastName}`,
        status: r.autoScored || r.manualOverride ? 'reviewed' : 'pending',
        aiSuggested: r.pointsEarned > 0 && !r.autoScored && !r.manualOverride
      }));

    } catch (error) {
      return [];
    }
  }


  // Exam sessions management

  async createExamSession(session: InsertExamSession): Promise<ExamSession> {
    const result = await db.insert(schema.examSessions).values(session).returning();
    return result[0];
  }

  async getExamSessionById(id: number): Promise<ExamSession | undefined> {
    // Only select columns that actually exist in the current database
    const result = await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.id, id))
      .limit(1);
    return result[0];
  }

  async getExamSessionsByExam(examId: number): Promise<ExamSession[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.examId, examId))
      .orderBy(desc(schema.examSessions.startedAt));
  }

  async getExamSessionsByStudent(studentId: string): Promise<ExamSession[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt,
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.studentId, studentId))
      .orderBy(desc(schema.examSessions.startedAt));
  }

  async updateExamSession(id: number, session: Partial<InsertExamSession>): Promise<ExamSession | undefined> {
    // Filter to only existing columns to avoid database errors
    const allowedFields: Partial<InsertExamSession> = {};
    const existingColumns = ['examId', 'studentId', 'startedAt', 'submittedAt', 'timeRemaining', 'isCompleted', 'score', 'maxScore', 'status', 'metadata'];

    // Only include fields that exist in the database
    for (const [key, value] of Object.entries(session)) {
      if (existingColumns.includes(key) && value !== undefined) {
        (allowedFields as any)[key] = value;
      }
    }

    const result = await db.update(schema.examSessions)
      .set(allowedFields)
      .where(eq(schema.examSessions.id, id))
      .returning({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      });
    return result[0];
  }

  // Atomically claim a session for submission. Only succeeds if the session is not
  // already completed, preventing double-submission races when two requests (e.g. a
  // manual click and an auto-submit-on-timeout) arrive concurrently for the same session.
  // Returns the updated session if this call won the race, or undefined if the session
  // was already completed by another in-flight request.

  async claimExamSessionForSubmission(
    id: number,
    updates: { submittedAt: Date; status: string; metadata: string }
  ): Promise<ExamSession | undefined> {
    const result = await db.update(schema.examSessions)
      .set({
        isCompleted: true,
        submittedAt: updates.submittedAt,
        status: updates.status,
        metadata: updates.metadata
      })
      .where(and(eq(schema.examSessions.id, id), eq(schema.examSessions.isCompleted, false)))
      .returning({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      });
    return result[0];
  }

  async deleteExamSession(id: number): Promise<boolean> {
    const result = await db.delete(schema.examSessions)
      .where(eq(schema.examSessions.id, id));
    return result.length > 0;
  }

  async getActiveExamSession(examId: number, studentId: string): Promise<ExamSession | undefined> {
    const result = await db.select().from(schema.examSessions)
      .where(and(
        eq(schema.examSessions.examId, examId),
        eq(schema.examSessions.studentId, studentId),
        eq(schema.examSessions.isCompleted, false)
      ))
      .limit(1);
    return result[0];
  }
  // Get all active exam sessions for background cleanup service

  async getActiveExamSessions(): Promise<ExamSession[]> {
    // Temporarily select only core columns to avoid missing column errors
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .where(eq(schema.examSessions.isCompleted, false))
      .orderBy(desc(schema.examSessions.startedAt));
  }
  // PERFORMANCE: Get only expired sessions directly from database.
  // SERVER-AUTHORITATIVE TIMER FIX: this used to fall back to a flat 2-hour window
  // regardless of the exam's actual time limit, so this safety-net sweep (which runs
  // every few minutes) effectively never caught most timed-out exams — students could
  // keep the session "in progress" for up to 2 hours after the timer hit 00:00 before the
  // background job would notice. It now joins the exam's real `timeLimit` (defaulting to
  // 60 minutes only when the exam has no limit set) plus a small grace period, matching
  // the same deadline every other exam-taking endpoint enforces.

  async getExpiredExamSessions(now: Date, limit = 100): Promise<ExamSession[]> {
    return await db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .innerJoin(schema.exams, eq(schema.exams.id, schema.examSessions.examId))
      .where(and(
        eq(schema.examSessions.isCompleted, false),
        dsql`${schema.examSessions.startedAt} + (COALESCE(${schema.exams.timeLimit}, 60) * interval '1 minute') + interval '5 seconds' < ${now.toISOString()}`
      ))
      .orderBy(asc(schema.examSessions.startedAt))
      .limit(limit);
  }
  // CIRCUIT BREAKER FIX: Idempotent session creation using UPSERT to prevent connection pool exhaustion

  async createOrGetActiveExamSession(examId: number, studentId: string, sessionData: InsertExamSession): Promise<ExamSession & { wasCreated?: boolean }> {
    try {
      // STEP 1: Try to insert new session - this will fail if an active session already exists due to unique index
      const insertResult = await db.insert(schema.examSessions)
        .values({
          examId: sessionData.examId,
          studentId: studentId,
          startedAt: new Date(),
          timeRemaining: sessionData.timeRemaining,
          isCompleted: false,
          status: 'in_progress'
        })
        .onConflictDoNothing() // This requires the unique index we added
        .returning({
          id: schema.examSessions.id,
          examId: schema.examSessions.examId,
          studentId: schema.examSessions.studentId,
          startedAt: schema.examSessions.startedAt,
          submittedAt: schema.examSessions.submittedAt,
          timeRemaining: schema.examSessions.timeRemaining,
          isCompleted: schema.examSessions.isCompleted,
          score: schema.examSessions.score,
          maxScore: schema.examSessions.maxScore,
          status: schema.examSessions.status,
          createdAt: schema.examSessions.createdAt
        });

      // If insert succeeded, return the new session
      if (insertResult.length > 0) {
        return { ...insertResult[0], wasCreated: true };
      }
      // STEP 2: Insert failed due to conflict, fetch the existing active session
      const existingSession = await db.select({
        id: schema.examSessions.id,
        examId: schema.examSessions.examId,
        studentId: schema.examSessions.studentId,
        startedAt: schema.examSessions.startedAt,
        submittedAt: schema.examSessions.submittedAt,
        timeRemaining: schema.examSessions.timeRemaining,
        isCompleted: schema.examSessions.isCompleted,
        score: schema.examSessions.score,
        maxScore: schema.examSessions.maxScore,
        status: schema.examSessions.status,
        createdAt: schema.examSessions.createdAt
      }).from(schema.examSessions)
        .where(and(
          eq(schema.examSessions.examId, examId),
          eq(schema.examSessions.studentId, studentId),
          eq(schema.examSessions.isCompleted, false)
        ))
        .limit(1);

      if (existingSession.length > 0) {
        return { ...existingSession[0], wasCreated: false };
      }
      // This should not happen with proper unique index, but handle gracefully
      throw new Error(`Unable to create or retrieve exam session for student ${studentId} exam ${examId}`);

    } catch (error: any) {
      throw error;
    }
  }

  // Exam retake management - allows teacher to reset student exam for retake
  // Uses a transaction to ensure atomic operation - either all changes succeed or all roll back

  async getStudentAnswers(sessionId: number): Promise<StudentAnswer[]> {
    return await db.select().from(schema.studentAnswers)
      .where(eq(schema.studentAnswers.sessionId, sessionId))
      .orderBy(asc(schema.studentAnswers.answeredAt));
  }

  async recalculateReportCard(reportCardId: number, gradingScale: string): Promise<ReportCard | undefined> {
    try {
      // Get all items for this report card
      const items = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));

      if (items.length === 0) return undefined;

      // Use the stored per-item percentage (already correctly weighted) to compute
      // the average.  Summing obtainedMarks/totalMarks is unreliable when only one
      // component (test OR exam) is present because obtainedMarks caps at the
      // component weight (e.g. 40 for test-only), making the ratio misleadingly low.
      const activeConfig = await getActiveGradingConfig();

      // Count only items that have actual recorded raw scores — avoids excluding
      // students who legitimately scored 0 (which percentage > 0 would wrongly skip).
      const itemsWithScores = items.filter(
        (item: any) => item.testScore !== null || item.examScore !== null
      );
      const countForAvg = itemsWithScores.length > 0 ? itemsWithScores.length : items.length;
      // Sum only scored items (unscored rows have percentage=0 and should not contribute
      // to the sum OR to the count, so keeping them out of both is consistent).
      const sumPercentage = itemsWithScores.reduce(
        (sum: number, item: any) => sum + (item.percentage || 0), 0
      );
      const averagePercentage = countForAvg > 0 ? sumPercentage / countForAvg : 0;

      // Also track the raw weighted total (sum of obtainedMarks) for the totalScore column
      const totalObtained = items.reduce(
        (sum: number, item: any) => sum + (item.obtainedMarks || 0), 0
      );

      const overallGrade = calculateGradeFromConfig(averagePercentage, activeConfig).grade;

      const result = await db.update(schema.reportCards)
        .set({
          totalScore: totalObtained,
          averageScore: Math.round(averagePercentage),
          averagePercentage: Math.round(averagePercentage),
          overallGrade: overallGrade,
          updatedAt: new Date()
        })
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error recalculating report card:', error);
      return undefined;
    }
  }


  async allowExamRetake(examId: number, studentId: string, archivedBy: string): Promise<{ success: boolean; message: string; archivedSubmissionId?: number }> {
    try {
      console.log(`[allowExamRetake] Starting retake process for exam ${examId}, student ${studentId}`);

      // 1. Get the existing exam result (outside transaction for validation)
      const existingResult = await this.getExamResultByExamAndStudent(examId, studentId);
      if (!existingResult) {
        return { success: false, message: 'No exam submission found for this student' };
      }

      // 2. Get all exam sessions for this student and exam
      const sessions = await db.select()
        .from(schema.examSessions)
        .where(and(
          eq(schema.examSessions.examId, examId),
          eq(schema.examSessions.studentId, studentId)
        ));

      // 3. Get the student answers from all sessions
      let studentAnswers: any[] = [];
      for (const session of sessions) {
        const answers = await this.getStudentAnswers(session.id);
        studentAnswers = [...studentAnswers, ...answers];
      }

      // 4. Execute archive and cleanup in a transaction for atomicity
      const result = await db.transaction(async (tx: any) => {
        // Archive the submission in exam_submissions_archive table
        const archivedSubmission = await tx.insert(schema.examSubmissionsArchive).values({
          examId,
          studentId,
          originalResultId: existingResult.id,
          originalSessionId: sessions[0]?.id || null,
          score: existingResult.score || existingResult.marksObtained || 0,
          maxScore: existingResult.maxScore || 100,
          grade: existingResult.grade || null,
          remarks: existingResult.remarks || null,
          answersSnapshot: JSON.stringify(studentAnswers),
          archivedBy,
          archiveReason: 'Teacher allowed retake',
          archivedAt: new Date(),
        }).returning();

        console.log(`[allowExamRetake] Archived submission ID: ${archivedSubmission[0]?.id}`);

        // Delete student answers for all sessions
        for (const session of sessions) {
          await tx.delete(schema.studentAnswers)
            .where(eq(schema.studentAnswers.sessionId, session.id));
          console.log(`[allowExamRetake] Deleted answers for session ${session.id}`);
        }

        // Delete all exam sessions
        await tx.delete(schema.examSessions)
          .where(and(
            eq(schema.examSessions.examId, examId),
            eq(schema.examSessions.studentId, studentId)
          ));
        console.log(`[allowExamRetake] Deleted ${sessions.length} sessions`);

        // Delete the exam result
        await tx.delete(schema.examResults)
          .where(eq(schema.examResults.id, existingResult.id));
        console.log(`[allowExamRetake] Deleted exam result ${existingResult.id}`);

        return { archivedSubmissionId: archivedSubmission[0]?.id };
      });

      // ── Clear stale report-card-item cache ─────────────────────────────────
      // The transaction above deleted the exam_results row, but report_card_items
      // still holds the cached testScore/examScore from that submission.
      // If left in place, reapplyWeightedScoresToItems() will read the stale cache
      // and write the old score back — making "Recalculate" a no-op after a retake.
      try {
        const examRows = await db
          .select({
            subjectId: schema.exams.subjectId,
            termId:    schema.exams.termId,
            examType:  schema.exams.examType,
          })
          .from(schema.exams)
          .where(eq(schema.exams.id, examId))
          .limit(1);

        if (examRows.length > 0) {
          const { subjectId, termId, examType } = examRows[0];
          const isTestType = ['test', 'quiz', 'assignment'].includes(examType || '');

          if (subjectId && termId) {
            const rcRows = await db
              .select({ id: schema.reportCards.id, gradingScale: schema.reportCards.gradingScale })
              .from(schema.reportCards)
              .where(and(
                eq(schema.reportCards.studentId, studentId),
                eq(schema.reportCards.termId, termId)
              ))
              .limit(1);

            if (rcRows.length > 0) {
              const rc = rcRows[0];
              const itemRows = await db
                .select()
                .from(schema.reportCardItems)
                .where(and(
                  eq(schema.reportCardItems.reportCardId, rc.id),
                  eq(schema.reportCardItems.subjectId, subjectId)
                ))
                .limit(1);

              if (itemRows.length > 0 && !itemRows[0].isOverridden) {
                const item = itemRows[0];

                // Build the clear payload — null the component that belonged to this exam
                const clearData: Record<string, any> = { updatedAt: new Date() };
                if (isTestType) {
                  clearData.testScore         = null;
                  clearData.testMaxScore      = null;
                  clearData.testWeightedScore = null;
                  clearData.testExamId        = null;
                  clearData.testExamCreatedBy = null;
                } else {
                  clearData.examScore         = null;
                  clearData.examMaxScore      = null;
                  clearData.examWeightedScore = null;
                  clearData.examExamId        = null;
                  clearData.examExamCreatedBy = null;
                }

                // Recompute totals from whatever score component still remains
                const remainingTest    = isTestType ? null : (item.testScore    ?? null);
                const remainingTestMax = isTestType ? null : (item.testMaxScore ?? null);
                const remainingExam    = isTestType ? (item.examScore    ?? null) : null;
                const remainingExamMax = isTestType ? (item.examMaxScore ?? null) : null;

                if (remainingTest === null && remainingExam === null) {
                  clearData.obtainedMarks = 0;
                  clearData.percentage    = 0;
                  clearData.grade         = null;
                  clearData.remarks       = null;
                } else {
                  let cfg = await getActiveGradingConfig();
                  const sysRows = await db
                    .select({ testWeight: schema.systemSettings.testWeight, examWeight: schema.systemSettings.examWeight })
                    .from(schema.systemSettings)
                    .limit(1);
                  if (sysRows[0]) {
                    cfg = { ...cfg, testWeight: sysRows[0].testWeight ?? cfg.testWeight, examWeight: sysRows[0].examWeight ?? cfg.examWeight };
                  }
                  const w = calculateWeightedScore(remainingTest, remainingTestMax, remainingExam, remainingExamMax, cfg);
                  const g = calculateGradeFromConfig(w.percentage, cfg);
                  clearData.obtainedMarks          = Math.round(w.weightedScore);
                  clearData.percentage             = Math.round(w.percentage);
                  clearData.grade                  = g.grade;
                  clearData.remarks                = g.remarks;
                  clearData[isTestType ? 'testWeightedScore' : 'examWeightedScore'] = 0;
                }

                await db.update(schema.reportCardItems)
                  .set(clearData)
                  .where(eq(schema.reportCardItems.id, item.id));

                await this.recalculateReportCard(rc.id, rc.gradingScale || 'standard');

                console.log(`[allowExamRetake] Cleared stale ${isTestType ? 'test' : 'exam'} score cache on report card item ${item.id} (RC ${rc.id})`);
              }
            }
          }
        }
      } catch (cacheErr: any) {
        // Non-fatal — retake itself succeeded; score will correct on next sync
        console.warn('[allowExamRetake] Failed to clear stale report card cache (non-fatal):', cacheErr.message);
      }
      // ────────────────────────────────────────────────────────────────────────

      return {
        success: true,
        message: 'Student can now retake the exam. Previous submission has been archived.',
        archivedSubmissionId: result.archivedSubmissionId
      };

    } catch (error: any) {
      console.error('[allowExamRetake] Error (transaction rolled back):', error);
      return { success: false, message: `Failed to allow retake: ${error.message}` };
    }
  }


  async getExamResultById(id: number): Promise<ExamResult | undefined> {
    const result = await db.select().from(schema.examResults)
      .where(eq(schema.examResults.id, id))
      .limit(1);
    return result[0];
  }

  // Enhanced session management for students

  async getStudentActiveSession(studentId: string): Promise<ExamSession | undefined> {
    const result = await this.db.select({
      id: schema.examSessions.id,
      examId: schema.examSessions.examId,
      studentId: schema.examSessions.studentId,
      startedAt: schema.examSessions.startedAt,
      submittedAt: schema.examSessions.submittedAt,
      timeRemaining: schema.examSessions.timeRemaining,
      isCompleted: schema.examSessions.isCompleted,
      score: schema.examSessions.score,
      maxScore: schema.examSessions.maxScore,
      status: schema.examSessions.status,
      createdAt: schema.examSessions.createdAt
    }).from(schema.examSessions)
      .where(and(
        eq(schema.examSessions.studentId, studentId),
        eq(schema.examSessions.isCompleted, false)
      ))
      .orderBy(desc(schema.examSessions.createdAt))
      .limit(1);
    return result[0];
  }
}
