/** maintenance-shared.ts — shared helper for maintenance routes. */
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
export async function recalculatePositionsForPairs(
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


// ─── Extended timeout constants + cache invalidation ─────────────────────────
// These bulk operations can process thousands of students; they need minutes,
// not the global 60 s production cap.
export const MAINTENANCE_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

// ─── Shared cache invalidation ────────────────────────────────────────────────
export function invalidateReportCardCaches(): void {
  enhancedCache.invalidate(/^reportcard:/);
  enhancedCache.invalidate(/^reportcards:/);
  enhancedCache.invalidate(/^report-card/);
  enhancedCache.invalidate(/^student-report/);
}
