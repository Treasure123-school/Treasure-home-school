/**
 * Report Card Admin Service
 *
 * Encapsulates business logic for admin report card operations, keeping route
 * handlers thin and testable.
 *
 * Responsibilities:
 *  - Querying all report cards (with optional class/term/status filters)
 *  - Bulk publishing
 *  - Rejecting (reverting to draft)
 *
 * The service does NOT handle HTTP concerns — it returns plain data or throws
 * errors that the route layer translates into HTTP responses.
 */

import { db } from '../storage';
import * as schema from '@shared/schema.pg';
import { users, students } from '@shared/schema.pg';
import { and, eq, sql, desc } from 'drizzle-orm';
import { storage } from '../storage';
import { realtimeService } from '../realtime-service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminReportCardFilters {
  classId?: number;
  termId?: number;
  /** 'all' returns every status; otherwise filters by exact status value */
  status?: string;
}

export interface AdminReportCardRow {
  id: number;
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  department: string | null;
  classId: number;
  className: string;
  classLevel: string | null;
  termId: number;
  termName: string;
  sessionYear: string;
  averagePercentage: number | null;
  overallGrade: string | null;
  status: string;
  finalizedAt: Date | null;
  publishedAt: Date | null;
  generatedAt: Date;
  isSSS: boolean;
}

export interface AdminReportCardStatistics {
  draft: number;
  finalized: number;
  published: number;
}

export interface AdminReportCardsResult {
  reportCards: AdminReportCardRow[];
  statistics: AdminReportCardStatistics;
}

// ── Query service ─────────────────────────────────────────────────────────────

/**
 * Fetch ALL report cards visible to admin, with optional filters.
 *
 * Admin visibility rule: admin always sees every report card regardless of
 * teacher publication status. The `status` filter only narrows the view — it
 * never hides records from admin.
 */
export async function getAdminReportCards(
  filters: AdminReportCardFilters = {}
): Promise<AdminReportCardsResult> {
  const { classId, termId, status = 'all' } = filters;

  // Build the status condition:
  //  - 'all'  → no status restriction (admin sees everything)
  //  - other  → filter by exact status value
  const statusCondition =
    status === 'all'
      ? sql`1=1`
      : eq(schema.reportCards.status, status);

  const rawResults = await db
    .select({
      id: schema.reportCards.id,
      studentId: schema.reportCards.studentId,
      studentName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      admissionNumber: students.admissionNumber,
      department: students.department,
      classId: schema.reportCards.classId,
      className: schema.classes.name,
      classLevel: schema.classes.level,
      termId: schema.reportCards.termId,
      termName: schema.academicTerms.name,
      sessionYear: schema.academicTerms.year,
      averagePercentage: schema.reportCards.averagePercentage,
      overallGrade: schema.reportCards.overallGrade,
      status: schema.reportCards.status,
      finalizedAt: schema.reportCards.finalizedAt,
      publishedAt: schema.reportCards.publishedAt,
      generatedAt: schema.reportCards.generatedAt,
    })
    .from(schema.reportCards)
    .innerJoin(students, eq(students.id, schema.reportCards.studentId))
    .innerJoin(users, eq(users.id, students.id))
    .innerJoin(schema.classes, eq(schema.classes.id, schema.reportCards.classId))
    .innerJoin(schema.academicTerms, eq(schema.academicTerms.id, schema.reportCards.termId))
    .where(
      and(
        statusCondition,
        classId ? eq(schema.reportCards.classId, classId) : sql`1=1`,
        termId ? eq(schema.reportCards.termId, termId) : sql`1=1`
      )
    )
    .orderBy(desc(schema.reportCards.generatedAt));

  // Annotate SSS records and conditionally include department
  const reportCards: AdminReportCardRow[] = rawResults.map((r: any) => {
    const isSSS =
      r.className?.startsWith('SS') ||
      r.classLevel?.includes('Senior Secondary') ||
      false;
    return { ...r, isSSS, department: isSSS ? r.department : null };
  });

  // Aggregate statistics across all statuses (class/term filters still apply)
  const statRows = await db
    .select({
      status: schema.reportCards.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.reportCards)
    .where(
      and(
        classId ? eq(schema.reportCards.classId, classId) : sql`1=1`,
        termId ? eq(schema.reportCards.termId, termId) : sql`1=1`
      )
    )
    .groupBy(schema.reportCards.status);

  const statistics: AdminReportCardStatistics = { draft: 0, finalized: 0, published: 0 };
  statRows.forEach((r: any) => {
    if (r.status in statistics) {
      statistics[r.status as keyof AdminReportCardStatistics] = Number(r.count);
    }
  });

  return { reportCards, statistics };
}

// ── Bulk publish service ──────────────────────────────────────────────────────

export interface BulkPublishResult {
  id: number;
  success: boolean;
  error?: string;
}

/**
 * Bulk-publish report cards by ID.
 * Applies principal signature from the admin's profile if not already set.
 * Emits realtime events immediately for instant UI updates.
 */
export async function bulkPublishReportCards(
  reportCardIds: number[],
  adminId: string
): Promise<{ results: BulkPublishResult[]; successCount: number; failedCount: number }> {
  // Pre-fetch principal signature once for all bulk operations
  const adminProfile = await storage.getAdminProfile(adminId);
  const principalSignature = adminProfile?.signatureUrl || null;

  const results = await Promise.all(
    reportCardIds.map(async (id): Promise<BulkPublishResult> => {
      try {
        const result = await storage.updateReportCardStatusOptimized(id, 'published', adminId);

        // Apply principal signature if available and not already set
        if (result && principalSignature && !result.reportCard.principalSignatureUrl) {
          await db
            .update(schema.reportCards)
            .set({
              principalSignatureUrl: principalSignature,
              principalSignedBy: adminId,
              principalSignedAt: new Date(),
            })
            .where(eq(schema.reportCards.id, id));
          result.reportCard.principalSignatureUrl = principalSignature;
          result.reportCard.principalSignedBy = adminId;
        }

        // Emit realtime event immediately for instant UI updates
        if (result) {
          realtimeService.emitReportCardEvent(id, 'published', {
            reportCardId: id,
            status: 'published',
            studentId: result.reportCard.studentId,
            classId: result.reportCard.classId,
            termId: result.reportCard.termId,
            action: 'bulk-publish',
          }, adminId);

          // Notify parent asynchronously (non-blocking)
          setImmediate(async () => {
            try {
              const student = await storage.getStudent(result.reportCard.studentId);
              if (student?.parentId) {
                realtimeService.emitToUser(student.parentId, 'reportcard.published', {
                  reportCardId: id,
                  status: 'published',
                  studentId: result.reportCard.studentId,
                });
              }
            } catch { /* best-effort notification */ }
          });
        }

        return { id, success: true };
      } catch (error: any) {
        return { id, success: false, error: error.message };
      }
    })
  );

  return {
    results,
    successCount: results.filter(r => r.success).length,
    failedCount: results.filter(r => !r.success).length,
  };
}

// ── Reject / revert service ───────────────────────────────────────────────────

/**
 * Reject a report card by reverting it to draft status.
 * Records audit trail via realtime event. Reason is broadcast to connected
 * clients for display in notifications.
 */
export async function rejectReportCard(
  reportCardId: number,
  reason: string,
  adminId: string
): Promise<{ reportCard: any; reason: string }> {
  const result = await storage.updateReportCardStatusOptimized(reportCardId, 'draft', adminId);

  if (!result) {
    throw new Error('Report card not found');
  }

  const { reportCard } = result;

  realtimeService.emitReportCardEvent(reportCardId, 'reverted', {
    reportCardId,
    status: 'draft',
    studentId: reportCard.studentId,
    classId: reportCard.classId,
    termId: reportCard.termId,
    reason: reason || 'Rejected by admin',
    action: 'reject',
  }, adminId);

  return { reportCard, reason };
}
