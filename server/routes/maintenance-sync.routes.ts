/** maintenance-sync.routes.ts: split from maintenance.routes.ts. */
import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { storage, db } from '../storage';
import * as schema from '@shared/schema.pg';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { enhancedCache } from '../enhanced-cache';
import { reliableSyncService } from '../services/reliable-sync-service';
import { getActiveGradingConfig } from '../grade-scale-service';
import { calculateGradeFromConfig } from '../grading-config';
import { recalculatePositionsForPairs, invalidateReportCardCaches } from './maintenance-shared';
const router = Router();


// ─── 4. Sync Missing Exam Scores ──────────────────────────────────────────────
// Fills blank score slots only — never overwrites existing scores or overrides.
router.post(
  '/api/admin/sync-all-missing-exam-scores',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { termId } = req.body;
      console.log(`[ADMIN-SYNC-MISSING] User ${(req as any).user!.id} triggered comprehensive exam score sync`);

      const result = await storage.syncAllMissingExamScores(termId ? Number(termId) : undefined);

      enhancedCache.invalidate(/^reportcard:/);
      console.log(`[ADMIN-SYNC-MISSING] Done: ${result.synced} synced, ${result.failed} failed`);

      res.json({
        message:     'Comprehensive exam score sync completed',
        synced:      result.synced,
        failed:      result.failed,
        errors:      result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
        totalErrors: result.errors.length,
      });
    } catch (error: any) {
      console.error('[ADMIN-SYNC-MISSING] Error:', error);
      res.status(500).json({ message: error.message ?? 'Failed to sync missing exam scores' });
    }
  },
);

// ─── 5. Sync Missing Test Scores ─────────────────────────────────────────────
// Fills NULL test_score slots from test-type (test/quiz/assignment) exam results.
// Never overwrites an existing test score or a manually-overridden row.
router.post(
  '/api/admin/sync-missing-test-scores',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const termId    = req.body?.termId ? Number(req.body.termId) : null;
      const adminId   = (req as any).user!.id;
      const termLabel = termId ? `term ${termId}` : 'all terms';

      console.log(`[ADMIN-SYNC-TEST] User ${adminId} triggered missing test-score sync for ${termLabel}`);

      const termFilter = termId ? sql`AND e.term_id = ${termId}` : sql``;

      // ── Step 1: Count fillable test slots ────────────────────────────────
      const countRows = await db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM report_card_items rci
        JOIN report_cards rc ON rc.id = rci.report_card_id
        JOIN exam_results er ON er.student_id = rc.student_id
        JOIN exams e ON e.id = er.exam_id
          AND e.subject_id = rci.subject_id
          AND e.term_id    = rc.term_id
        WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
          AND e.exam_type IN ('test', 'quiz', 'assignment')
          AND rci.test_score IS NULL
          AND COALESCE(rci.is_overridden, false) = false
          ${termFilter}
      `);
      const totalCount: number = (countRows.rows?.[0] as any)?.total ?? 0;
      console.log(`[ADMIN-SYNC-TEST] ${totalCount} NULL test-score slots to fill`);

      if (totalCount === 0) {
        return res.json({
          message: `No missing test scores found for ${termLabel}. All test-score slots are already filled.`,
          total: 0,
          synced: 0,
          failed: 0,
        });
      }

      // ── Step 2: Fill NULL test scores (DISTINCT ON keeps latest result) ──
      await db.execute(sql`
        UPDATE report_card_items rci
        SET
          test_exam_id         = subq.exam_id,
          test_score           = subq.score,
          test_max_score       = subq.max_score,
          test_exam_created_by = subq.created_by,
          updated_at           = NOW()
        FROM (
          SELECT DISTINCT ON (rc.id, e.subject_id)
            rc.id                                                    AS rc_id,
            e.subject_id,
            e.id                                                     AS exam_id,
            COALESCE(er.score, er.marks_obtained, 0)::integer        AS score,
            COALESCE(er.max_score, e.total_marks, 100)::integer      AS max_score,
            e.created_by
          FROM exam_results er
          JOIN exams e       ON e.id  = er.exam_id
          JOIN report_cards rc
            ON  rc.student_id = er.student_id
            AND rc.term_id    = e.term_id
          WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            AND e.exam_type IN ('test', 'quiz', 'assignment')
            ${termFilter}
          ORDER BY rc.id, e.subject_id, er.id DESC
        ) subq
        WHERE rci.report_card_id = subq.rc_id
          AND rci.subject_id     = subq.subject_id
          AND rci.test_score     IS NULL
          AND COALESCE(rci.is_overridden, false) = false
      `);

      // ── Step 3: Recalculate obtained_marks + percentage ──────────────────
      await db.execute(sql`
        UPDATE report_card_items rci
        SET
          obtained_marks = COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0),
          percentage     = CASE
            WHEN COALESCE(rci.exam_max_score, 0) + COALESCE(rci.test_max_score, 0) > 0
            THEN LEAST(100, ROUND(
              ( COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0) )::numeric
              / NULLIF(COALESCE(rci.exam_max_score, 0) + COALESCE(rci.test_max_score, 0), 0)
              * 100
            ))
            WHEN rci.total_marks > 0
            THEN LEAST(100, ROUND(
              ( COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0) )::numeric
              / rci.total_marks * 100
            ))
            ELSE 0
          END,
          updated_at = NOW()
        WHERE rci.test_score IS NOT NULL
          AND rci.report_card_id IN (
            SELECT DISTINCT rc2.id
            FROM report_cards rc2
            JOIN exam_results er ON er.student_id = rc2.student_id
            JOIN exams e ON e.id = er.exam_id
              AND e.term_id = rc2.term_id
              AND e.exam_type IN ('test', 'quiz', 'assignment')
            WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            ${termFilter}
          )
      `);

      // ── Step 4: Recalculate report_cards header totals ───────────────────
      await db.execute(sql`
        UPDATE report_cards rc
        SET
          total_score        = agg.total_obtained,
          average_score      = agg.avg_pct::integer,
          average_percentage = agg.avg_pct::integer,
          updated_at         = NOW()
        FROM (
          SELECT
            rci.report_card_id,
            COALESCE(SUM(rci.obtained_marks), 0)    AS total_obtained,
            COALESCE(ROUND(AVG(rci.percentage)), 0) AS avg_pct
          FROM report_card_items rci
          WHERE rci.report_card_id IN (
            SELECT DISTINCT rc2.id
            FROM report_cards rc2
            JOIN exam_results er ON er.student_id = rc2.student_id
            JOIN exams e ON e.id = er.exam_id
              AND e.term_id = rc2.term_id
              AND e.exam_type IN ('test', 'quiz', 'assignment')
            WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            ${termFilter}
          )
          GROUP BY rci.report_card_id
        ) agg
        WHERE rc.id = agg.report_card_id
      `);

      invalidateReportCardCaches();
      console.log(`[ADMIN-SYNC-TEST] Done — ${totalCount} test-score slot(s) filled for ${termLabel}`);

      res.json({
        message: `Test score sync complete: ${totalCount} slot(s) filled for ${termLabel}`,
        total:   totalCount,
        synced:  totalCount,
        failed:  0,
      });
    } catch (error: any) {
      console.error('[ADMIN-SYNC-TEST] Error:', error);
      res.status(500).json({ message: error.message ?? 'Test score sync failed' });
    }
  },
);

// ─── 6. Force Re-Sync Test Scores ────────────────────────────────────────────
// OVERWRITES all test_score values from test-type exam results.
// Use when "Sync Missing Test Scores" isn't enough (e.g. wrong values need reset).
router.post(
  '/api/admin/force-resync-test-scores',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const termId    = req.body?.termId ? Number(req.body.termId) : null;
      const adminId   = (req as any).user!.id;
      const termLabel = termId ? `term ${termId}` : 'all terms';

      console.log(`[ADMIN-FORCE-TEST] User ${adminId} triggered force test-score re-sync for ${termLabel}`);

      const termFilter = termId ? sql`AND e.term_id = ${termId}` : sql``;

      // ── Step 1: Count affected test results ──────────────────────────────
      const countRows = await db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(
          and(
            sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`,
            inArray(schema.exams.examType, ['test', 'quiz', 'assignment']),
            ...(termId ? [eq(schema.exams.termId, termId)] : []),
          ),
        );
      const totalCount = countRows[0]?.total ?? 0;
      console.log(`[ADMIN-FORCE-TEST] ${totalCount} test results to process`);

      if (totalCount === 0) {
        return res.json({
          message: `No test/quiz/assignment results found for ${termLabel}. Nothing to re-sync.`,
          total: 0,
          synced: 0,
          failed: 0,
        });
      }

      // ── Step 2: UPSERT test-type scores (overwrites existing) ────────────
      await db.execute(sql`
        INSERT INTO report_card_items
          (report_card_id, subject_id, total_marks, obtained_marks, percentage,
           test_exam_id, test_score, test_max_score, test_exam_created_by,
           is_overridden, updated_at)
        SELECT DISTINCT ON (rc.id, e.subject_id)
          rc.id,
          e.subject_id,
          COALESCE(er.max_score, e.total_marks, 100)::integer,
          0,
          0,
          e.id,
          COALESCE(er.score, er.marks_obtained, 0)::integer,
          COALESCE(er.max_score, e.total_marks, 100)::integer,
          e.created_by,
          false,
          NOW()
        FROM exam_results er
        JOIN exams e  ON e.id = er.exam_id
        JOIN report_cards rc
          ON  rc.student_id = er.student_id
          AND rc.term_id    = e.term_id
        WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
          AND e.exam_type IN ('test', 'quiz', 'assignment')
          ${termFilter}
        ORDER BY rc.id, e.subject_id, er.id DESC
        ON CONFLICT (report_card_id, subject_id) DO UPDATE SET
          test_exam_id         = EXCLUDED.test_exam_id,
          test_score           = EXCLUDED.test_score,
          test_max_score       = EXCLUDED.test_max_score,
          test_exam_created_by = EXCLUDED.test_exam_created_by,
          is_overridden        = false,
          updated_at           = NOW()
      `);

      // ── Step 3: Recalculate obtained_marks + percentage ──────────────────
      await db.execute(sql`
        UPDATE report_card_items rci
        SET
          obtained_marks = COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0),
          percentage     = CASE
            WHEN COALESCE(rci.exam_max_score, 0) + COALESCE(rci.test_max_score, 0) > 0
            THEN LEAST(100, ROUND(
              ( COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0) )::numeric
              / NULLIF(COALESCE(rci.exam_max_score, 0) + COALESCE(rci.test_max_score, 0), 0)
              * 100
            ))
            WHEN rci.total_marks > 0
            THEN LEAST(100, ROUND(
              ( COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0) )::numeric
              / rci.total_marks * 100
            ))
            ELSE 0
          END,
          updated_at = NOW()
        WHERE rci.report_card_id IN (
          SELECT DISTINCT rc.id
          FROM report_cards rc
          JOIN exam_results er ON er.student_id = rc.student_id
          JOIN exams e ON e.id = er.exam_id AND e.term_id = rc.term_id
          WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            AND e.exam_type IN ('test', 'quiz', 'assignment')
          ${termFilter}
        )
      `);

      // ── Step 4: Recalculate report_cards header totals ───────────────────
      await db.execute(sql`
        UPDATE report_cards rc
        SET
          total_score        = agg.total_obtained,
          average_score      = agg.avg_pct::integer,
          average_percentage = agg.avg_pct::integer,
          updated_at         = NOW()
        FROM (
          SELECT
            rci.report_card_id,
            COALESCE(SUM(rci.obtained_marks), 0)    AS total_obtained,
            COALESCE(ROUND(AVG(rci.percentage)), 0) AS avg_pct
          FROM report_card_items rci
          WHERE rci.report_card_id IN (
            SELECT DISTINCT rc2.id
            FROM report_cards rc2
            JOIN exam_results er ON er.student_id = rc2.student_id
            JOIN exams e ON e.id = er.exam_id AND e.term_id = rc2.term_id
            WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
              AND e.exam_type IN ('test', 'quiz', 'assignment')
            ${termFilter}
          )
          GROUP BY rci.report_card_id
        ) agg
        WHERE rc.id = agg.report_card_id
      `);

      invalidateReportCardCaches();
      console.log(`[ADMIN-FORCE-TEST] Force test re-sync complete — ${totalCount} results across all report cards`);

      res.json({
        message: `Force test re-sync complete: ${totalCount} test/quiz/assignment results resynced`,
        total:   totalCount,
        synced:  totalCount,
        failed:  0,
      });
    } catch (error: any) {
      console.error('[ADMIN-FORCE-TEST] Error:', error);
      res.status(500).json({ message: error.message ?? 'Force test re-sync failed' });
    }
  },
);

export default router;
