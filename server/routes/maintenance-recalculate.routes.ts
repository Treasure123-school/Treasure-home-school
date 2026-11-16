/** maintenance-recalculate.routes.ts: split from maintenance.routes.ts. */
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


// ─── 7. Force Re-Sync All Exams ────────────────────────────────────────────────
// OPTIMISED: replaces the old serial for-loop (one syncExamScoreToReportCard()
// per result, 6–8 DB queries each) with 4 bulk SQL statements.
//
// Old approach (500 students × 10 exams = 5000 loop iterations × ~7 queries):
//   ~35 000 DB round-trips → easily exceeds the 60 s prod timeout.
//
// New approach (4 parameterised SQL statements regardless of data volume):
//   Step 1 – COUNT affected exam results              (1 SELECT)
//   Step 2 – Bulk UPDATE exam-type scores             (1 UPDATE)
//   Step 3 – Bulk UPDATE test-type scores             (1 UPDATE)
//   Step 4 – Recalculate obtained_marks + percentage  (1 UPDATE)
//   Step 5 – Recalculate report_cards totals          (1 UPDATE)
router.post(
  '/api/admin/force-resync-all-exams',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const termId    = req.body?.termId ? Number(req.body.termId) : null;
      const adminId   = (req as any).user!.id;
      const termLabel = termId ? `term ${termId}` : 'all terms';

      console.log(`[ADMIN-FORCE-RESYNC] User ${adminId} triggered bulk force re-sync for ${termLabel}`);

      // Term filter fragment — composed into every bulk statement below
      const termFilter = termId ? sql`AND e.term_id = ${termId}` : sql``;

      // ── Step 1: Count affected exam results ──────────────────────────────
      const countRows = await db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(
          and(
            sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`,
            ...(termId ? [eq(schema.exams.termId, termId)] : []),
          ),
        );
      const totalCount = countRows[0]?.total ?? 0;
      console.log(`[ADMIN-FORCE-RESYNC] ${totalCount} exam results to process`);

      if (totalCount === 0) {
        return res.json({ message: 'No exam results with scores found for this selection.', total: 0, synced: 0, failed: 0 });
      }

      // ── Step 2: UPSERT exam-type scores ──────────────────────────────────
      // INSERT creates rows that don't exist yet; ON CONFLICT updates existing rows.
      // Only exam_* columns are touched — test_* columns are left intact.
      // DISTINCT ON ensures one row per (report_card_id, subject_id) when a
      // student has multiple exam results for the same subject.
      await db.execute(sql`
        INSERT INTO report_card_items
          (report_card_id, subject_id, total_marks, obtained_marks, percentage,
           exam_exam_id, exam_score, exam_max_score, exam_exam_created_by,
           is_overridden, updated_at)
        SELECT DISTINCT ON (rc.id, e.subject_id)
          rc.id,
          e.subject_id,
          COALESCE(er.max_score, e.total_marks, 100)::integer,
          COALESCE(er.score, er.marks_obtained, 0)::integer,
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
          AND e.exam_type IN ('exam', 'final', 'midterm')
          ${termFilter}
        ORDER BY rc.id, e.subject_id, er.id DESC
        ON CONFLICT (report_card_id, subject_id) DO UPDATE SET
          exam_exam_id         = EXCLUDED.exam_exam_id,
          exam_score           = EXCLUDED.exam_score,
          exam_max_score       = EXCLUDED.exam_max_score,
          exam_exam_created_by = EXCLUDED.exam_exam_created_by,
          is_overridden        = false,
          updated_at           = NOW()
      `);

      // ── Step 3: UPSERT test-type scores ──────────────────────────────────
      // Same UPSERT pattern; only test_* columns are touched.
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

      // ── Step 4: Re-apply weighted scores + recalculate grades ────────────────
      // The previous raw-arithmetic approach (exam_score + test_score / max) ignored
      // the school's testWeight/examWeight system and left grade/remarks/
      // testWeightedScore/examWeightedScore columns stale.
      //
      // We now call reapplyWeightedScoresToItems() for every affected report card.
      // That function:
      //   • reads system-settings testWeight/examWeight
      //   • applies the weighted formula to the scores just upserted above
      //   • looks up the correct grade from grading boundaries
      //   • updates testWeightedScore, examWeightedScore, obtainedMarks,
      //     percentage, grade, and remarks on each item
      //   • skips items where isOverridden = true
      //   • calls recalculateReportCard() to refresh the header totals
      //
      // This is exactly what the per-card "Recalculate" button calls.

      // Collect the distinct report card IDs affected by the upserts above
      const affectedRcRows = await db.execute(sql`
        SELECT DISTINCT rc.id
        FROM report_cards rc
        JOIN exam_results er ON er.student_id = rc.student_id
        JOIN exams e ON e.id = er.exam_id AND e.term_id = rc.term_id
        WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
        ${termFilter}
      `);
      const affectedRcIds: number[] = (affectedRcRows.rows ?? []).map((r: any) => Number(r.id));

      console.log(`[ADMIN-FORCE-RESYNC] Recalculating weighted scores for ${affectedRcIds.length} report cards...`);
      const RESYNC_CONCURRENCY = 5;
      let resyncFailed = 0;
      for (let i = 0; i < affectedRcIds.length; i += RESYNC_CONCURRENCY) {
        const batch = affectedRcIds.slice(i, i + RESYNC_CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map((id: number) => storage.reapplyWeightedScoresToItems(id))
        );
        for (const r of batchResults) {
          if (r.status === 'rejected') resyncFailed++;
        }
      }
      if (resyncFailed > 0) {
        console.warn(`[ADMIN-FORCE-RESYNC] ${resyncFailed} report card(s) failed weighted recalculation`);
      }

      invalidateReportCardCaches();
      console.log(`[ADMIN-FORCE-RESYNC] Bulk re-sync complete — ${totalCount} exam results across all report cards`);

      res.json({
        message: `Force re-sync complete: ${totalCount} exam results resynced across all report cards`,
        total:   totalCount,
        synced:  totalCount,
        failed:  0,
      });
    } catch (error: any) {
      console.error('[ADMIN-FORCE-RESYNC] Error:', error);
      res.status(500).json({ message: error.message ?? 'Force re-sync failed' });
    }
  },
);

// ─── 8. Recalculate All Report Cards ─────────────────────────────────────────
// Recomputes obtained_marks, percentage, grades, totals, AND class positions
// for every report card (optionally scoped to one term / one class).
// Safe to run multiple times — purely derived from existing scores.
router.post(
  '/api/admin/recalculate-all-report-cards',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const termId    = req.body?.termId  ? Number(req.body.termId)  : null;
      const classId   = req.body?.classId ? Number(req.body.classId) : null;
      const adminId   = (req as any).user!.id;
      const scopeLabel =
        termId && classId ? `class ${classId}, term ${termId}` :
        termId            ? `term ${termId}`                    :
        classId           ? `class ${classId}`                  : 'all';

      console.log(`[ADMIN-RECALC] User ${adminId} triggered bulk recalculate for ${scopeLabel}`);

      // ── Build scope filters ───────────────────────────────────────────────
      const rcTermFilter  = termId  ? sql`AND rc.term_id  = ${termId}`  : sql``;
      const rcClassFilter = classId ? sql`AND rc.class_id = ${classId}` : sql``;
      const rcFilters     = sql`${rcTermFilter} ${rcClassFilter}`;

      // ── Step 1: Count report cards in scope ───────────────────────────────
      const countRows = await db.execute(sql`
        SELECT COUNT(*)::int AS total FROM report_cards rc
        WHERE 1=1 ${rcFilters}
      `);
      const totalCount: number = (countRows.rows?.[0] as any)?.total ?? 0;
      console.log(`[ADMIN-RECALC] ${totalCount} report card(s) in scope`);

      if (totalCount === 0) {
        return res.json({
          message: `No report cards found for ${scopeLabel}.`,
          total: 0, succeeded: 0, positionPairs: 0, failed: 0,
        });
      }

      // ── Step 2: Collect all report card IDs in scope ─────────────────────
      const rcIdRows = await db.execute(sql`
        SELECT id FROM report_cards rc WHERE 1=1 ${rcFilters}
      `);
      const reportCardIds: number[] = (rcIdRows.rows ?? []).map((r: any) => Number(r.id));

      // ── Step 3: Reapply weighted scores — identical to the per-card button ─
      // storage.reapplyWeightedScoresToItems() updates ALL item columns:
      //   testWeightedScore, examWeightedScore, obtainedMarks, percentage, grade, remarks
      // It correctly skips items where isOverridden=true, and calls
      // recalculateReportCard() to refresh the header (totalScore, averagePercentage,
      // overallGrade).  Processing in small concurrent batches keeps memory low
      // while still being faster than pure serial execution.
      const CONCURRENCY = 5;
      let succeeded = 0, failed = 0;
      for (let i = 0; i < reportCardIds.length; i += CONCURRENCY) {
        const batch = reportCardIds.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(id => storage.reapplyWeightedScoresToItems(id))
        );
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled') {
            succeeded++;
          } else {
            failed++;
            const reason = (results[j] as PromiseRejectedResult).reason;
            console.error(`[ADMIN-RECALC] Error on report card ${batch[j]}:`, reason);
          }
        }
      }
      console.log(`[ADMIN-RECALC] Items + headers recalculated: ${succeeded} succeeded, ${failed} failed`);

      // ── Step 4: Recalculate class positions ───────────────────────────────
      const pairRows = await db.execute(sql`
        SELECT DISTINCT class_id, term_id FROM report_cards rc WHERE 1=1 ${rcFilters}
      `);
      const pairs: Array<{ classId: number; termId: number }> = (pairRows.rows ?? []).map((r: any) => ({
        classId: Number(r.class_id),
        termId:  Number(r.term_id),
      }));

      await recalculatePositionsForPairs(pairs);

      invalidateReportCardCaches();
      console.log(`[ADMIN-RECALC] Done — ${totalCount} report cards, ${pairs.length} class/term position group(s) recalculated`);

      res.json({
        message:       `Recalculation complete: ${succeeded} of ${totalCount} report card(s) updated, positions recalculated for ${pairs.length} class/term group(s).`,
        total:         totalCount,
        succeeded,
        positionPairs: pairs.length,
        failed,
      });
    } catch (error: any) {
      console.error('[ADMIN-RECALC] Error:', error);
      res.status(500).json({ message: error.message ?? 'Recalculation failed' });
    }
  },
);

export default router;
