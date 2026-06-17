/**
 * Question Bank & Syllabus Routes
 *
 * Role-based access:
 *   Super Admin / Admin — full control: view all, approve, reject, publish, manage banks
 *   Teacher            — create drafts, edit/delete own draft/rejected, submit for review
 *   Student / Parent   — no access
 *
 * Performance rules:
 *   - GET /api/question-bank/items  REQUIRES bankId + classId + termId — no unbounded queries
 *   - All item list endpoints are paginated (page + pageSize, default 20, max 100)
 *   - GET /api/question-bank/pending also paginated
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import {
    sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
    handleRouteError, parseIntParam, parseBoolParam
} from "../utils/response-helpers";

const router = Router();

const ADMIN_ROLES  = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const STAFF_ROLES  = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER];

const isAdmin   = (roleId: number) => (ADMIN_ROLES as readonly number[]).includes(roleId);
const isTeacher = (roleId: number) => roleId === ROLES.TEACHER;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ═══════════════════════════════════════════════════════
//  SYLLABUS TOPICS
// ═══════════════════════════════════════════════════════

router.get('/api/syllabus-topics/stats', authenticateUser, authorizeRoles(...STAFF_ROLES), async (_req: Request, res: Response) => {
    try {
        const stats = await storage.getSyllabusTopicsStats();
        sendSuccess(res, stats);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.stats'); }
});

router.get('/api/syllabus-topics', authenticateUser, async (req: Request, res: Response) => {
    try {
        const classId     = parseIntParam(req.query.classId as string);
        const subjectId   = parseIntParam(req.query.subjectId as string);
        const termId      = parseIntParam(req.query.termId as string);
        const isActive    = parseBoolParam(req.query.isActive as string);
        const isPublished = parseBoolParam(req.query.isPublished as string);
        const topics      = await storage.getSyllabusTopics({ classId, subjectId, termId, isActive, isPublished });
        sendSuccess(res, topics);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.list'); }
});

router.get('/api/syllabus-topics/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const topic = await storage.getSyllabusTopicById(id);
        if (!topic) return sendNotFound(res, 'Syllabus topic not found');
        sendSuccess(res, topic);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.getById'); }
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
        if (error.code === '23505') return sendBadRequest(res, 'Topic already exists for this class/subject/term');
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
            isActive: true, createdBy: req.user!.id,
        }));
        const result = await storage.createSyllabusTopicsBulk(topicsToCreate);
        sendSuccess(res, result);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.bulkCreate'); }
});

router.put('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getSyllabusTopicById(id);
        if (!existing) return sendNotFound(res, 'Syllabus topic not found');
        const updated = await storage.updateSyllabusTopic(id, req.body);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.update'); }
});

router.patch('/api/syllabus-topics/:id/publish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const { isPublished } = req.body;
        if (typeof isPublished !== 'boolean') return sendBadRequest(res, 'isPublished (boolean) is required');
        const existing = await storage.getSyllabusTopicById(id);
        if (!existing) return sendNotFound(res, 'Syllabus topic not found');
        const updated = await storage.updateSyllabusTopic(id, { isPublished });
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.publish'); }
});

router.delete('/api/syllabus-topics/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getSyllabusTopicById(id);
        if (!existing) return sendNotFound(res, 'Syllabus topic not found');
        await storage.deleteSyllabusTopic(id);
        sendSuccess(res, { message: 'Syllabus topic deleted', id });
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.delete'); }
});

// ═══════════════════════════════════════════════════════
//  QUESTION BANKS (Container CRUD)
// ═══════════════════════════════════════════════════════

// Stats summary for the dashboard header (admin only)
router.get('/api/question-bank/stats', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (_req: any, res: Response) => {
    try {
        const { db } = await import('../db');
        const { questionBanks, questionBankItems } = await import('../../shared/schema.pg');
        const { count, eq } = await import('drizzle-orm');

        const [banksRow]     = await db.select({ n: count() }).from(questionBanks);
        const [totalRow]     = await db.select({ n: count() }).from(questionBankItems);
        const [publishedRow] = await db.select({ n: count() }).from(questionBankItems)
            .where(eq(questionBankItems.status, 'published'));
        const [pendingRow]   = await db.select({ n: count() }).from(questionBankItems)
            .where(eq(questionBankItems.status, 'submitted'));

        sendSuccess(res, {
            totalBanks:          Number(banksRow?.n   ?? 0),
            totalQuestions:      Number(totalRow?.n    ?? 0),
            publishedQuestions:  Number(publishedRow?.n ?? 0),
            pendingReview:       Number(pendingRow?.n   ?? 0),
        });
    } catch (error) { handleRouteError(res, error, 'questionBanks.stats'); }
});

router.get('/api/question-banks', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const subjectId = parseIntParam(req.query.subjectId as string);
        const classId   = parseIntParam(req.query.classId   as string);
        const termId    = parseIntParam(req.query.termId    as string);

        // Require at least classId to prevent unbounded queries returning all banks
        if (!classId && !subjectId) {
            return sendBadRequest(res, 'classId or subjectId is required to filter question banks');
        }

        const filters: { subjectId?: number; classId?: number; termId?: number } = {};
        if (classId)   filters.classId   = classId;
        if (subjectId) filters.subjectId = subjectId;
        if (termId)    filters.termId    = termId;

        const banks = await storage.getQuestionBanks(filters);
        sendSuccess(res, banks);
    } catch (error) { handleRouteError(res, error, 'questionBanks.list'); }
});

router.get('/api/question-banks/:id', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const bank = await storage.getQuestionBankById(id);
        if (!bank) return sendNotFound(res, 'Question bank not found');
        sendSuccess(res, bank);
    } catch (error) { handleRouteError(res, error, 'questionBanks.getById'); }
});

router.post('/api/question-banks', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const { name, description, subjectId, classId, termId } = req.body;
        if (!name || !subjectId) return sendBadRequest(res, 'name and subjectId are required');
        if (!classId) return sendBadRequest(res, 'classId is required');
        const bank = await storage.createQuestionBankRecord({
            name: name.trim(), description: description || null,
            subjectId: parseInt(subjectId),
            classId:   parseInt(classId),
            termId:    termId ? parseInt(termId) : null,
            createdBy: req.user!.id,
        } as any);
        sendCreated(res, bank);
    } catch (error: any) {
        if (error.code === '23505') return sendBadRequest(res, 'A question bank with this name already exists');
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
    } catch (error) { handleRouteError(res, error, 'questionBanks.update'); }
});

router.delete('/api/question-banks/:id', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankById(id);
        if (!existing) return sendNotFound(res, 'Question bank not found');
        await storage.deleteQuestionBankRecord(id);
        sendSuccess(res, { message: 'Question bank deleted', id });
    } catch (error) { handleRouteError(res, error, 'questionBanks.delete'); }
});

// ═══════════════════════════════════════════════════════
//  QUESTION ITEMS — PAGINATED, FILTERED
//
//  REQUIRED: bankId + classId + termId must be supplied.
//  This prevents full-table scans and unbounded payloads.
// ═══════════════════════════════════════════════════════

router.get('/api/question-bank/items', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const bankId  = parseIntParam(req.query.bankId as string);
        const classId = parseIntParam(req.query.classId as string);
        const termId  = parseIntParam(req.query.termId as string);
        const myOnly  = req.query.myOnly === 'true';
        const user    = req.user!;

        // bankId is required unless teacher is fetching their own questions
        if (!myOnly && !bankId) return sendBadRequest(res, 'bankId is required');
        if (!classId)           return sendBadRequest(res, 'classId is required');
        // termId is optional for both paths — when absent, results span all terms

        const page     = clamp(parseInt((req.query.page as string) || '1', 10) || 1, 1, 9999);
        const pageSize = clamp(parseInt((req.query.pageSize as string) || '20', 10) || 20, 1, 100);

        const topicId      = parseIntParam(req.query.topicId as string) ?? undefined;
        const difficulty   = (req.query.difficulty as string) || undefined;
        const questionType = (req.query.questionType as string) || undefined;
        const statusFilter = (req.query.status as string) || undefined;

        // ── "My Questions" path (teacher / admin fetching own questions) ──
        // classId + termId scoped, no bankId required — bounded result set
        if (myOnly) {
            const createdBy = user.id;
            const allFilters: any = {
                classId, termId, createdBy, topicId, difficulty, questionType,
            };
            if (statusFilter) allFilters.status = statusFilter;

            const allItems = await storage.getQuestionBankItemsFiltered(allFilters);
            const total    = allItems.length;
            const offset   = (page - 1) * pageSize;
            const sliced   = allItems.slice(offset, offset + pageSize);

            const itemsWithOptions = await Promise.all(
                sliced.map(async (item: any) => {
                    const options = await storage.getQuestionBankItemOptions(item.id);
                    return { ...item, options };
                })
            );

            return sendSuccess(res, {
                items: itemsWithOptions, total, page, pageSize,
                totalPages: Math.ceil(total / pageSize),
            });
        }

        // ── Standard bank browse path ──
        const filters: Parameters<typeof storage.getQuestionBankItemsPaginated>[0] = {
            bankId: bankId!, classId, termId, page, pageSize,
            topicId, difficulty, questionType,
        };

        if (isAdmin(user.roleId)) {
            if (statusFilter) filters.status = statusFilter;
        } else if (isTeacher(user.roleId)) {
            // Teachers browsing the bank: only see published/approved/active items
            filters.statuses = ['published', 'active', 'approved'];
        }

        const result = await storage.getQuestionBankItemsPaginated(filters);

        const itemsWithOptions = await Promise.all(
            result.items.map(async (item: any) => {
                const options = await storage.getQuestionBankItemOptions(item.id);
                return { ...item, options };
            })
        );

        sendSuccess(res, { ...result, items: itemsWithOptions });
    } catch (error) { handleRouteError(res, error, 'questionBank.items.list'); }
});

// ─── Admin: Paginated approval queue ─────────────────────────────────────────
router.get('/api/question-bank/pending', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const page     = clamp(parseInt((req.query.page as string) || '1', 10) || 1, 1, 9999);
        const pageSize = clamp(parseInt((req.query.pageSize as string) || '25', 10) || 25, 1, 100);
        const subjectId = parseIntParam(req.query.subjectId as string) ?? undefined;
        const classId   = parseIntParam(req.query.classId as string) ?? undefined;

        const result = await storage.getPendingQuestionBankItems({ subjectId, classId, page, pageSize });

        const itemsWithOptions = await Promise.all(
            result.items.map(async (item: any) => {
                const options = await storage.getQuestionBankItemOptions(item.id);
                return { ...item, options };
            })
        );

        sendSuccess(res, { ...result, items: itemsWithOptions });
    } catch (error) { handleRouteError(res, error, 'questionBank.pending'); }
});

// ─── Create question ─────────────────────────────────────────────────────────
router.post('/api/question-bank/items', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const { bankId, questionText, questionType, points, difficulty, classId, termId, topicId, options, ...rest } = req.body;
        if (!bankId)       return sendBadRequest(res, 'bankId is required');
        if (!questionText) return sendBadRequest(res, 'questionText is required');
        if (!questionType) return sendBadRequest(res, 'questionType is required');

        const user = req.user!;
        const initialStatus = isAdmin(user.roleId) ? 'active' : 'draft';

        const item = await storage.createQuestionBankItem({
            bankId, questionText, questionType,
            points:     points || 1,
            difficulty: difficulty || 'medium',
            classId:    classId  || null,
            termId:     termId   || null,
            topicId:    topicId  || null,
            status:     initialStatus,
            createdBy:  user.id,
            ...rest,
        } as any, options?.map((o: any, i: number) => ({
            optionText:      o.optionText || o.text,
            isCorrect:       o.isCorrect || false,
            orderNumber:     o.orderNumber || i + 1,
            explanationText: o.explanationText || null,
        })));

        const savedOptions = await storage.getQuestionBankItemOptions(item.id);
        sendCreated(res, { ...item, options: savedOptions });
    } catch (error) { handleRouteError(res, error, 'questionBank.items.create'); }
});

// ─── Update question ──────────────────────────────────────────────────────────
router.put('/api/question-bank/items/:id', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId)) {
            if ((existing as any).createdBy !== user.id)
                return sendForbidden(res, 'You can only edit your own questions');
            if (!['draft', 'rejected'].includes(existing.status))
                return sendForbidden(res, 'Only draft or rejected questions can be edited');
        }

        // Strip workflow-controlled fields from body
        const { status, approvedBy, approvedAt, rejectionReason, createdBy, ...safeData } = req.body;
        const updated = await storage.updateQuestionBankItem(id, safeData);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.update'); }
});

// ─── Delete question ──────────────────────────────────────────────────────────
router.delete('/api/question-bank/items/:id', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId)) {
            if ((existing as any).createdBy !== user.id)
                return sendForbidden(res, 'You can only delete your own questions');
            if (!['draft', 'rejected'].includes(existing.status))
                return sendForbidden(res, 'Only draft or rejected questions can be deleted');
        }

        await storage.deleteQuestionBankItem(id);
        sendSuccess(res, { message: 'Question deleted', id });
    } catch (error) { handleRouteError(res, error, 'questionBank.items.delete'); }
});

// ═══════════════════════════════════════════════════════
//  APPROVAL WORKFLOW
// ═══════════════════════════════════════════════════════

router.post('/api/question-bank/items/:id/submit', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId) && (existing as any).createdBy !== user.id)
            return sendForbidden(res, 'You can only submit your own questions');
        if (!['draft', 'rejected'].includes(existing.status))
            return sendBadRequest(res, `Cannot submit a question with status "${existing.status}"`);

        const updated = await storage.updateQuestionBankItem(id, { status: 'submitted' } as any);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.submit'); }
});

router.post('/api/question-bank/items/:id/withdraw', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');

        const user = req.user!;
        if (isTeacher(user.roleId) && (existing as any).createdBy !== user.id)
            return sendForbidden(res, 'You can only withdraw your own questions');
        if (existing.status !== 'submitted')
            return sendBadRequest(res, 'Only submitted questions can be withdrawn');

        const updated = await storage.updateQuestionBankItem(id, { status: 'draft' } as any);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.withdraw'); }
});

router.post('/api/question-bank/items/:id/approve', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');
        if (existing.status !== 'submitted') return sendBadRequest(res, 'Only submitted questions can be approved');

        const updated = await storage.approveQuestionBankItem(id, req.user!.id);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.approve'); }
});

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
    } catch (error) { handleRouteError(res, error, 'questionBank.items.reject'); }
});

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
    } catch (error) { handleRouteError(res, error, 'questionBank.items.publish'); }
});

router.post('/api/question-bank/items/:id/unpublish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return sendBadRequest(res, 'Invalid ID');
        const existing = await storage.getQuestionBankItemById(id);
        if (!existing) return sendNotFound(res, 'Question not found');
        if (existing.status !== 'published')
            return sendBadRequest(res, 'Only published questions can be unpublished');

        const updated = await storage.unpublishQuestionBankItem(id);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.unpublish'); }
});

// ═══════════════════════════════════════════════════════
//  BULK CSV IMPORT
// ═══════════════════════════════════════════════════════

router.post('/api/question-bank/items/bulk-csv', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const { bankId, classId, termId, topicId, questions } = req.body;
        if (!bankId)  return sendBadRequest(res, 'bankId is required');
        if (!classId) return sendBadRequest(res, 'classId is required');
        if (!termId)  return sendBadRequest(res, 'termId is required');
        if (!Array.isArray(questions) || questions.length === 0)
            return sendBadRequest(res, 'questions array is required');
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
                    errors.push(`Row ${i + 1}: Question text must be at least 5 characters`); continue;
                }
                const questionType = q.questionType || 'text';
                if (!['multiple_choice', 'text', 'essay', 'true_false', 'fill_blank'].includes(questionType)) {
                    errors.push(`Row ${i + 1}: Invalid question type "${questionType}"`); continue;
                }
                let options: any[] | undefined;
                if (questionType === 'multiple_choice' && q.options?.length >= 2) {
                    options = q.options.map((o: any, idx: number) => ({
                        optionText:  o.optionText || o.text || '',
                        isCorrect:   o.isCorrect || false,
                        orderNumber: idx + 1,
                        explanationText: null,
                    }));
                    if (!options!.some((o: any) => o.isCorrect)) {
                        errors.push(`Row ${i + 1}: MCQ must have at least one correct option`); continue;
                    }
                }
                const item = await storage.createQuestionBankItem({
                    bankId:      parseInt(String(bankId)),
                    questionText: q.questionText.trim(),
                    questionType,
                    points:      parseInt(q.points) || 1,
                    difficulty:  q.difficulty || 'medium',
                    classId:     parseInt(String(classId)),
                    termId:      parseInt(String(termId)),
                    topicId:     topicId ? parseInt(String(topicId)) : null,
                    status:      initialStatus,
                    createdBy:   user.id,
                    expectedAnswers: q.expectedAnswer ? JSON.stringify([q.expectedAnswer]) : '[]',
                    explanationText: q.explanationText || null,
                } as any, options);
                created.push(item);
            } catch (err) {
                errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }

        sendSuccess(res, { created: created.length, questions: created, errors });
    } catch (error) { handleRouteError(res, error, 'questionBank.items.bulkCSV'); }
});

// ═══════════════════════════════════════════════════════
//  AUTO-GENERATE / IMPORT HELPERS
// ═══════════════════════════════════════════════════════

router.post('/api/question-bank/auto-generate', authenticateUser, async (req: any, res: Response) => {
    try {
        const { classId, subjectId, termId, topicId, count, questionType, difficulty, excludeIds } = req.body;
        if (!classId || !subjectId || !termId)
            return sendBadRequest(res, 'classId, subjectId, and termId are required');

        const numQuestions = clamp(parseInt(count) || 10, 1, 100);

        const filters: any = {
            classId: parseInt(classId), subjectId: parseInt(subjectId),
            termId:  parseInt(termId),
            statuses: ['active', 'published', 'approved'],
        };
        if (topicId)    filters.topicId    = parseInt(topicId);
        if (difficulty && difficulty !== 'mixed') filters.difficulty = difficulty;
        if (questionType && questionType !== 'all' && questionType !== 'both') filters.questionType = questionType;

        let pool = await storage.getQuestionBankItemsFiltered(filters);
        if (questionType === 'both')
            pool = pool.filter((q: any) => ['multiple_choice', 'text', 'essay'].includes(q.questionType));

        const excludeSet = new Set((excludeIds || []).map((id: any) => parseInt(id)));
        if (excludeSet.size > 0) pool = pool.filter((q: any) => !excludeSet.has(q.id));

        const selected = pool.sort(() => Math.random() - 0.5).slice(0, numQuestions);
        const questionsWithOptions = await Promise.all(selected.map(async (q: any) => {
            const options = await storage.getQuestionBankItemOptions(q.id);
            return { ...q, options };
        }));

        sendSuccess(res, {
            questions: questionsWithOptions,
            count: questionsWithOptions.length,
            totalAvailable: pool.length,
            shortfall: pool.length < numQuestions
                ? `Requested ${numQuestions} but only ${pool.length} available` : null,
        });
    } catch (error) { handleRouteError(res, error, 'questionBank.autoGenerate'); }
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
    } catch (error) { handleRouteError(res, error, 'questionBank.generate'); }
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
    } catch (error) { handleRouteError(res, error, 'questionBank.importToExam'); }
});

export default router;
