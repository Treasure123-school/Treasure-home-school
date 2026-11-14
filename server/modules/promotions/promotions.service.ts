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

export const PROMOTION_OUTCOMES = ['promoted', 'repeating', 'graduated', 'withdrawn', 'deferred'] as const;
export type PromotionOutcome = typeof PROMOTION_OUTCOMES[number];

// ==================== Zod validation ====================

export const previewSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive().optional(),
  destinationSessionId: z.coerce.number().int().positive(),
});

export const mappingsUpdateSchema = z.object({
  mappings: z.array(z.object({
    classId: z.coerce.number().int().positive(),
    sequenceOrder: z.coerce.number().int().nullable().optional(),
    nextClassId: z.coerce.number().int().nullable().optional(),
    isGraduationLevel: z.coerce.boolean().optional(),
  })).min(1),
});

export const executeSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive(),
  destinationSessionId: z.coerce.number().int().positive(),
  students: z.array(z.object({
    studentId: z.string().min(30).max(40),
    outcome: z.enum(PROMOTION_OUTCOMES),
    toClassId: z.coerce.number().int().positive().nullable().optional(),
    reason: z.string().max(1000).optional(),
  })).min(1).max(2000),
});

export const rolloverSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive().optional(),
  destinationSessionId: z.coerce.number().int().positive(),
});

export const correctRecordSchema = z.object({
  outcome: z.enum(PROMOTION_OUTCOMES),
  toClassId: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().max(1000).optional(),
});

type Tx = any; // drizzle transaction type (matches existing codebase convention)

// ==================== Helpers ====================

async function getSessionOrThrow(sessionId: number) {
  const rows = await db.select().from(schema.academicSessions).where(eq(schema.academicSessions.id, sessionId)).limit(1);
  if (rows.length === 0) {
    throw { statusCode: 400, message: `Academic session ${sessionId} does not exist` };
  }
  return rows[0];
}

async function getClassOrThrow(classId: number) {
  const rows = await db.select().from(schema.classes).where(eq(schema.classes.id, classId)).limit(1);
  if (rows.length === 0) {
    throw { statusCode: 400, message: `Class ${classId} does not exist` };
  }
  return rows[0];
}

function detectActiveSession(sessions: any[]) {
  const today = new Date().toISOString().split('T')[0];
  const byDate = sessions.find((s: any) => s.startDate && s.endDate && s.startDate <= today && today <= s.endDate);
  return byDate ?? sessions.find((s: any) => s.isCurrent) ?? sessions.find((s: any) => s.status === 'active') ?? null;
}

/**
 * Apply one student's promotion outcome within a transaction.
 * Throws { message } on validation failure (caller converts to failed record).
 * Returns { subjectAssignmentPending, destinationClassId? } for post-commit work.
 */
async function applyStudentOutcome(
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

async function recomputeBatchCounts(batchId: number) {
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

export class PromotionsService {

  /**
   * GET /api/admin/promotions/preview
   * Everything the wizard needs: classes, students, suggested destinations, stats.
   */
  async getPreview(params: { sourceSessionId?: number; destinationSessionId: number }) {
    const sessions = await db.select().from(schema.academicSessions).orderBy(desc(schema.academicSessions.id));
    const sourceSessionId = params.sourceSessionId ?? detectActiveSession(sessions)?.id;
    if (!sourceSessionId) throw { statusCode: 400, message: 'No source academic session available' };
    if (sourceSessionId === params.destinationSessionId) {
      throw { statusCode: 400, message: 'Destination session must be different from the source session' };
    }
    const [sourceSession, destSession] = await Promise.all([
      getSessionOrThrow(sourceSessionId), getSessionOrThrow(params.destinationSessionId),
    ]);

    // Classes ordered by progression
    const allClasses = await db.select().from(schema.classes)
      .orderBy(asc(sql`case when ${schema.classes.sequenceOrder} is null then 1 else 0 end`), asc(schema.classes.sequenceOrder), asc(schema.classes.id));
    const classMap = new Map(allClasses.map((c: any) => [c.id, c]));

    // Active students with their current class + account status
    const studentRows = await db.select({
      id: schema.students.id,
      admissionNumber: schema.students.admissionNumber,
      classId: schema.students.classId,
      department: schema.students.department,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      status: schema.users.status,
    }).from(schema.students)
      .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
      .where(and(eq(schema.users.isActive, true), sql`${schema.users.deletedAt} IS NULL`));

    // Enrolments for both sessions
    const studentIds = studentRows.map((s: any) => s.id);
    const sourceEnrollments = studentIds.length > 0 ? await db.select().from(schema.studentEnrollments)
      .where(and(eq(schema.studentEnrollments.sessionId, sourceSessionId), inArray(schema.studentEnrollments.studentId, studentIds))) : [];
    const destEnrollments = studentIds.length > 0 ? await db.select().from(schema.studentEnrollments)
      .where(and(eq(schema.studentEnrollments.sessionId, params.destinationSessionId), inArray(schema.studentEnrollments.studentId, studentIds))) : [];
    const sourceEnrollmentMap = new Map(sourceEnrollments.map((e: any) => [e.studentId, e]));
    const destEnrollmentSet = new Set(destEnrollments.map((e: any) => e.studentId));

    const students = studentRows.map((s: any) => {
      const cls = s.classId ? classMap.get(s.classId) : null;
      const sourceEnrollment = sourceEnrollmentMap.get(s.id);
      const suggestedOutcome: PromotionOutcome = !cls
        ? 'repeating'
        : cls.isGraduationLevel ? 'graduated'
          : cls.nextClassId ? 'promoted' : 'repeating';
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        admissionNumber: s.admissionNumber,
        currentClassId: s.classId,
        currentClassName: cls?.name ?? null,
        department: s.department ?? null,
        accountStatus: s.status,
        hasSourceEnrollment: !!sourceEnrollment,
        alreadyProcessed: destEnrollmentSet.has(s.id),
        suggestedDestinationClassId: cls?.nextClassId ?? null,
        suggestedDestinationClassName: cls?.nextClassId ? classMap.get(cls.nextClassId)?.name ?? null : null,
        suggestedOutcome,
      };
    });

    const activeStudents = students.filter((s: any) => s.accountStatus === 'active' || s.accountStatus === 'graduated');
    const awaiting = activeStudents.filter((s: any) => !s.alreadyProcessed);
    const graduating = awaiting.filter((s: any) => s.suggestedOutcome === 'graduated');

    const classGroups = allClasses
      .filter((c: any) => c.isActive)
      .map((c: any) => {
        const members = students.filter((s: any) => s.currentClassId === c.id);
        return {
          id: c.id, name: c.name, level: c.level,
          sequenceOrder: c.sequenceOrder, nextClassId: c.nextClassId,
          nextClassName: c.nextClassId ? classMap.get(c.nextClassId)?.name ?? null : null,
          isGraduationLevel: c.isGraduationLevel,
          studentCount: members.length,
        };
      });

    return {
      sourceSession: { id: sourceSession.id, name: sourceSession.name, year: sourceSession.year, status: sourceSession.status },
      destinationSession: { id: destSession.id, name: destSession.name, year: destSession.year, status: destSession.status },
      stats: {
        totalActiveStudents: activeStudents.length,
        awaitingDecision: awaiting.length,
        alreadyProcessed: activeStudents.length - awaiting.length,
        graduatingStudents: graduating.length,
        promoted: destEnrollments.filter((e: any) => e.promotionOutcome === null || e.promotionOutcome === 'promoted').length,
        repeating: destEnrollments.filter((e: any) => e.promotionOutcome === 'repeating').length,
        graduated: destEnrollments.filter((e: any) => e.promotionOutcome === 'graduated').length,
        withdrawn: studentRows.filter((s: any) => s.status === 'withdrawn').length,
        deferred: destEnrollments.filter((e: any) => e.promotionOutcome === 'deferred').length,
      },
      classGroups,
      students,
      existingBatches: await db.select().from(schema.promotionBatches)
        .where(and(eq(schema.promotionBatches.sourceSessionId, sourceSessionId), eq(schema.promotionBatches.destinationSessionId, params.destinationSessionId))),
    };
  }

  /**
   * GET /api/admin/promotions/mappings
   */
  async getMappings() {
    const allClasses = await db.select().from(schema.classes)
      .orderBy(asc(sql`case when ${schema.classes.sequenceOrder} is null then 1 else 0 end`), asc(schema.classes.sequenceOrder), asc(schema.classes.id));
    const counts = await db.select({
      classId: schema.students.classId,
      count: sql<number>`count(*)::int`,
    }).from(schema.students).innerJoin(schema.users, eq(schema.students.id, schema.users.id))
      .where(and(eq(schema.users.isActive, true), ne(schema.users.status, 'graduated'), ne(schema.users.status, 'withdrawn')))
      .groupBy(schema.students.classId);
    const countMap = new Map(counts.map((c: any) => [c.classId, Number(c.count)]));
    return allClasses.map((c: any) => ({
      id: c.id, name: c.name, level: c.level, isActive: c.isActive,
      sequenceOrder: c.sequenceOrder,
      nextClassId: c.nextClassId,
      isGraduationLevel: c.isGraduationLevel,
      activeStudentCount: countMap.get(c.id) ?? 0,
    }));
  }

  /**
   * PUT /api/admin/promotions/mappings
   */
  async updateMappings(body: z.infer<typeof mappingsUpdateSchema>, adminId: string) {
    const allClasses = await db.select().from(schema.classes);
    const classMap = new Map(allClasses.map((c: any) => [c.id, c]));

    for (const m of body.mappings) {
      const cls = classMap.get(m.classId);
      if (!cls) throw { statusCode: 400, message: `Class ${m.classId} does not exist` };
      if (m.nextClassId !== undefined && m.nextClassId !== null) {
        if (!classMap.has(m.nextClassId)) throw { statusCode: 400, message: `nextClassId ${m.nextClassId} does not exist` };
        if (m.nextClassId === m.classId) throw { statusCode: 400, message: `A class cannot be its own next class` };
      }
      if (m.nextClassId === null) {
        // Destination cleared → the class must be marked as a graduation level (or excluded)
      }
    }

    // Cycle check across the full chain after applying updates
    const nextMap = new Map(allClasses.map((c: any) => [c.id, c.nextClassId as number | null]));
    for (const m of body.mappings) {
      nextMap.set(m.classId, m.nextClassId !== undefined ? (m.nextClassId ?? null) : (nextMap.get(m.classId) ?? null));
    }
    for (const startId of nextMap.keys()) {
      const seen = new Set<number>([startId]);
      let cursor = nextMap.get(startId) ?? null;
      let hops = 0;
      while (cursor && hops < 100) {
        if (seen.has(cursor)) {
          throw { statusCode: 400, message: `Class progression mapping contains a cycle involving class ${cursor}` };
        }
        seen.add(cursor);
        cursor = nextMap.get(cursor) ?? null;
        hops++;
      }
    }

    for (const m of body.mappings) {
      await db.update(schema.classes).set({
        ...(m.sequenceOrder !== undefined ? { sequenceOrder: m.sequenceOrder } : {}),
        ...(m.nextClassId !== undefined ? { nextClassId: m.nextClassId } : {}),
        ...(m.isGraduationLevel !== undefined ? { isGraduationLevel: m.isGraduationLevel } : {}),
      }).where(eq(schema.classes.id, m.classId));
    }

    console.log(`[PROMOTIONS] Progression mappings updated by admin ${adminId} (${body.mappings.length} classes)`);
    return await this.getMappings();
  }

  /**
   * POST /api/admin/promotions/execute
   * One controlled bulk operation. Per-student transactions; partial failures isolated.
   */
  async execute(body: z.infer<typeof executeSchema>, adminId: string) {
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
  async getHistory() {
    const batches = await db.select({
      id: schema.promotionBatches.id,
      sourceSessionId: schema.promotionBatches.sourceSessionId,
      destinationSessionId: schema.promotionBatches.destinationSessionId,
      executedBy: schema.promotionBatches.executedBy,
      executedByName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      status: schema.promotionBatches.status,
      totalStudents: schema.promotionBatches.totalStudents,
      promotedCount: schema.promotionBatches.promotedCount,
      repeatingCount: schema.promotionBatches.repeatingCount,
      graduatedCount: schema.promotionBatches.graduatedCount,
      withdrawnCount: schema.promotionBatches.withdrawnCount,
      deferredCount: schema.promotionBatches.deferredCount,
      failedCount: schema.promotionBatches.failedCount,
      notes: schema.promotionBatches.notes,
      executedAt: schema.promotionBatches.executedAt,
    }).from(schema.promotionBatches)
      .leftJoin(schema.users, eq(schema.promotionBatches.executedBy, schema.users.id))
      .orderBy(desc(schema.promotionBatches.executedAt));

    const sessions = await db.select().from(schema.academicSessions);
    const sessionMap = new Map(sessions.map((s: any) => [s.id, s]));
    return batches.map((b: any) => ({
      ...b,
      sourceSessionYear: sessionMap.get(b.sourceSessionId)?.year ?? null,
      destinationSessionYear: sessionMap.get(b.destinationSessionId)?.year ?? null,
    }));
  }

  /**
   * GET /api/admin/promotions/history/:batchId
   */
  async getBatchDetail(batchId: number) {
    const batches = await db.select().from(schema.promotionBatches).where(eq(schema.promotionBatches.id, batchId)).limit(1);
    if (batches.length === 0) throw { statusCode: 404, message: `Promotion batch ${batchId} not found` };
    const batch = batches[0];

    const records = await db.select({
      id: schema.promotionRecords.id,
      studentId: schema.promotionRecords.studentId,
      studentName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      admissionNumber: schema.students.admissionNumber,
      fromClassId: schema.promotionRecords.fromClassId,
      toClassId: schema.promotionRecords.toClassId,
      outcome: schema.promotionRecords.outcome,
      status: schema.promotionRecords.status,
      reason: schema.promotionRecords.reason,
      errorMessage: schema.promotionRecords.errorMessage,
      correctedAt: schema.promotionRecords.correctedAt,
      createdAt: schema.promotionRecords.createdAt,
    }).from(schema.promotionRecords)
      .innerJoin(schema.students, eq(schema.promotionRecords.studentId, schema.students.id))
      .innerJoin(schema.users, eq(schema.promotionRecords.studentId, schema.users.id))
      .where(eq(schema.promotionRecords.batchId, batchId))
      .orderBy(asc(schema.promotionRecords.id));

    const classIds = new Set<number>();
    records.forEach((r: any) => { if (r.fromClassId) classIds.add(r.fromClassId); if (r.toClassId) classIds.add(r.toClassId); });
    const classRows = classIds.size > 0 ? await db.select().from(schema.classes).where(inArray(schema.classes.id, Array.from(classIds))) : [];
    const classNameMap = new Map(classRows.map((c: any) => [c.id, c.name]));

    const sessions = await db.select().from(schema.academicSessions);
    const sessionMap = new Map(sessions.map((s: any) => [s.id, s]));

    return {
      batch: {
        ...batch,
        sourceSessionYear: sessionMap.get(batch.sourceSessionId)?.year ?? null,
        destinationSessionYear: sessionMap.get(batch.destinationSessionId)?.year ?? null,
      },
      records: records.map((r: any) => ({
        ...r,
        fromClassName: r.fromClassId ? classNameMap.get(r.fromClassId) ?? null : null,
        toClassName: r.toClassId ? classNameMap.get(r.toClassId) ?? null : null,
      })),
    };
  }

  /**
   * PATCH /api/admin/promotions/records/:recordId
   * Correct an individual student's promotion outcome, reconciling all affected state.
   */
  async correctRecord(recordId: number, body: z.infer<typeof correctRecordSchema>, adminId: string) {
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
  async rolloverActivate(body: z.infer<typeof rolloverSchema>, adminId: string) {
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
}
