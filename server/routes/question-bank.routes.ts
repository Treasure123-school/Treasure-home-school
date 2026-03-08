/**
 * Question Bank & Syllabus Routes
 * 
 * Modular routes for:
 * - Syllabus Topics CRUD (Class × Subject × Term → Topics)
 * - Question Bank enhanced queries (filter by class/term/topic)
 * - Smart exam generation from question bank
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import {
    sendSuccess, sendCreated, sendBadRequest, sendNotFound,
    handleRouteError, parseIntParam, parseBoolParam
} from "../utils/response-helpers";

const router = Router();

// ═══════════════════════════════════════════
//  SYLLABUS TOPICS
// ═══════════════════════════════════════════

// GET /api/syllabus-topics — List with filters
router.get('/api/syllabus-topics', authenticateUser, async (req: Request, res: Response) => {
    try {
        const classId = parseIntParam(req.query.classId as string);
        const subjectId = parseIntParam(req.query.subjectId as string);
        const termId = parseIntParam(req.query.termId as string);
        const isActive = parseBoolParam(req.query.isActive as string);

        const topics = await storage.getSyllabusTopics({ classId, subjectId, termId, isActive });
        sendSuccess(res, topics);
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.list');
    }
});

// GET /api/syllabus-topics/:id
router.get('/api/syllabus-topics/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const topic = await storage.getSyllabusTopicById(id);
        if (!topic) return sendNotFound(res, 'Syllabus topic not found');

        sendSuccess(res, topic);
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.getById');
    }
});

// POST /api/syllabus-topics — Create single topic (admin/super-admin)
router.post('/api/syllabus-topics', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, name, description, orderNumber } = req.body;
        if (!classId || !subjectId || !termId || !name) {
            return sendBadRequest(res, 'classId, subjectId, termId, and name are required');
        }

        const topic = await storage.createSyllabusTopic({
            classId, subjectId, termId, name,
            description: description || null,
            orderNumber: orderNumber || 0,
            isActive: true,
            createdBy: req.user!.id,
        });

        sendCreated(res, topic);
    } catch (error: any) {
        if (error.message?.includes('UNIQUE') || error.code === '23505') {
            return sendBadRequest(res, 'A topic with this name already exists for this class/subject/term combination');
        }
        handleRouteError(res, error, 'syllabusTopics.create');
    }
});

// POST /api/syllabus-topics/bulk — Bulk create topics
router.post('/api/syllabus-topics/bulk', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, topics } = req.body;
        if (!classId || !subjectId || !termId || !Array.isArray(topics) || topics.length === 0) {
            return sendBadRequest(res, 'classId, subjectId, termId, and topics array are required');
        }

        const topicsToCreate = topics.map((t: any, i: number) => ({
            classId, subjectId, termId,
            name: typeof t === 'string' ? t : t.name,
            description: typeof t === 'string' ? null : (t.description || null),
            orderNumber: typeof t === 'string' ? i + 1 : (t.orderNumber || i + 1),
            isActive: true,
            createdBy: req.user!.id,
        }));

        const result = await storage.createSyllabusTopicsBulk(topicsToCreate);
        sendSuccess(res, result);
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.bulkCreate');
    }
});

// POST /api/syllabus-topics/bulk-csv — Bulk create topics from CSV (pre-resolved IDs)
router.post('/api/syllabus-topics/bulk-csv', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
    try {
        const { topics } = req.body;
        if (!Array.isArray(topics) || topics.length === 0) {
            return sendBadRequest(res, 'topics array is required');
        }

        let created = 0;
        const errors: string[] = [];

        for (let i = 0; i < topics.length; i++) {
            const t = topics[i];
            if (!t.classId || !t.subjectId || !t.termId || !t.name || t.name.length < 2) {
                errors.push(`Item ${i + 1}: Missing required fields (classId, subjectId, termId, name)`);
                continue;
            }
            try {
                await storage.createSyllabusTopic({
                    classId: t.classId,
                    subjectId: t.subjectId,
                    termId: t.termId,
                    name: t.name,
                    description: t.description || null,
                    orderNumber: t.orderNumber || 0,
                    isActive: true,
                    createdBy: req.user!.id,
                });
                created++;
            } catch (err: any) {
                errors.push(`"${t.name}": ${err.message || 'Creation failed'}`);
            }
        }

        sendSuccess(res, { created, errors: errors.length > 0 ? errors : undefined, total: topics.length });
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.bulkCsv');
    }
});

// PUT /api/syllabus-topics/:id — Update topic
router.put('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getSyllabusTopicById(id);
        if (!existing) return sendNotFound(res, 'Syllabus topic not found');

        const updated = await storage.updateSyllabusTopic(id, req.body);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.update');
    }
});

// DELETE /api/syllabus-topics/:id
router.delete('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getSyllabusTopicById(id);
        if (!existing) return sendNotFound(res, 'Syllabus topic not found');

        await storage.deleteSyllabusTopic(id);
        sendSuccess(res, { message: 'Syllabus topic deleted', id });
    } catch (error) {
        handleRouteError(res, error, 'syllabusTopics.delete');
    }
});

// ═══════════════════════════════════════════
//  QUESTION BANKS (Container CRUD)
// ═══════════════════════════════════════════

// GET /api/question-banks — List all question banks
router.get('/api/question-banks', authenticateUser, async (req: Request, res: Response) => {
    try {
        const subjectId = parseIntParam(req.query.subjectId as string);
        const banks = await storage.getQuestionBanks(subjectId ? { subjectId } : undefined);
        sendSuccess(res, banks);
    } catch (error) {
        handleRouteError(res, error, 'questionBanks.list');
    }
});

// GET /api/question-banks/:id — Get single bank
router.get('/api/question-banks/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const bank = await storage.getQuestionBankById(id);
        if (!bank) return sendNotFound(res, 'Question bank not found');
        sendSuccess(res, bank);
    } catch (error) {
        handleRouteError(res, error, 'questionBanks.getById');
    }
});

// POST /api/question-banks — Create new question bank
router.post('/api/question-banks', authenticateUser, async (req: any, res: Response) => {
    try {
        const { name, description, subjectId } = req.body;
        if (!name || !subjectId) {
            return sendBadRequest(res, 'name and subjectId are required');
        }
        const bank = await storage.createQuestionBankRecord({
            name: name.trim(),
            description: description || null,
            subjectId: parseInt(subjectId),
            createdBy: req.user!.id,
        });
        sendCreated(res, bank);
    } catch (error: any) {
        if (error.message?.includes('UNIQUE') || error.code === '23505') {
            return sendBadRequest(res, 'A question bank with this name already exists');
        }
        handleRouteError(res, error, 'questionBanks.create');
    }
});

// PUT /api/question-banks/:id — Update bank
router.put('/api/question-banks/:id', authenticateUser, async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankById(id);
        if (!existing) return sendNotFound(res, 'Question bank not found');
        const updated = await storage.updateQuestionBankRecord(id, req.body);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBanks.update');
    }
});

// DELETE /api/question-banks/:id
router.delete('/api/question-banks/:id', authenticateUser, async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankById(id);
        if (!existing) return sendNotFound(res, 'Question bank not found');
        await storage.deleteQuestionBankRecord(id);
        sendSuccess(res, { message: 'Question bank deleted', id });
    } catch (error) {
        handleRouteError(res, error, 'questionBanks.delete');
    }
});

// ═══════════════════════════════════════════
//  QUESTION BANK — Enhanced Queries
// ═══════════════════════════════════════════

// GET /api/question-bank/items — Filtered list
router.get('/api/question-bank/items', authenticateUser, async (req: Request, res: Response) => {
    try {
        const filters = {
            bankId: parseIntParam(req.query.bankId as string),
            classId: parseIntParam(req.query.classId as string),
            subjectId: parseIntParam(req.query.subjectId as string),
            termId: parseIntParam(req.query.termId as string),
            topicId: parseIntParam(req.query.topicId as string),
            difficulty: req.query.difficulty as string | undefined,
            questionType: req.query.questionType as string | undefined,
            status: req.query.status as string | undefined,
        };

        const items = await storage.getQuestionBankItemsFiltered(filters);

        // For each item, fetch its options
        const itemsWithOptions = await Promise.all(items.map(async (item) => {
            const options = await storage.getQuestionBankItemOptions(item.id);
            return { ...item, options };
        }));

        sendSuccess(res, itemsWithOptions);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.list');
    }
});

// POST /api/question-bank/items — Create question with hierarchy
router.post('/api/question-bank/items', authenticateUser, async (req: any, res: Response) => {
    try {
        const { bankId, questionText, questionType, points, difficulty, classId, termId, topicId, options, ...rest } = req.body;

        if (!bankId || !questionText || !questionType) {
            return sendBadRequest(res, 'bankId, questionText, and questionType are required');
        }

        const item = await storage.createQuestionBankItem({
            bankId, questionText, questionType,
            points: points || 1,
            difficulty: difficulty || 'medium',
            classId: classId || null,
            termId: termId || null,
            topicId: topicId || null,
            status: 'active',
            ...rest,
        }, options?.map((o: any, i: number) => ({
            optionText: o.optionText || o.text,
            isCorrect: o.isCorrect || false,
            orderNumber: o.orderNumber || i + 1,
            explanationText: o.explanationText || null,
        })));

        // Fetch options back
        const savedOptions = await storage.getQuestionBankItemOptions(item.id);
        sendCreated(res, { ...item, options: savedOptions });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.create');
    }
});

// PUT /api/question-bank/items/:id — Update question
router.put('/api/question-bank/items/:id', authenticateUser, async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const updated = await storage.updateQuestionBankItem(id, req.body);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.update');
    }
});

// DELETE /api/question-bank/items/:id
router.delete('/api/question-bank/items/:id', authenticateUser, async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        await storage.deleteQuestionBankItem(id);
        sendSuccess(res, { message: 'Question deleted', id });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.delete');
    }
});

// POST /api/question-bank/items/bulk-csv — Bulk upload questions to a bank
router.post('/api/question-bank/items/bulk-csv', authenticateUser, async (req: any, res: Response) => {
    try {
        const { bankId, classId, termId, topicId, questions } = req.body;

        if (!bankId) return sendBadRequest(res, 'bankId is required');
        if (!Array.isArray(questions) || questions.length === 0) {
            return sendBadRequest(res, 'questions array is required and must not be empty');
        }
        if (questions.length > 200) {
            return sendBadRequest(res, 'Maximum 200 questions per upload');
        }

        const created: any[] = [];
        const errors: string[] = [];

        for (let i = 0; i < questions.length; i++) {
            try {
                const q = questions[i];
                if (!q.questionText || q.questionText.trim().length < 5) {
                    errors.push(`Row ${i + 1}: Question text must be at least 5 characters`);
                    continue;
                }
                const questionType = q.questionType || 'text';
                if (!['multiple_choice', 'text', 'essay', 'true_false', 'fill_blank'].includes(questionType)) {
                    errors.push(`Row ${i + 1}: Invalid question type "${questionType}"`);
                    continue;
                }

                // Build options for MCQ
                let options: any[] | undefined;
                if (questionType === 'multiple_choice' && q.options?.length >= 2) {
                    options = q.options.map((o: any, idx: number) => ({
                        optionText: o.optionText || o.text || '',
                        isCorrect: o.isCorrect || false,
                        orderNumber: idx + 1,
                        explanationText: null,
                    }));
                    if (!options || !options.some((o: any) => o.isCorrect)) {
                        errors.push(`Row ${i + 1}: MCQ must have at least one correct option`);
                        continue;
                    }
                }

                const item = await storage.createQuestionBankItem({
                    bankId: parseInt(String(bankId)),
                    questionText: q.questionText.trim(),
                    questionType,
                    points: parseInt(q.points) || 1,
                    difficulty: q.difficulty || 'medium',
                    classId: classId ? parseInt(String(classId)) : null,
                    termId: termId ? parseInt(String(termId)) : null,
                    topicId: topicId ? parseInt(String(topicId)) : null,
                    status: 'active',
                    expectedAnswers: q.expectedAnswer ? JSON.stringify([q.expectedAnswer]) : '[]',
                    explanationText: q.explanationText || null,
                } as any, options);

                created.push(item);
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        sendSuccess(res, { created: created.length, questions: created, errors });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.bulkCSV');
    }
});

// ═══════════════════════════════════════════
//  EXAM GENERATION FROM BANK
// ═══════════════════════════════════════════

// POST /api/question-bank/generate — Smart random generation
router.post('/api/question-bank/generate', authenticateUser, async (req: any, res: Response) => {
    try {
        const { bankId, classId, subjectId, termId, distribution } = req.body;

        if (!Array.isArray(distribution) || distribution.length === 0) {
            return sendBadRequest(res, 'distribution array is required (each entry: { topicId?, difficulty?, count })');
        }

        const result = await storage.generateQuestionsFromBank({
            bankId, classId, subjectId, termId, distribution,
        });

        // Fetch options for each generated question
        const questionsWithOptions = await Promise.all(result.questions.map(async (q) => {
            const options = await storage.getQuestionBankItemOptions(q.id);
            return { ...q, options };
        }));

        sendSuccess(res, {
            questions: questionsWithOptions,
            count: questionsWithOptions.length,
            shortfalls: result.shortfalls,
        });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.generate');
    }
});

// POST /api/question-bank/import-to-exam — Import selected questions into an exam
router.post('/api/question-bank/import-to-exam', authenticateUser, async (req: any, res: Response) => {
    try {
        const { examId, questionItemIds, randomize, maxQuestions } = req.body;

        if (!examId || !Array.isArray(questionItemIds) || questionItemIds.length === 0) {
            return sendBadRequest(res, 'examId and questionItemIds array are required');
        }

        const result = await storage.importQuestionsFromBank(examId, questionItemIds, randomize, maxQuestions);

        // Track bank links for each imported question
        for (let i = 0; i < result.questions.length; i++) {
            try {
                await storage.createExamQuestionBankLink({
                    examId,
                    examQuestionId: result.questions[i].id,
                    bankItemId: questionItemIds[i],
                });
            } catch {
                // Link creation is non-critical, continue
            }
        }

        sendSuccess(res, result);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.importToExam');
    }
});

export default router;
