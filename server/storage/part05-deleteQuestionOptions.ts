/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { ExamQuestion, InsertExamQuestion, InsertLessonNote, InsertQuestionBank, InsertQuestionBankItem, InsertQuestionBankOption, InsertSyllabusTopic, LessonNote, QuestionBank, QuestionBankItem, QuestionBankOption, SyllabusTopic } from '@shared/schema.pg';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseStorageP04 } from './part04-batchUpsertAttendance'
import type { IStorage } from './types'

export class DatabaseStorageP05 extends DatabaseStorageP04 {
  async deleteQuestionOptions(questionId: number): Promise<boolean> {
    try {
      // First, get the option IDs to clear any references in student_answers
      const options = await db.select({ id: schema.questionOptions.id })
        .from(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, questionId));

      const optionIds = options.map((o: { id: number }) => o.id).filter((id: number | null | undefined): id is number => id != null);

      // Clear selectedOptionId in student_answers that reference these options
      if (optionIds.length > 0) {
        await db.update(schema.studentAnswers)
          .set({ selectedOptionId: null })
          .where(inArray(schema.studentAnswers.selectedOptionId, optionIds));
      }

      // Delete the options
      await db.delete(schema.questionOptions)
        .where(eq(schema.questionOptions.questionId, questionId));

      return true;
    } catch (error) {
      console.error('Error deleting question options:', error);
      return false;
    }
  }
  // Question Bank management

  async createQuestionBank(bank: InsertQuestionBank): Promise<QuestionBank> {
    const result = await db.insert(schema.questionBanks).values(bank).returning();
    return result[0];
  }

  async getAllQuestionBanks(): Promise<QuestionBank[]> {
    return await db.select().from(schema.questionBanks).orderBy(desc(schema.questionBanks.createdAt));
  }

  async getQuestionBankById(id: number): Promise<QuestionBank | undefined> {
    const result = await db.select().from(schema.questionBanks).where(eq(schema.questionBanks.id, id));
    return result[0];
  }

  async getQuestionBanksBySubject(subjectId: number): Promise<QuestionBank[]> {
    return await db.select().from(schema.questionBanks)
      .where(eq(schema.questionBanks.subjectId, subjectId))
      .orderBy(desc(schema.questionBanks.createdAt));
  }

  async updateQuestionBank(id: number, bank: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined> {
    const result = await db.update(schema.questionBanks)
      .set({ ...bank, updatedAt: new Date() })
      .where(eq(schema.questionBanks.id, id))
      .returning();
    return result[0];
  }

  async deleteQuestionBank(id: number): Promise<boolean> {
    await db.delete(schema.questionBanks).where(eq(schema.questionBanks.id, id));
    return true;
  }
  // Question Bank Items management

  async createQuestionBankItem(item: InsertQuestionBankItem, options?: Omit<InsertQuestionBankOption, 'questionItemId'>[]): Promise<QuestionBankItem> {
    const result = await db.insert(schema.questionBankItems).values(item).returning();
    const questionItem = result[0];

    if (options && options.length > 0) {
      const optionValues = options.map((option) => ({
        questionItemId: questionItem.id,
        ...option
      }));
      await db.insert(schema.questionBankOptions).values(optionValues);
    }
    return questionItem;
  }

  async getQuestionBankItems(bankId: number, filters?: { questionType?: string; difficulty?: string; tags?: string[] }): Promise<QuestionBankItem[]> {
    let query = db.select().from(schema.questionBankItems).where(eq(schema.questionBankItems.bankId, bankId));

    if (filters?.questionType) {
      query = query.where(eq(schema.questionBankItems.questionType, filters.questionType));
    }
    if (filters?.difficulty) {
      query = query.where(eq(schema.questionBankItems.difficulty, filters.difficulty));
    }
    return await query.orderBy(desc(schema.questionBankItems.createdAt));
  }

  async getQuestionBankItemById(id: number): Promise<QuestionBankItem | undefined> {
    const result = await db.select().from(schema.questionBankItems).where(eq(schema.questionBankItems.id, id));
    return result[0];
  }

  async updateQuestionBankItem(id: number, item: Partial<InsertQuestionBankItem>): Promise<QuestionBankItem | undefined> {
    const result = await db.update(schema.questionBankItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }

  async deleteQuestionBankItem(id: number): Promise<boolean> {
    await db.delete(schema.questionBankItems).where(eq(schema.questionBankItems.id, id));
    return true;
  }

  async deleteAllQuestionBankItems(bankId: number): Promise<number> {
    const rows = await db.delete(schema.questionBankItems)
      .where(eq(schema.questionBankItems.bankId, bankId))
      .returning({ id: schema.questionBankItems.id });
    return rows.length;
  }

  async getQuestionBankItemOptions(questionItemId: number): Promise<QuestionBankOption[]> {
    return await db.select().from(schema.questionBankOptions)
      .where(eq(schema.questionBankOptions.questionItemId, questionItemId))
      .orderBy(asc(schema.questionBankOptions.orderNumber));
  }

  async importQuestionsFromBank(examId: number, questionItemIds: number[], randomize: boolean = false, maxQuestions?: number): Promise<{ imported: number; questions: ExamQuestion[] }> {
    let selectedItemIds = [...questionItemIds];

    if (randomize && maxQuestions && maxQuestions < questionItemIds.length) {
      selectedItemIds = questionItemIds.sort(() => Math.random() - 0.5).slice(0, maxQuestions);
    }
    const questions: ExamQuestion[] = [];
    const existingQuestionsCount = await this.getExamQuestionCount(examId);
    let orderNumber = existingQuestionsCount + 1;

    for (const itemId of selectedItemIds) {
      const bankItem = await this.getQuestionBankItemById(itemId);
      if (!bankItem) continue;

      // Validate questionType to ensure data integrity (only two types supported)
      const validTypes: Array<"multiple_choice" | "essay"> = ["multiple_choice", "essay"];
      const questionType: "multiple_choice" | "essay" = validTypes.includes(bankItem.questionType as any)
        ? bankItem.questionType as "multiple_choice" | "essay"
        : "essay"; // Default to essay for any legacy types (text, true_false, fill_blank)

      // Parse expectedAnswers from JSON string or comma-separated string to array
      let expectedAnswersArray: string[] | undefined = undefined;
      if (bankItem.expectedAnswers) {
        if (Array.isArray(bankItem.expectedAnswers)) {
          expectedAnswersArray = bankItem.expectedAnswers;
        } else if (typeof bankItem.expectedAnswers === 'string') {
          try {
            const parsed = JSON.parse(bankItem.expectedAnswers);
            expectedAnswersArray = Array.isArray(parsed) ? parsed : [bankItem.expectedAnswers];
          } catch {
            expectedAnswersArray = bankItem.expectedAnswers.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
      }

      const questionData: InsertExamQuestion = {
        examId,
        questionText: bankItem.questionText,
        questionType,
        points: bankItem.points || 1,
        orderNumber: orderNumber++,
        imageUrl: bankItem.imageUrl ?? undefined,
        autoGradable: bankItem.autoGradable,
        expectedAnswers: expectedAnswersArray ? JSON.stringify(expectedAnswersArray) : undefined,
        caseSensitive: bankItem.caseSensitive ?? undefined,
        explanationText: bankItem.explanationText ?? undefined,
        hintText: bankItem.hintText ?? undefined,
        instructions: (bankItem as any).instructions ?? undefined,
      };

      const question = await this.createExamQuestion(questionData);
      questions.push(question);

      if (bankItem.questionType === 'multiple_choice') {
        const bankOptions = await this.getQuestionBankItemOptions(itemId);
        for (const bankOption of bankOptions) {
          await this.createQuestionOption({
            questionId: question.id,
            optionText: bankOption.optionText,
            isCorrect: bankOption.isCorrect,
            orderNumber: bankOption.orderNumber,
            partialCreditValue: 0,
            explanationText: bankOption.explanationText ?? undefined
          });
        }
      }
    }
    return { imported: questions.length, questions };
  }

  // ═══════════ QUESTION BANKS (Container CRUD) ═══════════

  async getQuestionBanks(filters?: { subjectId?: number; classId?: number; termId?: number; termNames?: string[] }): Promise<QuestionBank[]> {
    const conditions: any[] = [];
    if (filters?.subjectId) conditions.push(eq(schema.questionBanks.subjectId, filters.subjectId));
    if (filters?.classId)   conditions.push(eq(schema.questionBanks.classId,   filters.classId));
    if (filters?.termId)    conditions.push(eq(schema.questionBanks.termId,     filters.termId));
    if (filters?.termNames && filters.termNames.length > 0) {
      conditions.push(or(
        inArray(schema.questionBanks.termId,
          db.select({ id: schema.academicTerms.id }).from(schema.academicTerms).where(inArray(schema.academicTerms.name, filters.termNames))),
        isNull(schema.questionBanks.termId)
      ));
    }
    if (conditions.length > 0) {
      return await db.select().from(schema.questionBanks).where(and(...conditions)).orderBy(desc(schema.questionBanks.createdAt));
    }
    return await db.select().from(schema.questionBanks).orderBy(desc(schema.questionBanks.createdAt));
  }
  // getQuestionBankById already defined above (line ~2773)

  async createQuestionBankRecord(data: InsertQuestionBank): Promise<QuestionBank> {
    const result = await db.insert(schema.questionBanks).values(data).returning();
    return result[0];
  }

  async updateQuestionBankRecord(id: number, data: Partial<InsertQuestionBank>): Promise<QuestionBank> {
    const result = await db.update(schema.questionBanks).set({ ...data, updatedAt: new Date() }).where(eq(schema.questionBanks.id, id)).returning();
    return result[0];
  }

  async deleteQuestionBankRecord(id: number): Promise<boolean> {
    await db.delete(schema.questionBanks).where(eq(schema.questionBanks.id, id));
    return true;
  }

  // ═══════════ SYLLABUS TOPICS ═══════════

  async createSyllabusTopic(topic: InsertSyllabusTopic): Promise<SyllabusTopic> {
    const result = await db.insert(schema.syllabusTopics).values(topic).returning();
    return result[0];
  }

  async createSyllabusTopicsBulk(topics: InsertSyllabusTopic[]): Promise<{ created: number; topics: SyllabusTopic[]; errors: string[] }> {
    const created: SyllabusTopic[] = [];
    const errors: string[] = [];
    for (let i = 0; i < topics.length; i++) {
      try {
        const result = await db.insert(schema.syllabusTopics).values(topics[i]).returning();
        created.push(result[0]);
      } catch (error) {
        errors.push(`Topic ${i + 1} ("${topics[i].name}"): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return { created: created.length, topics: created, errors };
  }

  async getSyllabusTopics(filters: { classId?: number; subjectId?: number; termId?: number; isActive?: boolean; isPublished?: boolean }): Promise<SyllabusTopic[]> {
    const conditions: any[] = [];
    if (filters.classId) conditions.push(eq(schema.syllabusTopics.classId, filters.classId));
    if (filters.subjectId) conditions.push(eq(schema.syllabusTopics.subjectId, filters.subjectId));
    if (filters.termId) conditions.push(eq(schema.syllabusTopics.termId, filters.termId));
    if (filters.isActive !== undefined) conditions.push(eq(schema.syllabusTopics.isActive, filters.isActive));
    if (filters.isPublished !== undefined) conditions.push(eq(schema.syllabusTopics.isPublished, filters.isPublished));

    // Order by weekNumber first (preserves curriculum structure), then orderNumber as tie-break
    const ordering = [asc(schema.syllabusTopics.weekNumber), asc(schema.syllabusTopics.orderNumber)];

    if (conditions.length === 0) {
      return await db.select().from(schema.syllabusTopics).orderBy(...ordering);
    }
    return await db.select().from(schema.syllabusTopics)
      .where(and(...conditions))
      .orderBy(...ordering);
  }

  async getSyllabusTopicsStats(): Promise<{ total: number; published: number; draft: number; subjects: number }> {
    const all = await db.select().from(schema.syllabusTopics);
    const published = all.filter((t: SyllabusTopic) => t.isPublished).length;
    const subjectIds = new Set(all.map((t: SyllabusTopic) => t.subjectId));
    return { total: all.length, published, draft: all.length - published, subjects: subjectIds.size };
  }

  async getSyllabusTopicById(id: number): Promise<SyllabusTopic | undefined> {
    const result = await db.select().from(schema.syllabusTopics).where(eq(schema.syllabusTopics.id, id));
    return result[0];
  }

  async updateSyllabusTopic(id: number, topic: Partial<InsertSyllabusTopic>): Promise<SyllabusTopic | undefined> {
    const result = await db.update(schema.syllabusTopics)
      .set({ ...topic, updatedAt: new Date() })
      .where(eq(schema.syllabusTopics.id, id))
      .returning();
    return result[0];
  }

  async deleteSyllabusTopic(id: number): Promise<boolean> {
    await db.delete(schema.syllabusTopics).where(eq(schema.syllabusTopics.id, id));
    return true;
  }

  // ═══════════ LESSON NOTES ═══════════

  async getLessonNotes(filters: { classId?: number; subjectId?: number; termId?: number; status?: string; createdBy?: string }): Promise<LessonNote[]> {
    const conditions: any[] = [];
    if (filters.classId) conditions.push(eq(schema.lessonNotes.classId, filters.classId));
    if (filters.subjectId) conditions.push(eq(schema.lessonNotes.subjectId, filters.subjectId));
    if (filters.termId) conditions.push(eq(schema.lessonNotes.termId, filters.termId));
    if (filters.status) conditions.push(eq(schema.lessonNotes.status, filters.status));
    if (filters.createdBy) conditions.push(eq(schema.lessonNotes.createdBy, filters.createdBy));
    if (conditions.length === 0) return await db.select().from(schema.lessonNotes).orderBy(desc(schema.lessonNotes.createdAt));
    return await db.select().from(schema.lessonNotes).where(and(...conditions)).orderBy(desc(schema.lessonNotes.createdAt));
  }


  async getLessonNotesEnriched(filters: { classId?: number; subjectId?: number; termId?: number; status?: string; createdBy?: string }): Promise<Array<LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }>> {
    const conditions: any[] = [];
    if (filters.classId)   conditions.push(eq(schema.lessonNotes.classId,   filters.classId));
    if (filters.subjectId) conditions.push(eq(schema.lessonNotes.subjectId, filters.subjectId));
    if (filters.termId)    conditions.push(eq(schema.lessonNotes.termId,    filters.termId));
    if (filters.status)    conditions.push(eq(schema.lessonNotes.status,    filters.status));
    if (filters.createdBy) conditions.push(eq(schema.lessonNotes.createdBy, filters.createdBy));

    const creatorAlias  = alias(schema.users, 'creator');
    const approverAlias = alias(schema.users, 'approver');

    const rows = await db.select({
      note:              schema.lessonNotes,
      creatorFirstName:  creatorAlias.firstName,
      creatorLastName:   creatorAlias.lastName,
      approverFirstName: approverAlias.firstName,
      approverLastName:  approverAlias.lastName,
      subjectName:       schema.subjects.name,
      className:         schema.classes.name,
      topicName:         schema.syllabusTopics.name,
      termName:          schema.academicTerms.name,
    })
      .from(schema.lessonNotes)
      .leftJoin(creatorAlias,           eq(schema.lessonNotes.createdBy,  creatorAlias.id))
      .leftJoin(approverAlias,          eq(schema.lessonNotes.approvedBy, approverAlias.id))
      .leftJoin(schema.subjects,        eq(schema.lessonNotes.subjectId,  schema.subjects.id))
      .leftJoin(schema.classes,         eq(schema.lessonNotes.classId,    schema.classes.id))
      .leftJoin(schema.syllabusTopics,  eq(schema.lessonNotes.topicId,    schema.syllabusTopics.id))
      .leftJoin(schema.academicTerms,   eq(schema.lessonNotes.termId,     schema.academicTerms.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.lessonNotes.createdAt));

    return rows.map((row: any) => ({
      ...row.note,
      creatorName: row.creatorFirstName && row.creatorLastName
        ? `${row.creatorFirstName} ${row.creatorLastName}`.trim()
        : (row.creatorFirstName || row.creatorLastName || null),
      approverName: row.approverFirstName && row.approverLastName
        ? `${row.approverFirstName} ${row.approverLastName}`.trim()
        : (row.approverFirstName || row.approverLastName || null),
      subjectName: row.subjectName ?? null,
      className:   row.className   ?? null,
      topicName:   row.topicName   ?? null,
      termName:    row.termName    ?? null,
    }));
  }

  async getLessonNoteById(id: number): Promise<(LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }) | undefined> {
    const creatorAlias  = alias(schema.users, 'creator');
    const approverAlias = alias(schema.users, 'approver');
    const rows = await db
      .select({
        note:              schema.lessonNotes,
        creatorFirstName:  creatorAlias.firstName,
        creatorLastName:   creatorAlias.lastName,
        approverFirstName: approverAlias.firstName,
        approverLastName:  approverAlias.lastName,
        subjectName:       schema.subjects.name,
        className:         schema.classes.name,
        topicName:         schema.syllabusTopics.name,
        termName:          schema.academicTerms.name,
      })
      .from(schema.lessonNotes)
      .leftJoin(creatorAlias,          eq(schema.lessonNotes.createdBy,  creatorAlias.id))
      .leftJoin(approverAlias,         eq(schema.lessonNotes.approvedBy, approverAlias.id))
      .leftJoin(schema.subjects,       eq(schema.lessonNotes.subjectId,  schema.subjects.id))
      .leftJoin(schema.classes,        eq(schema.lessonNotes.classId,    schema.classes.id))
      .leftJoin(schema.syllabusTopics, eq(schema.lessonNotes.topicId,    schema.syllabusTopics.id))
      .leftJoin(schema.academicTerms,  eq(schema.lessonNotes.termId,     schema.academicTerms.id))
      .where(eq(schema.lessonNotes.id, id))
      .limit(1);
    if (!rows[0]) return undefined;
    const row = rows[0];
    return {
      ...row.note,
      creatorName: row.creatorFirstName && row.creatorLastName
        ? `${row.creatorFirstName} ${row.creatorLastName}`.trim()
        : (row.creatorFirstName || row.creatorLastName || null),
      approverName: row.approverFirstName && row.approverLastName
        ? `${row.approverFirstName} ${row.approverLastName}`.trim()
        : (row.approverFirstName || row.approverLastName || null),
      subjectName: row.subjectName ?? null,
      className:   row.className   ?? null,
      topicName:   row.topicName   ?? null,
      termName:    row.termName    ?? null,
    };
  }

  async getLessonNoteByTopicId(topicId: number, publishedOnly = false): Promise<(LessonNote & { creatorName: string | null; approverName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }) | undefined> {
    const creatorAlias  = alias(schema.users, 'creator');
    const approverAlias = alias(schema.users, 'approver');
    const conditions: any[] = [eq(schema.lessonNotes.topicId, topicId)];
    if (publishedOnly) conditions.push(eq(schema.lessonNotes.status, 'published'));
    const rows = await db
      .select({
        note:              schema.lessonNotes,
        creatorFirstName:  creatorAlias.firstName,
        creatorLastName:   creatorAlias.lastName,
        approverFirstName: approverAlias.firstName,
        approverLastName:  approverAlias.lastName,
        subjectName:       schema.subjects.name,
        className:         schema.classes.name,
        topicName:         schema.syllabusTopics.name,
        termName:          schema.academicTerms.name,
      })
      .from(schema.lessonNotes)
      .leftJoin(creatorAlias,          eq(schema.lessonNotes.createdBy,  creatorAlias.id))
      .leftJoin(approverAlias,         eq(schema.lessonNotes.approvedBy, approverAlias.id))
      .leftJoin(schema.subjects,       eq(schema.lessonNotes.subjectId,  schema.subjects.id))
      .leftJoin(schema.classes,        eq(schema.lessonNotes.classId,    schema.classes.id))
      .leftJoin(schema.syllabusTopics, eq(schema.lessonNotes.topicId,    schema.syllabusTopics.id))
      .leftJoin(schema.academicTerms,  eq(schema.lessonNotes.termId,     schema.academicTerms.id))
      .where(and(...conditions))
      .limit(1);
    if (!rows[0]) return undefined;
    const row = rows[0];
    return {
      ...row.note,
      creatorName: row.creatorFirstName && row.creatorLastName
        ? `${row.creatorFirstName} ${row.creatorLastName}`.trim()
        : (row.creatorFirstName || row.creatorLastName || null),
      approverName: row.approverFirstName && row.approverLastName
        ? `${row.approverFirstName} ${row.approverLastName}`.trim()
        : (row.approverFirstName || row.approverLastName || null),
      subjectName: row.subjectName ?? null,
      className:   row.className   ?? null,
      topicName:   row.topicName   ?? null,
      termName:    row.termName    ?? null,
    };
  }

  async createLessonNote(data: InsertLessonNote): Promise<LessonNote> {
    const result = await db.insert(schema.lessonNotes).values(data).returning();
    return result[0];
  }

  async updateLessonNote(id: number, data: Partial<InsertLessonNote>): Promise<LessonNote | undefined> {
    const result = await db.update(schema.lessonNotes).set({ ...data, updatedAt: new Date() }).where(eq(schema.lessonNotes.id, id)).returning();
    return result[0];
  }

  async deleteLessonNote(id: number): Promise<boolean> {
    await db.delete(schema.lessonNotes).where(eq(schema.lessonNotes.id, id));
    return true;
  }

  async getLessonNotesStats(): Promise<{ total: number; draft: number; submitted: number; approved: number; rejected: number; published: number }> {
    const all = await db.select().from(schema.lessonNotes);
    return {
      total: all.length,
      draft: all.filter((n: LessonNote) => n.status === 'draft').length,
      submitted: all.filter((n: LessonNote) => n.status === 'submitted').length,
      approved: all.filter((n: LessonNote) => n.status === 'approved').length,
      rejected: all.filter((n: LessonNote) => n.status === 'rejected').length,
      published: all.filter((n: LessonNote) => n.status === 'published').length,
    };
  }


  async getLessonNotesForTeacherView(
    teacherId: string,
    filters: { classId?: number; subjectId?: number; termId?: number },
  ): Promise<Array<LessonNote & { creatorName: string | null; subjectName: string | null; className: string | null; topicName: string | null; termName: string | null }>> {
    // 1. Fetch teacher's active class+subject assignments
    const assignments = await db
      .select({
        classId: schema.teacherClassAssignments.classId,
        subjectId: schema.teacherClassAssignments.subjectId,
      })
      .from(schema.teacherClassAssignments)
      .where(
        and(
          eq(schema.teacherClassAssignments.teacherId, teacherId),
          eq(schema.teacherClassAssignments.isActive, true),
        ),
      );

    if (assignments.length === 0) return [];

    // 2. Build OR conditions: (classId=A AND subjectId=B) OR (classId=C AND subjectId=D) ...
    const pairConds = assignments.map((a: any) =>
      and(
        eq(schema.lessonNotes.classId, a.classId),
        eq(schema.lessonNotes.subjectId, a.subjectId),
      ),
    );
    const inAssignedSubjects = or(...pairConds);

    // 3. Visibility rule:
    //    - Teacher's OWN notes for their assigned subjects (any status)
    //    - OR approved/published notes from ANY creator for their assigned subjects
    const visibility = or(
      and(eq(schema.lessonNotes.createdBy, teacherId), inAssignedSubjects),
      and(inArray(schema.lessonNotes.status, ['approved', 'published']), inAssignedSubjects),
    );

    const conditions: any[] = [visibility];
    if (filters.classId)   conditions.push(eq(schema.lessonNotes.classId,   filters.classId));
    if (filters.subjectId) conditions.push(eq(schema.lessonNotes.subjectId, filters.subjectId));
    if (filters.termId)    conditions.push(eq(schema.lessonNotes.termId,    filters.termId));

    const creatorAlias = alias(schema.users, 'creator');
    const rows = await db
      .select({
        note:             schema.lessonNotes,
        creatorFirstName: creatorAlias.firstName,
        creatorLastName:  creatorAlias.lastName,
        subjectName:      schema.subjects.name,
        className:        schema.classes.name,
        topicName:        schema.syllabusTopics.name,
        termName:         schema.academicTerms.name,
      })
      .from(schema.lessonNotes)
      .leftJoin(creatorAlias,          eq(schema.lessonNotes.createdBy,  creatorAlias.id))
      .leftJoin(schema.subjects,       eq(schema.lessonNotes.subjectId,  schema.subjects.id))
      .leftJoin(schema.classes,        eq(schema.lessonNotes.classId,    schema.classes.id))
      .leftJoin(schema.syllabusTopics, eq(schema.lessonNotes.topicId,    schema.syllabusTopics.id))
      .leftJoin(schema.academicTerms,  eq(schema.lessonNotes.termId,     schema.academicTerms.id))
      .where(and(...conditions))
      .orderBy(desc(schema.lessonNotes.createdAt));

    return rows.map((row: any) => ({
      ...row.note,
      creatorName: row.creatorFirstName && row.creatorLastName
        ? `${row.creatorFirstName} ${row.creatorLastName}`.trim()
        : (row.creatorFirstName || row.creatorLastName || null),
      subjectName: row.subjectName ?? null,
      className:   row.className   ?? null,
      topicName:   row.topicName   ?? null,
      termName:    row.termName    ?? null,
    }));
  }


  async isTeacherAssignedToSubject(teacherId: string, classId: number, subjectId: number): Promise<boolean> {
    const result = await db
      .select({ id: schema.teacherClassAssignments.id })
      .from(schema.teacherClassAssignments)
      .where(
        and(
          eq(schema.teacherClassAssignments.teacherId, teacherId),
          eq(schema.teacherClassAssignments.classId,   classId),
          eq(schema.teacherClassAssignments.subjectId, subjectId),
          eq(schema.teacherClassAssignments.isActive,  true),
        ),
      )
      .limit(1);
    return result.length > 0;
  }

  // ═══════════ ENHANCED QUESTION BANK QUERIES ═══════════

  async getQuestionBankItemsFiltered(filters: {
    bankId?: number; classId?: number; subjectId?: number; termId?: number; termNames?: string[];
    topicId?: number; difficulty?: string; questionType?: string; status?: string;
    createdBy?: string; statuses?: string[];
  }): Promise<QuestionBankItem[]> {
    const conditions: any[] = [];
    if (filters.bankId) conditions.push(eq(schema.questionBankItems.bankId, filters.bankId));
    if (filters.classId) conditions.push(eq(schema.questionBankItems.classId, filters.classId));
    if (filters.termId) conditions.push(eq(schema.questionBankItems.termId, filters.termId));
    if (filters.termNames && filters.termNames.length > 0) {
      conditions.push(or(
        inArray(schema.questionBankItems.termId,
          db.select({ id: schema.academicTerms.id }).from(schema.academicTerms).where(inArray(schema.academicTerms.name, filters.termNames))),
        isNull(schema.questionBankItems.termId)
      ));
    }
    if (filters.topicId) conditions.push(eq(schema.questionBankItems.topicId, filters.topicId));
    if (filters.difficulty) conditions.push(eq(schema.questionBankItems.difficulty, filters.difficulty));
    if (filters.questionType) conditions.push(eq(schema.questionBankItems.questionType, filters.questionType));
    if (filters.createdBy) conditions.push(eq(schema.questionBankItems.createdBy, filters.createdBy));
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(schema.questionBankItems.status, filters.statuses));
    } else if (filters.status) {
      conditions.push(eq(schema.questionBankItems.status, filters.status));
    }

    // If subjectId is specified, join via the bank to filter by subject
    if (filters.subjectId) {
      const bankIds = await db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.subjectId, filters.subjectId));
      if (bankIds.length > 0) {
        conditions.push(inArray(schema.questionBankItems.bankId, bankIds.map((b: { id: number }) => b.id)));
      } else {
        return []; // No banks for this subject
      }
    }

    if (conditions.length === 0) {
      return await db.select().from(schema.questionBankItems)
        .orderBy(desc(schema.questionBankItems.createdAt));
    }
    return await db.select().from(schema.questionBankItems)
      .where(and(...conditions))
      .orderBy(desc(schema.questionBankItems.createdAt));
  }


  async getQuestionBankItemsPaginated(filters: {
    bankId: number; classId?: number; termId?: number; termNames?: string[]; topicId?: number;
    difficulty?: string; questionType?: string; status?: string;
    createdBy?: string; statuses?: string[];
    page: number; pageSize: number;
  }): Promise<{ items: QuestionBankItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const conditions: any[] = [eq(schema.questionBankItems.bankId, filters.bankId)];
    if (filters.classId) conditions.push(eq(schema.questionBankItems.classId, filters.classId));
    if (filters.termId) conditions.push(eq(schema.questionBankItems.termId, filters.termId));
    if (filters.termNames && filters.termNames.length > 0) {
      conditions.push(or(
        inArray(schema.questionBankItems.termId,
          db.select({ id: schema.academicTerms.id }).from(schema.academicTerms).where(inArray(schema.academicTerms.name, filters.termNames))),
        isNull(schema.questionBankItems.termId)
      ));
    }
    if (filters.topicId) conditions.push(eq(schema.questionBankItems.topicId, filters.topicId));
    if (filters.difficulty) conditions.push(eq(schema.questionBankItems.difficulty, filters.difficulty));
    if (filters.questionType) conditions.push(eq(schema.questionBankItems.questionType, filters.questionType));
    if (filters.createdBy) conditions.push(eq(schema.questionBankItems.createdBy, filters.createdBy));
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(schema.questionBankItems.status, filters.statuses));
    } else if (filters.status) {
      conditions.push(eq(schema.questionBankItems.status, filters.status));
    }

    const whereClause = and(...conditions);
    const offset = (filters.page - 1) * filters.pageSize;

    const [countResult, items] = await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.questionBankItems)
        .where(whereClause),
      db.select().from(schema.questionBankItems)
        .where(whereClause)
        .orderBy(desc(schema.questionBankItems.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }


  async approveQuestionBankItem(id: number, approvedBy: string): Promise<QuestionBankItem | undefined> {
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }


  async rejectQuestionBankItem(id: number, rejectedBy: string, reason: string): Promise<QuestionBankItem | undefined> {
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'rejected', approvedBy: rejectedBy, approvedAt: new Date(), rejectionReason: reason, updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }


  async publishQuestionBankItem(id: number): Promise<QuestionBankItem | undefined> {
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }


  async bulkPublishQuestionBankItems(bankId: number): Promise<number> {
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'published', updatedAt: new Date() })
      .where(and(
        eq(schema.questionBankItems.bankId, bankId),
        inArray(schema.questionBankItems.status, ['draft', 'submitted', 'active', 'approved'])
      ))
      .returning({ id: schema.questionBankItems.id });
    return result.length;
  }


  async unpublishQuestionBankItem(id: number): Promise<QuestionBankItem | undefined> {
    // Revert to 'active' — the usable pre-publish state that re-enables the Publish button
    // without requiring a re-approval step (teachers see it in exam imports; admins can re-publish).
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(schema.questionBankItems.id, id))
      .returning();
    return result[0];
  }


  async bulkUnpublishQuestionBankItems(bankId: number): Promise<number> {
    const result = await db.update(schema.questionBankItems)
      .set({ status: 'active', updatedAt: new Date() })
      .where(and(
        eq(schema.questionBankItems.bankId, bankId),
        eq(schema.questionBankItems.status, 'published')
      ))
      .returning({ id: schema.questionBankItems.id });
    return result.length;
  }


  async getPendingQuestionBankItems(filters?: { subjectId?: number; classId?: number; createdBy?: string; page?: number; pageSize?: number }): Promise<{ items: QuestionBankItem[]; total: number; totalPages: number }> {
    const conditions: any[] = [eq(schema.questionBankItems.status, 'submitted')];
    if (filters?.classId) conditions.push(eq(schema.questionBankItems.classId, filters.classId));
    if (filters?.createdBy) conditions.push(eq(schema.questionBankItems.createdBy, filters.createdBy));
    if (filters?.subjectId) {
      const bankIds = await db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.subjectId, filters.subjectId));
      if (bankIds.length > 0) {
        conditions.push(inArray(schema.questionBankItems.bankId, bankIds.map((b: { id: number }) => b.id)));
      } else {
        return { items: [], total: 0, totalPages: 0 };
      }
    }

    const whereClause = and(...conditions);
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 25;
    const offset = (page - 1) * pageSize;

    const [countResult, items] = await Promise.all([
      db.select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.questionBankItems).where(whereClause),
      db.select().from(schema.questionBankItems)
        .where(whereClause)
        .orderBy(asc(schema.questionBankItems.createdAt))
        .limit(pageSize).offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, totalPages: Math.ceil(total / pageSize) };
  }

  // Smart random generation: Pull questions based on distribution criteria
}
