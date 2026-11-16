/** Promotions write-side — execute batch, correct record, rollover activation.
 *  Extracted from promotions.service.ts. */
/**
 * Promotions Service
 * Student Promotion & Academic Year Rollover business logic.
 *
 * Design notes:
 * - students.class_id remains the operational current-class pointer used by existing queries.
 * - student_enrollments preserves per-session class history (unique student_id + session_id).
 * - Promotion never rewrites historical academic records (they snapshot class_id + term_id).
 * - Execution is per-student transactions inside one batch; failures are isolated per student.
 */
import { db } from '../../db';
import * as schema from '../../../shared/schema.pg';
import { eq, and, ne, inArray, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { storage } from '../../storage';
import {
  previewSchema, mappingsUpdateSchema, executeSchema, rolloverSchema, correctRecordSchema,
} from './promotions.schemas';
import { getSessionOrThrow, getClassOrThrow, detectActiveSession, applyStudentOutcome,
  recomputeBatchCounts } from './promotions.helpers';
import type { Tx } from './promotions.schemas';

  export async function execute(body: z.infer<typeof executeSchema>, adminId: string) {
    if (body.sourceSessionId === body.destinationSessionId) {
      throw { statusCode: 400, message: 'Destination session must be different from the source session' };
    }
    const [sourceSession, destSession] = await Promise.all([
      getSessionOrThrow(body.sourceSessionId), getSessionOrThrow(body.destinationSessionId),
    ]);

    // Duplicate batch guard: one completed batch per session transition
    const priorBatches = await db.select().from(schema.promotionBatches)
      .where(and(
        eq(schema.promotionBatches.sourceSessionId, body.sourceSessionId),
        eq(schema.promotionBatches.destinationSessionId, body.destinationSessionId),
        eq(schema.promotionBatches.status, 'completed'),
      ));
    if (priorBatches.length > 0) {
      throw { statusCode: 409, message: `Promotion for ${sourceSession.year} → ${destSession.year} was already executed (batch #${priorBatches[0].id}). Use individual corrections for exceptions.` };
    }

    // Stale in-progress batch recovery: if a previous run crashed mid-batch (server
    // restart), mark it failed so the transition can be re-run. Anything older than
    // 1 hour with no recent activity is considered abandoned.
    const inProgress = await db.select().from(schema.promotionBatches)
      .where(and(
        eq(schema.promotionBatches.sourceSessionId, body.sourceSessionId),
        eq(schema.promotionBatches.destinationSessionId, body.destinationSessionId),
        eq(schema.promotionBatches.status, 'in_progress'),
      ));
    for (const stale of inProgress) {
      const ageMinutes = (Date.now() - new Date(stale.executedAt).getTime()) / 60000;
      if (ageMinutes > 60) {
        await db.update(schema.promotionBatches).set({ status: 'failed', notes: 'Marked failed: abandoned (server restart during execution)' })
          .where(eq(schema.promotionBatches.id, stale.id));
        console.warn(`[PROMOTIONS] Marked stale in-progress batch #${stale.id} as failed (${ageMinutes.toFixed(0)} min old)`);
      } else {
        throw { statusCode: 409, message: `Promotion for this transition is currently executing (batch #${stale.id}, started ${ageMinutes.toFixed(0)} min ago)` };
      }
    }

    // Deduplicate students within the request
    const seen = new Set<string>();
    for (const s of body.students) {
      if (seen.has(s.studentId)) throw { statusCode: 400, message: `Duplicate student in request: ${s.studentId}` };
      seen.add(s.studentId);
    }

    // Create batch — the DB partial unique index on (source, destination) where
    // status <> 'failed' is the hard guard against concurrent double execution
    let batch;
    try {
      const batchRows = await db.insert(schema.promotionBatches).values({
        sourceSessionId: body.sourceSessionId,
        destinationSessionId: body.destinationSessionId,
        executedBy: adminId,
        status: 'in_progress',
        totalStudents: body.students.length,
      }).returning();
      batch = batchRows[0];
    } catch (error: any) {
      if (error?.code === '23505') {
        throw { statusCode: 409, message: `Promotion for ${sourceSession.year} → ${destSession.year} is already executing or was executed. Use individual corrections for exceptions.` };
      }
      throw error;
    }

    const results: Array<{ studentId: string; success: boolean; outcome?: string; destinationClassId?: number | null; error?: string }> = [];
    const subjectAssignmentQueue: Array<{ studentId: string; classId: number }> = [];

    for (const item of body.students) {
      try {
        const outcome = await db.transaction(async (tx: Tx) => {
          const res = await applyStudentOutcome(tx, {
            batchId: batch.id,
            studentId: item.studentId,
            sourceSessionId: body.sourceSessionId,
            destinationSessionId: body.destinationSessionId,
            outcome: item.outcome,
            toClassId: item.toClassId ?? null,
            reason: item.reason ?? null,
          });
          return res;
        });
        if (outcome.subjectAssignmentPending && outcome.destinationClassId) {
          subjectAssignmentQueue.push({ studentId: item.studentId, classId: outcome.destinationClassId });
        }
        results.push({ studentId: item.studentId, success: true, outcome: item.outcome, destinationClassId: outcome.destinationClassId });
      } catch (error: any) {
        const message = error?.message || 'Promotion failed';
        console.error(`[PROMOTIONS] Failed student ${item.studentId}:`, message);
        // Failed record for the completion report (no transaction to roll back — nothing was applied)
        try {
          await db.insert(schema.promotionRecords).values({
            batchId: batch.id, studentId: item.studentId,
            fromClassId: null, toClassId: item.toClassId ?? null,
            outcome: item.outcome, status: 'failed',
            reason: item.reason ?? null, errorMessage: message,
          });
        } catch (recordError) {
          console.error('[PROMOTIONS] Could not write failure record:', recordError);
        }
        results.push({ studentId: item.studentId, success: false, error: message });
      }
    }

    // Post-commit, best-effort subject assignment for promoted students
    // (uses storage layer + class_subject_mappings; failure must not fail the promotion)
    for (const job of subjectAssignmentQueue) {
      try {
        const studentRow = await db.select({ department: schema.students.department })
          .from(schema.students).where(eq(schema.students.id, job.studentId)).limit(1);
        await storage.autoAssignSubjectsToStudent(job.studentId, job.classId, studentRow[0]?.department || undefined);
      } catch (e) {
        console.error(`[PROMOTIONS] Subject assignment failed for student ${job.studentId} (non-fatal):`, e);
      }
    }

    const stats = await recomputeBatchCounts(batch.id);
    console.log(`[PROMOTIONS] Batch #${batch.id} executed by ${adminId}: ${body.sourceSessionId} → ${body.destinationSessionId}, ${JSON.stringify(stats)}`);

    return { batch: { ...batch, ...stats }, results };
  }

  /**
   * GET /api/admin/promotions/history
   */
  export async function correctRecord(recordId: number, body: z.infer<typeof correctRecordSchema>, adminId: string) {
    const recordRows = await db.select().from(schema.promotionRecords).where(eq(schema.promotionRecords.id, recordId)).limit(1);
    if (recordRows.length === 0) throw { statusCode: 404, message: `Promotion record ${recordId} not found` };
    const record = recordRows[0];
    if (record.status === 'success' && record.outcome === body.outcome && !body.toClassId) {
      throw { statusCode: 400, message: 'Record already has this outcome' };
    }

    const { studentId, batchId } = record;
    const batchRows = await db.select().from(schema.promotionBatches).where(eq(schema.promotionBatches.id, record.batchId)).limit(1);
    if (batchRows.length === 0) throw { statusCode: 404, message: `Promotion batch ${record.batchId} not found` };
    const batch = batchRows[0];
    const sourceSessionId = batch.sourceSessionId;
    const destinationSessionId = batch.destinationSessionId;

    await db.transaction(async (tx: Tx) => {
      // 1. Revert the effects of the old outcome (nothing to revert for failed records —
      // their transaction rolled back, so no state was ever applied)
      if (record.status === 'success') {
        if (record.outcome === 'promoted') {
          // Move student back to their original class
          if (record.fromClassId) {
            await tx.update(schema.students).set({ classId: record.fromClassId }).where(eq(schema.students.id, studentId));
          }
          // Remove the destination-session enrolment created by promotion
          await tx.delete(schema.studentEnrollments)
            .where(and(eq(schema.studentEnrollments.studentId, studentId), eq(schema.studentEnrollments.sessionId, destinationSessionId)));
        } else if (record.outcome === 'repeating' || record.outcome === 'deferred') {
          await tx.delete(schema.studentEnrollments)
            .where(and(eq(schema.studentEnrollments.studentId, studentId), eq(schema.studentEnrollments.sessionId, destinationSessionId)));
        } else if (record.outcome === 'graduated') {
          await tx.update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, studentId));
        } else if (record.outcome === 'withdrawn') {
          await tx.update(schema.users).set({ status: 'active', isActive: true }).where(eq(schema.users.id, studentId));
        }
      }

      // 2. Reset the source enrolment to its pre-promotion state
      await tx.update(schema.studentEnrollments).set({
        status: 'active', promotionOutcome: null, promotedToClassId: null, updatedAt: new Date(),
      }).where(and(
        eq(schema.studentEnrollments.studentId, studentId),
        eq(schema.studentEnrollments.sessionId, sourceSessionId),
      ));

      // 3. Apply the new outcome
      const applied = await applyStudentOutcome(tx, {
        batchId: null, // record already exists; update it below
        studentId,
        sourceSessionId,
        destinationSessionId,
        outcome: body.outcome,
        toClassId: body.toClassId ?? record.toClassId ?? null,
        reason: body.reason ?? record.reason,
      });

      // 4. Update the audit record
      await tx.update(schema.promotionRecords).set({
        outcome: body.outcome,
        toClassId: applied.destinationClassId,
        reason: body.reason ?? record.reason,
        status: 'success',
        errorMessage: null,
        correctedBy: adminId,
        correctedAt: new Date(),
      }).where(eq(schema.promotionRecords.id, recordId));
    });

    // Best-effort subject assignment if the correction promoted the student
    const refreshed = await db.select().from(schema.promotionRecords).where(eq(schema.promotionRecords.id, recordId)).limit(1);
    if (refreshed[0]?.outcome === 'promoted' && refreshed[0]?.toClassId) {
      try {
        const studentRow = await db.select({ department: schema.students.department })
          .from(schema.students).where(eq(schema.students.id, studentId)).limit(1);
        await storage.autoAssignSubjectsToStudent(studentId, refreshed[0].toClassId!, studentRow[0]?.department || undefined);
      } catch (e) {
        console.error(`[PROMOTIONS] Subject assignment failed during correction (non-fatal):`, e);
      }
    }

    const stats = await recomputeBatchCounts(batchId);
    console.log(`[PROMOTIONS] Record ${recordId} corrected by ${adminId}: outcome → ${body.outcome}`);
    return { record: refreshed[0], batchStats: stats };
  }

  /**
   * POST /api/admin/promotions/rollover-activate
   * Explicit academic-year activation: terms ensured, previous session completed,
   * destination session activated in First Term.
   */
  export async function rolloverActivate(body: z.infer<typeof rolloverSchema>, adminId: string) {
    const sessions = await db.select().from(schema.academicSessions);
    const sourceSessionId = body.sourceSessionId ?? detectActiveSession(sessions)?.id;
    if (!sourceSessionId) throw { statusCode: 400, message: 'No source session found — provide sourceSessionId' };
    if (sourceSessionId === body.destinationSessionId) {
      throw { statusCode: 400, message: 'Destination session must be different from the source session' };
    }

    const [sourceSession, destSession] = await Promise.all([
      getSessionOrThrow(sourceSessionId), getSessionOrThrow(body.destinationSessionId),
    ]);
    if (destSession.status === 'active' && destSession.isCurrent) {
      return { alreadyActive: true, message: `Session ${destSession.year} is already active`, session: destSession };
    }

    // Required terms for the destination session (First / Second / Third Term)
    const REQUIRED_TERMS = ['First Term', 'Second Term', 'Third Term'];
    const existingTerms = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.sessionId, destSession.id));
    const existingByName = new Map(existingTerms.map((t: any) => [t.name.toLowerCase(), t]));
    const [startYear] = destSession.year.split('/').map((y: string) => parseInt(y, 10));

    const termDefaults: Record<string, { start: [number, number, number]; end: [number, number, number]; yearOffset: number }> = {
      'First Term': { start: [9, 1, 0], end: [12, 15, 0], yearOffset: 0 },
      'Second Term': { start: [1, 6, 1], end: [4, 10, 1], yearOffset: 1 },
      'Third Term': { start: [4, 21, 1], end: [7, 18, 1], yearOffset: 1 },
    };

    const createdTerms: string[] = [];
    for (const name of REQUIRED_TERMS) {
      if (existingByName.has(name.toLowerCase())) continue;
      const def = termDefaults[name];
      const pad = (n: number) => String(n).padStart(2, '0');
      const y = startYear + def.yearOffset;
      const startDate = `${y}-${pad(def.start[0])}-${pad(def.start[1])}`;
      const endDate = `${y}-${pad(def.end[0])}-${pad(def.end[1])}`;
      await db.insert(schema.academicTerms).values({
        name, year: destSession.year, startDate, endDate,
        status: 'upcoming', sessionId: destSession.id,
        description: `${name} of ${destSession.year} (created by rollover)`,
      });
      createdTerms.push(name);
    }

    // Activate: clear all isCurrent flags (sessions AND terms), complete source,
    // activate destination + First Term
    await db.transaction(async (tx: Tx) => {
      await tx.update(schema.academicSessions).set({ isCurrent: false }).where(eq(schema.academicSessions.isCurrent, true));
      // Clear stray term flags from ANY session (e.g. an old term still flagged current)
      await tx.update(schema.academicTerms).set({ isCurrent: false }).where(eq(schema.academicTerms.isCurrent, true));

      await tx.update(schema.academicSessions).set({ status: 'completed', isCurrent: false })
        .where(eq(schema.academicSessions.id, sourceSessionId));
      await tx.update(schema.academicTerms).set({ status: 'completed', isCurrent: false })
        .where(eq(schema.academicTerms.sessionId, sourceSessionId));

      await tx.update(schema.academicSessions).set({ status: 'active', isCurrent: true })
        .where(eq(schema.academicSessions.id, destSession.id));

      await tx.update(schema.academicTerms).set({ status: 'upcoming', isCurrent: false })
        .where(eq(schema.academicTerms.sessionId, destSession.id));

      const firstTermRows = await tx.select().from(schema.academicTerms)
        .where(and(eq(schema.academicTerms.sessionId, destSession.id), sql`lower(${schema.academicTerms.name}) = 'first term'`))
        .limit(1);
      if (firstTermRows.length > 0) {
        await tx.update(schema.academicTerms).set({ status: 'active', isCurrent: true })
          .where(eq(schema.academicTerms.id, firstTermRows[0].id));
      }
    });

    console.log(`[PROMOTIONS] Rollover activated: ${sourceSession.year} completed → ${destSession.year} active in First Term (by ${adminId}, created terms: ${createdTerms.join(', ') || 'none'})`);

    const refreshed = await getSessionOrThrow(destSession.id);
    const terms = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.sessionId, destSession.id));
    return {
      alreadyActive: false,
      message: `Academic year ${destSession.year} is now active in First Term`,
      createdTerms,
      session: refreshed,
      terms,
      completedSession: { id: sourceSession.id, year: sourceSession.year },
    };
  }