/** Syllabus topics endpoints — split from question-bank.routes.ts. */
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

/**
 * POST /api/syllabus-topics/repair-ordering
 * Admin-only. Repairs week_number and order_number for ALL syllabus topics so
 * that every term starts at 1 and numbers are sequential with no gaps.
 *
 * Strategy:
 *  1. Load curriculum templates and index their topics by (normalised class name
 *     + subject name + term).  weekNumber from the template is the sort key that
 *     reflects the correct curriculum sequence — orderNumber in the template is a
 *     historical global cross-term index and is intentionally IGNORED here.
 *  2. For each class × subject × term group in syllabus_topics, look up each
 *     topic's position by name-matching against the template.
 *  3. Sort matched topics by their template position; unmatched topics go last
 *     (sorted by insertion id).
 *  4. Assign week_number = order_number = sequential 1-based position.
 *
 * Safe to run multiple times — idempotent.
 */
router.post('/api/syllabus-topics/repair-ordering', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (_req: any, res: Response) => {
    try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        // Normalise class name so 'SSS 1' matches template 'SS 1', etc.
        const normClass = (n: string) => n.trim().replace(/^SSS\s+/i, 'SS ').toLowerCase();
        const normSubj  = (n: string) => n.trim().toLowerCase();
        const normTerm  = (n: string) => n.toLowerCase().includes('first')  ? 'first'
                                       : n.toLowerCase().includes('second') ? 'second'
                                       : n.toLowerCase().includes('third')  ? 'third'
                                       : null;

        // ── Step 1: Build template position lookup ──────────────────────────
        const tplRows = await pool.query<{ id: number; class_name: string; subject_name: string }>(
            'SELECT id, class_name, subject_name FROM curriculum_templates'
        );

        // key: 'ss 1::chemistry' → { first: [{name, pos}], second:…, third:… }
        const tplMap: Record<string, Record<string, Array<{ name: string; pos: number }>>> = {};

        for (const tpl of tplRows.rows) {
            const key = normClass(tpl.class_name) + '::' + normSubj(tpl.subject_name);
            if (tplMap[key]) continue; // keep first match for duplicate templates

            const topics = await pool.query<{ term: string; week_number: number; name: string }>(
                'SELECT term, week_number, name FROM curriculum_template_topics WHERE template_id=$1 ORDER BY term, week_number, id',
                [tpl.id]
            );

            const byTerm: Record<string, Array<{ name: string; pos: number }>> = { first: [], second: [], third: [] };
            const termCounters: Record<string, number> = { first: 0, second: 0, third: 0 };
            for (const t of topics.rows) {
                if (byTerm[t.term]) {
                    termCounters[t.term]++;
                    byTerm[t.term].push({ name: t.name.toLowerCase().trim(), pos: termCounters[t.term] });
                }
            }
            tplMap[key] = byTerm;
        }

        // ── Step 2: Fetch all syllabus group metadata ────────────────────────
        const groups = await pool.query<{
            class_id: number; subject_id: number; term_id: number;
            class_name: string; subject_name: string; term_name: string;
        }>(`
            SELECT st.class_id, st.subject_id, st.term_id,
                   c.name as class_name, s.name as subject_name, at.name as term_name
            FROM syllabus_topics st
            JOIN classes c ON st.class_id = c.id
            JOIN subjects s ON st.subject_id = s.id
            JOIN academic_terms at ON st.term_id = at.id
            GROUP BY st.class_id, st.subject_id, st.term_id, c.name, s.name, at.name
        `);

        let repaired = 0;
        let noMatch  = 0;

        for (const grp of groups.rows) {
            const termKey = normTerm(grp.term_name);
            const lookupKey = normClass(grp.class_name) + '::' + normSubj(grp.subject_name);
            const tplTopics = termKey && tplMap[lookupKey] ? tplMap[lookupKey][termKey] ?? [] : [];

            // name → 1-based template position
            const nameToPos: Record<string, number> = {};
            for (const t of tplTopics) nameToPos[t.name] = t.pos;

            if (tplTopics.length === 0) noMatch++;

            // Fetch this group's topics
            const topics = await pool.query<{ id: number; name: string; week_number: number; order_number: number }>(
                'SELECT id, name, week_number, order_number FROM syllabus_topics WHERE class_id=$1 AND subject_id=$2 AND term_id=$3 ORDER BY id',
                [grp.class_id, grp.subject_id, grp.term_id]
            );

            // Sort: template-matched by position first, unknowns by id at the end
            const sorted = [...topics.rows].sort((a, b) => {
                const pA = nameToPos[a.name.toLowerCase().trim()];
                const pB = nameToPos[b.name.toLowerCase().trim()];
                if (pA !== undefined && pB !== undefined) return pA - pB;
                if (pA !== undefined) return -1;
                if (pB !== undefined) return 1;
                return a.id - b.id;
            });

            // Assign sequential week_number = order_number = 1-based position
            for (let i = 0; i < sorted.length; i++) {
                const topic = sorted[i];
                const pos   = i + 1;
                if (topic.week_number !== pos || topic.order_number !== pos) {
                    await pool.query(
                        'UPDATE syllabus_topics SET week_number=$1, order_number=$2, updated_at=NOW() WHERE id=$3',
                        [pos, pos, topic.id]
                    );
                    repaired++;
                }
            }
        }

        await pool.end();

        sendSuccess(res, {
            message: `Ordering repaired. ${repaired} topic(s) updated across ${groups.rows.length} group(s). ${noMatch} group(s) had no template match (sorted by insertion order).`,
            repaired,
            groups: groups.rows.length,
            noTemplateMatch: noMatch,
        });
    } catch (error) { handleRouteError(res, error, 'syllabusTopics.repairOrdering'); }
});

export default router;
