/** Reliable sync types — extracted from reliable-sync-service.ts. */

export type SyncType = 'exam_submit' | 'manual_sync' | 'bulk_sync' | 'retry' | 'admin_repair';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface SyncResult {
  success: boolean;
  reportCardId?: number;
  reportCardItemId?: number;
  message: string;
  isNewReportCard?: boolean;
  auditLogId?: number;
  errorCode?: string;
}

export interface SyncOptions {
  triggeredBy?: string;
  syncType: SyncType;
  skipAuditLog?: boolean;
  maxRetries?: number;
}

function generateIdempotencyKey(studentId: string, examId: number, syncType: SyncType): string {
  const timestamp = Math.floor(Date.now() / 60000);
  return `${syncType}:${studentId}:${examId}:${timestamp}`;
}

