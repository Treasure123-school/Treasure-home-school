/** Complete exam / question-bank cleanup — extracted from smart-deletion-manager.ts. */
import { eq, inArray } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";
import { DeletionService } from "./deletion-service";
import { deleteFile } from "../cloudinary-service";

export async function deleteExamCompletely(examId: number, deletionService: DeletionService): Promise<string[]> {
    const collectedFiles: string[] = [];
    try {
      const questions = await db.select({ id: schema.examQuestions.id, imageUrl: schema.examQuestions.imageUrl })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.examId, examId));
      
      const questionIds = questions.map(q => q.id);
      
      for (const question of questions) {
        if (question.imageUrl) collectedFiles.push(question.imageUrl);
      }

      if (questionIds.length > 0) {
        const sessions = await db.select({ id: schema.examSessions.id })
          .from(schema.examSessions)
          .where(eq(schema.examSessions.examId, examId));
        
        const sessionIds = sessions.map(s => s.id);
        
        if (sessionIds.length > 0) {
          try {
            const gtResult = await db.delete(schema.gradingTasks)
              .where(inArray(schema.gradingTasks.sessionId, sessionIds))
              .returning();
            deletionService.recordDeletion('grading_tasks', gtResult.length);
          } catch (e) {}

          try {
            const peResult = await db.delete(schema.performanceEvents)
              .where(inArray(schema.performanceEvents.sessionId, sessionIds))
              .returning();
            deletionService.recordDeletion('performance_events', peResult.length);
          } catch (e) {}

          try {
            const saResult = await db.delete(schema.studentAnswers)
              .where(inArray(schema.studentAnswers.sessionId, sessionIds))
              .returning();
            deletionService.recordDeletion('student_answers', saResult.length);
          } catch (e) {}
          
          try {
            const esResult = await db.delete(schema.examSessions)
              .where(inArray(schema.examSessions.id, sessionIds))
              .returning();
            deletionService.recordDeletion('exam_sessions', esResult.length);
          } catch (e) {}
        }

        try {
          const qoResult = await db.delete(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds))
            .returning();
          deletionService.recordDeletion('question_options', qoResult.length);
        } catch (e) {}
        
        try {
          const eqResult = await db.delete(schema.examQuestions)
            .where(eq(schema.examQuestions.examId, examId))
            .returning();
          deletionService.recordDeletion('exam_questions', eqResult.length);
        } catch (e) {}
      }

      try {
        const erResult = await db.delete(schema.examResults)
          .where(eq(schema.examResults.examId, examId))
          .returning();
        deletionService.recordDeletion('exam_results', erResult.length);
      } catch (e) {}

      try {
        await db.update(schema.reportCardItems)
          .set({ testExamId: null })
          .where(eq(schema.reportCardItems.testExamId, examId));
      } catch (e) {}

      try {
        await db.update(schema.reportCardItems)
          .set({ examExamId: null })
          .where(eq(schema.reportCardItems.examExamId, examId));
      } catch (e) {}

      // Delete archived submissions (FK: exam_submissions_archive_exam_id_exams_id_fk)
      try {
        const archiveResult = await db.delete(schema.examSubmissionsArchive)
          .where(eq(schema.examSubmissionsArchive.examId, examId))
          .returning();
        deletionService.recordDeletion('exam_submissions_archive', archiveResult.length);
      } catch (e) {}

      const result = await db.delete(schema.exams)
        .where(eq(schema.exams.id, examId))
        .returning();
      
      deletionService.recordDeletion('exams', result.length);
    } catch (error) {
      deletionService.recordError(`Failed to delete exam ${examId}: ${(error as Error).message}`);
    }
    return collectedFiles;
  }

export async function deleteQuestionBankCompletely(bankId: number, deletionService: DeletionService): Promise<string[]> {
    const collectedFiles: string[] = [];
    try {
      const items = await db.select({ 
        id: schema.questionBankItems.id, 
        imageUrl: schema.questionBankItems.imageUrl, 
        practicalFileUrl: schema.questionBankItems.practicalFileUrl 
      })
        .from(schema.questionBankItems)
        .where(eq(schema.questionBankItems.bankId, bankId));
      
      const itemIds = items.map(i => i.id);
      
      for (const item of items) {
        if (item.imageUrl) collectedFiles.push(item.imageUrl);
        if (item.practicalFileUrl) collectedFiles.push(item.practicalFileUrl);
      }

      if (itemIds.length > 0) {
        try {
          const qboResult = await db.delete(schema.questionBankOptions)
            .where(inArray(schema.questionBankOptions.questionItemId, itemIds))
            .returning();
          deletionService.recordDeletion('question_bank_options', qboResult.length);
        } catch (e) {}
        
        try {
          const qbiResult = await db.delete(schema.questionBankItems)
            .where(eq(schema.questionBankItems.bankId, bankId))
            .returning();
          deletionService.recordDeletion('question_bank_items', qbiResult.length);
        } catch (e) {}
      }

      const result = await db.delete(schema.questionBanks)
        .where(eq(schema.questionBanks.id, bankId))
        .returning();
      
      deletionService.recordDeletion('question_banks', result.length);
    } catch (error) {
      deletionService.recordError(`Failed to delete question bank ${bankId}: ${(error as Error).message}`);
    }
    return collectedFiles;
  }
