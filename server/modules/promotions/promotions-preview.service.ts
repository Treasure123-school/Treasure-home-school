/** Promotions read-side + mapping config — getPreview, getMappings,
 *  updateMappings, getHistory, getBatchDetail. Extracted from promotions.service.ts. */
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
  PromotionOutcome,
} from './promotions.schemas';
import { getSessionOrThrow, getClassOrThrow, detectActiveSession, applyStudentOutcome,
  recomputeBatchCounts } from './promotions.helpers';

  export async function getPreview(params: { sourceSessionId?: number; destinationSessionId: number }) {
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

    // Senior-secondary levels require a department (SSS subject mappings are per-department)
    const SENIOR_SECONDARY_LEVELS = ['SS1', 'SS2', 'SS3', 'Senior Secondary'];
    const isSeniorSecondary = (level: any) =>
      !!level && SENIOR_SECONDARY_LEVELS.some(l => String(level).toLowerCase().includes(l.toLowerCase()));

    const students = studentRows.map((s: any) => {
      const cls = s.classId ? classMap.get(s.classId) : null;
      const sourceEnrollment = sourceEnrollmentMap.get(s.id);
      const suggestedOutcome: PromotionOutcome = !cls
        ? 'repeating'
        : cls.isGraduationLevel ? 'graduated'
          : cls.nextClassId ? 'promoted' : 'repeating';
      // True when this student's suggested destination is SSS but they have no department
      const suggestedDestClass = cls?.nextClassId ? classMap.get(cls.nextClassId) : null;
      const needsDepartment =
        suggestedOutcome === 'promoted' &&
        isSeniorSecondary(suggestedDestClass?.level) &&
        !(s.department ?? null);
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        admissionNumber: s.admissionNumber,
        currentClassId: s.classId,
        currentClassName: cls?.name ?? null,
        department: s.department ?? null,
        needsDepartment,
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
  export async function getMappings() {
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
  export async function updateMappings(body: z.infer<typeof mappingsUpdateSchema>, adminId: string) {
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
    return await getMappings();
  }

  /**
   * POST /api/admin/promotions/execute
   * One controlled bulk operation. Per-student transactions; partial failures isolated.
   */
  export async function getHistory() {
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
  export async function getBatchDetail(batchId: number) {
    const batches = await db.select().from(schema.promotionBatches).where(eq(schema.promotionBatches.id, batchId)).limit(1);
    if (batches.length === 0) throw { statusCode: 404, message: `Promotion batch ${batchId} not found` };
    const batch = batches[0];

    const records = await db.select({
      id: schema.promotionRecords.id,
      studentId: schema.promotionRecords.studentId,
      studentName: sql<string>`concat(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
      admissionNumber: schema.students.admissionNumber,
      studentDepartment: schema.students.department,
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