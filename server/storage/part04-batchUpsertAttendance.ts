/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { deleteFile } from '../cloudinary-service';
import { Attendance, Exam, ExamQuestion, ExamResult, InsertAttendance, InsertExam, InsertExamQuestion, InsertExamResult, InsertQuestionOption, QuestionOption } from '@shared/schema';
import { and, asc, desc, eq, gte, inArray, lte, or, sql, sql as dsql } from 'drizzle-orm';
import { DatabaseStorageP03 } from './part03-createParentProfile'
import type { IStorage } from './types'

export class DatabaseStorageP04 extends DatabaseStorageP03 {
  async batchUpsertAttendance(
    classId: number,
    date: string,
    recordedBy: string,
    records: Array<{ studentId: string; status: string }>,
  ): Promise<void> {
    if (records.length === 0) return;
    const studentIds = records.map(r => r.studentId);

    // 1. ONE SELECT using Drizzle ORM — returns camelCase fields, no raw-SQL array binding issues.
    //    Order by id DESC so the first occurrence per studentId is the most-recent (highest id).
    const existingRaw = await db
      .select({ id: schema.attendance.id, studentId: schema.attendance.studentId })
      .from(schema.attendance)
      .where(and(
        eq(schema.attendance.classId, classId),
        eq(schema.attendance.date, date),
        inArray(schema.attendance.studentId, studentIds),
      ))
      .orderBy(desc(schema.attendance.id));

    // Keep only the highest-id record per student (dedup any stale duplicates)
    const existingMap = new Map<string, number>();
    for (const r of existingRaw) {
      if (!existingMap.has(r.studentId)) existingMap.set(r.studentId, r.id);
    }

    const toUpdate = records.filter(r => existingMap.has(r.studentId));
    const toInsert = records.filter(r => !existingMap.has(r.studentId));

    // 2. Parallel UPDATEs — all fire concurrently, not sequentially.
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(r =>
          db.update(schema.attendance)
            .set({ status: r.status, recordedBy })
            .where(eq(schema.attendance.id, existingMap.get(r.studentId)!)),
        ),
      );
    }

    // 3. ONE batch INSERT for students with no existing record.
    if (toInsert.length > 0) {
      await db.insert(schema.attendance).values(
        toInsert.map(r => ({
          studentId: r.studentId,
          classId,
          date,
          status: r.status,
          recordedBy,
          notes: null,
        })),
      );
    }
  }


  async getAttendanceByClass(classId: number, date: string): Promise<Attendance[]> {
    // Fetch all records for the class+date then deduplicate in JS.
    // Using Drizzle ORM (not raw SQL) ensures camelCase field names that the frontend expects.
    const all = await db
      .select()
      .from(schema.attendance)
      .where(and(eq(schema.attendance.classId, classId), eq(schema.attendance.date, date)))
      .orderBy(desc(schema.attendance.id)); // highest id first for easy dedup
    const seen = new Map<string, Attendance>();
    for (const r of all) {
      if (!seen.has(r.studentId)) seen.set(r.studentId, r);
    }
    return Array.from(seen.values());
  }

  async updateAttendance(id: number, data: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const result = await db.update(schema.attendance).set(data).where(eq(schema.attendance.id, id)).returning();
    return result[0];
  }

  async getAttendanceByClassDateRange(classId: number, startDate: string, endDate: string): Promise<Attendance[]> {
    // Drizzle ORM query (camelCase fields) + JS dedup: keeps highest-id record per student+date.
    const all = await db
      .select()
      .from(schema.attendance)
      .where(and(
        eq(schema.attendance.classId, classId),
        gte(schema.attendance.date, startDate),
        lte(schema.attendance.date, endDate),
      ))
      .orderBy(desc(schema.attendance.id)); // highest id first for easy dedup
    const seen = new Map<string, Attendance>();
    for (const r of all) {
      const key = `${r.studentId}::${r.date}`;
      if (!seen.has(key)) seen.set(key, r);
    }
    // Return sorted by date descending for the UI
    return Array.from(seen.values()).sort((a, b) => b.date.localeCompare(a.date));
  }
  // Exam management

  async createExam(exam: InsertExam): Promise<Exam> {
    const result = await db.insert(schema.exams).values(exam).returning();
    return result[0];
  }

  async getAllExams(): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }


  async getExamById(id: number): Promise<Exam | undefined> {
    const result = await db.select().from(schema.exams)
      .where(eq(schema.exams.id, id))
      .limit(1);
    return result[0];
  }

  async getExamsByClass(classId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .where(eq(schema.exams.classId, classId))
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }


  async getExamsByClassAndTerm(classId: number, termId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams)
        .where(and(
          eq(schema.exams.classId, classId),
          eq(schema.exams.termId, termId)
        ))
        .orderBy(desc(schema.exams.date));
      return result || [];
    } catch (error) {
      return [];
    }
  }


  async updateExam(id: number, exam: Partial<InsertExam>): Promise<Exam | undefined> {
    const result = await db.update(schema.exams)
      .set(exam)
      .where(eq(schema.exams.id, id))
      .returning();
    return result[0];
  }

  async recordExamResult(result: InsertExamResult): Promise<ExamResult> {
    try {
      const examResult = await db.insert(schema.examResults).values(result).returning();
      return examResult[0];
    } catch (error: any) {
      // Handle missing columns by removing autoScored from the insert
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('auto_scored')) {
        const { autoScored, ...resultWithoutAutoScored } = result;
        // Map score to marksObtained for compatibility with existing schema
        const compatibleResult = {
          ...resultWithoutAutoScored,
          marksObtained: result.score || 0
        };
        const examResult = await db.insert(schema.examResults).values(compatibleResult).returning();
        return {
          ...examResult[0],
          autoScored: result.recordedBy === '00000000-0000-0000-0000-000000000001',
          score: examResult[0].marksObtained || 0
        } as ExamResult;
      }
      throw error;
    }
  }


  async updateExamResult(id: number, result: Partial<InsertExamResult>): Promise<ExamResult | undefined> {
    try {
      const updated = await db.update(schema.examResults)
        .set(result)
        .where(eq(schema.examResults.id, id))
        .returning();
      return updated[0];
    } catch (error: any) {
      // Handle missing columns by removing autoScored from the update
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('auto_scored')) {
        const { autoScored, ...resultWithoutAutoScored } = result;
        // Map score to marksObtained for compatibility with existing schema
        const compatibleResult = {
          ...resultWithoutAutoScored,
          marksObtained: result.score || 0
        };
        const updated = await db.update(schema.examResults)
          .set(compatibleResult)
          .where(eq(schema.examResults.id, id))
          .returning();
        return {
          ...updated[0],
          autoScored: result.recordedBy === '00000000-0000-0000-0000-000000000001',
          score: updated[0].marksObtained || 0
        } as ExamResult;
      }
      throw error;
    }
  }


  async getExamResultsByStudent(studentId: string): Promise<ExamResult[]> {
    const SYSTEM_AUTO_SCORING_UUID = '00000000-0000-0000-0000-000000000001';

    console.log(`[getExamResultsByStudent] Fetching results for student: ${studentId}`);

    // CRITICAL FIX: Use simple, reliable query without complex SQL that might fail
    // This mirrors the approach used by getExamResultByExamAndStudent which works correctly
    // for report cards. We fetch exam_results directly without complex JOINs or casts.
    try {
      // Primary query: Simple and reliable - directly query exam_results table
      const results = await this.db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        studentId: schema.examResults.studentId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        marksObtained: schema.examResults.marksObtained,
        grade: schema.examResults.grade,
        remarks: schema.examResults.remarks,
        autoScored: schema.examResults.autoScored,
        recordedBy: schema.examResults.recordedBy,
        createdAt: schema.examResults.createdAt,
      }).from(schema.examResults)
        .where(eq(schema.examResults.studentId, studentId))
        .orderBy(desc(schema.examResults.createdAt));

      console.log(`[getExamResultsByStudent] Primary query returned ${results.length} results`);

      // Enrich results with exam's totalMarks if maxScore is null
      const enrichedResults = await Promise.all(results.map(async (result: any) => {
        // Ensure score field is populated from marksObtained if needed
        const finalScore = result.score ?? result.marksObtained ?? 0;
        let finalMaxScore = result.maxScore;

        // If maxScore is null, try to get it from the exam
        if (finalMaxScore === null || finalMaxScore === undefined) {
          try {
            const exam = await this.db.select({ totalMarks: schema.exams.totalMarks })
              .from(schema.exams)
              .where(eq(schema.exams.id, result.examId))
              .limit(1);
            finalMaxScore = exam[0]?.totalMarks ?? 100;
          } catch (examLookupError) {
            console.warn(`[getExamResultsByStudent] Could not fetch exam totalMarks for examId ${result.examId}`);
            finalMaxScore = 100;
          }
        }

        // Determine autoScored from recordedBy if autoScored column is null
        const isAutoScored = result.autoScored ?? (result.recordedBy === SYSTEM_AUTO_SCORING_UUID);

        return {
          ...result,
          score: finalScore,
          maxScore: finalMaxScore,
          autoScored: isAutoScored
        };
      }));

      return enrichedResults;
    } catch (primaryError: any) {
      console.error(`[getExamResultsByStudent] Primary query failed for student ${studentId}:`, primaryError?.message || primaryError);

      // Fallback: Even simpler query without any computed fields
      try {
        console.log(`[getExamResultsByStudent] Attempting fallback query...`);
        const fallbackResults = await this.db.select()
          .from(schema.examResults)
          .where(eq(schema.examResults.studentId, studentId))
          .orderBy(desc(schema.examResults.createdAt));

        console.log(`[getExamResultsByStudent] Fallback query returned ${fallbackResults.length} results`);

        // Normalize the fallback results
        return fallbackResults.map((result: any) => ({
          id: result.id,
          examId: result.examId,
          studentId: result.studentId,
          score: result.score ?? result.marksObtained ?? 0,
          maxScore: result.maxScore ?? 100,
          marksObtained: result.marksObtained,
          grade: result.grade,
          remarks: result.remarks,
          autoScored: result.autoScored ?? (result.recordedBy === SYSTEM_AUTO_SCORING_UUID),
          recordedBy: result.recordedBy,
          createdAt: result.createdAt,
        }));
      } catch (fallbackError: any) {
        console.error(`[getExamResultsByStudent] CRITICAL: Fallback query also failed for student ${studentId}:`, fallbackError?.message || fallbackError);
        // Return empty array only if ALL queries fail - but log it
        return [];
      }
    }
  }


  async getExamResultsByExam(examId: number): Promise<ExamResult[]> {
    try {
      return await db.select().from(schema.examResults)
        .where(eq(schema.examResults.examId, examId))
        .orderBy(desc(schema.examResults.createdAt));
    } catch (error: any) {
      // Handle missing columns by selecting only the columns that exist
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('column') && error?.cause?.message?.includes('does not exist')) {
        try {
          return await db.select({
            id: schema.examResults.id,
            examId: schema.examResults.examId,
            studentId: schema.examResults.studentId,
            marksObtained: schema.examResults.marksObtained, // Use legacy field
            grade: schema.examResults.grade,
            remarks: schema.examResults.remarks,
            recordedBy: schema.examResults.recordedBy,
            createdAt: schema.examResults.createdAt,
            // Map marksObtained to score for compatibility
            score: schema.examResults.marksObtained,
            maxScore: dsql`null`.as('maxScore'),
            // Since auto_scored column doesn't exist, determine from recordedBy
            autoScored: dsql`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as('autoScored')
          }).from(schema.examResults)
            .where(eq(schema.examResults.examId, examId))
            .orderBy(desc(schema.examResults.createdAt));
        } catch (fallbackError) {
          return [];
        }
      }
      throw error;
    }
  }


  async getExamResultByExamAndStudent(examId: number, studentId: string): Promise<ExamResult | undefined> {
    const result = await db.select().from(schema.examResults)
      .where(
        sql`${schema.examResults.examId} = ${examId} AND ${schema.examResults.studentId} = ${studentId}`
      )
      .limit(1);
    return result[0];
  }

  async getExamResultsByClass(classId: number): Promise<any[]> {
    try {
      // Join all needed tables to get complete data
      const results = await db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        studentId: schema.examResults.studentId,
        score: schema.examResults.score,
        maxScore: schema.examResults.maxScore,
        marksObtained: schema.examResults.marksObtained,
        grade: schema.examResults.grade,
        remarks: schema.examResults.remarks,
        recordedBy: schema.examResults.recordedBy,
        autoScored: schema.examResults.autoScored,
        createdAt: schema.examResults.createdAt,
        examName: schema.exams.name,
        examType: schema.exams.examType,
        examDate: schema.exams.date,
        totalMarks: schema.exams.totalMarks,
        admissionNumber: schema.students.admissionNumber,
        studentName: sql<string>`${schema.users.firstName} || ' ' || ${schema.users.lastName}`.as('studentName'),
        className: schema.classes.name,
        subjectName: schema.subjects.name,
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .innerJoin(schema.students, eq(schema.examResults.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .leftJoin(schema.classes, eq(schema.exams.classId, schema.classes.id))
        .leftJoin(schema.subjects, eq(schema.exams.subjectId, schema.subjects.id))
        .where(eq(schema.exams.classId, classId))
        .orderBy(desc(schema.examResults.createdAt));

      // Results already contain all needed data from joins
      return results;
    } catch (error: any) {

      // Handle missing columns by using a fallback query
      if (error?.cause?.code === '42703' && error?.cause?.message?.includes('column') && error?.cause?.message?.includes('does not exist')) {
        try {
          // Fallback query using only existing columns
          const results = await db.select({
            id: schema.examResults.id,
            examId: schema.examResults.examId,
            studentId: schema.examResults.studentId,
            marksObtained: schema.examResults.marksObtained,
            grade: schema.examResults.grade,
            remarks: schema.examResults.remarks,
            recordedBy: schema.examResults.recordedBy,
            createdAt: schema.examResults.createdAt,
            // Map marksObtained to score for compatibility
            score: schema.examResults.marksObtained,
            maxScore: dsql`null`.as('maxScore'),
            // Infer autoScored based on recordedBy
            autoScored: dsql`CASE WHEN "recorded_by" = '00000000-0000-0000-0000-000000000001' THEN true ELSE false END`.as('autoScored')
          })
            .from(schema.examResults)
            .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
            .where(eq(schema.exams.classId, classId))
            .orderBy(desc(schema.examResults.createdAt));

          // Return fallback results as-is
          return results;
        } catch (fallbackError) {
          return [];
        }
      }
      throw error;
    }
  }


  // Exam questions management

  async createExamQuestion(question: InsertExamQuestion): Promise<ExamQuestion> {
    // Use all available columns from the schema
    const questionData = {
      examId: question.examId,
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points,
      orderNumber: question.orderNumber,
      imageUrl: question.imageUrl,
      autoGradable: question.autoGradable ?? true,
      expectedAnswers: question.expectedAnswers,
      caseSensitive: question.caseSensitive ?? false,
      allowPartialCredit: question.allowPartialCredit ?? false,
      partialCreditRules: question.partialCreditRules,
      explanationText: question.explanationText,
      hintText: question.hintText,
      instructions: question.instructions,
    };
    const result = await db.insert(schema.examQuestions).values(questionData).returning();
    return result[0];
  }

  async createExamQuestionWithOptions(
    question: InsertExamQuestion,
    options?: Array<{ optionText: string; isCorrect: boolean }>
  ): Promise<ExamQuestion> {
    // NOTE: Neon HTTP driver does NOT support transactions
    // Using direct inserts instead of db.transaction()
    try {
      // Use all available columns from the schema
      const questionData = {
        examId: question.examId,
        questionText: question.questionText,
        questionType: question.questionType,
        points: question.points,
        orderNumber: question.orderNumber,
        imageUrl: question.imageUrl,
        autoGradable: question.autoGradable ?? true,
        expectedAnswers: question.expectedAnswers,
        caseSensitive: question.caseSensitive ?? false,
        allowPartialCredit: question.allowPartialCredit ?? false,
        partialCreditRules: question.partialCreditRules,
        explanationText: question.explanationText,
        hintText: question.hintText,
        instructions: question.instructions,
      };
      // Insert question first
      const questionResult = await db.insert(schema.examQuestions).values(questionData).returning();
      const createdQuestion = questionResult[0];

      // Insert options if provided
      if (Array.isArray(options) && options.length > 0) {
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          await db.insert(schema.questionOptions).values({
            questionId: createdQuestion.id,
            optionText: option.optionText,
            orderNumber: i + 1,
            isCorrect: option.isCorrect
          });
          // Small delay to prevent connection overload
          if (i < options.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
      return createdQuestion;
    } catch (error) {
      throw new Error(`Failed to create question with options: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createExamQuestionsBulk(
    questionsData: Array<{
      question: InsertExamQuestion;
      options?: Array<{ optionText: string; isCorrect: boolean }>;
    }>
  ): Promise<{ created: number; questions: ExamQuestion[]; errors: string[] }> {
    const createdQuestions: ExamQuestion[] = [];
    const errors: string[] = [];


    // SEQUENTIAL processing to prevent circuit breaker - NO parallel requests
    for (let i = 0; i < questionsData.length; i++) {
      const { question, options } = questionsData[i];

      try {

        const createdQuestion = await this.createExamQuestionWithOptions(question, options);
        createdQuestions.push(createdQuestion);


        // Throttling delay between EACH question to prevent circuit breaker
        if (i < questionsData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150)); // 150ms delay between questions
        }
      } catch (error) {
        const errorMsg = `Question ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);

        // Check if this is a circuit breaker error and implement backoff
        if (error instanceof Error && (
          error.message.includes('circuit') ||
          error.message.includes('breaker') ||
          error.message.includes('pool') ||
          error.message.includes('connection')
        )) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second backoff on connection issues
        } else {
          // Normal error delay
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    return {
      created: createdQuestions.length,
      questions: createdQuestions,
      errors
    };
  }

  async getExamQuestions(examId: number): Promise<ExamQuestion[]> {
    return await db.select({
      id: schema.examQuestions.id,
      examId: schema.examQuestions.examId,
      questionText: schema.examQuestions.questionText,
      questionType: schema.examQuestions.questionType,
      points: schema.examQuestions.points,
      orderNumber: schema.examQuestions.orderNumber,
      imageUrl: schema.examQuestions.imageUrl,
      autoGradable: schema.examQuestions.autoGradable,
      expectedAnswers: schema.examQuestions.expectedAnswers,
      caseSensitive: schema.examQuestions.caseSensitive,
      allowPartialCredit: schema.examQuestions.allowPartialCredit,
      partialCreditRules: schema.examQuestions.partialCreditRules,
      explanationText: schema.examQuestions.explanationText,
      hintText: schema.examQuestions.hintText,
      instructions: schema.examQuestions.instructions,
      createdAt: schema.examQuestions.createdAt,
    }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.examId, examId))
      .orderBy(asc(schema.examQuestions.orderNumber));
  }

  async getExamQuestionById(id: number): Promise<ExamQuestion | undefined> {
    const result = await db.select({
      id: schema.examQuestions.id,
      examId: schema.examQuestions.examId,
      questionText: schema.examQuestions.questionText,
      questionType: schema.examQuestions.questionType,
      points: schema.examQuestions.points,
      orderNumber: schema.examQuestions.orderNumber,
      imageUrl: schema.examQuestions.imageUrl,
      autoGradable: schema.examQuestions.autoGradable,
      expectedAnswers: schema.examQuestions.expectedAnswers,
      caseSensitive: schema.examQuestions.caseSensitive,
      allowPartialCredit: schema.examQuestions.allowPartialCredit,
      partialCreditRules: schema.examQuestions.partialCreditRules,
      explanationText: schema.examQuestions.explanationText,
      hintText: schema.examQuestions.hintText,
      instructions: schema.examQuestions.instructions,
      createdAt: schema.examQuestions.createdAt,
    }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.id, id))
      .limit(1);
    return result[0];
  }

  async getExamQuestionCount(examId: number): Promise<number> {
    const result = await db.select({ count: dsql`count(*)` }).from(schema.examQuestions)
      .where(eq(schema.examQuestions.examId, examId));
    return Number(result[0]?.count || 0);
  }
  // Get question counts for multiple exams

  async getExamQuestionCounts(examIds: number[]): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};

    for (const examId of examIds) {
      try {
        const count = await this.getExamQuestionCount(examId);
        counts[examId] = count;
      } catch (error) {
        counts[examId] = 0;
      }
    }

    return counts;
  }

  async updateExamQuestion(id: number, question: Partial<InsertExamQuestion>): Promise<ExamQuestion | undefined> {
    const result = await db.update(schema.examQuestions)
      .set(question)
      .where(eq(schema.examQuestions.id, id))
      .returning();
    return result[0];
  }

  async deleteExamQuestion(id: number): Promise<boolean> {
    try {
      // Get the question first to delete its image
      const question = await db.select({
        id: schema.examQuestions.id,
        imageUrl: schema.examQuestions.imageUrl
      })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.id, id))
        .limit(1);

      // Delete question image from Cloudinary/local storage if exists
      if (question[0]?.imageUrl) {
        try {
          await deleteFile(question[0].imageUrl);
        } catch (fileError) {
          console.error(`Error deleting question image for question ${id}:`, fileError);
        }
      }

      // Get question options to delete their images
      try {
        const options = await db.select({
          id: schema.questionOptions.id,
          imageUrl: schema.questionOptions.imageUrl
        })
          .from(schema.questionOptions)
          .where(eq(schema.questionOptions.questionId, id));

        for (const option of options) {
          if (option.imageUrl) {
            try {
              await deleteFile(option.imageUrl);
            } catch (fileError) {
              console.error(`Error deleting option image for option ${option.id}:`, fileError);
            }
          }
        }
      } catch (e) {
        // imageUrl column might not exist in question_options
      }

      // IMPORTANT: Delete in correct order to respect foreign key constraints
      // 1. First delete student answers (references both question_id AND selected_option_id -> question_options)
      await db.delete(schema.studentAnswers)
        .where(eq(schema.studentAnswers.questionId, id));

      // 2. Then delete question options (now safe since student_answers are gone)
      await db.delete(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, id));

      // 3. Finally delete the question itself
      const result = await db.delete(schema.examQuestions)
        .where(eq(schema.examQuestions.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deleting exam question:', error);
      throw error;
    }
  }

  // Question options management

  async createQuestionOption(option: InsertQuestionOption): Promise<QuestionOption> {
    const result = await db.insert(schema.questionOptions).values(option).returning();
    return result[0];
  }

  async getQuestionOptions(questionId: number): Promise<QuestionOption[]> {
    // Only select columns that actually exist in the current database
    return await db.select({
      id: schema.questionOptions.id,
      questionId: schema.questionOptions.questionId,
      optionText: schema.questionOptions.optionText,
      isCorrect: schema.questionOptions.isCorrect,
      orderNumber: schema.questionOptions.orderNumber,
      createdAt: schema.questionOptions.createdAt,
    }).from(schema.questionOptions)
      .where(eq(schema.questionOptions.questionId, questionId))
      .orderBy(asc(schema.questionOptions.orderNumber));
  }
  // PERFORMANCE: Bulk fetch question options to eliminate N+1 queries

  async getQuestionOptionsBulk(questionIds: number[]): Promise<QuestionOption[]> {
    if (questionIds.length === 0) {
      return [];
    }
    // Use inArray for efficient bulk query
    return await db.select({
      id: schema.questionOptions.id,
      questionId: schema.questionOptions.questionId,
      optionText: schema.questionOptions.optionText,
      isCorrect: schema.questionOptions.isCorrect,
      orderNumber: schema.questionOptions.orderNumber,
      createdAt: schema.questionOptions.createdAt,
    }).from(schema.questionOptions)
      .where(inArray(schema.questionOptions.questionId, questionIds))
      .orderBy(asc(schema.questionOptions.questionId), asc(schema.questionOptions.orderNumber));
  }
}
