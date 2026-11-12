/** Auto-split from routes.ts — sync-audit-log (orig lines 14700-14808). See git history. */
import * as schema from '@shared/schema.pg';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { reliableSyncService } from '../services/reliable-sync-service';
import { db } from '../storage';
import { eq, sql } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerSyncAuditLogRoutes(app: Express) {
  // ==================== SYNC AUDIT LOG ENDPOINTS ====================

  // ADMIN: Get sync audit logs with filters
  app.get('/api/admin/sync-audit-logs', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { studentId, examId, status, syncType, limit, offset } = req.query;

      const result = await reliableSyncService.getSyncAuditLogs({
        studentId: studentId as string | undefined,
        examId: examId ? parseInt(examId as string) : undefined,
        status: status as 'pending' | 'success' | 'failed' | 'retrying' | undefined,
        syncType: syncType as 'exam_submit' | 'manual_sync' | 'bulk_sync' | 'retry' | 'admin_repair' | undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0
      });

      res.json(result);
    } catch (error: any) {
      console.error('[SYNC-AUDIT] Error fetching logs:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch sync audit logs' });
    }
  });

  // ADMIN: Retry all failed syncs (batch retry)
  app.post('/api/admin/sync-audit-logs/retry-failed', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      console.log(`[SYNC-AUDIT] User ${req.user!.id} triggered batch retry of failed syncs`);

      const result = await reliableSyncService.retryFailedSyncs();

      res.json({
        message: `Processed ${result.processed} failed syncs: ${result.succeeded} succeeded, ${result.failed} still failing`,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed
      });
    } catch (error: any) {
      console.error('[SYNC-AUDIT] Error retrying failed syncs:', error);
      res.status(500).json({ message: error.message || 'Failed to retry syncs' });
    }
  });

  // ADMIN: Manually resync a specific audit log entry
  app.post('/api/admin/sync-audit-logs/:auditLogId/resync', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const auditLogId = parseInt(req.params.auditLogId);
      const adminId = req.user!.id;

      if (isNaN(auditLogId) || auditLogId <= 0) {
        return res.status(400).json({ message: 'Invalid audit log ID' });
      }

      console.log(`[SYNC-AUDIT] Admin ${adminId} manually resyncing audit log ${auditLogId}`);

      const result = await reliableSyncService.manualResyncById(auditLogId, adminId);

      if (!result.success) {
        return res.status(400).json({
          message: result.message,
          errorCode: result.errorCode
        });
      }

      res.json({
        message: result.message,
        reportCardId: result.reportCardId,
        reportCardItemId: result.reportCardItemId,
        isNewReportCard: result.isNewReportCard,
        auditLogId: result.auditLogId
      });
    } catch (error: any) {
      console.error('[SYNC-AUDIT] Error resyncing:', error);
      res.status(500).json({ message: error.message || 'Failed to resync' });
    }
  });

  // ADMIN: Get sync statistics summary
  app.get('/api/admin/sync-audit-logs/stats', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const [
        totalLogs,
        successfulSyncs,
        failedSyncs,
        pendingSyncs,
        retryingSyncs
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(schema.syncAuditLogs),
        db.select({ count: sql<number>`count(*)` }).from(schema.syncAuditLogs).where(eq(schema.syncAuditLogs.status, 'success')),
        db.select({ count: sql<number>`count(*)` }).from(schema.syncAuditLogs).where(eq(schema.syncAuditLogs.status, 'failed')),
        db.select({ count: sql<number>`count(*)` }).from(schema.syncAuditLogs).where(eq(schema.syncAuditLogs.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(schema.syncAuditLogs).where(eq(schema.syncAuditLogs.status, 'retrying'))
      ]);

      res.json({
        total: Number(totalLogs[0]?.count || 0),
        successful: Number(successfulSyncs[0]?.count || 0),
        failed: Number(failedSyncs[0]?.count || 0),
        pending: Number(pendingSyncs[0]?.count || 0),
        retrying: Number(retryingSyncs[0]?.count || 0),
        successRate: totalLogs[0]?.count
          ? Math.round((Number(successfulSyncs[0]?.count || 0) / Number(totalLogs[0]?.count)) * 100)
          : 0
      });
    } catch (error: any) {
      console.error('[SYNC-AUDIT] Error fetching stats:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch sync stats' });
    }
  });

}
