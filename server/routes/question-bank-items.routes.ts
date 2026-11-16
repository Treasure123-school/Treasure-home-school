/** Question bank items: list, pending, create, update, delete, submit/withdraw/approve/reject/publish/unpublish — split from question-bank.routes.ts. */
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

const ADMIN_ROLES  = [ROLES.ADMIN];
const STAFF_ROLES  = [ROLES.ADMIN, ROLES.TEACHER];

const isAdmin   = (roleId: number) => (ADMIN_ROLES as readonly number[]).includes(roleId);
const isTeacher = (roleId: number) => roleId === ROLES.TEACHER;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Resolves term name filter to array of term names for cross-session filtering
 * @param raw - 'all', 'first', 'second', 'third' (case-insensitive) or undefined
 * @returns Array of term names ['First Term'], ['Second Term'], ['Third Term'], or undefined (all terms)
 */
function resolveTermNames(raw?: string): string[] | undefined {
    if (!raw || raw.toLowerCase() === 'all') return undefined;
    const normalized = raw.toLowerCase();
    if (normalized === 'first')  return ['First Term'];
    if (normalized === 'second') return ['Second Term'];
    if (normalized === 'third')  return ['Third Term'];
    return undefined;
}

// ═══════════════════════════════════════════════════════
//  QUESTION ITEMS — PAGINATED, FILTERED
//
//  REQUIRED: bankId + classId + termId must be supplied.
//  This prevents full-table scans and unbounded payloads.
// ═══════════════════════════════════════════════════════

router.get('/api/question-bank/items', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const bankId   = parseIntParam(req.query.bankId as string);
        const classId  = parseIntParam(req.query.classId as string);
        const termId   = parseIntParam(req.query.termId as string);
        const termName = req.query.termName as string | undefined;
        const myOnly   = req.query.myOnly === 'true';
        const user     = req.user!;

        // bankId is required unless teacher is fetching their own questions
        if (!myOnly && !bankId) return sendBadRequest(res, 'bankId is required');
        if (!classId)           return sendBadRequest(res, 'classId is required');
        // termId is optional for both paths — when absent, results span all terms

        const page     = clamp(parseInt((req.query.page as string) || '1', 10) || 1, 1, 9999);
        const pageSize = clamp(parseInt((req.query.pageSize as string) || '20', 10) || 20, 1, 100);
        const fetchAll = req.query.fetchAll === 'true';

        const topicId      = parseIntParam(req.query.topicId as string) ?? undefined;
        const difficulty   = (req.query.difficulty as string) || undefined;
        const questionType = (req.query.questionType as string) || undefined;
        const statusFilter = (req.query.status as string) || undefined;
        
        // Cross-session term filtering by name
        const termNames = resolveTermNames(termName);

        // ── "My Questions" path (teacher / admin fetching own questions) ──
        // classId + termId scoped, no bankId required — bounded result set
        if (myOnly) {
            const createdBy = user.id;
            const allFilters: any = {
                classId, termId, createdBy, topicId, difficulty, questionType,
            };
            if (termNames) allFilters.termNames = termNames;
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

        // ── fetchAll path — used by import/search modals; bypasses pagination ──
        if (fetchAll) {
            const allFilters: Parameters<typeof storage.getQuestionBankItemsFiltered>[0] = {
                bankId: bankId!, classId, termId, topicId, difficulty, questionType,
            };
            if (termNames) allFilters.termNames = termNames;
            if (isAdmin(user.roleId)) {
                if (statusFilter) allFilters.status = statusFilter;
            } else if (isTeacher(user.roleId)) {
                allFilters.statuses = ['published', 'active', 'approved'];
            }
            const allItems = await storage.getQuestionBankItemsFiltered(allFilters);
            const itemsWithOptions = await Promise.all(
                allItems.map(async (item: any) => {
                    const options = await storage.getQuestionBankItemOptions(item.id);
                    return { ...item, options };
                })
            );
            return sendSuccess(res, {
                items: itemsWithOptions, total: allItems.length,
                page: 1, pageSize: allItems.length, totalPages: 1,
            });
        }

        // ── Standard bank browse path ──
        const filters: Parameters<typeof storage.getQuestionBankItemsPaginated>[0] = {
            bankId: bankId!, classId, termId, page, pageSize,
            topicId, difficulty, questionType,
        };
        if (termNames) filters.termNames = termNames;

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
        // Admins: directly published (no manual publish step needed)
        // Teachers: active (immediately usable in exam imports without draft/submit workflow)
        const initialStatus = isAdmin(user.roleId) ? 'published' : 'active';

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
        // Idempotent: already published → return as-is without error
        if (existing.status === 'published') return sendSuccess(res, existing);
        if (!['approved', 'active'].includes(existing.status))
            return sendBadRequest(res, 'Only approved or active questions can be published');

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
        // Idempotent: already unpublished (active/approved/draft) → return as-is without error
        if (existing.status !== 'published') return sendSuccess(res, existing);

        const updated = await storage.unpublishQuestionBankItem(id);
        sendSuccess(res, updated);
    } catch (error) { handleRouteError(res, error, 'questionBank.items.unpublish'); }
});

export default router;
