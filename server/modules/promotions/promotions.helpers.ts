/** Promotion helpers — lookup-or-throw, active session detection, per-student
 *  outcome application, batch count recomputation. Extracted from promotions.service.ts. */
import { db } from '../../db';
import * as schema from '../../../shared/schema.pg';
import { eq, and, ne, inArray, desc, asc, sql } from 'drizzle-orm';
import type { Tx, PromotionOutcome } from './promotions.schemas';

export async function getSessionOrThrow(sessionId: number) {
  const rows = await db.select().from(schema.academicSessions).where(eq(schema.academicSessions.id, sessionId)).limit(1);
  if (rows.length === 0) {
    throw { statusCode: 400, message: `Academic session ${sessionId} does not exist` };
  }
  return rows[0];
}

export async function getClassOrThrow(classId: number) {
  const rows = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1);
  if (rows.length === 0) {
    throw { statusCode: 400, message: `Class ${classId} does not exist` };
  }
  return rows[0];
}

export function detectActiveSession(sessions: any[]) {
  const today = new Date().toISOString().split('T')[0];
  const byDate = sessions.find((s: any) => s.startDate && s.endDate && s.startDate <= today && today <= s.endDate);
  return byDate ?? sessions.find((s: any) => s.isCurrent) ?? sessions.find((s: any) => s.status === 'active') ?? null;
}

/**
 * Apply one student's promotion outcome within a transaction.
 * Throws { message } on validation failure (caller converts to failed record).
 * Returns { subjectAssignmentPending, destinationClassId? } for post-commit work.
 */
export async function applyStudentOutcome(
  tx: Tx,
  params: {
    batchId: number | null,
    studentId: string,
    sourceSessionId: number,
    destinationSessionId: number,
    outcome: PromotionOutcome,
    toClassId?: number | null,
    reason?: string | null,
  }
) {
  const { studentId, sourceSessionId, destinationSessionId, outcome } = params;

  // 1. Load student + user
  const studentRows = await tx.select().from(schema.students).where(eq(schema.students.id, studentId)).limit(1);
  if (studentRows.length === 0) throw new Error(`Student ${studentId} not found`);
  const student = studentRows[0];
  if (!student.classId) throw new Error(`Student ${studentId} has no class assignment`);

  const currentClass = await tx.select().from(schema.classes).where(eq(schema.classes.id, student.classId)).limit(1);
  if (currentClass.length === 0) throw new Error(`Student's class ${student.classId} no longer exists`);
  const fromClassId = student.classId;

  // 2. Source enrolment (create implicitly if the student was never enrolled for this session)
  const sourceEnrollmentRows = await tx.select().from(schema.studentEnrollments)
    .where(and(eq(schema.studentEnrollments.studentId, studentId), eq(schema.studentEnrollments.sessionId, sourceSessionId)))
    .limit(1);
  let sourceEnrollment = sourceEnrollmentRows[0];
  if (!sourceEnrollment) {
    const created = await tx.insert(schema.studentEnrollments)
      .values({ studentId, sessionId: sourceSessionId, classId: fromClassId, status: 'active' })
      .returning();
    sourceEnrollment = created[0];
  }

  // 3. Duplicate enrolment guard — DB unique index is the final backstop
  const existingDest = await tx.select().from(schema.studentEnrollments)
    .where(and(eq(schema.studentEnrollments.studentId, studentId), eq(schema.studentEnrollments.sessionId, destinationSessionId)))
    .limit(1);
  if (existingDest.length > 0 && outcome !== 'graduated' && outcome !== 'withdrawn') {
    throw new Error(`Student already has an enrolment in the destination session (id ${existingDest[0].id})`);
  }

  let destinationClassId: number | null = null;
  let subjectAssignmentPending = false;

  if (outcome === 'promoted') {
    // 4. Resolve destination class: explicit override or configured progression
    const destClassId = params.toClassId ?? currentClass[0].nextClassId;
    if (!destClassId) {
      throw new Error(`No destination class: class "${currentClass[0].name}" has no next class configured and no override provided`);
    }
    const destClassRows = await tx.select().from(schema.classes).where(eq(schema.classes.id, destClassId)).limit(1);
    if (destClassRows.length === 0) throw new Error(`Destination class ${destClassId} does not exist`);
    if (destClassId === fromClassId) {
      throw new Error(`Destination class equals current class — use the "repeating" outcome instead`);
    }
    destinationClassId = destClassId;

    // 5. Move the operational pointer + create destination enrolment
    await tx.update(schema.students).set({ classId: destClassId }).where(eq(schema.students.id, studentId));
    await tx.insert(schema.studentEnrollments).values({
      studentId, sessionId: destinationSessionId, classId: destClassId, status: 'active',
    });
    await tx.update(schema.studentEnrollments).set({
      status: 'completed', promotionOutcome: 'promoted', promotedToClassId: destClassId, updatedAt: new Date(),
    }).where(eq(schema.studentEnrollments.id, sourceEnrollment.id));
    subjectAssignmentPending = true;
  } else if (outcome === 'repeating') {
    await tx.insert(schema.studentEnrollments).values({
      studentId, sessionId: destinationSessionId, classId: fromClassId, status: 'active',
    });
    await tx.update(schema.studentEnrollments).set({
      status: 'completed', promotionOutcome: 'repeating', updatedAt: new Date(),
    }).where(eq(schema.studentEnrollments.id, sourceEnrollment.id));
  } else if (outcome === 'graduated') {
    await tx.update(schema.studentEnrollments).set({
      status: 'completed', promotionOutcome: 'graduated', updatedAt: new Date(),
    }).where(eq(schema.studentEnrollments.id, sourceEnrollment.id));
    // Account stays active (alumni can still log in) but is flagged and hidden from active lists
    await tx.update(schema.users).set({ status: 'graduated' }).where(eq(schema.users.id, studentId));
  } else if (outcome === 'withdrawn') {
    await tx.update(schema.studentEnrollments).set({
      status: 'completed', promotionOutcome: 'withdrawn', updatedAt: new Date(),
    }).where(eq(schema.studentEnrollments.id, sourceEnrollment.id));
    // Account deactivated (no login) — records are preserved
    await tx.update(schema.users).set({ status: 'withdrawn', isActive: false }).where(eq(schema.users.id, studentId));
  } else if (outcome === 'deferred') {
    // Decision not finalized: keep the old class association, flag as pending in the new session
    await tx.insert(schema.studentEnrollments).values({
      studentId, sessionId: destinationSessionId, classId: fromClassId, status: 'pending', promotionOutcome: 'deferred',
    });
    await tx.update(schema.studentEnrollments).set({
      promotionOutcome: 'deferred', updatedAt: new Date(),
    }).where(eq(schema.studentEnrollments.id, sourceEnrollment.id));
  } else {
    throw new Error(`Unknown outcome "${outcome}"`);
  }

  // 6. Per-student audit record
  if (params.batchId !== null) {
    await tx.insert(schema.promotionRecords).values({
      batchId: params.batchId,
      studentId,
      fromClassId,
      toClassId: destinationClassId,
      outcome,
      status: 'success',
      reason: params.reason ?? null,
    });
  }

  return { destinationClassId, subjectAssignmentPending, fromClassId };
}

export async function recomputeBatchCounts(batchId: number) {
  const counts = await db.select({
    outcome: schema.promotionRecords.outcome,
    status: schema.promotionRecords.status,
    count: sql<number>`count(*)::int`,
  }).from(schema.promotionRecords).where(eq(schema.promotionRecords.batchId, batchId))
    .groupBy(schema.promotionRecords.outcome, schema.promotionRecords.status);

  const stats = {
    totalStudents: 0, promotedCount: 0, repeatingCount: 0, graduatedCount: 0,
    withdrawnCount: 0, deferredCount: 0, failedCount: 0,
  };
  for (const c of counts) {
    stats.totalStudents += Number(c.count);
    if (c.status === 'failed') { stats.failedCount += Number(c.count); continue; }
    switch (c.outcome) {
      case 'promoted': stats.promotedCount += Number(c.count); break;
      case 'repeating': stats.repeatingCount += Number(c.count); break;
      case 'graduated': stats.graduatedCount += Number(c.count); break;
      case 'withdrawn': stats.withdrawnCount += Number(c.count); break;
      case 'deferred': stats.deferredCount += Number(c.count); break;
    }
  }
  const allFailed = stats.totalStudents > 0 && stats.failedCount === stats.totalStudents;
  await db.update(schema.promotionBatches).set({ ...stats, status: allFailed ? 'failed' : 'completed' })
    .where(eq(schema.promotionBatches.id, batchId));
  return stats;
}

// ==================== Service ====================
