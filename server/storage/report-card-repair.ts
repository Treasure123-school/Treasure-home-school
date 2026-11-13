/** Storage layer: report card repair operations (missing subjects, resync).
 *  Chain: DatabaseStorageReportCardRepair → extends into score-sync-messages-gallery.ts */
import { db, schema } from '../storage/helpers';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { DatabaseStorageEventsUserCleanup } from './school-events-user-cleanup'
import type { IStorage } from './types'

export class DatabaseStorageReportCardRepair extends DatabaseStorageEventsUserCleanup {
  async addMissingSubjectsToReportCards(classIds: number[]): Promise<{ studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[] }> {
    if (!classIds?.length) return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [] };

    let totalItemsAdded = 0;
    let examScoresSynced = 0;
    const errors: string[] = [];

    try {
      // ── 1. All active students in affected classes (1 query) ──────────────
      const students = await db.select({
        id: schema.students.id,
        classId: schema.students.classId,
        department: schema.students.department,
      })
        .from(schema.students)
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .where(and(
          inArray(schema.students.classId, classIds),
          eq(schema.users.isActive, true)
        ));

      if (!students.length) return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [] };
      console.log(`[ADD-MISSING-SUBJECTS] ${students.length} students across ${classIds.length} classes`);

      // ── 2. All class info (1 query) ────────────────────────────────────────
      const classRows = await db.select({ id: schema.classes.id, name: schema.classes.name, level: schema.classes.level })
        .from(schema.classes)
        .where(inArray(schema.classes.id, classIds));
      const classMap = new Map<number, { id: number; name: string | null; level: string | null }>();
      for (const row of classRows) classMap.set(row.id, row);

      // ── 3. All class-subject mappings for affected classes (1 query) ───────
      const allMappings = await db.select({
        classId: schema.classSubjectMappings.classId,
        subjectId: schema.classSubjectMappings.subjectId,
        department: schema.classSubjectMappings.department,
      }).from(schema.classSubjectMappings)
        .where(inArray(schema.classSubjectMappings.classId, classIds));

      // Mirrors getClassSubjectMappings: dept passed → accept NULL or matching dept
      const getSubjectIds = (classId: number, dept?: string): Set<number> => {
        const ids = new Set<number>();
        for (const m of allMappings) {
          if (m.classId !== classId) continue;
          if (dept !== undefined) {
            if (m.department === null || m.department === undefined || m.department === dept) ids.add(m.subjectId);
          } else {
            ids.add(m.subjectId);
          }
        }
        return ids;
      };

      // ── 4. All report cards for all students (1 query) ────────────────────
      const studentIds: string[] = [];
      for (const s of students) studentIds.push(s.id);
      const allReportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        termId: schema.reportCards.termId,
        gradingScale: schema.reportCards.gradingScale,
      }).from(schema.reportCards)
        .where(inArray(schema.reportCards.studentId, studentIds));

      if (!allReportCards.length) return { studentsProcessed: students.length, itemsAdded: 0, examScoresSynced: 0, errors: [] };

      const rcByStudent = new Map<string, typeof allReportCards>();
      for (const rc of allReportCards) {
        if (!rcByStudent.has(rc.studentId)) rcByStudent.set(rc.studentId, []);
        rcByStudent.get(rc.studentId)!.push(rc);
      }

      // ── 5. All existing items for all report cards (1 query) ──────────────
      const rcIds: number[] = [];
      for (const rc of allReportCards) rcIds.push(rc.id);
      const allExistingItems = await db.select({
        reportCardId: schema.reportCardItems.reportCardId,
        subjectId: schema.reportCardItems.subjectId,
      }).from(schema.reportCardItems)
        .where(inArray(schema.reportCardItems.reportCardId, rcIds));

      const existingByRc = new Map<number, Set<number>>();
      for (const item of allExistingItems) {
        if (!existingByRc.has(item.reportCardId)) existingByRc.set(item.reportCardId, new Set());
        existingByRc.get(item.reportCardId)!.add(item.subjectId);
      }

      // ── 6. Compute the full insert queue ──────────────────────────────────
      type InsertEntry = { reportCardId: number; subjectId: number; studentId: string; termId: number | null; gradingScale: string | null };
      const insertQueue: InsertEntry[] = [];

      for (const student of students) {
        const classInfo = classMap.get(student.classId!);
        if (!classInfo) continue;
        const isSS = ['SS1','SS2','SS3','Senior Secondary'].some(l =>
          classInfo.level?.toLowerCase().includes(l.toLowerCase()) ||
          classInfo.name?.toLowerCase().includes(l.toLowerCase())
        );
        const dept = isSS ? (student.department?.toLowerCase().trim() || undefined) : undefined;
        const allowedIds = getSubjectIds(student.classId!, dept);
        if (!allowedIds.size) continue;

        for (const rc of rcByStudent.get(student.id) || []) {
          const existing = existingByRc.get(rc.id) || new Set();
          for (const subjectId of allowedIds) {
            if (!existing.has(subjectId)) {
              insertQueue.push({ reportCardId: rc.id, subjectId, studentId: student.id, termId: rc.termId, gradingScale: rc.gradingScale });
            }
          }
        }
      }

      if (!insertQueue.length) {
        console.log('[ADD-MISSING-SUBJECTS] No missing subjects found — nothing to insert');
        return { studentsProcessed: students.length, itemsAdded: 0, examScoresSynced: 0, errors: [] };
      }
      console.log(`[ADD-MISSING-SUBJECTS] Inserting ${insertQueue.length} missing subject rows`);

      // ── 7. Batch insert in chunks of 100 (avoids parameter limit) ─────────
      const CHUNK = 100;
      const insertedItems: Array<{ id: number; reportCardId: number; subjectId: number }> = [];
      for (let i = 0; i < insertQueue.length; i += CHUNK) {
        const chunk = insertQueue.slice(i, i + CHUNK);
        const rows = await db.insert(schema.reportCardItems)
          .values(chunk.map(v => ({ reportCardId: v.reportCardId, subjectId: v.subjectId, totalMarks: 100, obtainedMarks: 0, percentage: 0 })))
          .onConflictDoNothing()
          .returning({ id: schema.reportCardItems.id, reportCardId: schema.reportCardItems.reportCardId, subjectId: schema.reportCardItems.subjectId });
        totalItemsAdded += rows.length;
        insertedItems.push(...rows);
      }

      if (!insertedItems.length) {
        return { studentsProcessed: students.length, itemsAdded: 0, examScoresSynced: 0, errors: [] };
      }

      // ── 8. Build fast lookups for score assignment ─────────────────────────
      // "rcId:subjectId" → new item id
      const newItemMap = new Map<string, number>();
      for (const item of insertedItems) newItemMap.set(`${item.reportCardId}:${item.subjectId}`, item.id);

      // rc meta for recalculation
      const rcMeta = new Map<number, { gradingScale: string | null }>();
      for (const v of insertQueue) {
        if (!rcMeta.has(v.reportCardId)) rcMeta.set(v.reportCardId, { gradingScale: v.gradingScale });
      }

      // "studentId:termId" → rcId
      const rcByStudentTerm = new Map<string, number>();
      for (const rc of allReportCards) {
        if (rc.termId) rcByStudentTerm.set(`${rc.studentId}:${rc.termId}`, rc.id);
      }

      // ── 9. Batch fetch exam results covering newly added (student, term) pairs
      const newStudentIds = [...new Set(insertQueue.map(v => v.studentId))];
      const newTermIds = [...new Set(insertQueue.map(v => v.termId).filter((t): t is number => t !== null))];

      if (newStudentIds.length && newTermIds.length) {
        const examResultsForNew = await db.select({
          studentId: schema.examResults.studentId,
          examId: schema.examResults.examId,
          subjectId: schema.exams.subjectId,
          termId: schema.exams.termId,
          examType: schema.exams.examType,
          createdBy: schema.exams.createdBy,
          score: sql<number>`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}, 0)`,
          // exam_results.maxScore is the ACTUAL max the exam was marked out of (e.g. 60).
        // exams.totalMarks is the template default (often 100) and must only be a fallback.
        maxScore: sql<number>`COALESCE(${schema.examResults.maxScore}, ${schema.exams.totalMarks}, 100)`,
        })
          .from(schema.examResults)
          .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
          .where(and(
            inArray(schema.examResults.studentId, newStudentIds),
            inArray(schema.exams.termId, newTermIds),
            sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`
          ));

        // ── 10. Apply scores to the newly created items ──────────────────────
        const rcIdsToRecalculate = new Set<number>();
        for (const result of examResultsForNew) {
          const rcId = rcByStudentTerm.get(`${result.studentId}:${result.termId}`);
          if (!rcId) continue;
          const itemId = newItemMap.get(`${rcId}:${result.subjectId}`);
          if (!itemId) continue;

          const isTest = ['test', 'quiz', 'assignment'].includes(result.examType);
          const isMainExam = ['exam', 'final', 'midterm'].includes(result.examType);
          if (!isTest && !isMainExam) continue;

          const safeScore = Number(result.score) || 0;
          const safeMaxScore = Number(result.maxScore) || 100;
          const updateData: any = { updatedAt: new Date() };
          if (isTest) {
            updateData.testExamId = result.examId;
            updateData.testExamCreatedBy = result.createdBy;
            updateData.testScore = safeScore;
            updateData.testMaxScore = safeMaxScore;
          } else {
            updateData.examExamId = result.examId;
            updateData.examExamCreatedBy = result.createdBy;
            updateData.examScore = safeScore;
            updateData.examMaxScore = safeMaxScore;
          }
          await db.update(schema.reportCardItems).set(updateData).where(eq(schema.reportCardItems.id, itemId));
          rcIdsToRecalculate.add(rcId);
          examScoresSynced++;
        }

        // ── 11. Recalculate only report cards that actually changed ──────────
        for (const rcId of rcIdsToRecalculate) {
          const meta = rcMeta.get(rcId);
          await this.recalculateReportCard(rcId, meta?.gradingScale || 'standard').catch((e: any) => {
            errors.push(`Recalculate RC ${rcId}: ${e.message}`);
          });
        }
      }

      // ── Phase 2: Fill NULL scores on EXISTING items (bulk, 1 JOIN query) ──
      // The previous phases only wrote scores for NEWLY inserted rows.
      // Students who already had a report_card_items row (created when the report
      // card was first generated) but exam_score = NULL were never touched.
      // This phase fixes all such rows that aren't manually overridden.
      console.log(`[ADD-MISSING-SUBJECTS] Phase 2: scanning existing items with NULL scores…`);

      const phase2RcIds = new Set<number>();

      // Build a rc→gradingScale lookup for phase 2 recalculations
      const rcGradingMap = new Map<number, string | null>();
      for (const rc of allReportCards) rcGradingMap.set(rc.id, rc.gradingScale);

      // Single query: existing items with NULL exam_score or NULL test_score,
      // joined to matching exam results for the same student+subject+term.
      const nullScoreItems = await db.select({
        itemId: schema.reportCardItems.id,
        reportCardId: schema.reportCardItems.reportCardId,
        subjectId: schema.reportCardItems.subjectId,
        examId: schema.exams.id,
        examType: schema.exams.examType,
        createdBy: schema.exams.createdBy,
        score: sql<number>`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}, 0)`,
        // exam_results.maxScore is the ACTUAL max the exam was marked out of (e.g. 60).
        // exams.totalMarks is the template default (often 100) and must only be a fallback.
        maxScore: sql<number>`COALESCE(${schema.examResults.maxScore}, ${schema.exams.totalMarks}, 100)`,
        currentExamScore: schema.reportCardItems.examScore,
        currentTestScore: schema.reportCardItems.testScore,
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.examResults, and(
          eq(schema.examResults.studentId, schema.reportCards.studentId),
          sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`
        ))
        .innerJoin(schema.exams, and(
          eq(schema.exams.id, schema.examResults.examId),
          eq(schema.exams.subjectId, schema.reportCardItems.subjectId),
          eq(schema.exams.termId, schema.reportCards.termId)
        ))
        .where(and(
          inArray(schema.reportCards.studentId, studentIds),
          // Only touch rows that are not manually overridden
          or(
            eq(schema.reportCardItems.isOverridden, false),
            isNull(schema.reportCardItems.isOverridden)
          ),
          // Only rows where the relevant score slot is still NULL
          or(
            and(
              inArray(schema.exams.examType, ['exam', 'final', 'midterm']),
              isNull(schema.reportCardItems.examScore)
            ),
            and(
              inArray(schema.exams.examType, ['test', 'quiz', 'assignment']),
              isNull(schema.reportCardItems.testScore)
            )
          )
        ));

      console.log(`[ADD-MISSING-SUBJECTS] Phase 2: ${nullScoreItems.length} existing items to backfill`);

      for (const row of nullScoreItems) {
        try {
          const isTest = ['test', 'quiz', 'assignment'].includes(row.examType);
          const isMainExam = ['exam', 'final', 'midterm'].includes(row.examType);
          if (!isTest && !isMainExam) continue;

          // Double-check: skip if score already present (race condition safety)
          if (isMainExam && row.currentExamScore !== null) continue;
          if (isTest && row.currentTestScore !== null) continue;

          const safeScore = Number(row.score) || 0;
          const safeMaxScore = Number(row.maxScore) || 100;
          const updateData: any = { updatedAt: new Date() };
          if (isTest) {
            updateData.testExamId = row.examId;
            updateData.testExamCreatedBy = row.createdBy;
            updateData.testScore = safeScore;
            updateData.testMaxScore = safeMaxScore;
          } else {
            updateData.examExamId = row.examId;
            updateData.examExamCreatedBy = row.createdBy;
            updateData.examScore = safeScore;
            updateData.examMaxScore = safeMaxScore;
          }
          await db.update(schema.reportCardItems).set(updateData).where(eq(schema.reportCardItems.id, row.itemId));
          phase2RcIds.add(row.reportCardId);
          examScoresSynced++;
        } catch (e: any) {
          errors.push(`Phase2 item ${row.itemId}: ${e.message}`);
        }
      }

      // Phase 3+4: Recalculate all report cards changed in phase 2
      for (const rcId of phase2RcIds) {
        await this.recalculateReportCard(rcId, rcGradingMap.get(rcId) || 'standard').catch((e: any) => {
          errors.push(`Phase2 recalculate RC ${rcId}: ${e.message}`);
        });
      }
      console.log(`[ADD-MISSING-SUBJECTS] Phase 2 done: ${examScoresSynced} total scores synced, ${phase2RcIds.size} report cards recalculated`);

      console.log(`[ADD-MISSING-SUBJECTS] Done: ${students.length} students, ${totalItemsAdded} items added, ${examScoresSynced} scores synced`);
      return { studentsProcessed: students.length, itemsAdded: totalItemsAdded, examScoresSynced, errors };

    } catch (error: any) {
      console.error('[ADD-MISSING-SUBJECTS] Error:', error);
      return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
    }
  }

  /**
   * FIX: Repair all report cards by adding missing subjects AND syncing exam scores.
   *
   * Two-phase repair:
   * Phase 1 — addMissingSubjectsToReportCards:
   *   Inserts subject rows that are completely absent, then fills scores for
   *   those NEW rows only (existing rows are not touched in that helper).
   *
   * Phase 2 — Bulk SQL NULL-score fill:
   *   After phase 1, run UPDATE statements to fill NULL exam_score / test_score
   *   on ALL existing rows that still have no score (is_overridden = false).
   *   This covers the common case where report_card_items rows were created
   *   earlier but the exam scores were never synced into them.
   *   Finally, recalculate obtained_marks / percentage / report_card totals for
   *   every row that was just updated.
   */

  async repairAllReportCards(): Promise<{ studentsProcessed: number; itemsAdded: number; examScoresSynced: number; errors: string[] }> {
    const errors: string[] = [];
    try {
      // ── Phase 1: Add missing subject rows + fill scores for new rows ──────
      const classes = await db.select({ id: schema.classes.id })
        .from(schema.classes)
        .where(eq(schema.classes.isActive, true));

      const classIds = classes.map((c: { id: number }) => c.id);
      console.log(`[REPAIR-REPORT-CARDS] Starting repair for ${classIds.length} classes`);

      const phase1 = await this.addMissingSubjectsToReportCards(classIds);
      errors.push(...phase1.errors);

      // ── Phase 2: Bulk-fill NULL scores on ALL existing items ──────────────
      // Fills exam_score where it is currently NULL and is_overridden = false.
      // Uses DISTINCT ON (rc.id, subject_id) so one result per student/subject.
      console.log('[REPAIR-REPORT-CARDS] Phase 2 — bulk-filling NULL exam scores on existing items...');

      await db.execute(sql`
        UPDATE report_card_items rci
        SET
          exam_exam_id         = subq.exam_id,
          exam_score           = subq.score,
          exam_max_score       = subq.max_score,
          exam_exam_created_by = subq.created_by,
          updated_at           = NOW()
        FROM (
          SELECT DISTINCT ON (rc.id, e.subject_id)
            rc.id                                                    AS rc_id,
            e.subject_id,
            e.id                                                     AS exam_id,
            COALESCE(er.score, er.marks_obtained, 0)::integer        AS score,
            COALESCE(er.max_score, e.total_marks, 100)::integer      AS max_score,
            e.created_by
          FROM exam_results er
          JOIN exams e       ON e.id  = er.exam_id
          JOIN report_cards rc
            ON  rc.student_id = er.student_id
            AND rc.term_id    = e.term_id
          WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            AND e.exam_type IN ('exam', 'final', 'midterm')
          ORDER BY rc.id, e.subject_id, er.id DESC
        ) subq
        WHERE rci.report_card_id = subq.rc_id
          AND rci.subject_id     = subq.subject_id
          AND rci.exam_score     IS NULL
          AND rci.is_overridden  = false
      `);

      // Same for test-type (CA / quiz / assignment) scores
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
            COALESCE(er.max_score, e.total_marks, 100)::integer      AS max_score,
            e.created_by
          FROM exam_results er
          JOIN exams e       ON e.id  = er.exam_id
          JOIN report_cards rc
            ON  rc.student_id = er.student_id
            AND rc.term_id    = e.term_id
          WHERE COALESCE(er.score, er.marks_obtained) IS NOT NULL
            AND e.exam_type IN ('test', 'quiz', 'assignment')
          ORDER BY rc.id, e.subject_id, er.id DESC
        ) subq
        WHERE rci.report_card_id = subq.rc_id
          AND rci.subject_id     = subq.subject_id
          AND rci.test_score     IS NULL
          AND rci.is_overridden  = false
      `);

      // ── Phase 3: Recalculate obtained_marks / percentage on updated items ─
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
        WHERE
          (rci.exam_score IS NOT NULL OR rci.test_score IS NOT NULL)
          AND (
            rci.obtained_marks != COALESCE(rci.exam_score, 0) + COALESCE(rci.test_score, 0)
            OR rci.percentage = 0
          )
      `);

      // ── Phase 4: Recalculate report_cards header totals ───────────────────
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
          WHERE (rci.exam_score IS NOT NULL OR rci.test_score IS NOT NULL)
          GROUP BY rci.report_card_id
        ) agg
        WHERE rc.id = agg.report_card_id
      `);

      console.log(`[REPAIR-REPORT-CARDS] Done — phase1: ${phase1.itemsAdded} items added, ${phase1.examScoresSynced} new scores; phase2: bulk NULL-score fill + recalculate complete`);

      return {
        studentsProcessed: phase1.studentsProcessed,
        itemsAdded:        phase1.itemsAdded,
        examScoresSynced:  phase1.examScoresSynced,
        errors,
      };
    } catch (error: any) {
      console.error('[REPAIR-REPORT-CARDS] Error:', error);
      return { studentsProcessed: 0, itemsAdded: 0, examScoresSynced: 0, errors: [error.message] };
    }
  }


  async syncReportCardItemsOnExamSubjectChange(examId: number, oldSubjectId: number, newSubjectId: number): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      console.log(`[SYNC] Syncing report card items for exam ${examId}: subject ${oldSubjectId} -> ${newSubjectId}`);

      // Collect all report card items that reference this exam (as CA/test or as main exam)
      const affectedItems = await db.select()
        .from(schema.reportCardItems)
        .where(or(
          eq(schema.reportCardItems.testExamId, examId),
          eq(schema.reportCardItems.examExamId, examId)
        ));

      if (affectedItems.length === 0) {
        console.log(`[SYNC] No report card items found referencing exam ${examId}`);
        return { updated: 0, errors };
      }

      for (const item of affectedItems) {
        try {
          const isTestExam = item.testExamId === examId;
          const isMainExam = item.examExamId === examId;

          // Check whether the new subject already has a report card item in this same report card.
          // If it does, we must MERGE (not create a duplicate) by moving the score over.
          const [existingNewItem] = await db.select()
            .from(schema.reportCardItems)
            .where(and(
              eq(schema.reportCardItems.reportCardId, item.reportCardId),
              eq(schema.reportCardItems.subjectId, newSubjectId),
              ne(schema.reportCardItems.id, item.id)
            ))
            .limit(1);

          if (existingNewItem) {
            // --- MERGE: move this exam's score into the already-existing new-subject item ---
            // Always force-overwrite the target item with the moved exam's score.
            // The exam's subject is now authoritative — we must NOT leave the score orphaned
            // even if the target item already had a score from a different exam.
            const mergeUpdates: Record<string, any> = {};

            if (isTestExam) {
              mergeUpdates.testExamId = item.testExamId;
              mergeUpdates.testScore = item.testScore;
              mergeUpdates.testMaxScore = item.testMaxScore;
              mergeUpdates.testWeightedScore = item.testWeightedScore;
              mergeUpdates.testExamCreatedBy = item.testExamCreatedBy;
            }
            if (isMainExam) {
              mergeUpdates.examExamId = item.examExamId;
              mergeUpdates.examScore = item.examScore;
              mergeUpdates.examMaxScore = item.examMaxScore;
              mergeUpdates.examWeightedScore = item.examWeightedScore;
              mergeUpdates.examExamCreatedBy = item.examExamCreatedBy;
            }

            if (Object.keys(mergeUpdates).length > 0) {
              // Recalculate totals on the target item
              const newTestScore = (mergeUpdates.testScore ?? existingNewItem.testScore) || 0;
              const newExamScore = (mergeUpdates.examScore ?? existingNewItem.examScore) || 0;
              const newTestMax = (mergeUpdates.testMaxScore ?? existingNewItem.testMaxScore) || 0;
              const newExamMax = (mergeUpdates.examMaxScore ?? existingNewItem.examMaxScore) || 0;
              mergeUpdates.obtainedMarks = newTestScore + newExamScore;
              if (newTestMax + newExamMax > 0) {
                mergeUpdates.percentage = Math.round((mergeUpdates.obtainedMarks / (newTestMax + newExamMax)) * 100);
              }
              await db.update(schema.reportCardItems)
                .set(mergeUpdates)
                .where(eq(schema.reportCardItems.id, existingNewItem.id));
            }

            // Clear this exam's references from the OLD item (so it no longer claims the score)
            // leaving the old subject item empty (it will either be cleaned up or remain as an empty row)
            const clearUpdates: Record<string, any> = {};
            if (isTestExam) {
              clearUpdates.testExamId = null;
              clearUpdates.testScore = null;
              clearUpdates.testMaxScore = null;
              clearUpdates.testWeightedScore = null;
              clearUpdates.testExamCreatedBy = null;
            }
            if (isMainExam) {
              clearUpdates.examExamId = null;
              clearUpdates.examScore = null;
              clearUpdates.examMaxScore = null;
              clearUpdates.examWeightedScore = null;
              clearUpdates.examExamCreatedBy = null;
            }
            const remainingTest = isTestExam ? 0 : (item.testScore || 0);
            const remainingExam = isMainExam ? 0 : (item.examScore || 0);
            clearUpdates.obtainedMarks = remainingTest + remainingExam;
            clearUpdates.percentage = 0;

            await db.update(schema.reportCardItems)
              .set(clearUpdates)
              .where(eq(schema.reportCardItems.id, item.id));

            console.log(`[SYNC] Merged exam ${examId} score from item ${item.id} (old subject ${oldSubjectId}) into item ${existingNewItem.id} (new subject ${newSubjectId})`);
          } else {
            // --- NO DUPLICATE: safe to just update the subjectId on this item ---
            await db.update(schema.reportCardItems)
              .set({ subjectId: newSubjectId })
              .where(eq(schema.reportCardItems.id, item.id));

            console.log(`[SYNC] Updated item ${item.id}: subject ${oldSubjectId} -> ${newSubjectId}`);
          }

          updated++;
        } catch (itemError: any) {
          console.error(`[SYNC] Error processing report card item ${item.id}:`, itemError);
          errors.push(`Item ${item.id}: ${itemError.message}`);
        }
      }

      console.log(`[SYNC] Completed sync for exam ${examId}: ${updated} items processed, ${errors.length} errors`);
      return { updated, errors };
    } catch (error: any) {
      console.error(`[SYNC] Error syncing report card items for exam ${examId}:`, error);
      return { updated: 0, errors: [error.message] };
    }
  }

  /**
   * COMPREHENSIVE FIX: Sync all missing exam scores to existing report card items
   * This finds all exam_results that have scores but aren't reflected in report_card_items
   * and syncs them properly
   */
}
