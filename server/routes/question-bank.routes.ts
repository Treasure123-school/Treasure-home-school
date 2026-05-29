/**
 * Question Bank & Syllabus Routes
 *
 * Role-based access control:
 * - Super Admin / Admin: full control — view all, approve, reject, publish, edit any
 * - Teacher: create (draft), edit own draft/rejected, submit for approval, view own
 * - Student/Parent: no access
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import {
    sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
    handleRouteError, parseIntParam, parseBoolParam
} from "../utils/response-helpers";

const router = Router();

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const TEACHER_AND_ADMIN = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER];

const isAdmin = (roleId: number) => ADMIN_ROLES.includes(roleId);
const isTeacher = (roleId: number) => roleId === ROLES.TEACHER;

// ═══════════════════════════════════════════
//  SYLLABUS TOPICS
// ═══════════════════════════════════════════

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

router.post('/api/syllabus-topics', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, name, description, orderNumber } = req.body;
        if (!classId || !subjectId || !termId || !name)
            return sendBadRequest(res, 'classId, subjectId, termId, and name are required');
        const topic = await storage.createSyllabusTopic({
            classId, subjectId, termId, name,
            description: description || null,
            orderNumber: orderNumber || 0,
            isActive: true,
            createdBy: req.user!.id,
        });
        sendCreated(res, topic);
    } catch (error: any) {
        if (error.message?.includes('UNIQUE') || error.code === '23505')
            return sendBadRequest(res, 'A topic with this name already exists for this class/subject/term');
        handleRouteError(res, error, 'syllabusTopics.create');
    }
});

router.post('/api/syllabus-topics/bulk', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, topics } = req.body;
        if (!classId || !subjectId || !termId || !Array.isArray(topics) || topics.length === 0)
            return sendBadRequest(res, 'classId, subjectId, termId, and topics array are required');
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

router.post('/api/syllabus-topics/bulk-csv', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const { topics } = req.body;
        if (!Array.isArray(topics) || topics.length === 0)
            return sendBadRequest(res, 'topics array is required');
        let created = 0;
        const errors: string[] = [];
        for (let i = 0; i < topics.length; i++) {
            const t = topics[i];
            if (!t.classId || !t.subjectId || !t.termId || !t.name || t.name.length < 2) {
                errors.push(`Item ${i + 1}: Missing required fields`);
                continue;
            }
            try {
                await storage.createSyllabusTopic({
                    classId: t.classId, subjectId: t.subjectId, termId: t.termId,
                    name: t.name, description: t.description || null,
                    orderNumber: t.orderNumber || 0, isActive: true, createdBy: req.user!.id,
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

router.put('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
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

router.delete('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
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

router.get('/api/question-banks', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const subjectId = parseIntParam(req.query.subjectId as string);
        const banks = await storage.getQuestionBanks(subjectId ? { subjectId } : undefined);
        sendSuccess(res, banks);
    } catch (error) {
        handleRouteError(res, error, 'questionBanks.list');
    }
});

router.get('/api/question-banks/:id', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
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

// Only admins can create/manage question bank containers
router.post('/api/question-banks', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const { name, description, subjectId } = req.body;
        if (!name || !subjectId) return sendBadRequest(res, 'name and subjectId are required');
        const bank = await storage.createQuestionBankRecord({
            name: name.trim(), description: description || null,
            subjectId: parseInt(subjectId), createdBy: req.user!.id,
        });
        sendCreated(res, bank);
    } catch (error: any) {
        if (error.message?.includes('UNIQUE') || error.code === '23505')
            return sendBadRequest(res, 'A question bank with this name already exists');
        handleRouteError(res, error, 'questionBanks.create');
    }
});

router.put('/api/question-banks/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
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

router.delete('/api/question-banks/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
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
//  QUESTION ITEMS — CRUD with RBAC
// ═══════════════════════════════════════════

// GET /api/question-bank/items — Filtered list
// Admin: sees all items (or filtered by status)
// Teacher: sees own items + published/approved items
router.get('/api/question-bank/items', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const user = req.user!;
        const filters: any = {
            bankId: parseIntParam(req.query.bankId as string),
            classId: parseIntParam(req.query.classId as string),
            subjectId: parseIntParam(req.query.subjectId as string),
            termId: parseIntParam(req.query.termId as string),
            topicId: parseIntParam(req.query.topicId as string),
            difficulty: req.query.difficulty as string | undefined,
            questionType: req.query.questionType as string | undefined,
        };

        const requestedStatus = req.query.status as string | undefined;
        const myOnly = req.query.myOnly === 'true';

        if (isAdmin(user.roleId)) {
            // Admin: respect explicit status filter; default = all
            if (requestedStatus) filters.status = requestedStatus;
        } else if (isTeacher(user.roleId)) {
            if (myOnly) {
                // Teacher fetching own questions
                filters.createdBy = user.id;
                if (requestedStatus) filters.status = requestedStatus;
            } else {
                // Teacher browsing bank: only see published/active/approved
                filters.statuses = ['published', 'active', 'approved'];
            }
        }

        const items = await storage.getQuestionBankItemsFiltered(filters);
        const itemsWithOptions = await Promise.all(items.map(async (item: any) => {
            const options = await storage.getQuestionBankItemOptions(item.id);
            return { ...item, options };
        }));

        sendSuccess(res, itemsWithOptions);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.list');
    }
});

// GET /api/question-bank/pending — Admin approval queue
router.get('/api/question-bank/pending', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const subjectId = parseIntParam(req.query.subjectId as string);
        const classId = parseIntParam(req.query.classId as string);
        const items = await storage.getPendingQuestionBankItems({ subjectId, classId });
        const itemsWithOptions = await Promise.all(items.map(async (item: any) => {
            const options = await storage.getQuestionBankItemOptions(item.id);
            return { ...item, options };
        }));
        sendSuccess(res, itemsWithOptions);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.pending');
    }
});

// POST /api/question-bank/items — Create question
// Admin: creates as 'active' (published immediately)
// Teacher: creates as 'draft'
router.post('/api/question-bank/items', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const { bankId, questionText, questionType, points, difficulty, classId, termId, topicId, options, ...rest } = req.body;
        if (!bankId || !questionText || !questionType)
            return sendBadRequest(res, 'bankId, questionText, and questionType are required');

        const user = req.user!;
        const initialStatus = isAdmin(user.roleId) ? 'active' : 'draft';

        const item = await storage.createQuestionBankItem({
            bankId, questionText, questionType,
            points: points || 1,
            difficulty: difficulty || 'medium',
            classId: classId || null,
            termId: termId || null,
            topicId: topicId || null,
            status: initialStatus,
            createdBy: user.id,
            ...rest,
        } as any, options?.map((o: any, i: number) => ({
            optionText: o.optionText || o.text,
            isCorrect: o.isCorrect || false,
            orderNumber: o.orderNumber || i + 1,
            explanationText: o.explanationText || null,
        })));

        const savedOptions = await storage.getQuestionBankItemOptions(item.id);
        sendCreated(res, { ...item, options: savedOptions });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.create');
    }
});

// PUT /api/question-bank/items/:id — Update question
// Admin: can edit any question
// Teacher: can only edit own draft or rejected questions
router.put('/api/question-bank/items/:id', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId)) {
            if (existing.createdBy !== user.id)
                return sendForbidden(res, 'You can only edit your own questions');
            if (!['draft', 'rejected'].includes(existing.status))
                return sendForbidden(res, 'Only draft or rejected questions can be edited. Withdraw the submission first.');
        }

        // Strip workflow fields from teacher edits
        const { status, approvedBy, approvedAt, rejectionReason, createdBy, ...safeData } = req.body;
        const updated = await storage.updateQuestionBankItem(id, safeData);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.update');
    }
});

// DELETE /api/question-bank/items/:id
// Admin: can delete any question
// Teacher: can only delete own draft questions
router.delete('/api/question-bank/items/:id', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId)) {
            if (existing.createdBy !== user.id)
                return sendForbidden(res, 'You can only delete your own questions');
            if (existing.status !== 'draft' && existing.status !== 'rejected')
                return sendForbidden(res, 'Only draft or rejected questions can be deleted');
        }

        await storage.deleteQuestionBankItem(id);
        sendSuccess(res, { message: 'Question deleted', id });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.delete');
    }
});

// ═══════════════════════════════════════════
//  APPROVAL WORKFLOW ACTIONS
// ═══════════════════════════════════════════

// POST /api/question-bank/items/:id/submit — Teacher submits for admin approval
router.post('/api/question-bank/items/:id/submit', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId) && existing.createdBy !== user.id)
            return sendForbidden(res, 'You can only submit your own questions');

        if (!['draft', 'rejected'].includes(existing.status))
            return sendBadRequest(res, `Cannot submit a question with status "${existing.status}"`);

        const updated = await storage.updateQuestionBankItem(id, { status: 'submitted' } as any);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.submit');
    }
});

// POST /api/question-bank/items/:id/withdraw — Teacher withdraws submission back to draft
router.post('/api/question-bank/items/:id/withdraw', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId) && existing.createdBy !== user.id)
            return sendForbidden(res, 'You can only withdraw your own questions');

        if (existing.status !== 'submitted')
            return sendBadRequest(res, 'Only submitted questions can be withdrawn');

        const updated = await storage.updateQuestionBankItem(id, { status: 'draft' } as any);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.withdraw');
    }
});

// POST /api/question-bank/items/:id/approve — Admin approves
router.post('/api/question-bank/items/:id/approve', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');
        if (existing.status !== 'submitted')
            return sendBadRequest(res, 'Only submitted questions can be approved');

        const updated = await storage.approveQuestionBankItem(id, req.user!.id);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.approve');
    }
});

// POST /api/question-bank/items/:id/reject — Admin rejects with reason
router.post('/api/question-bank/items/:id/reject', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');
        if (!['submitted', 'approved'].includes(existing.status))
            return sendBadRequest(res, 'Only submitted or approved questions can be rejected');

        const reason = (req.body.reason || '').trim();
        if (!reason) return sendBadRequest(res, 'Rejection reason is required');

        const updated = await storage.rejectQuestionBankItem(id, req.user!.id, reason);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.reject');
    }
});

// POST /api/question-bank/items/:id/publish — Admin publishes an approved question
router.post('/api/question-bank/items/:id/publish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');

        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');
        if (!['approved', 'active'].includes(existing.status))
            return sendBadRequest(res, 'Only approved questions can be published');

        const updated = await storage.publishQuestionBankItem(id);
        sendSuccess(res, updated);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.items.publish');
    }
});

// ═══════════════════════════════════════════
//  BULK CSV UPLOAD
// ═══════════════════════════════════════════

router.post('/api/question-bank/items/bulk-csv', authenticateUser, authorizeRoles(...TEACHER_AND_ADMIN), async (req: any, res: Response) => {
    try {
        const { bankId, classId, termId, topicId, questions } = req.body;
        if (!bankId) return sendBadRequest(res, 'bankId is required');
        if (!Array.isArray(questions) || questions.length === 0)
            return sendBadRequest(res, 'questions array is required and must not be empty');
        if (questions.length > 200)
            return sendBadRequest(res, 'Maximum 200 questions per upload');

        const user = req.user!;
        const initialStatus = isAdmin(user.roleId) ? 'active' : 'draft';

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
                let options: any[] | undefined;
                if (questionType === 'multiple_choice' && q.options?.length >= 2) {
                    options = q.options.map((o: any, idx: number) => ({
                        optionText: o.optionText || o.text || '',
                        isCorrect: o.isCorrect || false,
                        orderNumber: idx + 1,
                        explanationText: null,
                    }));
                    if (!options.some((o: any) => o.isCorrect)) {
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
                    status: initialStatus,
                    createdBy: user.id,
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

router.post('/api/question-bank/auto-generate', authenticateUser, async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, topicId, count, questionType, difficulty, excludeIds } = req.body;
        if (!classId || !subjectId || !termId)
            return sendBadRequest(res, 'classId, subjectId, and termId are required');

        const numQuestions = parseInt(count) || 10;
        if (numQuestions < 1 || numQuestions > 100)
            return sendBadRequest(res, 'count must be between 1 and 100');

        const filters: any = {
            classId: parseInt(classId),
            subjectId: parseInt(subjectId),
            termId: parseInt(termId),
            statuses: ['active', 'published', 'approved'],
        };
        if (topicId) filters.topicId = parseInt(topicId);
        if (difficulty && difficulty !== 'mixed') filters.difficulty = difficulty;
        if (questionType && questionType !== 'all' && questionType !== 'both') filters.questionType = questionType;

        let pool = await storage.getQuestionBankItemsFiltered(filters);

        if (questionType === 'both') {
            pool = pool.filter((q: any) =>
                ['multiple_choice', 'text', 'essay'].includes(q.questionType));
        }

        const excludeSet = new Set((excludeIds || []).map((id: any) => parseInt(id)));
        if (excludeSet.size > 0) pool = pool.filter((q: any) => !excludeSet.has(q.id));

        const shuffled = pool.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, numQuestions);

        const questionsWithOptions = await Promise.all(selected.map(async (q: any) => {
            const options = await storage.getQuestionBankItemOptions(q.id);
            return { ...q, options };
        }));

        sendSuccess(res, {
            questions: questionsWithOptions,
            count: questionsWithOptions.length,
            totalAvailable: pool.length,
            shortfall: pool.length < numQuestions
                ? `Requested ${numQuestions} but only ${pool.length} available`
                : null,
        });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.autoGenerate');
    }
});

router.post('/api/question-bank/generate', authenticateUser, async (req: any, res: Response) => {
    try {
        const { bankId, classId, subjectId, termId, distribution } = req.body;
        if (!Array.isArray(distribution) || distribution.length === 0)
            return sendBadRequest(res, 'distribution array is required');
        const result = await storage.generateQuestionsFromBank({ bankId, classId, subjectId, termId, distribution });
        const questionsWithOptions = await Promise.all(result.questions.map(async (q) => {
            const options = await storage.getQuestionBankItemOptions(q.id);
            return { ...q, options };
        }));
        sendSuccess(res, { questions: questionsWithOptions, count: questionsWithOptions.length, shortfalls: result.shortfalls });
    } catch (error) {
        handleRouteError(res, error, 'questionBank.generate');
    }
});

router.post('/api/question-bank/import-to-exam', authenticateUser, async (req: any, res: Response) => {
    try {
        const { examId, questionItemIds, randomize, maxQuestions } = req.body;
        if (!examId || !Array.isArray(questionItemIds) || questionItemIds.length === 0)
            return sendBadRequest(res, 'examId and questionItemIds array are required');
        const result = await storage.importQuestionsFromBank(examId, questionItemIds, randomize, maxQuestions);
        for (let i = 0; i < result.questions.length; i++) {
            try {
                await storage.createExamQuestionBankLink({
                    examId, examQuestionId: result.questions[i].id, bankItemId: questionItemIds[i],
                });
            } catch { /* non-critical */ }
        }
        sendSuccess(res, result);
    } catch (error) {
        handleRouteError(res, error, 'questionBank.importToExam');
    }
});

export default router;
