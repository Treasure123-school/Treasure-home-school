/** Question bank CRUD (stats, list, get, create, update, delete) — split from question-bank.routes.ts. */
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
        const termName  = req.query.termName as string | undefined;

        // Require at least classId to prevent unbounded queries returning all banks
        if (!classId && !subjectId) {
            return sendBadRequest(res, 'classId or subjectId is required to filter question banks');
        }

        const filters: { subjectId?: number; classId?: number; termId?: number; termNames?: string[] } = {};
        if (classId)   filters.classId   = classId;
        if (subjectId) filters.subjectId = subjectId;
        if (termId)    filters.termId    = termId;
        
        // Cross-session term filtering by name
        const termNames = resolveTermNames(termName);
        if (termNames) filters.termNames = termNames;

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

export default router;
