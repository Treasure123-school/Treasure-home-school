/** Promotions reversal — controlled compensating operation for executed batches.
 *
 * Design (per approved spec):
 * - Reversal NEVER deletes the original promotion history (batches/records stay).
 * - analyzeReversal() classifies each success record as eligible / blocked / review
 *   by checking for subsequent academic activity (exams, CA, report cards, attendance,
 *   manual subject assignments, later sessions, manual class/enrolment changes).
 * - reverseBatch() runs in ONE transaction guarded by an atomic status flip
 *   (`not_reversed`/`partially_reversed` → `reversing`), so a batch can never be
 *   reversed twice. Blocked records are marked with reasons; eligible ones are
 *   restored from the snapshots captured at execution time.
 */
import { db } from '../../db';
import * as schema from '../../../shared/schema.pg';
import { eq, and, ne, or, inArray, gt, isNull, isNotNull, desc } from 'drizzle-orm';
import { invalidateVisibilityCache } from '../../exam-visibility';
import { getSessionOrThrow, recomputeBatchCounts } from './promotions.helpers';
import type { Tx } from './promotions.schemas';

interface ReversalRecordState {
  record: any;
  verdict: 'eligible' | 'blocked' | 'review' | 'reversed';
  reason?: string;
}

interface ReversalAnalysis {
  batch: any;
  destSessionYear: string;
  eligible: ReversalRecordState[];
  blocked: ReversalRecordState[];
  review: ReversalRecordState[];
  reversedCount: number;
  counts: { total: number; eligible: number; blocked: number; review: number; reversed: number };
}

/** Expected destination-enrolment state produced by each outcome (used to detect manual changes). */
function expectedDestEnrollment(record: any): { classId: number; status: string; promotionOutcome: string | null } | null {
  switch (record.outcome) {
    case 'promoted':
      return { classId: record.toClassId, status: 'active', promotionOutcome: null };
    case 'repeating':
      return { classId: record.fromClassId, status: 'active', promotionOutcome: null };
    case 'deferred':
      return { classId: record.fromClassId, status: 'pending', promotionOutcome: 'deferred' };
    default: // graduated / withdrawn create no destination enrolment
      return null;
  }
}

/** Class the student should currently be in, per the original promotion outcome. */
function expectedCurrentClassId(record: any): number | null {
  return record.outcome === 'promoted' ? record.toClassId : record.fromClassId;
}

/**
 * Classify every success record of a batch for reversal. Read-only; safe to run
 * on `db` (preview endpoint) or inside a transaction (during reverseBatch).
 */
async function analyze(tx: any, batchId: number): Promise<ReversalAnalysis> {
  const batchRows = await tx.select().from(schema.promotionBatches).where(eq(schema.promotionBatches.id, batchId)).limit(1);
  if (batchRows.length === 0) throw { statusCode: 404, message: `Promotion batch ${batchId} not found` };
  const batch = batchRows[0];

  const records = await tx.select().from(schema.promotionRecords)
    .where(and(eq(schema.promotionRecords.batchId, batchId), eq(schema.promotionRecords.status, 'success')))
    .orderBy(desc(schema.promotionRecords.id));
  const studentIds: string[] = Array.from(new Set<string>(records.map((r: any) => r.studentId)));

  const destSession = await getSessionOrThrow(batch.destinationSessionId);
  const destSessionYear = destSession.year || (destSession as any).sessionYear || `session #${batch.destinationSessionId}`;

  const empty: ReversalAnalysis = {
    batch, destSessionYear, eligible: [], blocked: [], review: [], reversedCount: 0,
    counts: { total: 0, eligible: 0, blocked: 0, review: 0, reversed: 0 },
  };
  if (studentIds.length === 0) return empty;

  // --- Batched conflict lookups (all keyed by studentId) ---

  // Destination-session enrolments (to verify the promotion's own state is untouched)
  const destEnrollments = await tx.select().from(schema.studentEnrollments)
    .where(and(inArray(schema.studentEnrollments.studentId, studentIds), eq(schema.studentEnrollments.sessionId, batch.destinationSessionId)));
  const destEnrollByStudent = new Map<string, any>(destEnrollments.map((e: any) => [e.studentId, e] as [string, any]));

  // Current class pointer
  const studentRows = await tx.select({ id: schema.students.id, classId: schema.students.classId })
    .from(schema.students).where(inArray(schema.students.id, studentIds));
  const classByStudent = new Map<string, any>(studentRows.map((s: any) => [s.id, s.classId] as [string, any]));

  // Exam results (exams + continuous assessments) in the destination session
  const examConflictRows = await tx.select({ studentId: schema.examResults.studentId })
    .from(schema.examResults)
    .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
    .innerJoin(schema.academicTerms, eq(schema.exams.termId, schema.academicTerms.id))
    .where(and(eq(schema.academicTerms.sessionId, batch.destinationSessionId), inArray(schema.examResults.studentId, studentIds)));
  const examConflict = new Set<string>(examConflictRows.map((r: any) => r.studentId));

  // Report cards in the destination session
  const reportCardRows = await tx.select({ studentId: schema.reportCards.studentId })
    .from(schema.reportCards)
    .innerJoin(schema.academicTerms, eq(schema.reportCards.termId, schema.academicTerms.id))
    .where(and(eq(schema.academicTerms.sessionId, batch.destinationSessionId), inArray(schema.reportCards.studentId, studentIds)));
  const reportCardConflict = new Set<string>(reportCardRows.map((r: any) => r.studentId));

  // Attendance recorded after the batch ran (attendance has no session column —
  // approximated by "recorded for the student after execution in the destination class")
  const attendanceRows = await tx.select({ studentId: schema.attendance.studentId, classId: schema.attendance.classId })
    .from(schema.attendance)
    .where(and(gt(schema.attendance.createdAt, batch.executedAt), inArray(schema.attendance.studentId, studentIds)));
  const attendanceByStudent = new Map<string, Set<number>>();
  for (const row of attendanceRows) {
    if (!attendanceByStudent.has(row.studentId)) attendanceByStudent.set(row.studentId, new Set());
    attendanceByStudent.get(row.studentId)!.add(row.classId);
  }

  // MANUAL subject assignments added after the batch (the promotion's own
  // auto-assignments have assignedBy = null and are cleaned by reversal, not counted)
  const manualSubjectRows = await tx.select({ studentId: schema.studentSubjectAssignments.studentId, classId: schema.studentSubjectAssignments.classId })
    .from(schema.studentSubjectAssignments)
    .where(and(
      gt(schema.studentSubjectAssignments.createdAt, batch.executedAt),
      isNotNull(schema.studentSubjectAssignments.assignedBy),
      inArray(schema.studentSubjectAssignments.studentId, studentIds),
    ));
  const manualSubjectsByStudent = new Map<string, Set<number>>();
  for (const row of manualSubjectRows) {
    if (!manualSubjectsByStudent.has(row.studentId)) manualSubjectsByStudent.set(row.studentId, new Set());
    manualSubjectsByStudent.get(row.studentId)!.add(row.classId);
  }

  // Enrolments in a LATER session (a subsequent promotion batch or manual enrolment).
  // Enrolments in earlier sessions are legitimate history and must not block reversal.
  const otherSessionRows = await tx.select({ studentId: schema.studentEnrollments.studentId })
    .from(schema.studentEnrollments)
    .where(and(
      inArray(schema.studentEnrollments.studentId, studentIds),
      gt(schema.studentEnrollments.sessionId, batch.destinationSessionId),
    ));
  const otherSessionConflict = new Set<string>(otherSessionRows.map((r: any) => r.studentId));

  // --- Classification ---
  const eligible: ReversalRecordState[] = [];
  const blocked: ReversalRecordState[] = [];
  const review: ReversalRecordState[] = [];
  let reversedCount = 0;

  for (const record of records) {
    if (record.reversalStatus === 'reversed') { reversedCount++; continue; }

    const classId = classByStudent.get(record.studentId);
    const destEn = destEnrollByStudent.get(record.studentId);

    // Previously corrected records: state no longer matches what the batch produced —
    // require individual review instead of automatic reversal
    if (record.correctedAt) {
      review.push({ record, verdict: 'review', reason: `Record was corrected after promotion (current outcome: ${record.outcome}) — verify manually` });
      continue;
    }

    // Legacy records without snapshots: cannot safely restore automatically
    if (!record.destEnrollmentId && ['promoted', 'repeating', 'deferred'].includes(record.outcome)) {
      review.push({ record, verdict: 'review', reason: 'Missing destination enrolment snapshot (legacy record) — verify manually' });
      continue;
    }

    // Destination enrolment must still be exactly what the promotion created
    if (record.destEnrollmentId) {
      if (!destEn || destEn.id !== record.destEnrollmentId) {
        blocked.push({ record, verdict: 'blocked', reason: 'Destination enrolment missing or replaced after promotion' });
        continue;
      }
      const expected = expectedDestEnrollment(record);
      if (expected && (
        destEn.classId !== expected.classId ||
        destEn.status !== expected.status ||
        (destEn.promotionOutcome ?? null) !== expected.promotionOutcome
      )) {
        blocked.push({ record, verdict: 'blocked', reason: `Destination enrolment modified after promotion (manual change: class ${destEn.classId}, status ${destEn.status})` });
        continue;
      }
    }

    // Current class pointer must match the promotion's outcome
    const expectedClass = expectedCurrentClassId(record);
    if (classId !== expectedClass) {
      blocked.push({ record, verdict: 'blocked', reason: `Current class changed after promotion (expected class ${expectedClass}, found ${classId})` });
      continue;
    }

    // Destination-class id for activity checks (the class the student was placed into)
    const destClassId = record.outcome === 'promoted' ? record.toClassId : record.fromClassId;

    if (examConflict.has(record.studentId)) {
      blocked.push({ record, verdict: 'blocked', reason: `Examination/assessment records exist in ${destSessionYear}` });
      continue;
    }
    if (reportCardConflict.has(record.studentId)) {
      blocked.push({ record, verdict: 'blocked', reason: `Report cards exist in ${destSessionYear}` });
      continue;
    }
    if (destClassId && attendanceByStudent.get(record.studentId)?.has(destClassId)) {
      blocked.push({ record, verdict: 'blocked', reason: 'Attendance recorded for the destination class after promotion' });
      continue;
    }
    if (destClassId && manualSubjectsByStudent.get(record.studentId)?.has(destClassId)) {
      blocked.push({ record, verdict: 'blocked', reason: 'Manual subject assignments added to the destination class after promotion' });
      continue;
    }
    if (otherSessionConflict.has(record.studentId)) {
      blocked.push({ record, verdict: 'blocked', reason: 'Student has enrolments in another academic session (moved on)' });
      continue;
    }

    eligible.push({ record, verdict: 'eligible' });
  }

  return {
    batch, destSessionYear, eligible, blocked, review, reversedCount,
    counts: {
      total: records.length,
      eligible: eligible.length,
      blocked: blocked.length,
      review: review.length,
      reversed: reversedCount,
    },
  };
}

/**
 * Re-sync one student's subject assignments to their final class. Runs entirely
 * on the transaction so it rolls back with the reversal.
 */
async function resyncStudentSubjectsSafe(tx: Tx, studentId: string, classId: number) {
  const classRows = await tx.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1);
  if (classRows.length === 0) return;
  const level: string | null = classRows[0].level ?? null;
  const isSeniorSecondary = !!level && ['SS1', 'SS2', 'SS3', 'Senior Secondary']
    .some(l => level.toLowerCase().includes(l.toLowerCase()));

  let department: string | undefined = undefined;
  if (isSeniorSecondary) {
    const studentRows = await tx.select({ department: schema.students.department })
      .from(schema.students).where(eq(schema.students.id, studentId)).limit(1);
    department = studentRows[0]?.department ?? undefined;
  }

  // Mirror getClassSubjectMappings(classId, department): departmental lookups include shared (null-department) mappings
  // Single bulk statement: drop stale assignments + re-map from class_subject_mappings in one shot
  const mappings = await tx.select({ subjectId: schema.classSubjectMappings.subjectId })
    .from(schema.classSubjectMappings)
    .where(department
      ? and(
          eq(schema.classSubjectMappings.classId, classId),
          or(
            eq(schema.classSubjectMappings.department, department),
            isNull(schema.classSubjectMappings.department),
          ),
        )
      : eq(schema.classSubjectMappings.classId, classId));
  const subjectIds = Array.from(new Set(mappings.map((m: any) => m.subjectId)));

  await tx.delete(schema.studentSubjectAssignments)
    .where(and(
      eq(schema.studentSubjectAssignments.studentId, studentId),
      eq(schema.studentSubjectAssignments.isActive, true),
    ));

  if (subjectIds.length > 0) {
    await tx.insert(schema.studentSubjectAssignments)
      .values(subjectIds.map(subjectId => ({ studentId, classId, subjectId, isActive: true })))
      .onConflictDoNothing();
  }
}

/**
 * GET /api/admin/promotions/batches/:batchId/reversal-preview
 * Read-only classification for the confirmation dialog.
 */
export async function analyzeReversal(batchId: number) {
  const analysis = await analyze(db, batchId);
  return {
    batch: {
      id: analysis.batch.id,
      sourceSessionId: analysis.batch.sourceSessionId,
      destinationSessionId: analysis.batch.destinationSessionId,
      status: analysis.batch.status,
      reversalStatus: analysis.batch.reversalStatus,
      executedAt: analysis.batch.executedAt,
      totalStudents: analysis.batch.totalStudents,
    },
    destSessionYear: analysis.destSessionYear,
    counts: analysis.counts,
    eligible: analysis.eligible.map(({ record }) => ({
      recordId: record.id, studentId: record.studentId, outcome: record.outcome,
      fromClassId: record.fromClassId, toClassId: record.toClassId,
    })),
    blocked: analysis.blocked.map(({ record, reason }) => ({
      recordId: record.id, studentId: record.studentId, outcome: record.outcome, reason,
    })),
    review: analysis.review.map(({ record, reason }) => ({
      recordId: record.id, studentId: record.studentId, outcome: record.outcome, reason,
    })),
  };
}

/**
 * POST /api/admin/promotions/batches/:batchId/reverse
 * Reverses every safely-reversible success record in one transaction.
 * Blocked records are marked with reasons; review records are left untouched
 * for individual correction and re-evaluated on the next reversal run (idempotent).
 */
export async function reverseBatch(batchId: number, reason: string, adminId: string) {
  const t0 = Date.now();
  return db.transaction(async (tx: Tx) => {
    // Atomic idempotency guard: flip to 'reversing' or refuse.
    const guard = await tx.update(schema.promotionBatches)
      .set({ reversalStatus: 'reversing' })
      .where(and(
        eq(schema.promotionBatches.id, batchId),
        eq(schema.promotionBatches.status, 'completed'),
        inArray(schema.promotionBatches.reversalStatus, ['not_reversed', 'partially_reversed']),
      ))
      .returning();
    if (guard.length === 0) {
      const existing = await tx.select({ reversalStatus: schema.promotionBatches.reversalStatus, status: schema.promotionBatches.status })
        .from(schema.promotionBatches).where(eq(schema.promotionBatches.id, batchId)).limit(1);
      if (existing.length === 0) throw { statusCode: 404, message: `Promotion batch ${batchId} not found` };
      throw { statusCode: 409, message: `Batch #${batchId} cannot be reversed (status: ${existing[0].status}, reversal: ${existing[0].reversalStatus})` };
    }
    const batch = guard[0];

    const analysis = await analyze(tx, batchId);
    console.log(`[PROMOTIONS] Reverse #${batchId}: analysis done in ${Date.now() - t0}ms (eligible ${analysis.eligible.length}, blocked ${analysis.blocked.length}, review ${analysis.review.length})`);
    if (analysis.eligible.length === 0) {
      // Refuse unsafe reversal — nothing touched (transaction rolls back the 'reversing' flip)
      throw {
        statusCode: 409,
        message: `No students can be safely reversed: ${analysis.counts.blocked} blocked by subsequent academic activity, ${analysis.counts.review} require individual review. Use individual corrections instead.`,
      };
    }

    let reversedNow = 0;
    for (const { record } of analysis.eligible) {
      const rt0 = Date.now();
      // 1. Revert the effects of the original outcome (restore from snapshots).
      //    Only records WITH a dest-enrolment snapshot reach here — promoted/repeating/
      //    deferred records without one are routed to 'review' by the analysis, and
      //    graduated/withdrawn never created a destination enrolment.
      if (record.destEnrollmentId) {
        await tx.delete(schema.studentEnrollments).where(eq(schema.studentEnrollments.id, record.destEnrollmentId));
      }

      if (record.outcome === 'promoted') {
        if (record.fromClassId) {
          await tx.update(schema.students).set({ classId: record.fromClassId })
            .where(eq(schema.students.id, record.studentId));
        }
      } else if (record.outcome === 'graduated') {
        await tx.update(schema.users).set({ status: record.prevUserStatus ?? 'active' })
          .where(eq(schema.users.id, record.studentId));
      } else if (record.outcome === 'withdrawn') {
        await tx.update(schema.users).set({ status: record.prevUserStatus ?? 'active', isActive: true })
          .where(eq(schema.users.id, record.studentId));
      }

      // 2. Restore the source enrolment from the pre-promotion snapshot
      await tx.update(schema.studentEnrollments).set({
        status: record.prevEnrollmentStatus ?? 'active',
        promotionOutcome: null,
        promotedToClassId: null,
        updatedAt: new Date(),
      }).where(and(
        eq(schema.studentEnrollments.studentId, record.studentId),
        eq(schema.studentEnrollments.sessionId, batch.sourceSessionId),
      ));

      // 3. Subject hygiene (promoted students only — the only outcome that moved the
      //    student's class / created new subject assignments): remove promotion-created
      //    auto-assignments in the destination class, then re-map to the restored class
      const restoredClassId = record.fromClassId;
      if (record.outcome === 'promoted' && restoredClassId) {
        const destClassId = record.toClassId;
        if (destClassId) {
          await tx.delete(schema.studentSubjectAssignments).where(and(
            eq(schema.studentSubjectAssignments.studentId, record.studentId),
            eq(schema.studentSubjectAssignments.classId, destClassId),
            isNull(schema.studentSubjectAssignments.assignedBy), // only the promotion's own auto-assignments
          ));
        }
        await resyncStudentSubjectsSafe(tx, record.studentId, restoredClassId);
      }

      // 4. Mark the record reversed (original row preserved)
      await tx.update(schema.promotionRecords).set({
        reversalStatus: 'reversed', reversedAt: new Date(), reversalBlockedReason: null,
      }).where(eq(schema.promotionRecords.id, record.id));

      // 5. Audit trail
      await tx.insert(schema.promotionAudit).values({
        batchId, recordId: record.id, studentId: record.studentId,
        eventType: 'record_reversal',
        previousOutcome: record.outcome,
        previousToClassId: record.toClassId,
        reason,
        details: JSON.stringify({ outcome: record.outcome, restoredClassId: record.fromClassId }),
        performedBy: adminId,
      });
      reversedNow++;
      console.log(`[PROMOTIONS] Reverse #${batchId}: record ${record.id} (${record.outcome}) restored in ${Date.now() - rt0}ms`);
    }

    // Blocked records: persist the reason so the UI can explain them
    if (analysis.blocked.length > 0) {
      await tx.update(schema.promotionRecords).set({
        reversalStatus: 'blocked', reversalBlockedReason: null,
      }).where(and(
        inArray(schema.promotionRecords.id, analysis.blocked.map(({ record }) => record.id)),
        ne(schema.promotionRecords.reversalStatus, 'reversed'),
      ));
      // one UPDATE per blocked record for its individual reason
      for (const { record, reason: blockedReason } of analysis.blocked) {
        await tx.update(schema.promotionRecords).set({ reversalBlockedReason: blockedReason })
          .where(eq(schema.promotionRecords.id, record.id));
      }
    }

    // Review records stay untouched; they are re-evaluated on the next reversal run.

    // 6. Finalize batch status — fully reversed batches are marked 'reversed'
    //    (the transition unique index excludes them, so the promotion can be re-run)
    //    total includes records already reversed in earlier partial runs, so
    //    full reversal is achieved when nothing is blocked and nothing is in review.
    const fullyReversed = analysis.blocked.length === 0 && analysis.review.length === 0;
    await tx.update(schema.promotionBatches).set({
      status: fullyReversed ? 'reversed' : 'completed',
      reversalStatus: fullyReversed ? 'reversed' : 'partially_reversed',
      reversedAt: new Date(),
      reversedBy: adminId,
      reversalReason: reason,
    }).where(eq(schema.promotionBatches.id, batchId));

    await tx.insert(schema.promotionAudit).values({
      batchId,
      eventType: 'batch_reversal',
      reason,
      details: JSON.stringify({
        reversed: reversedNow,
        blocked: analysis.blocked.length,
        review: analysis.review.length,
        total: analysis.counts.total,
        fullyReversed,
      }),
      performedBy: adminId,
    });

    console.log(`[PROMOTIONS] Reverse #${batchId}: finalize at ${Date.now() - t0}ms (reversed ${reversedNow}/${analysis.counts.total}) — committing transaction`);
    return {
      batchId,
      fullyReversed,
      reversedCount: reversedNow,
      blocked: analysis.blocked.map(({ record, reason: r }) => ({ recordId: record.id, studentId: record.studentId, reason: r })),
      review: analysis.review.map(({ record, reason: r }) => ({ recordId: record.id, studentId: record.studentId, reason: r })),
    };
  }).then(async (result: any) => {
    invalidateVisibilityCache({ all: true });
    // Recounts AFTER commit — recomputeBatchCounts uses the global pool and must not
    // hold the reversal transaction open while queuing for a connection.
    const stats = await recomputeBatchCounts(batchId);
    console.log(`[PROMOTIONS] Batch #${batchId} reversed by ${adminId}: ${result.reversedCount}/${result.blocked.length + result.review.length + result.reversedCount} records restored (blocked: ${result.blocked.length}, review: ${result.review.length}) in ${Date.now() - t0}ms total`);
    return { ...result, batchStats: stats };
  });
}
