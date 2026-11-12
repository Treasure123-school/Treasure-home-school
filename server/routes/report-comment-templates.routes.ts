/** Auto-split from routes.ts — report-comment-templates (orig lines 14175-14699). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { reliableSyncService } from '../services/reliable-sync-service';
import { db, storage } from '../storage';
import { students, users } from '@shared/schema.pg';
import { and, desc, eq, sql } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerReportCommentTemplatesRoutes(app: Express) {
  // ==================== REPORT COMMENT TEMPLATES (Admin-managed) ====================

  // ADMIN: Get all comment templates
  app.get('/api/admin/report-comment-templates', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { role } = req.query;
      const templates = await storage.getReportCommentTemplates(role as string | undefined);
      res.json(templates);
    } catch (error: any) {
      console.error('[COMMENT-TEMPLATES] Error fetching templates:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch comment templates' });
    }
  });

  // ADMIN: Get single comment template
  app.get('/api/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const template = await storage.getReportCommentTemplate(parseInt(req.params.id));
      if (!template) {
        return res.status(404).json({ message: 'Comment template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('[COMMENT-TEMPLATES] Error fetching template:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch comment template' });
    }
  });

  // ADMIN: Create comment template
  app.post('/api/admin/report-comment-templates', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { role, performanceLevel, minPercentage, maxPercentage, commentTemplate, isActive } = req.body;

      if (!role || !performanceLevel || minPercentage === undefined || maxPercentage === undefined || !commentTemplate) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (!['teacher', 'principal'].includes(role)) {
        return res.status(400).json({ message: 'Role must be either teacher or principal' });
      }

      const template = await storage.createReportCommentTemplate({
        role,
        performanceLevel,
        minPercentage,
        maxPercentage,
        commentTemplate,
        isActive: isActive !== false,
        createdBy: req.user!.id
      });

      res.status(201).json(template);
    } catch (error: any) {
      console.error('[COMMENT-TEMPLATES] Error creating template:', error);
      res.status(500).json({ message: error.message || 'Failed to create comment template' });
    }
  });

  // ADMIN: Update comment template
  app.patch('/api/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { role, performanceLevel, minPercentage, maxPercentage, commentTemplate, isActive } = req.body;

      const updateData: any = { updatedBy: req.user!.id };
      if (role !== undefined) updateData.role = role;
      if (performanceLevel !== undefined) updateData.performanceLevel = performanceLevel;
      if (minPercentage !== undefined) updateData.minPercentage = minPercentage;
      if (maxPercentage !== undefined) updateData.maxPercentage = maxPercentage;
      if (commentTemplate !== undefined) updateData.commentTemplate = commentTemplate;
      if (isActive !== undefined) updateData.isActive = isActive;

      const template = await storage.updateReportCommentTemplate(parseInt(req.params.id), updateData);
      if (!template) {
        return res.status(404).json({ message: 'Comment template not found' });
      }

      res.json(template);
    } catch (error: any) {
      console.error('[COMMENT-TEMPLATES] Error updating template:', error);
      res.status(500).json({ message: error.message || 'Failed to update comment template' });
    }
  });

  // ADMIN: Delete comment template
  app.delete('/api/admin/report-comment-templates/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteReportCommentTemplate(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: 'Comment template not found' });
      }
      res.json({ message: 'Comment template deleted successfully' });
    } catch (error: any) {
      console.error('[COMMENT-TEMPLATES] Error deleting template:', error);
      res.status(500).json({ message: error.message || 'Failed to delete comment template' });
    }
  });

  // ADMIN: Get all finalized report cards for approval/publishing
  app.get('/api/admin/report-cards/finalized', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      // Admin always sees all report cards regardless of status — default to 'all'
      const { classId, termId, status = 'all' } = req.query;

      // Build the query to get finalized report cards with student and class info
      const query = db
        .select({
          id: schema.reportCards.id,
          studentId: schema.reportCards.studentId,
          studentName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          admissionNumber: students.admissionNumber,
          department: students.department,
          classId: schema.reportCards.classId,
          className: schema.classes.name,
          classLevel: schema.classes.level,
          termId: schema.reportCards.termId,
          termName: schema.academicTerms.name,
          sessionYear: schema.academicTerms.year,
          averagePercentage: schema.reportCards.averagePercentage,
          overallGrade: schema.reportCards.overallGrade,
          status: schema.reportCards.status,
          finalizedAt: schema.reportCards.finalizedAt,
          publishedAt: schema.reportCards.publishedAt,
          generatedAt: schema.reportCards.generatedAt,
        })
        .from(schema.reportCards)
        .innerJoin(students, eq(students.id, schema.reportCards.studentId))
        .innerJoin(users, eq(users.id, students.id))
        .innerJoin(schema.classes, eq(schema.classes.id, schema.reportCards.classId))
        .innerJoin(schema.academicTerms, eq(schema.academicTerms.id, schema.reportCards.termId))
        .where(
          and(
            status === 'all'
              ? sql`1=1`
              : eq(schema.reportCards.status, status as string),
            classId ? eq(schema.reportCards.classId, Number(classId)) : sql`1=1`,
            termId ? eq(schema.reportCards.termId, Number(termId)) : sql`1=1`
          )
        )
        .orderBy(desc(schema.reportCards.finalizedAt));

      const rawResults = await query;

      // Add isSSS and conditionally include department
      const results = rawResults.map((r: any) => {
        const isSSS = r.className?.startsWith('SS') || r.classLevel?.includes('Senior Secondary');
        return {
          ...r,
          isSSS,
          department: isSSS ? r.department : null
        };
      });

      // Get statistics
      const allReports = await db
        .select({
          status: schema.reportCards.status,
          count: sql<number>`count(*)`
        })
        .from(schema.reportCards)
        .where(
          and(
            classId ? eq(schema.reportCards.classId, Number(classId)) : sql`1=1`,
            termId ? eq(schema.reportCards.termId, Number(termId)) : sql`1=1`
          )
        )
        .groupBy(schema.reportCards.status);

      const stats = {
        draft: 0,
        finalized: 0,
        published: 0
      };

      allReports.forEach((r: any) => {
        if (r.status in stats) {
          stats[r.status as keyof typeof stats] = Number(r.count);
        }
      });

      res.json({
        reportCards: results,
        statistics: stats
      });
    } catch (error: any) {
      console.error('[ADMIN-FINALIZED] Error fetching finalized report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch report cards' });
    }
  });

  // ADMIN: Bulk publish report cards
  app.post('/api/admin/report-cards/bulk-publish', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardIds } = req.body;

      if (!reportCardIds || !Array.isArray(reportCardIds) || reportCardIds.length === 0) {
        return res.status(400).json({ message: 'Report card IDs are required' });
      }

      // Pre-fetch principal signature once for all bulk operations
      let bulkPrincipalSignature: string | null = null;
      const bulkProfile = await storage.getAdminProfile(req.user!.id);
      bulkPrincipalSignature = bulkProfile?.signatureUrl || null;

      const results = await Promise.all(
        reportCardIds.map(async (id: number) => {
          try {
            const result = await storage.updateReportCardStatusOptimized(id, 'published', req.user!.id);
            // Apply principal signature if available and not already set
            if (result && bulkPrincipalSignature && !result.reportCard.principalSignatureUrl) {
              await db.update(schema.reportCards)
                .set({
                  principalSignatureUrl: bulkPrincipalSignature,
                  principalSignedBy: req.user!.id,
                  principalSignedAt: new Date()
                })
                .where(eq(schema.reportCards.id, id));
              result.reportCard.principalSignatureUrl = bulkPrincipalSignature;
              result.reportCard.principalSignedBy = req.user!.id;
              (result.reportCard as any).principalSignedAt = new Date();
            }
            return { id, success: true, result };
          } catch (error: any) {
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      // Emit real-time events IMMEDIATELY for successful publishes (CRITICAL FOR INSTANT UI UPDATES)
      // This must happen BEFORE the response so connected clients update their UI
      for (const r of results.filter(r => r.success && r.result)) {
        const reportCard = (r as any).result.reportCard;
        if (reportCard) {
          realtimeService.emitReportCardEvent(reportCard.id, 'published', {
            reportCardId: reportCard.id,
            status: 'published',
            studentId: reportCard.studentId,
            classId: reportCard.classId,
            termId: reportCard.termId,
            action: 'bulk-publish'
          }, req.user!.id);
        }
      }

      // Fetch parent IDs asynchronously for parent notifications (non-blocking)
      setImmediate(async () => {
        for (const r of results.filter(r => r.success && r.result)) {
          const reportCard = (r as any).result.reportCard;
          if (reportCard && reportCard.studentId) {
            try {
              const student = await storage.getStudent(reportCard.studentId);
              if (student?.parentId) {
                realtimeService.emitToUser(student.parentId, 'reportcard.published', {
                  reportCardId: reportCard.id,
                  status: 'published',
                  studentId: reportCard.studentId
                });
              }
            } catch (e) {
              console.warn('Could not emit parent notification:', e);
            }
          }
        }
      });

      res.json({
        message: `${successCount} report cards published successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        results,
        successCount,
        failedCount
      });
    } catch (error: any) {
      console.error('[ADMIN-BULK-PUBLISH] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to publish report cards' });
    }
  });

  // ADMIN: Reject report card (revert to draft)
  app.post('/api/admin/report-cards/:id/reject', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Revert to draft status
      const result = await storage.updateReportCardStatusOptimized(Number(id), 'draft', req.user!.id);

      if (!result) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const reportCard = result.reportCard;

      // Emit real-time event for instant UI update (CRITICAL FOR REALTIME)
      realtimeService.emitReportCardEvent(Number(id), 'reverted', {
        reportCardId: Number(id),
        status: 'draft',
        studentId: reportCard.studentId,
        classId: reportCard.classId,
        termId: reportCard.termId,
        reason: reason || 'Rejected by admin',
        action: 'reject'
      }, req.user!.id);

      res.json({
        message: 'Report card rejected and reverted to draft',
        reportCard: result.reportCard,
        reason
      });
    } catch (error: any) {
      console.error('[ADMIN-REJECT] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to reject report card' });
    }
  });

  // ADMIN: Force resync a single exam score to report card (uses reliable sync with full audit trail)
  app.post('/api/admin/resync-exam-score', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { studentId, examId, score, maxScore } = req.body;

      if (!studentId || !examId) {
        return res.status(400).json({ message: 'studentId and examId are required' });
      }

      console.log('[ADMIN-RESYNC] Received request:', { studentId, examId, score, maxScore });

      const result = await reliableSyncService.syncExamScoreToReportCardReliable(
        String(studentId),
        Number(examId),
        Number(score ?? 0),
        Number(maxScore ?? 100),
        { syncType: 'admin_repair', triggeredBy: req.user!.id }
      );

      res.json(result);
    } catch (error: any) {
      console.error('[ADMIN-RESYNC] Error:', error);
      res.status(500).json({ message: error.message || 'Sync failed' });
    }
  });

  // ADMIN: Resync report card items when exam subject has been changed
  // This endpoint allows admin to manually trigger a resync for exams whose subjects were changed
  // before the automatic sync fix was implemented (useful for fixing historical data)
  app.post('/api/admin/resync-report-card-subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { examIds, newSubjectId } = req.body;

      // Validate input
      if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
        return res.status(400).json({ message: 'examIds must be a non-empty array of exam IDs' });
      }

      if (!newSubjectId || typeof newSubjectId !== 'number') {
        return res.status(400).json({ message: 'newSubjectId must be a valid subject ID number' });
      }

      // Verify the new subject exists
      const subject = await storage.getSubject(newSubjectId);
      if (!subject) {
        return res.status(404).json({ message: `Subject with ID ${newSubjectId} not found` });
      }

      console.log(`[ADMIN-RESYNC-SUBJECTS] User ${req.user!.id} requested resync for ${examIds.length} exams to subject ${newSubjectId} (${subject.name})`);

      const results: Array<{ examId: number; updated: number; errors: string[] }> = [];
      let totalUpdated = 0;
      const allErrors: string[] = [];

      for (const examId of examIds) {
        try {
          // Verify the exam exists
          const exam = await storage.getExamById(Number(examId));
          if (!exam) {
            results.push({ examId: Number(examId), updated: 0, errors: [`Exam ${examId} not found`] });
            allErrors.push(`Exam ${examId} not found`);
            continue;
          }

          // Get the exam's current subject for logging
          const oldSubjectId = exam.subjectId!;

          // Sync report card items for this exam
          const syncResult = await storage.syncReportCardItemsOnExamSubjectChange(
            Number(examId),
            oldSubjectId,
            newSubjectId
          );

          results.push({ examId: Number(examId), updated: syncResult.updated, errors: syncResult.errors });
          totalUpdated += syncResult.updated;
          allErrors.push(...syncResult.errors);

        } catch (examError: any) {
          console.error(`[ADMIN-RESYNC-SUBJECTS] Error syncing exam ${examId}:`, examError);
          results.push({ examId: Number(examId), updated: 0, errors: [examError.message] });
          allErrors.push(`Exam ${examId}: ${examError.message}`);
        }
      }

      console.log(`[ADMIN-RESYNC-SUBJECTS] Complete. Total items updated: ${totalUpdated}, Errors: ${allErrors.length}`);

      res.json({
        message: `Report card items resynced for ${examIds.length} exams`,
        totalUpdated,
        results,
        errors: allErrors
      });
    } catch (error: any) {
      console.error('[ADMIN-RESYNC-SUBJECTS] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to resync report card subjects' });
    }
  });

  // TEACHER: Bulk sync all results from a specific exam to report cards
  // This allows teachers to sync all their exam results at once
  app.post('/api/teacher/exams/:examId/sync-all-to-reportcards', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const examId = parseInt(req.params.examId);
      const teacherId = req.user!.id;

      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Get the exam
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // For teachers, verify ownership
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only sync results for exams you created, are assigned to, or teach' });
        }
      }

      console.log(`[TEACHER-BULK-SYNC] User ${teacherId} syncing all results for exam ${examId}`);

      const result = await storage.syncExamResultsToReportCards(examId);

      // Emit realtime event
      realtimeService.emitTableChange('report_cards', 'UPDATE', { examId, bulkSync: true }, undefined, teacherId);

      res.json({
        message: `Synced ${result.synced} exam results to report cards`,
        synced: result.synced,
        failed: result.failed,
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
        totalErrors: result.errors.length
      });
    } catch (error: any) {
      console.error('[TEACHER-BULK-SYNC] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to sync exam results' });
    }
  });

  // TEACHER: Get sync status for exam results (shows which results are synced/pending/failed)
  app.get('/api/teacher/exams/:examId/sync-status', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const examId = parseInt(req.params.examId);

      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Get latest sync status for each student for this exam
      const syncStatuses = await db.select({
        studentId: schema.syncAuditLogs.studentId,
        status: schema.syncAuditLogs.status,
        syncedAt: schema.syncAuditLogs.syncedAt,
        errorMessage: schema.syncAuditLogs.errorMessage,
        retryCount: schema.syncAuditLogs.retryCount
      })
        .from(schema.syncAuditLogs)
        .where(eq(schema.syncAuditLogs.examId, examId))
        .orderBy(desc(schema.syncAuditLogs.createdAt));

      // Get unique latest status per student
      const statusByStudent = new Map<string, { status: string; syncedAt: Date | null; errorMessage: string | null; retryCount: number }>();
      for (const s of syncStatuses) {
        if (!statusByStudent.has(s.studentId)) {
          statusByStudent.set(s.studentId, {
            status: s.status,
            syncedAt: s.syncedAt,
            errorMessage: s.errorMessage,
            retryCount: s.retryCount
          });
        }
      }

      // Count stats
      let synced = 0, pending = 0, failed = 0, retrying = 0;
      statusByStudent.forEach(v => {
        if (v.status === 'success') synced++;
        else if (v.status === 'pending') pending++;
        else if (v.status === 'failed') failed++;
        else if (v.status === 'retrying') retrying++;
      });

      res.json({
        byStudent: Object.fromEntries(statusByStudent),
        summary: { synced, pending, failed, retrying, total: statusByStudent.size }
      });
    } catch (error: any) {
      console.error('[TEACHER-SYNC-STATUS] Error:', error);
      res.status(500).json({ message: error.message || 'Failed to get sync status' });
    }
  });

}
