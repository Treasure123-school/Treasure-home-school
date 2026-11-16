/** maintenance-repair.routes.ts: split from maintenance.routes.ts. */
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

export default router;
