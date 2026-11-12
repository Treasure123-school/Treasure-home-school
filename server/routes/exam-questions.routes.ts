/** Auto-split from routes.ts — exam-questions (orig lines 3702-4118). See git history. */
import type { Express } from 'express';
import { upload, uploadCSV } from '../routes/upload-config';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { parse as parseCSVSync } from 'csv-parse/sync';
import { and } from 'drizzle-orm';
import fs from 'fs/promises';
import { Server } from 'http';
import multer from 'multer';
import path from 'path';

export async function registerExamQuestionsRoutes(app: Express) {
  app.get('/api/exam-questions/:examId', authenticateUser, async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const questions = await storage.getExamQuestions(examId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch exam questions' });
    }
  });

  // Create exam question - Teachers and Admins
  app.post('/api/exam-questions', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const { options, ...questionData } = req.body;
      let question;

      if (options && Array.isArray(options)) {
        question = await storage.createExamQuestionWithOptions(questionData, options);
      } else {
        question = await storage.createExamQuestion(questionData);
      }

      // Emit realtime event for question creation
      realtimeService.emitTableChange('exam_questions', 'INSERT', question, undefined, req.user!.id);
      if (question.examId) {
        realtimeService.emitToExam(question.examId, 'question.created', question);
      }

      res.status(201).json(question);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create exam question' });
    }
  });

  // Update exam question - Teachers and Admins
  app.patch('/api/exam-questions/:id', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);
      const { options, ...questionData } = req.body;

      // Get existing question to check if type is changing
      const existingQuestion = await storage.getExamQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: 'Question not found' });
      }

      // Update the question
      const question = await storage.updateExamQuestion(questionId, questionData);

      if (!question) {
        return res.status(404).json({ message: 'Failed to update question' });
      }

      // Handle options update for multiple choice questions
      if (questionData.questionType === 'multiple_choice') {
        if (options && Array.isArray(options)) {
          // Delete existing options and create new ones
          await storage.deleteQuestionOptions(questionId);
          for (let i = 0; i < options.length; i++) {
            const option = options[i];
            await storage.createQuestionOption({
              questionId,
              optionText: option.optionText,
              isCorrect: option.isCorrect ?? false,
              orderNumber: typeof option.orderNumber === 'number' ? option.orderNumber : (i + 1),
              explanationText: option.explanationText ?? null,
              partialCreditValue: typeof option.partialCreditValue === 'number' ? option.partialCreditValue : 0,
            });
          }
        }
      } else if (existingQuestion.questionType === 'multiple_choice' && questionData.questionType !== 'multiple_choice') {
        // If changing from multiple_choice to another type, delete options
        await storage.deleteQuestionOptions(questionId);
      }

      // Emit realtime event for question update
      realtimeService.emitTableChange('exam_questions', 'UPDATE', question, undefined, req.user!.id);
      if (question.examId) {
        realtimeService.emitToExam(question.examId, 'question.updated', question);
      }

      res.json(question);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exam question' });
    }
  });

  // Delete exam question - Teachers and Admins
  app.delete('/api/exam-questions/:id', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);

      // Get question before deleting for the realtime event
      const existingQuestion = await storage.getExamQuestionById(questionId);
      if (!existingQuestion) {
        return res.status(404).json({ message: 'Question not found' });
      }

      const success = await storage.deleteExamQuestion(questionId);
      if (!success) {
        return res.status(500).json({ message: 'Failed to delete question' });
      }

      // Emit realtime event for question deletion with examId for proper subscription targeting
      realtimeService.emitTableChange('exam_questions', 'DELETE', { id: questionId, examId: existingQuestion.examId }, existingQuestion, req.user!.id);

      // Also emit to the specific exam room for real-time updates
      if (existingQuestion.examId) {
        realtimeService.emitToExam(existingQuestion.examId, 'question.deleted', { id: questionId, examId: existingQuestion.examId });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting exam question:', error);
      res.status(500).json({ message: error?.message || 'Failed to delete exam question' });
    }
  });

  // Bulk get question options for multiple questions (must be before :questionId route)
  app.get('/api/question-options/bulk', authenticateUser, async (req, res) => {
    try {
      const questionIdsParam = req.query.questionIds as string;

      if (!questionIdsParam) {
        return res.json([]);
      }

      const questionIds = questionIdsParam.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));

      if (questionIds.length === 0) {
        return res.json([]);
      }

      // Fetch options for all questions in parallel
      const allOptions = await Promise.all(
        questionIds.map(async (questionId) => {
          try {
            const options = await storage.getQuestionOptions(questionId);
            return options;
          } catch (error) {
            return [];
          }
        })
      );

      // Flatten the array of arrays
      const flattenedOptions = allOptions.flat();
      res.json(flattenedOptions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch question options' });
    }
  });

  // Get question options for a single question
  app.get('/api/question-options/:questionId', authenticateUser, async (req, res) => {
    try {
      const questionId = parseInt(req.params.questionId);
      const options = await storage.getQuestionOptions(questionId);
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch question options' });
    }
  });

  // Bulk upload exam questions - Teachers and Admins
  app.post('/api/exam-questions/bulk', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const { examId, questions } = req.body;

      if (!examId) {
        return res.status(400).json({ message: 'Exam ID is required' });
      }
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: 'Questions array is required and must not be empty' });
      }

      // Prepare questions data with examId and order number
      const questionsData = questions.map((q, index) => ({
        question: {
          examId,
          questionText: q.questionText,
          questionType: q.questionType,
          points: q.points || 1,
          orderNumber: index + 1,
          instructions: q.instructions,
          sampleAnswer: q.sampleAnswer,
          expectedAnswers: q.expectedAnswers,
        },
        options: q.options || []
      }));

      const result = await storage.createExamQuestionsBulk(questionsData);

      // Emit realtime event for bulk question creation
      realtimeService.emitTableChange('exam_questions', 'INSERT', { examId, count: result.created });
      realtimeService.emitToExam(examId, 'questions.bulk_created', { examId, count: result.created });

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({
        message: error.message || 'Failed to upload questions',
        created: 0,
        errors: [error.message || 'Unknown error occurred']
      });
    }
  });

  // CSV Upload for exam questions - Teachers and Admins
  // Expected CSV format: questionText, questionType, points, optionA, optionB, optionC, optionD, correctAnswer
  app.post('/api/exams/:examId/questions/csv', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), uploadCSV.single('file'), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);

      if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required' });
      }

      // Verify exam exists and belongs to this teacher
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Only allow teachers who created the exam, are assigned to it, or admins
      if (req.user!.roleId === ROLES.TEACHER) {
        const teacherId = req.user!.id;
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;
        if (!isCreator && !isTeacherInCharge) {
          return res.status(403).json({ message: 'You can only upload questions to exams you created or are assigned to' });
        }
      }

      // Read and parse CSV file.
      // NOTE: uploadCSV uses multer memoryStorage, so the file arrives as an
      // in-memory buffer (req.file.buffer) — there is no req.file.path and no
      // temp file on disk to unlink. (A prior version of this handler assumed
      // disk storage and called fs.readFile(req.file.path)/fs.unlink(req.file.path),
      // which always threw "path must be a string" and made every CSV upload fail.)
      //
      // IMPORTANT: use a real RFC-4180 parser (csv-parse) instead of naively
      // splitting on '\n' — a naive split shreds any quoted field that
      // contains embedded line breaks (e.g. a reading passage or poem pasted
      // into "QuestionText") into multiple broken rows, which then fail to
      // map to columns correctly and get miscounted as junk/essay entries.
      const csvContent = req.file.buffer.toString('utf-8');

      let records: Record<string, string>[];
      try {
        records = parseCSVSync(csvContent, {
          columns: (headerRow: string[]) => headerRow.map(h => h.trim().toLowerCase().replace(/\s+/g, '')),
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          bom: true,
        });
      } catch (parseErr: any) {
        return res.status(400).json({ message: `Failed to parse CSV: ${parseErr.message}` });
      }

      if (records.length === 0) {
        return res.status(400).json({ message: 'CSV file must contain header and at least one question row' });
      }

      // Expected columns for exam questions CSV
      const headers = Object.keys(records[0]);
      const requiredColumns = ['questiontext', 'questiontype'];
      const hasRequiredColumns = requiredColumns.every(col => headers.includes(col));

      if (!hasRequiredColumns) {
        return res.status(400).json({
          message: 'CSV must contain columns: questionText, questionType. Optional: points, instructions, optionA, optionB, optionC, optionD, correctAnswer, expectedAnswers'
        });
      }

      const questionsData: any[] = [];
      const errors: string[] = [];

      // Parse each row (row indices are +2: +1 for the header row, +1 for 1-based display)
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;

        try {
          const questionText = row['questiontext'];
          const questionType = row['questiontype']?.toLowerCase() || 'multiple_choice';
          const points = parseInt(row['points']) || 1;
          const instructions = row['instructions']?.trim() || null;

          if (!questionText) {
            errors.push(`Row ${rowNum}: Missing question text`);
            continue;
          }

          // Validate question type
          const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank'];
          if (!validTypes.includes(questionType)) {
            errors.push(`Row ${rowNum}: Invalid question type '${questionType}'. Valid types: ${validTypes.join(', ')}`);
            continue;
          }

          // Build question data
          const questionData: any = {
            question: {
              examId,
              questionText,
              questionType,
              points,
              orderNumber: questionsData.length + 1,
              autoGradable: ['multiple_choice', 'true_false', 'fill_blank'].includes(questionType),
              expectedAnswers: '[]',
              instructions,
            },
            options: []
          };

          // Handle multiple choice options
          if (questionType === 'multiple_choice' || questionType === 'true_false') {
            const optionLabels = ['a', 'b', 'c', 'd', 'e', 'f'];
            const correctAnswer = row['correctanswer']?.toLowerCase();

            for (const label of optionLabels) {
              const optionText = row[`option${label}`];
              if (optionText) {
                questionData.options.push({
                  optionText,
                  isCorrect: correctAnswer === label || correctAnswer === optionText.toLowerCase(),
                  orderNumber: optionLabels.indexOf(label) + 1
                });
              }
            }

            // For true/false, auto-create options if not provided
            if (questionType === 'true_false' && questionData.options.length === 0) {
              questionData.options = [
                { optionText: 'True', isCorrect: correctAnswer === 'true' || correctAnswer === 'a', orderNumber: 1 },
                { optionText: 'False', isCorrect: correctAnswer === 'false' || correctAnswer === 'b', orderNumber: 2 }
              ];
            }

            if (questionType === 'multiple_choice' && questionData.options.length < 2) {
              errors.push(`Row ${rowNum}: Multiple choice questions need at least 2 non-empty options`);
              continue;
            }
            if (questionData.options.length > 0 && !questionData.options.some((o: any) => o.isCorrect)) {
              errors.push(`Row ${rowNum}: correctAnswer "${row['correctanswer'] || ''}" doesn't match any option (use A, B, C, D... or the exact option text)`);
              continue;
            }
          }

          // Handle expected answers for short answer/fill blank
          if (questionType === 'short_answer' || questionType === 'fill_blank') {
            const expectedAnswers = row['expectedanswers'] || row['correctanswer'];
            if (expectedAnswers) {
              // Split by semicolon for multiple acceptable answers
              const answers = expectedAnswers.split(';').map(a => a.trim()).filter(a => a);
              questionData.question.expectedAnswers = JSON.stringify(answers);
            }
          }

          questionsData.push(questionData);
        } catch (err: any) {
          errors.push(`Row ${rowNum}: ${err.message}`);
        }
      }

      if (questionsData.length === 0) {
        return res.status(400).json({
          message: 'No valid questions found in CSV',
          errors
        });
      }

      // Use database transaction for atomic insert
      const result = await storage.createExamQuestionsBulk(questionsData);

      // Update exam total marks if needed
      const totalPoints = questionsData.reduce((sum, q) => sum + (q.question.points || 1), 0);
      await storage.updateExam(examId, { totalMarks: (exam.totalMarks || 0) + totalPoints });

      // Log audit event
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'exam_questions_csv_upload',
        entityType: 'exam',
        entityId: examId.toString(),
        newValue: JSON.stringify({ questionsCreated: result.created, errors: result.errors?.length || 0 }),
        reason: `CSV upload: ${result.created} questions added to exam ${exam.name}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null
      });

      // Emit realtime event for CSV question upload
      realtimeService.emitTableChange('exam_questions', 'INSERT', { examId, count: result.created }, undefined, req.user!.id);
      realtimeService.emitToExam(examId, 'questions.csv_uploaded', { examId, count: result.created, totalPointsAdded: totalPoints });

      res.status(201).json({
        message: `Successfully imported ${result.created} questions from CSV`,
        created: result.created,
        errors: errors.length > 0 ? errors : result.errors,
        totalPointsAdded: totalPoints
      });
    } catch (error: any) {
      console.error('CSV question upload error:', error);
      res.status(500).json({
        message: error.message || 'Failed to import questions from CSV',
        errors: [error.message || 'Unknown error occurred']
      });
    }
  });

  // Exam Sessions - Student exam taking functionality

  // Server time sync endpoint — the client uses this to compute its clock offset
  // from the server so the exam countdown never depends on the device's own clock.
}
