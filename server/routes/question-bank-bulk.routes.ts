/** Bulk publish/unpublish/clear + CSV import + auto-generate/generate/import-to-exam — split from question-bank.routes.ts. */
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

// ─── Bulk publish all questions in a bank ─────────────────────────────────────
router.post('/api/question-banks/:bankId/bulk-publish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const bankId = parseInt(req.params.bankId);
        if (isNaN(bankId)) return sendBadRequest(res, 'Invalid bank ID');
        const count = await storage.bulkPublishQuestionBankItems(bankId);
        sendSuccess(res, { published: count, message: `${count} question${count !== 1 ? 's' : ''} published.` });
    } catch (error) { handleRouteError(res, error, 'questionBank.banks.bulkPublish'); }
});

// ─── Delete all questions in a bank (keeps the bank record) ──────────────────
router.delete('/api/question-banks/:bankId/questions', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const bankId = parseInt(req.params.bankId);
        if (isNaN(bankId)) return sendBadRequest(res, 'Invalid bank ID');
        const existing = await storage.getQuestionBankById(bankId);
        if (!existing) return sendNotFound(res, 'Question bank not found');
        const count = await storage.deleteAllQuestionBankItems(bankId);
        sendSuccess(res, { deleted: count, message: `${count} question${count !== 1 ? 's' : ''} deleted.` });
    } catch (error) { handleRouteError(res, error, 'questionBank.banks.deleteAllQuestions'); }
});

// ─── Bulk unpublish all questions in a bank ────────────────────────────────────
router.post('/api/question-banks/:bankId/bulk-unpublish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: any, res: Response) => {
    try {
        const bankId = parseInt(req.params.bankId);
        if (isNaN(bankId)) return sendBadRequest(res, 'Invalid bank ID');
        const count = await storage.bulkUnpublishQuestionBankItems(bankId);
        sendSuccess(res, { unpublished: count, message: `${count} question${count !== 1 ? 's' : ''} unpublished.` });
    } catch (error) { handleRouteError(res, error, 'questionBank.banks.bulkUnpublish'); }
});

// ═══════════════════════════════════════════════════════
//  BULK CSV IMPORT
// ═══════════════════════════════════════════════════════

router.post('/api/question-bank/items/bulk-csv', authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: any, res: Response) => {
    try {
        const { bankId, classId, termId, topicId, questions } = req.body;
        if (!bankId)  return sendBadRequest(res, 'bankId is required');
        if (!classId) return sendBadRequest(res, 'classId is required');
        // termId is now optional — allows creating global/cross-term banks
        if (!Array.isArray(questions) || questions.length === 0)
            return sendBadRequest(res, 'questions array is required');
        if (questions.length > 200)
            return sendBadRequest(res, 'Maximum 200 questions per upload');

        const user = req.user!;
        // Admins: directly published; Teachers: active (visible for exam use immediately)
        const initialStatus = isAdmin(user.roleId) ? 'published' : 'active';
        const created: any[] = [];
        const errors: string[] = [];

        for (let i = 0; i < questions.length; i++) {
            try {
                const q = questions[i];
                if (!q.questionText || q.questionText.trim().length < 5) {
                    errors.push(`Row ${i + 1}: Question text must be at least 5 characters`); continue;
                }
                const questionType = q.questionType || 'essay';
                if (!['multiple_choice', 'essay'].includes(questionType)) {
                    errors.push(`Row ${i + 1}: Invalid question type "${questionType}". Please use 'multiple_choice' or 'essay'.`); continue;
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
                    termId:      termId ? parseInt(String(termId)) : null,
                    topicId:     topicId ? parseInt(String(topicId)) : null,
                    status:      initialStatus,
                    createdBy:   user.id,
                    expectedAnswers: q.expectedAnswer ? JSON.stringify([q.expectedAnswer]) : '[]',
                    explanationText: q.explanationText || null,
                } as any, options);
                // Fetch saved options so the response includes them — without this,
                // the frontend cache write has no options array and MCQ options are
                // invisible until a manual page refresh.
                const savedOptions = await storage.getQuestionBankItemOptions(item.id);
                created.push({ ...item, options: savedOptions || [] });
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
            pool = pool.filter((q: any) => ['multiple_choice', 'essay'].includes(q.questionType));

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
