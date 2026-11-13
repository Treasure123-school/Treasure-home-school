/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { deleteFile } from '../cloudinary-service';
import { getPgClient, isPostgres } from '../db';
import { realtimeService } from '../realtime-service';
import { Announcement, Exam, ExamSession, Gallery, GalleryCategory, HomePageContent, InsertAnnouncement, InsertGallery, InsertGalleryCategory, InsertHomePageContent, InsertStudentAnswer, InsertStudyResource, QuestionOption, Student, StudentAnswer, StudyResource } from '@shared/schema.pg';
import { and, asc, desc, eq, like, or, sql, sql as dsql } from 'drizzle-orm';
import { DatabaseStorageP06 } from './part06-generateQuestionsFromBank'
import type { IStorage } from './types'

export class DatabaseStorageP07 extends DatabaseStorageP06 {
  async updateSessionProgress(sessionId: number, progress: { currentQuestionIndex?: number; timeRemaining?: number }): Promise<void> {
    const updates: any = {};
    if (typeof progress.timeRemaining === 'number') {
      updates.timeRemaining = progress.timeRemaining;
    }
    if (typeof progress.currentQuestionIndex === 'number') {
      updates.metadata = JSON.stringify({ currentQuestionIndex: progress.currentQuestionIndex });
    }
    if (Object.keys(updates).length > 0) {
      await this.db.update(schema.examSessions)
        .set(updates)
        .where(eq(schema.examSessions.id, sessionId));
    }
  }

  // Student answers management

  async createStudentAnswer(answer: InsertStudentAnswer): Promise<StudentAnswer> {
    const result = await db.insert(schema.studentAnswers).values(answer).returning();
    return result[0];
  }

  async getStudentAnswerById(id: number): Promise<StudentAnswer | undefined> {
    const result = await db.select().from(schema.studentAnswers)
      .where(eq(schema.studentAnswers.id, id))
      .limit(1);
    return result[0];
  }

  async updateStudentAnswer(id: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer | undefined> {
    const result = await db.update(schema.studentAnswers)
      .set(answer)
      .where(eq(schema.studentAnswers.id, id))
      .returning();
    return result[0];
  }

  async getStudentAnswerBySessionAndQuestion(sessionId: number, questionId: number): Promise<StudentAnswer | undefined> {
    const result = await db.select().from(schema.studentAnswers)
      .where(and(
        eq(schema.studentAnswers.sessionId, sessionId),
        eq(schema.studentAnswers.questionId, questionId)
      ))
      .limit(1);
    return result[0];
  }

  async upsertStudentAnswer(sessionId: number, questionId: number, answer: Partial<InsertStudentAnswer>): Promise<StudentAnswer> {
    const existing = await this.getStudentAnswerBySessionAndQuestion(sessionId, questionId);

    if (existing) {
      const updated = await this.updateStudentAnswer(existing.id, answer);
      return updated!;
    } else {
      return await this.createStudentAnswer({
        sessionId,
        questionId,
        ...answer
      } as InsertStudentAnswer);
    }
  }


  async getQuestionOptionById(optionId: number): Promise<QuestionOption | undefined> {
    const result = await db.select().from(schema.questionOptions)
      .where(eq(schema.questionOptions.id, optionId))
      .limit(1);
    return result[0];
  }
  // OPTIMIZED SCORING: Get all scoring data in a single query for <2s performance

  async getExamScoringData(sessionId: number): Promise<{
    session: ExamSession;
    scoringData: Array<{
      questionId: number;
      questionType: string;
      points: number;
      studentSelectedOptionId: number | null;
      correctOptionId: number | null;
      isCorrect: boolean;
      textAnswer: string | null;
    }>;
    summary: {
      totalQuestions: number;
      maxScore: number;
      studentScore: number;
      autoScoredQuestions: number;
    };
  }> {
    try {

      // First, get the session - select only existing columns
      const sessionResult = await this.db.select({
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
        metadata: schema.examSessions.metadata,
        createdAt: schema.examSessions.createdAt
      })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.id, sessionId))
        .limit(1);

      if (!sessionResult[0]) {
        throw new Error(`Exam session ${sessionId} not found`);
      }
      const session = sessionResult[0];

      // CORRECTED QUERY: Get question data and correct options separately to avoid row multiplication issues
      const questionsQuery = await this.db.select({
        questionId: schema.examQuestions.id,
        questionType: schema.examQuestions.questionType,
        points: schema.examQuestions.points,
        autoGradable: schema.examQuestions.autoGradable,
        expectedAnswers: schema.examQuestions.expectedAnswers,
        caseSensitive: schema.examQuestions.caseSensitive,
        allowPartialCredit: schema.examQuestions.allowPartialCredit,
        partialCreditRules: schema.examQuestions.partialCreditRules,
        studentSelectedOptionId: schema.studentAnswers.selectedOptionId,
        textAnswer: schema.studentAnswers.textAnswer,
      })
        .from(schema.examQuestions)
        .leftJoin(schema.studentAnswers, and(
          eq(schema.studentAnswers.questionId, schema.examQuestions.id),
          eq(schema.studentAnswers.sessionId, sessionId)
        ))
        .where(eq(schema.examQuestions.examId, session.examId))
        .orderBy(asc(schema.examQuestions.orderNumber));

      // Get correct options separately to avoid confusion
      const correctOptionsQuery = await this.db.select({
        questionId: schema.questionOptions.questionId,
        correctOptionId: schema.questionOptions.id,
      })
        .from(schema.questionOptions)
        .innerJoin(schema.examQuestions, eq(schema.questionOptions.questionId, schema.examQuestions.id))
        .where(
          and(
            eq(schema.examQuestions.examId, session.examId),
            eq(schema.questionOptions.isCorrect, true)
          )
        );

      // Get selected option details for partial credit (only for questions with student answers)
      const selectedOptionsQuery = await this.db.select({
        questionId: schema.questionOptions.questionId,
        optionId: schema.questionOptions.id,
        partialCreditValue: schema.questionOptions.partialCreditValue,
        isCorrect: schema.questionOptions.isCorrect,
      })
        .from(schema.questionOptions)
        .innerJoin(schema.studentAnswers, eq(schema.questionOptions.id, schema.studentAnswers.selectedOptionId))
        .where(eq(schema.studentAnswers.sessionId, sessionId));

      // Create lookup maps for efficient processing
      const correctOptionsMap = new Map<number, number>();
      for (const option of correctOptionsQuery) {
        correctOptionsMap.set(option.questionId, option.correctOptionId);
      }
      const selectedOptionsMap = new Map<number, { optionId: number; partialCreditValue: number | null; isCorrect: boolean | null }>();
      for (const option of selectedOptionsQuery) {
        selectedOptionsMap.set(option.questionId, {
          optionId: option.optionId,
          partialCreditValue: option.partialCreditValue,
          isCorrect: option.isCorrect,
        });
      }
      // CORRECTED PROCESSING: Build question data from separate queries
      const questionMap = new Map<number, {
        questionType: string;
        points: number;
        autoGradable: boolean | null;
        expectedAnswers: string[] | null;
        caseSensitive: boolean | null;
        allowPartialCredit: boolean | null;
        partialCreditRules: string | null;
        studentSelectedOptionId: number | null;
        textAnswer: string | null;
        correctOptionId: number | null;
        isCorrect: boolean;
        partialCreditEarned: number;
      }>();

      // Build questions with correct option IDs
      for (const question of questionsQuery) {
        const correctOptionId = correctOptionsMap.get(question.questionId) || null;
        const selectedOptionData = selectedOptionsMap.get(question.questionId);

        questionMap.set(question.questionId, {
          questionType: question.questionType,
          points: question.points || 1,
          autoGradable: question.autoGradable,
          expectedAnswers: question.expectedAnswers,
          caseSensitive: question.caseSensitive,
          allowPartialCredit: question.allowPartialCredit,
          partialCreditRules: question.partialCreditRules,
          studentSelectedOptionId: question.studentSelectedOptionId,
          textAnswer: question.textAnswer,
          correctOptionId,
          isCorrect: false,
          partialCreditEarned: 0,
        });

        // FIXED CORRECTNESS LOGIC: Determine if option-based questions are correct
        if ((question.questionType === 'multiple_choice' ||
          question.questionType === 'true_false' ||
          question.questionType === 'true/false') &&
          correctOptionId && question.studentSelectedOptionId === correctOptionId) {
          questionMap.get(question.questionId)!.isCorrect = true;
        }
        // FIXED PARTIAL CREDIT LOGIC: Award partial credit for incorrect option-based answers
        if (question.allowPartialCredit && selectedOptionData && selectedOptionData.partialCreditValue) {
          const questionData = questionMap.get(question.questionId)!;

          // Only award partial credit if the answer is incorrect but has some value
          if (!questionData.isCorrect && selectedOptionData.partialCreditValue > 0) {
            questionData.partialCreditEarned = Math.min(
              questionData.points,
              selectedOptionData.partialCreditValue
            );
          }
        }
      }
      // Essay questions require manual grading; no auto-scoring path needed here.
      // Legacy text/fill_blank questions in the database are skipped (not auto-scored).
      // Convert map to array and calculate summary
      const scoringData = Array.from(questionMap.entries()).map(([questionId, data]) => ({
        questionId,
        ...data,
      }));

      // Calculate summary statistics
      let totalQuestions = scoringData.length;
      let maxScore = 0;
      let studentScore = 0;
      let autoScoredQuestions = 0;


      // Track question types for debugging
      const questionTypeCount: Record<string, number> = {};

      for (const question of scoringData) {
        maxScore += question.points;

        // Count question types for diagnostic
        questionTypeCount[question.questionType] = (questionTypeCount[question.questionType] || 0) + 1;

        // ENHANCED SCORING: Use auto_gradable field from database to determine if question can be auto-scored
        // This is the definitive source of truth for auto-scoring eligibility
        if (question.autoGradable === true) {
          autoScoredQuestions++;

          // Award full points for correct answers
          if (question.isCorrect) {
            studentScore += question.points;
          }
          // Award partial credit if earned
          else if (question.partialCreditEarned > 0) {
            studentScore += question.partialCreditEarned;
          }
          // No credit
          else {
          }
        } else {
        }
      }


      return {
        session,
        scoringData,
        summary: {
          totalQuestions,
          maxScore,
          studentScore,
          autoScoredQuestions,
        }
      };
    } catch (error) {
      throw error;
    }
  }


  // Text similarity calculation for partial credit scoring

  getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
  // Announcements

  calculateTextSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await db.insert(schema.announcements).values(announcement).returning();
    return result[0];
  }

  async getAnnouncements(targetRole?: string, includeDrafts: boolean = false): Promise<Announcement[]> {
    let query = db.select().from(schema.announcements);

    // Filter by published status unless includeDrafts is true
    if (!includeDrafts) {
      query = query.where(eq(schema.announcements.isPublished, true));
    }

    if (targetRole && targetRole !== 'all') {
      // Improved filtering logic for JSON strings in both SQLite and PostgreSQL
      query = query.where(or(
        like(schema.announcements.targetRoles, `%\"All\"%`),
        like(schema.announcements.targetRoles, `%\"${targetRole}\"%`),
        eq(schema.announcements.targetRoles, '["All"]'),
        eq(schema.announcements.targetRoles, `["${targetRole}"]`)
      ));
    }

    return await query.orderBy(desc(schema.announcements.publishedAt), desc(schema.announcements.createdAt));
  }

  async getAnnouncementById(id: number): Promise<Announcement | undefined> {
    const result = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id)).limit(1);
    return result[0];
  }

  async updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const result = await db.update(schema.announcements).set(announcement).where(eq(schema.announcements.id, id)).returning();
    return result[0];
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    const [announcement] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
    if (!announcement) return false;

    await db.delete(schema.announcements).where(eq(schema.announcements.id, id));

    // Broadcast deletion using standardized emitter
    realtimeService.emitAnnouncementEvent('deleted', { id });

    return true;
  }
  // Messages methods moved to the end of the class for better organization
  // Gallery

  async createGalleryCategory(category: InsertGalleryCategory): Promise<GalleryCategory> {
    const result = await db.insert(schema.galleryCategories).values(category).returning();
    return result[0];
  }

  async getGalleryCategories(): Promise<GalleryCategory[]> {
    return await db.select().from(schema.galleryCategories).orderBy(asc(schema.galleryCategories.name));
  }

  async uploadGalleryImage(image: InsertGallery): Promise<Gallery> {
    const result = await db.insert(schema.gallery).values(image).returning();
    return result[0];
  }

  async getGalleryImages(categoryId?: number): Promise<Gallery[]> {
    if (categoryId) {
      return await db.select().from(schema.gallery)
        .where(eq(schema.gallery.categoryId, categoryId))
        .orderBy(desc(schema.gallery.createdAt));
    }
    return await db.select().from(schema.gallery).orderBy(desc(schema.gallery.createdAt));
  }

  async getGalleryImageById(id: string): Promise<Gallery | undefined> {
    const result = await db.select().from(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .limit(1);
    return result[0];
  }

  async deleteGalleryImage(id: string): Promise<boolean> {
    // First get the image to delete the file
    const image = await db.select({ id: schema.gallery.id, imageUrl: schema.gallery.imageUrl })
      .from(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .limit(1);

    // Delete the image file from Cloudinary/local storage
    if (image[0]?.imageUrl) {
      try {
        await deleteFile(image[0].imageUrl);
      } catch (fileError) {
        console.error(`Error deleting gallery image file for image ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.gallery)
      .where(eq(schema.gallery.id, parseInt(id)))
      .returning();
    return result.length > 0;
  }
  // Study resources management

  async createStudyResource(resource: InsertStudyResource): Promise<StudyResource> {
    const result = await db.insert(schema.studyResources).values(resource).returning();
    return result[0];
  }

  async getStudyResources(filters?: {
    classId?: number;
    subjectId?: number;
    termId?: number;
    resourceType?: string;
  }): Promise<StudyResource[]> {
    let query = db.select().from(schema.studyResources)
      .where(eq(schema.studyResources.isPublished, true));

    if (filters?.classId) {
      query = query.where(eq(schema.studyResources.classId, filters.classId));
    }
    if (filters?.subjectId) {
      query = query.where(eq(schema.studyResources.subjectId, filters.subjectId));
    }
    if (filters?.termId) {
      query = query.where(eq(schema.studyResources.termId, filters.termId));
    }
    if (filters?.resourceType) {
      query = query.where(eq(schema.studyResources.resourceType, filters.resourceType));
    }
    return await query.orderBy(desc(schema.studyResources.createdAt));
  }

  async getStudyResourceById(id: number): Promise<StudyResource | undefined> {
    const result = await db.select().from(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .limit(1);
    return result[0];
  }

  async incrementStudyResourceDownloads(id: number): Promise<void> {
    await db.update(schema.studyResources)
      .set({ downloads: dsql`${schema.studyResources.downloads} + 1` })
      .where(eq(schema.studyResources.id, id));
  }

  async deleteStudyResource(id: number): Promise<boolean> {
    // First get the resource to delete the file
    const resource = await db.select({ id: schema.studyResources.id, fileUrl: schema.studyResources.fileUrl })
      .from(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .limit(1);

    // Delete the file from Cloudinary/local storage
    if (resource[0]?.fileUrl) {
      try {
        await deleteFile(resource[0].fileUrl);
      } catch (fileError) {
        console.error(`Error deleting study resource file for resource ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.studyResources)
      .where(eq(schema.studyResources.id, id))
      .returning();
    return result.length > 0;
  }
  // Home page content management

  async createHomePageContent(content: InsertHomePageContent): Promise<HomePageContent> {
    const result = await db.insert(schema.homePageContent).values(content).returning();
    return result[0];
  }


  // Manual Grading System Methods

  async getGradingTasks(teacherId: string, status?: string): Promise<any[]> {
    try {
      // Use PostgreSQL for production, SQLite for development
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];

        let query = `
          SELECT
            sa.id,
            es.student_id,
            u.first_name || ' ' || u.last_name as student_name,
            es.exam_id,
            e.name as exam_title,
            eq.id as question_id,
            eq.question_text,
            eq.question_type,
            eq.points as max_marks,
            sa.text_answer as student_answer,
            es.submitted_at,
            CASE
              WHEN sa.id IN (SELECT answer_id FROM manual_scores) THEN 'graded'
              ELSE 'pending'
            END as status,
            ms.awarded_marks as current_score,
            ms.comment as grader_comment
          FROM student_answers sa
          JOIN exam_sessions es ON sa.session_id = es.id
          JOIN exams e ON es.exam_id = e.id
          JOIN exam_questions eq ON sa.question_id = eq.id
          JOIN users u ON es.student_id = u.id
          LEFT JOIN manual_scores ms ON sa.id = ms.answer_id
          WHERE e.created_by = $1
          AND eq.question_type = 'essay'
          AND es.is_completed = true
        `;

        if (status && status !== 'all') {
          if (status === 'pending') {
            query += ' AND sa.id NOT IN (SELECT answer_id FROM manual_scores)';
          } else if (status === 'graded') {
            query += ' AND sa.id IN (SELECT answer_id FROM manual_scores)';
          }
        }

        query += ' ORDER BY es.submitted_at DESC';

        // Use Neon's unsafe method for dynamic queries with parameters
        const result = await (db as any).execute(sql.raw(query.replace(/\$([0-9]+)/g, (_, n) => `$${n}`)));
        const rows = (result.rows || result) as any[];
        // Map snake_case to camelCase if needed, but for now just return as is
        return rows;
      }

      return [];
    } catch (error) {
      console.error('Error fetching grading tasks:', error);
      return [];
    }
  }


  async submitManualGrade(gradeData: { taskId: number; score: number; comment: string; graderId: string }): Promise<any> {
    try {
      const { taskId, score, comment, graderId } = gradeData;

      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) throw new Error('PostgreSQL client not available');

        // Use PostgreSQL upsert syntax
        const result = await (db as any).execute(sql`
          INSERT INTO manual_scores (answer_id, grader_id, awarded_marks, comment, graded_at)
          VALUES (${taskId}, ${graderId}, ${score}, ${comment}, NOW())
          ON CONFLICT (answer_id)
          DO UPDATE SET
            awarded_marks = EXCLUDED.awarded_marks,
            comment = EXCLUDED.comment,
            graded_at = EXCLUDED.graded_at,
            grader_id = EXCLUDED.grader_id
          RETURNING *
        `);

        // Update the student answer with the manual score
        await (db as any).execute(sql`
          UPDATE student_answers
          SET points_earned = ${score}
          WHERE id = ${taskId}
        `);

        // Extract first row from PostgreSQL result
        const rows = result as Record<string, any>[];
        return rows.length > 0 ? rows[0] : null;
      }

      throw new Error('PostgreSQL client not available');
    } catch (error) {
      throw error;
    }
  }


  async getAllExamSessions(): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];

        const result = await (db as any).execute(sql`
          SELECT
            es.*,
            e.name as exam_title,
            u.first_name || ' ' || u.last_name as student_name,
            (
              SELECT COUNT(*)
              FROM student_answers sa
              WHERE sa.session_id = es.id
              AND (sa.selected_option_id IS NOT NULL OR sa.text_answer IS NOT NULL)
            ) as answered_questions,
            (
              SELECT COUNT(*)
              FROM exam_questions eq
              WHERE eq.exam_id = es.exam_id
            ) as total_questions
          FROM exam_sessions es
          JOIN exams e ON es.exam_id = e.id
          JOIN users u ON es.student_id = u.id
          ORDER BY es.started_at DESC
        `);

        return result as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam sessions:', error);
      return [];
    }
  }


  async getExamReports(filters: { subjectId?: number; classId?: number }): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];

        let query = `
          SELECT
            e.id as exam_id,
            e.name as exam_title,
            c.name as class_name,
            s.name as subject_name,
            e.date as exam_date,
            e.total_marks as max_score,
            COUNT(DISTINCT es.student_id) as total_students,
            COUNT(DISTINCT CASE WHEN es.is_completed THEN es.student_id END) as completed_students,
            COALESCE(AVG(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as average_score,
            COALESCE(
              COUNT(CASE WHEN es.is_completed AND er.marks_obtained >= (e.total_marks * 0.5) THEN 1 END) * 100.0 /
              NULLIF(COUNT(CASE WHEN es.is_completed THEN 1 END), 0),
              0
            ) as pass_rate,
            COALESCE(MAX(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as highest_score,
            COALESCE(MIN(CASE WHEN es.is_completed THEN er.marks_obtained END), 0) as lowest_score,
            CASE
              WHEN COUNT(DISTINCT CASE WHEN es.is_completed THEN es.student_id END) = 0 THEN 'ongoing'
              ELSE 'completed'
            END as status,
            COALESCE(
              COUNT(CASE WHEN es.is_completed AND er.id IS NOT NULL THEN 1 END) * 100.0 /
              NULLIF(COUNT(CASE WHEN es.is_completed THEN 1 END), 0),
              0
            ) as grading_progress
          FROM exams e
          JOIN classes c ON e.class_id = c.id
          JOIN subjects s ON e.subject_id = s.id
          LEFT JOIN exam_sessions es ON e.id = es.exam_id
          LEFT JOIN exam_results er ON e.id = er.exam_id AND es.student_id = er.student_id
          WHERE e.is_published = true
        `;

        const params: any[] = [];
        let paramIndex = 1;

        if (filters.classId) {
          query += ` AND e.class_id = $${paramIndex}`;
          params.push(filters.classId);
          paramIndex++;
        }
        if (filters.subjectId) {
          query += ` AND e.subject_id = $${paramIndex}`;
          params.push(filters.subjectId);
          paramIndex++;
        }
        query += `
          GROUP BY e.id, e.name, c.name, s.name, e.date, e.total_marks
          ORDER BY e.date DESC
        `;

        // Use Neon's unsafe method for dynamic queries with parameters
        const result = await (db as any).execute(sql.raw(query.replace(/\$([0-9]+)/g, (_, n) => `$${n}`)));
        const rows = (result.rows || result) as any[];
        // Map snake_case to camelCase if needed, but for now just return as is
        return rows;
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam reports:', error);
      return [];
    }
  }

}
