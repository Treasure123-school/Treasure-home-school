import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq, and, or, inArray, isNull, lte, desc, sql } from 'drizzle-orm';
import { calculateGradeFromConfig } from '../grading-config';
import { calculateWeightedScore } from '../../shared/grading-utils';
import { getActiveGradingConfig } from '../grade-scale-service';
import { realtimeService } from '../realtime-service';

import { performSyncWithTransaction } from './reliable-sync-tx';
import { createFailedResult } from './reliable-sync.helpers';
import type { SyncType, SyncStatus, SyncResult, SyncOptions } from './reliable-sync.types';
export type { SyncType, SyncStatus, SyncResult, SyncOptions } from './reliable-sync.types';

const DEFAULT_MAX_RETRIES = 3;

export class ReliableSyncService {
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
        return createFailedResult('Exam not found', 'EXAM_NOT_FOUND');
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
        return createFailedResult('Exam missing required fields', 'MISSING_EXAM_FIELDS');
      }

      const student = await db.select()
        .from(schema.students)
        .where(eq(schema.students.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return createFailedResult('Student not found', 'STUDENT_NOT_FOUND');
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
              maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
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
      const result = await performSyncWithTransaction(
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
