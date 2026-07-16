/**
 * Admin Report-Card Maintenance Routes
 *
 * Long-running admin operations: repair, sync, and generate report cards.
 * Extracted from routes.ts for modularity.
 *
 * KEY FIX: A per-router 8-minute timeout overrides the global 60 s production
 * limit so these bulk operations never 408 on large schools.
 *
 * KEY PERF FIX (force-resync): replaces the old serial N+1 loop
 * (one syncExamScoreToReportCard() call per student/exam — 6–8 DB queries each)
 * with 4 bulk SQL statements that update every affected row in one shot.
 *
 * Routes
 *   POST /api/admin/repair-profile-completion
 *   POST /api/admin/repair-report-cards
 *   POST /api/admin/report-cards/generate-missing
 *   POST /api/admin/sync-all-missing-exam-scores
 *   POST /api/admin/force-resync-all-exams
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { storage, db } from '../storage';
import * as schema from '@shared/schema.pg';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { enhancedCache } from '../enhanced-cache';

const router = Router();

// ─── Extended timeout for every route in this module ─────────────────────────
// These bulk operations can process thousands of students; they need minutes,
// not the global 60 s production cap.
const MAINTENANCE_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

router.use((_req, res, next) => {
  _req.setTimeout(MAINTENANCE_TIMEOUT_MS);
  res.setTimeout(MAINTENANCE_TIMEOUT_MS);
  next();
});

// ─── Shared cache invalidation ────────────────────────────────────────────────
function invalidateReportCardCaches(): void {
  enhancedCache.invalidate(/^reportcard:/);
  enhancedCache.invalidate(/^reportcards:/);
  enhancedCache.invalidate(/^report-card/);
  enhancedCache.invalidate(/^student-report/);
}

// ─── 1. Repair Profile Completion ─────────────────────────────────────────────
router.post(
  '/api/admin/repair-profile-completion',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const allStudentRows = await db
        .select({
          userId:                     schema.students.id,
          phone:                      schema.users.phone,
          address:                    schema.users.address,
          dateOfBirth:                schema.users.dateOfBirth,
          gender:                     schema.users.gender,
          profileImageUrl:            schema.users.profileImageUrl,
          profileCompleted:           schema.users.profileCompleted,
          profileCompletionPercentage: schema.users.profileCompletionPercentage,
          emergencyContact:           schema.students.emergencyContact,
          medicalInfo:                schema.students.medicalInfo,
        })
        .from(schema.students)
        .leftJoin(schema.users, eq(schema.students.id, schema.users.id));

      let repaired = 0;
      for (const row of allStudentRows) {
        const fields = [
          row.phone, row.address, row.dateOfBirth, row.gender,
          row.emergencyContact, row.medicalInfo, row.profileImageUrl,
        ];
        const filled = fields.filter(f => f !== null && f !== undefined && f !== '').length;
        const pct    = Math.round((filled / 7) * 100);
        const done   = pct === 100;
        if (row.profileCompletionPercentage !== pct || !!row.profileCompleted !== done) {
          await db.update(schema.users)
            .set({ profileCompletionPercentage: pct, profileCompleted: done })
            .where(eq(schema.users.id, row.userId));
          repaired++;
        }
      }

      res.json({
        message: `Profile completion repair done. ${repaired} of ${allStudentRows.length} student(s) updated.`,
        total: allStudentRows.length,
        repaired,
      });
    } catch (error: any) {
      console.error('[REPAIR-PROFILE] Error:', error);
      res.status(500).json({ message: 'Repair failed', error: error.message ?? 'Unknown' });
    }
  },
);

// ─── 2. Repair All Report Cards ───────────────────────────────────────────────
// Adds missing subjects to every existing report card and syncs exam scores.
// Delegates to addMissingSubjectsToReportCards which is already bulk-optimised.
router.post(
  '/api/admin/repair-report-cards',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      console.log('[ADMIN-REPAIR] Starting report card repair…');
      const result = await storage.repairAllReportCards();
      console.log(`[ADMIN-REPAIR] Done: ${result.itemsAdded} items added, ${result.examScoresSynced} scores synced`);
      invalidateReportCardCaches();
      res.json({
        message:          'Report card repair completed',
        studentsProcessed: result.studentsProcessed,
        itemsAdded:        result.itemsAdded,
        examScoresSynced:  result.examScoresSynced,
        errors:            result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
        totalErrors:       result.errors.length,
      });
    } catch (error: any) {
      console.error('[ADMIN-REPAIR] Error:', error);
      res.status(500).json({ message: error.message ?? 'Failed to repair report cards' });
    }
  },
);

// ─── 3. Generate Missing Report Cards ─────────────────────────────────────────
// Creates report cards only for students who have exam results but no card yet.
// Students who already have one are never touched.
router.post(
  '/api/admin/report-cards/generate-missing',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { classId, termId } = req.query;
      console.log('[AUTO-GEN] Generating missing report cards:', { classId, termId });

      const whereConditions = [
        ...(classId ? [eq(schema.exams.classId, Number(classId))] : []),
        ...(termId  ? [eq(schema.exams.termId,  Number(termId))]  : []),
      ];

      const examResults = await db
        .selectDistinct({
          studentId: schema.examResults.studentId,
          examId:    schema.examResults.examId,
          termId:    schema.exams.termId,
          classId:   schema.exams.classId,
          score:     schema.examResults.score,
          maxScore:  schema.examResults.maxScore,
        })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined as any);

      if (examResults.length === 0) {
        return res.json({
          message:     'No exam data found for this selection — nothing to generate.',
          created:     0,
          pairsChecked: 0,
          errors:      [],
        });
      }

      // Find student+term pairs that have no report card yet
      const distinctTermIds = Array.from(
        new Set(examResults.map(r => r.termId).filter((id): id is number => id != null))
      );
      const existingReportCards = distinctTermIds.length > 0
        ? await db
            .select({ studentId: schema.reportCards.studentId, termId: schema.reportCards.termId })
            .from(schema.reportCards)
            .where(inArray(schema.reportCards.termId, distinctTermIds))
        : [];

      const existingPairs  = new Set(existingReportCards.map(rc => `${rc.studentId}:${rc.termId}`));
      const missingResults = examResults.filter(r => !existingPairs.has(`${r.studentId}:${r.termId}`));

      if (missingResults.length === 0) {
        return res.json({
          message:     'No missing report cards — every student already has one for this selection.',
          created:     0,
          pairsChecked: 0,
          errors:      [],
        });
      }

      let created = 0;
      const errors: string[]        = [];
      const affectedPairs = new Set<string>();

      // Process in concurrent batches of 20 to avoid overwhelming the DB
      const BATCH = 20;
      for (let i = 0; i < missingResults.length; i += BATCH) {
        const batch = missingResults.slice(i, i + BATCH);
        await Promise.all(batch.map(async result => {
          affectedPairs.add(`${result.studentId}:${result.termId}`);
          try {
            const syncResult = await storage.syncExamScoreToReportCard(
              result.studentId,
              result.examId,
              result.score   ?? 0,
              result.maxScore ?? 100,
              false,
            );
            if (syncResult.isNewReportCard) created++;
          } catch (err: any) {
            errors.push(`Student ${result.studentId} exam ${result.examId}: ${err.message}`);
          }
        }));
      }

      invalidateReportCardCaches();
      console.log(`[AUTO-GEN] Done: ${created} new report card(s) for ${affectedPairs.size} student-term pair(s)`);

      res.json({
        message:     `${created} missing report card(s) generated for ${affectedPairs.size} student(s).`,
        created,
        pairsChecked: affectedPairs.size,
        errors:       errors.slice(0, 10),
      });
    } catch (error: any) {
      console.error('[AUTO-GEN] Error:', error);
      res.status(500).json({ message: error.message ?? 'Failed to generate missing report cards' });
    }
  },
);

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

// ─── 5. Force Re-Sync All Exams ────────────────────────────────────────────────
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
          COALESCE(e.total_marks, er.max_score, 100)::integer,
          COALESCE(er.score, er.marks_obtained, 0)::integer,
          0,
          e.id,
          COALESCE(er.score, er.marks_obtained, 0)::integer,
          COALESCE(e.total_marks, er.max_score, 100)::integer,
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
          COALESCE(e.total_marks, er.max_score, 100)::integer,
          0,
          0,
          e.id,
          COALESCE(er.score, er.marks_obtained, 0)::integer,
          COALESCE(e.total_marks, er.max_score, 100)::integer,
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

      // ── Step 4: Recalculate obtained_marks + percentage on ALL affected items
      // Recalculate every item in any report card that has exam results in scope.
      // Uses exam_score + test_score combined; handles partial (only exam, only test).
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
          ${termFilter}
        )
      `);

      // ── Step 5: Recalculate report_cards header totals ────────────────────
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
            ${termFilter}
          )
          GROUP BY rci.report_card_id
        ) agg
        WHERE rc.id = agg.report_card_id
      `);

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

export default router;
