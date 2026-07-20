import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq, and, or, inArray, isNull, lte, desc, sql } from 'drizzle-orm';
import { calculateGradeFromConfig } from '../grading-config';
import { calculateWeightedScore } from '../../shared/grading-utils';
import { getActiveGradingConfig } from '../grade-scale-service';
import { realtimeService } from '../realtime-service';

export type SyncType = 'exam_submit' | 'manual_sync' | 'bulk_sync' | 'retry' | 'admin_repair';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'retrying';

interface SyncResult {
  success: boolean;
  reportCardId?: number;
  reportCardItemId?: number;
  message: string;
  isNewReportCard?: boolean;
  auditLogId?: number;
  errorCode?: string;
}

interface SyncOptions {
  triggeredBy?: string;
  syncType: SyncType;
  skipAuditLog?: boolean;
  maxRetries?: number;
}

function generateIdempotencyKey(studentId: string, examId: number, syncType: SyncType): string {
  const timestamp = Math.floor(Date.now() / 60000);
  return `${syncType}:${studentId}:${examId}:${timestamp}`;
}

export class ReliableSyncService {
  private readonly defaultMaxRetries = 3;
  private readonly retryDelayMs = [1000, 5000, 15000];

  async syncExamScoreToReportCardReliable(
    studentId: string,
    examId: number,
    score: number,
    maxScore: number,
    options: SyncOptions
  ): Promise<SyncResult> {
    // Use a stable idempotency key based on student+exam (not time-based for retries)
    const stableIdempotencyKey = `${options.syncType}:${studentId}:${examId}`;
    let auditLogId: number | undefined;

    try {
      // For non-manual syncs: skip if there was a successful sync within the last 5 seconds
      // (prevents duplicate processing from rapid double-submits)
      // Manual syncs always force a re-sync — teachers explicitly want to re-push the score.
      if (options.syncType !== 'manual_sync') {
        const recentSuccessSync = await db.select()
          .from(schema.syncAuditLogs)
          .where(and(
            eq(schema.syncAuditLogs.studentId, studentId),
            eq(schema.syncAuditLogs.examId, examId),
            eq(schema.syncAuditLogs.status, 'success')
          ))
          .orderBy(desc(schema.syncAuditLogs.createdAt))
          .limit(1);

        if (recentSuccessSync.length > 0) {
          const syncTime = recentSuccessSync[0].syncedAt;
          if (syncTime && (Date.now() - new Date(syncTime).getTime()) < 5000) {
            console.log(`[RELIABLE-SYNC] Idempotent skip: sync just completed for student ${studentId}, exam ${examId}`);
            return {
              success: true,
              reportCardId: recentSuccessSync[0].reportCardId ?? undefined,
              message: 'Sync already completed (idempotent)',
              auditLogId: recentSuccessSync[0].id
            };
          }
        }
      }

      const exam = await db.select()
        .from(schema.exams)
        .where(eq(schema.exams.id, examId))
        .limit(1);

      if (exam.length === 0) {
        return this.createFailedResult('Exam not found', 'EXAM_NOT_FOUND');
      }

      const examData = exam[0];
      const { subjectId, classId, termId } = examData;

      // Standalone assessments never touch report cards — skip sync entirely
      if (examData.assessmentCategory === 'standalone') {
        console.log(`[RELIABLE-SYNC] Skipping report card sync for standalone assessment (examId: ${examId})`);
        return {
          success: true,
          message: 'Standalone assessment — report card sync skipped',
          auditLogId: undefined
        };
      }

      if (!subjectId || !classId || !termId) {
        return this.createFailedResult('Exam missing required fields', 'MISSING_EXAM_FIELDS');
      }

      const student = await db.select()
        .from(schema.students)
        .where(eq(schema.students.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return this.createFailedResult('Student not found', 'STUDENT_NOT_FOUND');
      }

      // Find or reuse the audit log entry for this sync attempt.
      // We look for ANY existing entry (any status) to avoid unique-key constraint violations
      // when the same syncType+student+exam is retried after a previous attempt.
      if (!options.skipAuditLog) {
        const existingAuditLog = await db.select()
          .from(schema.syncAuditLogs)
          .where(and(
            eq(schema.syncAuditLogs.studentId, studentId),
            eq(schema.syncAuditLogs.examId, examId),
            eq(schema.syncAuditLogs.syncType, options.syncType)
          ))
          .orderBy(desc(schema.syncAuditLogs.createdAt))
          .limit(1);

        if (existingAuditLog.length > 0) {
          // Reuse existing audit log entry (update it to retrying)
          auditLogId = existingAuditLog[0].id;
          await db.update(schema.syncAuditLogs)
            .set({
              status: 'retrying',
              retryCount: (existingAuditLog[0].retryCount || 0) + 1,
              score,
              maxScore,
              updatedAt: new Date()
            })
            .where(eq(schema.syncAuditLogs.id, auditLogId));
          console.log(`[RELIABLE-SYNC] Reusing audit log ${auditLogId} for ${options.syncType} (retry/re-sync)`);
        } else {
          // Create new audit log entry (first time for this syncType+student+exam)
          const auditEntry = await db.insert(schema.syncAuditLogs)
            .values({
              syncType: options.syncType,
              studentId,
              examId,
              subjectId,
              termId,
              score,
              maxScore,
              status: 'pending',
              triggeredBy: options.triggeredBy ?? null,
              idempotencyKey: stableIdempotencyKey,
              maxRetries: options.maxRetries ?? this.defaultMaxRetries,
              metadata: JSON.stringify({
                examType: examData.examType,
                classId,
                gradingScale: examData.gradingScale
              })
            })
            .returning();
          auditLogId = auditEntry[0].id;
        }
      }

      // Perform the actual sync within a transaction for atomicity
      const result = await this.performSyncWithTransaction(
        studentId,
        examId,
        score,
        maxScore,
        examData,
        student[0],
        auditLogId,
        options.triggeredBy,
        options.syncType
      );

      // Update audit log OUTSIDE the transaction (it's okay if this fails after success)
      if (auditLogId) {
        await db.update(schema.syncAuditLogs)
          .set({
            status: result.success ? 'success' : 'failed',
            reportCardId: result.reportCardId ?? null,
            reportCardItemId: result.reportCardItemId ?? null,
            syncedAt: result.success ? new Date() : null,
            errorMessage: result.success ? null : result.message,
            errorCode: result.errorCode ?? null,
            updatedAt: new Date()
          })
          .where(eq(schema.syncAuditLogs.id, auditLogId));
      }

      if (result.success && result.reportCardId) {
        try {
          realtimeService.emitTableChange('report_cards', 'UPDATE', {
            id: result.reportCardId,
            syncType: options.syncType,
            studentId,
            examId
          }, undefined, options.triggeredBy);
        } catch (emitError) {
          console.warn('[RELIABLE-SYNC] Failed to emit realtime event:', emitError);
        }
      }

      return { ...result, auditLogId };

    } catch (error: any) {
      console.error('[RELIABLE-SYNC] Unhandled error in syncExamScoreToReportCardReliable:', error);

      if (auditLogId) {
        try {
          await db.update(schema.syncAuditLogs)
            .set({
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              errorCode: 'UNHANDLED_ERROR',
              updatedAt: new Date()
            })
            .where(eq(schema.syncAuditLogs.id, auditLogId));
        } catch (updateError) {
          console.error('[RELIABLE-SYNC] Failed to update audit log after error:', updateError);
        }
      }

      return {
        success: false,
        message: error.message || 'Sync failed with unhandled error',
        errorCode: 'UNHANDLED_ERROR',
        auditLogId
      };
    }
  }

  private async performSyncWithTransaction(
    studentId: string,
    examId: number,
    score: number,
    maxScore: number,
    examData: any,
    studentData: any,
    auditLogId?: number,
    triggeredBy?: string,
    syncType?: SyncType
  ): Promise<SyncResult> {
    const { subjectId, classId, termId, examType, gradingScale: examGradingScale, createdBy: examCreatedBy } = examData;

    // Use a database transaction for atomicity - if any step fails, all changes are rolled back
    try {
      const result = await db.transaction(async (tx: any) => {
        // Get academic term for session year
        const academicTerm = await tx.select()
          .from(schema.academicTerms)
          .where(eq(schema.academicTerms.id, termId))
          .limit(1);

        const sessionYear = academicTerm.length > 0
          ? `${academicTerm[0].year}/${academicTerm[0].year + 1}`
          : null;

        // Check for existing report card within the transaction
        let reportCard = await tx.select()
          .from(schema.reportCards)
          .where(and(
            eq(schema.reportCards.studentId, studentId),
            eq(schema.reportCards.termId, termId)
          ))
          .limit(1);

        let reportCardId: number;
        let isNewReportCard = false;
        const gradingScale = examGradingScale || 'standard';

        if (reportCard.length === 0) {
          console.log(`[RELIABLE-SYNC-TX] Creating new report card for student ${studentId}, term ${termId}`);
          isNewReportCard = true;
          
          const newReportCard = await tx.insert(schema.reportCards)
            .values({
              studentId,
              classId,
              termId,
              sessionYear,
              status: 'draft',
              gradingScale,
              scoreAggregationMode: 'last',
              generatedAt: new Date(),
              autoGenerated: true,
              locked: false
            })
            .returning();
          reportCardId = newReportCard[0].id;

          // Initialize report card items within transaction
          await this.initializeReportCardItemsTx(tx, reportCardId, studentId, classId, studentData);
        } else {
          reportCardId = reportCard[0].id;
          // Ensure missing subjects added within transaction
          await this.ensureMissingSubjectsAddedTx(tx, reportCardId, studentId, classId, studentData);
        }

        // Get or create report card item for this subject within transaction
        let reportCardItem = await tx.select()
          .from(schema.reportCardItems)
          .where(and(
            eq(schema.reportCardItems.reportCardId, reportCardId),
            eq(schema.reportCardItems.subjectId, subjectId)
          ))
          .limit(1);

        if (reportCardItem.length === 0) {
          const newItem = await tx.insert(schema.reportCardItems)
            .values({
              reportCardId,
              subjectId,
              totalMarks: 100,
              obtainedMarks: 0,
              percentage: 0
            })
            .returning();
          reportCardItem = newItem;
        }

        // For auto-syncs (exam_submit, retry): respect the override flag
        // For explicit teacher/admin syncs (manual_sync, bulk_sync, admin_repair): 
        //   force the update and clear the override so the exam score goes through
        const forceOverride = syncType === 'manual_sync' || syncType === 'bulk_sync' || syncType === 'admin_repair';
        if (reportCardItem[0].isOverridden && !forceOverride) {
          console.log(`[RELIABLE-SYNC-TX] Item ${reportCardItem[0].id} is manually overridden, skipping (auto-sync)`);
          return {
            success: true,
            reportCardId,
            reportCardItemId: reportCardItem[0].id,
            message: 'Skipped - item manually overridden',
            isNewReportCard
          };
        }
        if (reportCardItem[0].isOverridden && forceOverride) {
          console.log(`[RELIABLE-SYNC-TX] Item ${reportCardItem[0].id} was overridden but force-sync requested — clearing override`);
        }

        const safeScore = typeof score === 'number' ? score : parseInt(String(score), 10) || 0;
        const safeMaxScore = typeof maxScore === 'number' ? maxScore : parseInt(String(maxScore), 10) || 0;
        const safeExamId = typeof examId === 'number' ? examId : parseInt(String(examId), 10);

        const isTest = ['test', 'quiz', 'assignment'].includes(examType);
        const isMainExam = ['exam', 'final', 'midterm'].includes(examType);

        const updateData: any = { updatedAt: new Date() };

        // If force-syncing, clear the override flag so future auto-syncs also work
        if (forceOverride && reportCardItem[0].isOverridden) {
          updateData.isOverridden = false;
          updateData.overriddenBy = null;
          updateData.overriddenAt = null;
        }

        if (isTest) {
          updateData.testExamId = safeExamId;
          updateData.testExamCreatedBy = examCreatedBy;
          updateData.testScore = safeScore;
          updateData.testMaxScore = safeMaxScore;
        } else if (isMainExam) {
          updateData.examExamId = safeExamId;
          updateData.examExamCreatedBy = examCreatedBy;
          updateData.examScore = safeScore;
          updateData.examMaxScore = safeMaxScore;
        } else {
          updateData.testExamId = safeExamId;
          updateData.testExamCreatedBy = examCreatedBy;
          updateData.testScore = safeScore;
          updateData.testMaxScore = safeMaxScore;
        }

        const existingItem = reportCardItem[0];
        const finalTestScore = isTest ? safeScore : (existingItem.testScore ?? null);
        const finalTestMaxScore = isTest ? safeMaxScore : (existingItem.testMaxScore ?? null);
        const finalExamScore = isMainExam ? safeScore : (existingItem.examScore ?? null);
        const finalExamMaxScore = isMainExam ? safeMaxScore : (existingItem.examMaxScore ?? null);

        const gradingConfig = await getActiveGradingConfig();
        const weighted = calculateWeightedScore(finalTestScore, finalTestMaxScore, finalExamScore, finalExamMaxScore, gradingConfig);
        const gradeInfo = calculateGradeFromConfig(weighted.percentage, gradingConfig);

        const safeTestWeighted = Number.isFinite(weighted.testWeighted) ? Math.round(weighted.testWeighted) : 0;
        const safeExamWeighted = Number.isFinite(weighted.examWeighted) ? Math.round(weighted.examWeighted) : 0;
        const safeObtainedMarks = Number.isFinite(weighted.weightedScore) ? Math.round(weighted.weightedScore) : 0;
        const safePercentage = Number.isFinite(weighted.percentage) ? Math.round(weighted.percentage) : 0;

        updateData.testWeightedScore = safeTestWeighted;
        updateData.examWeightedScore = safeExamWeighted;
        updateData.obtainedMarks = safeObtainedMarks;
        updateData.percentage = safePercentage;
        updateData.grade = gradeInfo.grade;
        updateData.remarks = gradeInfo.remarks;

        // Update the report card item within transaction
        await tx.update(schema.reportCardItems)
          .set(updateData)
          .where(eq(schema.reportCardItems.id, existingItem.id));

        console.log(`[RELIABLE-SYNC-TX] Updated item ${existingItem.id}: ${isTest ? 'test' : 'exam'} ${safeScore}/${safeMaxScore}, grade: ${gradeInfo.grade}`);

        // Recalculate report card totals within transaction
        await this.recalculateReportCardTx(tx, reportCardId, gradingScale);

        return {
          success: true,
          reportCardId,
          reportCardItemId: existingItem.id,
          isNewReportCard,
          message: isNewReportCard
            ? `New report card created. Grade: ${gradeInfo.grade} (${safePercentage}%)`
            : `Score synced. Grade: ${gradeInfo.grade} (${safePercentage}%)`
        };
      });

      // Recalculate class positions OUTSIDE transaction (non-critical, can fail independently)
      try {
        await this.recalculateClassPositions(classId, termId);
      } catch (positionError) {
        console.warn('[RELIABLE-SYNC] Failed to recalculate class positions (non-critical):', positionError);
      }

      return result;
    } catch (txError: any) {
      console.error('[RELIABLE-SYNC-TX] Transaction failed and rolled back:', txError);
      return {
        success: false,
        message: `Transaction failed: ${txError.message || 'Unknown error'}`,
        errorCode: 'TRANSACTION_FAILED'
      };
    }
  }

  // Transaction-aware version of initializeReportCardItems
  private async initializeReportCardItemsTx(
    tx: any,
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const studentClass = await tx.select()
      .from(schema.classes)
      .where(eq(schema.classes.id, classId))
      .limit(1);

    const isSeniorSecondary = studentClass.length > 0 &&
      (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await tx.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let relevantSubjects: any[] = [];

    if (studentSubjectAssignments.length > 0) {
      const studentSubjectIds = studentSubjectAssignments.map((a: any) => a.subjectId);
      relevantSubjects = await tx.select()
        .from(schema.subjects)
        .where(and(
          inArray(schema.subjects.id, studentSubjectIds),
          eq(schema.subjects.isActive, true)
        ));
    } else {
      relevantSubjects = await this.getSubjectsByClassAndDepartmentTx(tx, classId, studentDepartment);
    }

    console.log(`[RELIABLE-SYNC-TX] Initializing ${relevantSubjects.length} subject items for report card ${reportCardId}`);

    for (const subject of relevantSubjects) {
      await tx.insert(schema.reportCardItems)
        .values({
          reportCardId,
          subjectId: subject.id,
          totalMarks: 100,
          obtainedMarks: 0,
          percentage: 0
        })
        .onConflictDoNothing();
    }
  }

  // Transaction-aware version of ensureMissingSubjectsAdded
  private async ensureMissingSubjectsAddedTx(
    tx: any,
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const existingItems = await tx.select({ subjectId: schema.reportCardItems.subjectId })
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    const existingSubjectIds = new Set(existingItems.map((item: any) => item.subjectId));

    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await tx.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let assignedSubjectIds: number[] = [];

    if (studentSubjectAssignments.length > 0) {
      assignedSubjectIds = studentSubjectAssignments.map((a: any) => a.subjectId);
    } else {
      const relevantSubjects = await this.getSubjectsByClassAndDepartmentTx(tx, classId, studentDepartment);
      assignedSubjectIds = relevantSubjects.map((s: any) => s.id);
    }

    const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));

    if (missingSubjectIds.length > 0) {
      console.log(`[RELIABLE-SYNC-TX] Adding ${missingSubjectIds.length} missing subjects to report card ${reportCardId}`);

      for (const subjectId of missingSubjectIds) {
        await tx.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .onConflictDoNothing();
      }
    }
  }

  // Transaction-aware version of getSubjectsByClassAndDepartment
  private async getSubjectsByClassAndDepartmentTx(tx: any, classId: number, department?: string): Promise<any[]> {
    const mappings = await tx.select({
      subjectId: schema.classSubjectMappings.subjectId
    })
      .from(schema.classSubjectMappings)
      .where(
        department
          ? and(
              eq(schema.classSubjectMappings.classId, classId),
              or(
                eq(schema.classSubjectMappings.department, department),
                isNull(schema.classSubjectMappings.department)
              )
            )
          : eq(schema.classSubjectMappings.classId, classId)
      );

    if (mappings.length === 0) {
      return [];
    }

    const subjectIds = mappings.map((m: any) => m.subjectId);
    const subjects = await tx.select()
      .from(schema.subjects)
      .where(and(
        inArray(schema.subjects.id, subjectIds),
        eq(schema.subjects.isActive, true)
      ));

    return subjects;
  }

  // Transaction-aware version of recalculateReportCard
  private async recalculateReportCardTx(tx: any, reportCardId: number, gradingScale: string): Promise<void> {
    const items = await tx.select()
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    if (items.length === 0) return;

    // Filter by raw score nullability — correctly includes students who scored 0.
    const itemsWithScores = items.filter((item: any) =>
      item.testScore !== null || item.examScore !== null
    );

    if (itemsWithScores.length === 0) return;

    const totalObtained = itemsWithScores.reduce((sum: number, item: any) => sum + (item.obtainedMarks || 0), 0);
    const averageScore = Math.round(totalObtained / itemsWithScores.length);
    // averagePercentage = average of per-item percentages (equivalent since percentage=obtainedMarks when fullWeight=100)
    const averagePercentage = Math.round(
      itemsWithScores.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0) / itemsWithScores.length
    );

    const activeConfig = await getActiveGradingConfig();
    const gradeInfo = calculateGradeFromConfig(averagePercentage, activeConfig);

    // Use the actual reportCards column names: totalScore, averageScore, averagePercentage, overallGrade
    await tx.update(schema.reportCards)
      .set({
        totalScore: totalObtained,
        averageScore,
        averagePercentage,
        overallGrade: gradeInfo.grade,
        updatedAt: new Date()
      })
      .where(eq(schema.reportCards.id, reportCardId));
  }

  private async initializeReportCardItems(
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const studentClass = await db.select()
      .from(schema.classes)
      .where(eq(schema.classes.id, classId))
      .limit(1);

    const isSeniorSecondary = studentClass.length > 0 &&
      (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let relevantSubjects: any[] = [];

    if (studentSubjectAssignments.length > 0) {
      const studentSubjectIds = studentSubjectAssignments.map((a) => a.subjectId);
      relevantSubjects = await db.select()
        .from(schema.subjects)
        .where(and(
          inArray(schema.subjects.id, studentSubjectIds),
          eq(schema.subjects.isActive, true)
        ));
    } else {
      relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
    }

    console.log(`[RELIABLE-SYNC] Initializing ${relevantSubjects.length} subject items for report card ${reportCardId}`);

    for (const subject of relevantSubjects) {
      await db.insert(schema.reportCardItems)
        .values({
          reportCardId,
          subjectId: subject.id,
          totalMarks: 100,
          obtainedMarks: 0,
          percentage: 0
        })
        .onConflictDoNothing();
    }
  }

  private async ensureMissingSubjectsAdded(
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const existingItems = await db.select({ subjectId: schema.reportCardItems.subjectId })
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    const existingSubjectIds = new Set(existingItems.map((item) => item.subjectId));

    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let assignedSubjectIds: number[] = [];

    if (studentSubjectAssignments.length > 0) {
      assignedSubjectIds = studentSubjectAssignments.map((a) => a.subjectId);
    } else {
      const relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
      assignedSubjectIds = relevantSubjects.map(s => s.id);
    }

    const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));

    if (missingSubjectIds.length > 0) {
      console.log(`[RELIABLE-SYNC] Adding ${missingSubjectIds.length} missing subjects to report card ${reportCardId}`);

      for (const subjectId of missingSubjectIds) {
        await db.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .onConflictDoNothing();
      }
    }
  }

  private async getSubjectsByClassAndDepartment(classId: number, department?: string): Promise<any[]> {
    const mappings = await db.select({
      subjectId: schema.classSubjectMappings.subjectId
    })
      .from(schema.classSubjectMappings)
      .where(
        department
          ? and(
              eq(schema.classSubjectMappings.classId, classId),
              or(
                eq(schema.classSubjectMappings.department, department),
                isNull(schema.classSubjectMappings.department)
              )
            )
          : eq(schema.classSubjectMappings.classId, classId)
      );

    if (mappings.length === 0) {
      return [];
    }

    const subjectIds = mappings.map(m => m.subjectId);
    const subjects = await db.select()
      .from(schema.subjects)
      .where(and(
        inArray(schema.subjects.id, subjectIds),
        eq(schema.subjects.isActive, true)
      ));

    return subjects;
  }

  private async recalculateReportCard(reportCardId: number, gradingScale: string): Promise<void> {
    const items = await db.select()
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    if (items.length === 0) return;

    // Filter by raw score nullability — correctly includes students who scored 0.
    const itemsWithScores = items.filter(item =>
      item.testScore !== null || item.examScore !== null
    );

    if (itemsWithScores.length === 0) return;

    const totalObtained = itemsWithScores.reduce((sum, item) => sum + (item.obtainedMarks || 0), 0);
    // Average the per-item percentages directly (reliable when fullWeight may vary per item).
    const averagePercentage = Math.round(
      itemsWithScores.reduce((sum, item) => sum + (item.percentage || 0), 0) / itemsWithScores.length
    );

    const activeConfig = await getActiveGradingConfig();
    const gradeInfo = calculateGradeFromConfig(averagePercentage, activeConfig);

    await db.update(schema.reportCards)
      .set({
        totalScore: totalObtained,
        averageScore: Math.round(totalObtained / itemsWithScores.length),
        averagePercentage,
        overallGrade: gradeInfo.grade,
        updatedAt: new Date()
      })
      .where(eq(schema.reportCards.id, reportCardId));
  }

  private async recalculateClassPositions(classId: number, termId: number): Promise<void> {
    try {
      const reportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        averagePercentage: schema.reportCards.averagePercentage
      })
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ))
        .orderBy(desc(schema.reportCards.averagePercentage));

      if (reportCards.length === 0) return;

      const positionMap = new Map<number, number>();
      let currentPosition = 1;
      let previousPercentage: number | null = null;
      let samePositionCount = 0;

      for (const card of reportCards) {
        const percentage = card.averagePercentage ?? 0;

        if (previousPercentage !== null && percentage === previousPercentage) {
          samePositionCount++;
        } else {
          currentPosition += samePositionCount;
          samePositionCount = 1;
        }

        positionMap.set(card.id, currentPosition);
        previousPercentage = percentage;
      }

      const totalStudentsInClass = reportCards.length;

      for (const card of reportCards) {
        const position = positionMap.get(card.id) || 0;
        await db.update(schema.reportCards)
          .set({
            position,
            totalStudentsInClass,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCards.id, card.id));
      }
    } catch (error) {
      console.error(`[RELIABLE-SYNC] Error calculating positions:`, error);
    }
  }

  private createFailedResult(message: string, errorCode: string): SyncResult {
    return { success: false, message, errorCode };
  }

  async retryFailedSyncs(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date();
    const failedSyncs = await db.select()
      .from(schema.syncAuditLogs)
      .where(and(
        eq(schema.syncAuditLogs.status, 'failed'),
        sql`${schema.syncAuditLogs.retryCount} < ${schema.syncAuditLogs.maxRetries}`,
        sql`${schema.syncAuditLogs.nextRetryAt} IS NULL OR ${schema.syncAuditLogs.nextRetryAt} <= ${now}`
      ))
      .limit(50);

    let succeeded = 0;
    let failed = 0;

    for (const sync of failedSyncs) {
      try {
        await db.update(schema.syncAuditLogs)
          .set({
            status: 'retrying',
            retryCount: sync.retryCount + 1,
            lastRetryAt: now,
            updatedAt: now
          })
          .where(eq(schema.syncAuditLogs.id, sync.id));

        const result = await this.syncExamScoreToReportCardReliable(
          sync.studentId,
          sync.examId!,
          sync.score!,
          sync.maxScore!,
          {
            syncType: 'retry',
            triggeredBy: sync.triggeredBy ?? undefined,
            skipAuditLog: true
          }
        );

        if (result.success) {
          await db.update(schema.syncAuditLogs)
            .set({
              status: 'success',
              reportCardId: result.reportCardId ?? null,
              syncedAt: now,
              errorMessage: null,
              updatedAt: now
            })
            .where(eq(schema.syncAuditLogs.id, sync.id));
          succeeded++;
        } else {
          const nextRetryDelay = this.retryDelayMs[Math.min(sync.retryCount, this.retryDelayMs.length - 1)];
          const nextRetryAt = new Date(now.getTime() + nextRetryDelay);

          await db.update(schema.syncAuditLogs)
            .set({
              status: 'failed',
              errorMessage: result.message,
              nextRetryAt: sync.retryCount + 1 < sync.maxRetries ? nextRetryAt : null,
              updatedAt: now
            })
            .where(eq(schema.syncAuditLogs.id, sync.id));
          failed++;
        }
      } catch (error: any) {
        console.error(`[RELIABLE-SYNC] Retry failed for sync ${sync.id}:`, error);
        failed++;
      }
    }

    return { processed: failedSyncs.length, succeeded, failed };
  }

  async getSyncAuditLogs(filters: {
    studentId?: string;
    examId?: number;
    status?: SyncStatus;
    syncType?: SyncType;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const conditions: any[] = [];

    if (filters.studentId) {
      conditions.push(eq(schema.syncAuditLogs.studentId, filters.studentId));
    }
    if (filters.examId) {
      conditions.push(eq(schema.syncAuditLogs.examId, filters.examId));
    }
    if (filters.status) {
      conditions.push(eq(schema.syncAuditLogs.status, filters.status));
    }
    if (filters.syncType) {
      conditions.push(eq(schema.syncAuditLogs.syncType, filters.syncType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.select()
        .from(schema.syncAuditLogs)
        .where(whereClause)
        .orderBy(desc(schema.syncAuditLogs.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.syncAuditLogs)
        .where(whereClause)
    ]);

    return { logs, total: Number(countResult[0]?.count || 0) };
  }

  async manualResyncById(auditLogId: number, triggeredBy: string): Promise<SyncResult> {
    const log = await db.select()
      .from(schema.syncAuditLogs)
      .where(eq(schema.syncAuditLogs.id, auditLogId))
      .limit(1);

    if (log.length === 0) {
      return { success: false, message: 'Audit log not found', errorCode: 'NOT_FOUND' };
    }

    const syncLog = log[0];

    if (!syncLog.examId || !syncLog.score || !syncLog.maxScore) {
      return { success: false, message: 'Incomplete sync data', errorCode: 'INCOMPLETE_DATA' };
    }

    return this.syncExamScoreToReportCardReliable(
      syncLog.studentId,
      syncLog.examId,
      syncLog.score,
      syncLog.maxScore,
      {
        syncType: 'admin_repair',
        triggeredBy
      }
    );
  }
}

export const reliableSyncService = new ReliableSyncService();
