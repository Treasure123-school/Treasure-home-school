/**
 * Admin Report-Card Maintenance Routes
 *
 * Long-running admin operations: repair, sync, recalculate, and generate report cards.
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
 *   POST /api/admin/sync-missing-test-scores
 *   POST /api/admin/force-resync-all-exams
 *   POST /api/admin/force-resync-test-scores
 *   POST /api/admin/recalculate-all-report-cards
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { storage, db } from '../storage';
import * as schema from '@shared/schema.pg';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { enhancedCache } from '../enhanced-cache';
import { reliableSyncService } from '../services/reliable-sync-service';
import { getActiveGradingConfig } from '../grade-scale-service';
import { calculateGradeFromConfig } from '../grading-config';

// ─── Shared position recalculation helper ─────────────────────────────────────
// Mirrors the private storage.recalculateClassPositions logic so maintenance
// routes can trigger position updates without accessing private methods.
async function recalculatePositionsForPairs(
  pairs: Array<{ classId: number; termId: number }>,
): Promise<void> {
  if (pairs.length === 0) return;

  const settingsRows = await db
    .select({ positioningMethod: schema.systemSettings.positioningMethod })
    .from(schema.systemSettings)
    .limit(1);
  const positioningMethod = settingsRows[0]?.positioningMethod || 'average';

  for (const { classId, termId } of pairs) {
    const cards = await db
      .select({
        id:           schema.reportCards.id,
        totalScore:   schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore,
      })
      .from(schema.reportCards)
      .where(
        and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId,  termId),
        ),
      );

    if (!cards.length) continue;
    const totalInClass = cards.length;

    const sorted = [...cards].sort((a, b) => {
      const sa = positioningMethod === 'average' ? (a.averageScore ?? 0) : (a.totalScore ?? a.averageScore ?? 0);
      const sb = positioningMethod === 'average' ? (b.averageScore ?? 0) : (b.totalScore ?? b.averageScore ?? 0);
      return sb - sa;
    });

    let lastPosition = 1;
    let prevScore: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const card: { id: number; totalScore: number | null; averageScore: number | null } = sorted[i];
      const score = positioningMethod === 'average'
        ? (card.averageScore ?? 0)
        : (card.totalScore ?? card.averageScore ?? 0);
      if (i === 0) {
        lastPosition = 1;
      } else if (score !== prevScore) {
        lastPosition = i + 1;
      }
      prevScore = score;
      await db.update(schema.reportCards)
        .set({ position: lastPosition, totalStudentsInClass: totalInClass, updatedAt: new Date() })
        .where(eq(schema.reportCards.id, card.id));
    }
  }
}

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
      const distinctTermIds: number[] = Array.from(
        new Set(examResults.map((r: any) => r.termId).filter((id: any): id is number => id != null))
      );
      const existingReportCards: { studentId: string; termId: number }[] = distinctTermIds.length > 0
        ? await db
            .select({ studentId: schema.reportCards.studentId, termId: schema.reportCards.termId })
            .from(schema.reportCards)
            .where(inArray(schema.reportCards.termId, distinctTermIds))
        : [];

      const existingPairs  = new Set(existingReportCards.map((rc: { studentId: string; termId: number }) => `${rc.studentId}:${rc.termId}`));
      const missingResults = examResults.filter((r: any) => !existingPairs.has(`${r.studentId}:${r.termId}`));

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
        await Promise.all(batch.map(async (result: any) => {
          affectedPairs.add(`${result.studentId}:${result.termId}`);
          try {
            const syncResult = await reliableSyncService.syncExamScoreToReportCardReliable(
              result.studentId,
              result.examId,
              result.score   ?? 0,
              result.maxScore ?? 100,
              { syncType: 'admin_repair', triggeredBy: 'system' }
            );
            if (syncResult.success) created++;
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
            COALESCE(e.total_marks, er.max_score, 100)::integer      AS max_score,
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
