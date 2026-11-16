/** Exam update (PATCH), delete, publish/unpublish — split from exams-management.routes.ts. */
/** Auto-split from routes.ts — exams-management (orig lines 2626-3701). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { autoScoreExamSession } from '../routes/exam-scoring';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { reliableSyncService } from '../services/reliable-sync-service';
import { storage } from '../storage';
import { logExamAccess, validateExamTimeWindow } from '../teacher-auth-middleware';
import { computeExamTiming, logExamTiming } from '../utils/exam-timing';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import session from 'express-session';
import { Server } from 'http';
import { z } from 'zod';



export async function registerExamCrudRoutes(app: Express) {
  // Update exam - TEACHERS ONLY (creator or teacher in charge) with assignment validation
  app.patch('/api/exams/:id', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const teacherId = req.user!.id;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Admins and Super Admins can edit any exam, teachers need to be creator or assigned
      const isAdmin = req.user!.roleId === ROLES.ADMIN;
      const isCreator = existingExam.createdBy === teacherId;
      const isTeacherInCharge = existingExam.teacherInChargeId === teacherId;
      if (!isAdmin && !isCreator && !isTeacherInCharge) {
        return res.status(403).json({ message: 'You can only edit exams you created or are assigned to' });
      }

      // SECURITY: Validate teacherInChargeId whenever it's present in request
      // This prevents privilege escalation by assigning to non-teacher or inactive accounts
      if (req.body.teacherInChargeId !== undefined) {
        // If teacherInChargeId is provided, validate it's a valid active teacher
        const assignedUser = await storage.getUser(req.body.teacherInChargeId);
        if (!assignedUser) {
          return res.status(400).json({ message: 'Assigned teacher not found' });
        }
        if (assignedUser.roleId !== ROLES.TEACHER) {
          return res.status(400).json({ message: 'teacherInChargeId must be a teacher' });
        }
        if (!assignedUser.isActive) {
          return res.status(400).json({ message: 'Assigned teacher is not active' });
        }
      }

      // Only pass allowed fields to prevent unexpected field updates
      const allowedFields = ['name', 'description', 'date', 'timeLimit', 'totalMarks',
        'classId', 'subjectId', 'teacherInChargeId', 'isPublished', 'instructions',
        'passingScore', 'maxAttempts', 'showResults', 'shuffleQuestions', 'shuffleOptions',
        'showCorrectAnswers', 'autoGradingEnabled', 'instantFeedback', 'gradingScale',
        'timerMode'];
      const sanitizedData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          sanitizedData[field] = req.body[field];
        }
      }

      const exam = await storage.updateExam(examId, sanitizedData);

      if (!exam) {
        return res.status(500).json({ message: 'Failed to update exam' });
      }

      // CRITICAL: When exam subject changes, sync report card items to use new subject
      // This ensures report cards reflect the updated exam subject
      let reportCardSyncResult = { updated: 0, errors: [] as string[] };
      if (sanitizedData.subjectId !== undefined && sanitizedData.subjectId !== existingExam.subjectId) {
        console.log(`[EXAM-UPDATE] Subject changed from ${existingExam.subjectId} to ${sanitizedData.subjectId} for exam ${examId}. Syncing report cards...`);
        try {
          reportCardSyncResult = await storage.syncReportCardItemsOnExamSubjectChange(examId, existingExam.subjectId!,
            sanitizedData.subjectId
          );
          console.log(`[EXAM-UPDATE] Report card sync complete: ${reportCardSyncResult.updated} items updated`);
        } catch (syncError: any) {
          console.error(`[EXAM-UPDATE] Failed to sync report card items:`, syncError?.message);
          // Don't fail the request, just log the error - exam was still updated
        }
      }

      // Invalidate exam visibility cache when exam is updated
      invalidateVisibilityCache({ examId: exam.id });

      // Emit realtime event for exam update
      realtimeService.emitTableChange('exams', 'UPDATE', exam, existingExam, teacherId);
      // Emit to the specific exam room — students currently taking this exam are subscribed here
      realtimeService.emitToExam(exam.id, 'exam.updated', exam);
      if (exam.classId) {
        // Emit to the class room — students in this class who have the exam page open receive this
        realtimeService.emitToClass(exam.classId.toString(), 'exam.updated', exam);
      }

      res.json({
        ...exam,
        reportCardSync: reportCardSyncResult.updated > 0 ? reportCardSyncResult : undefined
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exam' });
    }
  });

  // Delete exam - Admins (any exam) and Teachers (own exams only)
  // Implements comprehensive smart deletion with cascade, audit logging, and cleanup
  app.delete('/api/exams/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
    const startTime = Date.now();
    try {
      const examId = parseInt(req.params.id);
      const deletedBy = req.user!;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        // Exam already deleted — respond with 200 so the client treats it as success
        return res.status(200).json({ message: 'Exam already deleted', alreadyDeleted: true });
      }

      // Admins can delete any exam; teachers can only delete their own
      const isAdmin = deletedBy.roleId === ROLES.ADMIN;
      if (!isAdmin && existingExam.createdBy !== deletedBy.id) {
        return res.status(403).json({ message: 'You can only delete exams you created' });
      }

      // Get additional context for audit log
      const examClass = await storage.getClass(existingExam.classId!);
      const examSubject = await storage.getSubject(existingExam.subjectId!);

      // Perform comprehensive smart deletion
      const deletionResult = await storage.deleteExam(examId);

      if (!deletionResult.success) {
        return res.status(500).json({ message: 'Failed to delete exam' });
      }

      // Invalidate exam visibility cache
      invalidateVisibilityCache({ examId: examId });

      const duration = Date.now() - startTime;

      // Create audit log for accountability
      try {
        await storage.createAuditLog({
          userId: deletedBy.id,
          action: 'exam_deleted',
          entityType: 'exam',
          entityId: examId.toString(),
          oldValue: JSON.stringify({
            exam: existingExam,
            className: examClass?.name,
            subjectName: examSubject?.name
          }),
          newValue: JSON.stringify({
            deletedAt: new Date().toISOString(),
            deletedCounts: deletionResult.deletedCounts,
            duration: `${duration}ms`
          }),
          reason: `Exam "${existingExam.name}" permanently deleted by ${deletedBy.email || (deletedBy as any).username}. Cascade deleted: ${deletionResult.deletedCounts.questions} questions, ${deletionResult.deletedCounts.questionOptions} options, ${deletionResult.deletedCounts.sessions} sessions, ${deletionResult.deletedCounts.studentAnswers} student answers, ${deletionResult.deletedCounts.results} results. ${deletionResult.deletedCounts.filesDeleted} files removed from storage. ${deletionResult.deletedCounts.reportCardRefsCleared} report card references cleared.`,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        console.error('[SmartDeletion] Error creating audit log:', auditError);
        // Don't fail the deletion if audit logging fails
      }

      // Emit realtime events for cache invalidation and UI updates
      realtimeService.emitTableChange('exams', 'DELETE', { id: examId }, existingExam, deletedBy.id);
      if (existingExam.classId) {
        realtimeService.emitToClass(existingExam.classId.toString(), 'exam.deleted', {
          ...existingExam,
          deletedCounts: deletionResult.deletedCounts
        });
      }

      // Also emit to teachers and admins for subject-specific views
      if (existingExam.subjectId) {
        realtimeService.emitToRole('teacher', 'subject.exam.deleted', {
          subjectId: existingExam.subjectId,
          examId: examId,
          examName: existingExam.name
        });
        realtimeService.emitToRole('admin', 'subject.exam.deleted', {
          subjectId: existingExam.subjectId,
          examId: examId,
          examName: existingExam.name
        });
      }

      console.log(`[SmartDeletion] Exam ${examId} "${existingExam.name}" deleted in ${duration}ms by ${deletedBy.email || (deletedBy as any).username}`);

      res.status(200).json({
        message: 'Exam deleted successfully',
        deletedCounts: deletionResult.deletedCounts,
        duration: `${duration}ms`
      });
    } catch (error: any) {
      console.error('[SmartDeletion] Error deleting exam:', error);
      res.status(500).json({ message: error?.message || 'Failed to delete exam' });
    }
  });

  // Toggle exam publish status - Teachers (creator or teacher in charge) and Admins only
  app.patch('/api/exams/:id/publish', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const teacherId = req.user!.id;
      const { isPublished } = req.body;

      const existingExam = await storage.getExamById(examId);
      if (!existingExam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Admins and Super Admins can publish any exam, teachers need to be creator or assigned
      const isAdmin = req.user!.roleId === ROLES.ADMIN;
      const isCreator = existingExam.createdBy === teacherId;
      const isTeacherInCharge = existingExam.teacherInChargeId === teacherId;
      if (!isAdmin && !isCreator && !isTeacherInCharge) {
        return res.status(403).json({ message: 'You can only publish/unpublish exams you created or are assigned to' });
      }
      const exam = await storage.updateExam(examId, { isPublished });

      if (!exam) {
        return res.status(500).json({ message: 'Failed to update exam publish status' });
      }

      // Invalidate exam visibility cache when publish status changes
      invalidateVisibilityCache({ examId: exam.id });

      // Use dedicated exam publish/unpublish emit method for comprehensive realtime updates
      realtimeService.emitExamPublishEvent(examId, isPublished, exam, teacherId);

      res.json(exam);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exam publish status' });
    }
  });
}
