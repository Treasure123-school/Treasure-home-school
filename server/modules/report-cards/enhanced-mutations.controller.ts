/** Enhanced report cards — mutations (overrideItemScore, updateStatus, updateRemarks) — extracted from enhanced.controller.ts. */
/**
 * Enhanced Report Cards Controller
 * Handles teacher portal operations: score overrides, status management, remarks
 */
import { Request, Response } from 'express';
import { storage, db } from '../../storage';
import * as schema from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { realtimeService } from '../../realtime-service';
import { resolveDesignatedPrincipal } from '../../routes/report-helpers';
export const overrideItemScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { testScore, testMaxScore, examScore, examMaxScore, teacherRemarks } = req.body;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;
      const ROLES = (await import('@shared/role-constants')).ROLE_IDS;

      const parsedItemId = Number(itemId);
      if (isNaN(parsedItemId) || parsedItemId <= 0) {
        res.status(400).json({ message: 'Invalid item ID provided', code: 'INVALID_ITEM_ID' });
        return;
      }

      const currentItem = await storage.getReportCardItemById(parsedItemId);
      if (!currentItem) {
        res.status(404).json({ message: 'Report card item not found. It may have been deleted.', code: 'ITEM_NOT_FOUND' });
        return;
      }

      const reportCard = await storage.getReportCard(currentItem.reportCardId);
      if (!reportCard) {
        res.status(404).json({ message: 'Report card not found', code: 'REPORT_CARD_NOT_FOUND' });
        return;
      }

      // Check if published (locked for teachers)
      if (reportCard.status === 'published') {
        const isAdminEdit = userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN;
        if (!isAdminEdit) {
          res.status(403).json({
            message: 'This report card has been published and cannot be edited. Contact an administrator to unlock it.',
            code: 'REPORT_LOCKED'
          });
          return;
        }
      }

      // Check permissions
      const { calculateScorePermissions, getPermissionDeniedMessage } = await import('@shared/score-permissions');
      const isAdminCheck = [1, 2].includes(userRoleId);
      let isAssignedToSubject = false;

      if (!isAdminCheck && reportCard.classId) {
        const assignments = await storage.getTeacherAssignmentsForClass(userId, reportCard.classId);
        isAssignedToSubject = assignments.some((a: any) => a.subjectId === currentItem.subjectId);
      }

      const permissions = calculateScorePermissions({
        loggedInUserId: userId,
        loggedInRoleId: userRoleId,
        testExamCreatedBy: currentItem.testExamCreatedBy,
        examExamCreatedBy: currentItem.examExamCreatedBy,
        assignedTeacherId: isAssignedToSubject ? userId : null
      });

      const permissionContext = {
        loggedInUserId: userId,
        loggedInRoleId: userRoleId,
        testExamCreatedBy: currentItem.testExamCreatedBy,
        examExamCreatedBy: currentItem.examExamCreatedBy,
        assignedTeacherId: isAssignedToSubject ? userId : null
      };

      if (!permissions.isAdmin) {
        if (teacherRemarks !== undefined && !permissions.canEditTest && !permissions.canEditExam) {
          res.status(403).json({
            message: getPermissionDeniedMessage('remarks', permissionContext),
            code: 'PERMISSION_DENIED_REMARKS'
          });
          return;
        }
        if ((testScore !== undefined || testMaxScore !== undefined) && !permissions.canEditTest) {
          res.status(403).json({
            message: getPermissionDeniedMessage('test', permissionContext),
            code: 'PERMISSION_DENIED_TEST'
          });
          return;
        }
        if ((examScore !== undefined || examMaxScore !== undefined) && !permissions.canEditExam) {
          res.status(403).json({
            message: getPermissionDeniedMessage('exam', permissionContext),
            code: 'PERMISSION_DENIED_EXAM'
          });
          return;
        }
      }

      // Validate scores
      const validationErrors: string[] = [];
      if (testScore !== undefined && testScore !== '' && testScore !== null) {
        const num = Number(testScore);
        if (isNaN(num) || num < 0) validationErrors.push('Test score must be a valid positive number');
        if (testMaxScore && num > Number(testMaxScore)) validationErrors.push('Test score cannot exceed maximum');
      }
      if (examScore !== undefined && examScore !== '' && examScore !== null) {
        const num = Number(examScore);
        if (isNaN(num) || num < 0) validationErrors.push('Exam score must be a valid positive number');
        if (examMaxScore && num > Number(examMaxScore)) validationErrors.push('Exam score cannot exceed maximum');
      }

      if (validationErrors.length > 0) {
        res.status(400).json({ message: validationErrors.join('. '), code: 'VALIDATION_ERROR', errors: validationErrors });
        return;
      }

      // Build update payload
      const updatePayload: any = { overriddenBy: userId };
      if (testScore !== undefined && testScore !== '') updatePayload.testScore = Number(testScore);
      if (testMaxScore !== undefined && testMaxScore !== '') updatePayload.testMaxScore = Number(testMaxScore);
      if (examScore !== undefined && examScore !== '') updatePayload.examScore = Number(examScore);
      if (examMaxScore !== undefined && examMaxScore !== '') updatePayload.examMaxScore = Number(examMaxScore);
      if (teacherRemarks !== undefined) updatePayload.teacherRemarks = teacherRemarks || null;

      const updatedItem = await storage.overrideReportCardItemScore(parsedItemId, updatePayload);
      if (!updatedItem) {
        res.status(500).json({ message: 'Failed to save score changes. Please try again.', code: 'UPDATE_FAILED' });
        return;
      }

      // Get updated totals and class stats
      let reportCardTotals;
      let classStats;

      if (updatedItem.reportCardId) {
        const updatedReportCard = await storage.getReportCard(updatedItem.reportCardId) as any;
        if (updatedReportCard) {
          reportCardTotals = {
            totalScore: updatedReportCard.totalScore ?? 0,
            averageScore: updatedReportCard.averageScore ?? 0,
            averagePercentage: updatedReportCard.averagePercentage ?? 0,
            overallGrade: updatedReportCard.overallGrade ?? '',
            position: updatedReportCard.position
          };
        }

        if (reportCard.classId && reportCard.termId) {
          const allClassCards = await db
            .select({ averagePercentage: schema.reportCards.averagePercentage })
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.classId, reportCard.classId),
              eq(schema.reportCards.termId, reportCard.termId)
            ));

          const validScores = allClassCards
            .filter((r: any) => r.averagePercentage !== null && r.averagePercentage > 0)
            .map((r: any) => r.averagePercentage as number);

          if (validScores.length > 0) {
            classStats = {
              highestScore: Math.round(Math.max(...validScores)),
              lowestScore: Math.round(Math.min(...validScores)),
              classAverage: Math.round((validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length) * 10) / 10,
            };
          }
        }
      }

      // Emit realtime events
      realtimeService.emitTableChange('report_card_items', 'UPDATE', updatedItem, undefined, userId);
      if (updatedItem.reportCardId) {
        realtimeService.emitReportCardEvent(updatedItem.reportCardId, 'updated', {
          itemId: updatedItem.id,
          subjectId: updatedItem.subjectId,
          reportCardTotals,
          classStats,
        }, userId);
      }

      res.json({ ...updatedItem, message: 'Score updated successfully', reportCardTotals, classStats });
    } catch (error: any) {
      console.error('Error overriding score:', error);
      res.status(500).json({ message: error.message || 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
    }
  };

  /**
   * PATCH /api/reports/:reportCardId/status
   * Update report card status (draft → finalized → published)
   */
export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportCardId } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({ message: 'Status is required' });
        return;
      }

      const result = await storage.updateReportCardStatusOptimized(Number(reportCardId), status, req.user!.id);
      if (!result) {
        res.status(500).json({ message: 'Failed to update report card status' });
        return;
      }

      const { reportCard: updatedReportCard, previousStatus } = result;

      // Apply signatures
      const signatureUpdate: Record<string, any> = {};
      if (status === 'finalized' && !updatedReportCard.teacherSignatureUrl) {
        const classInfo = await storage.getClass(updatedReportCard.classId);
        if (classInfo?.classTeacherId === req.user!.id) {
          const teacherProfile = await storage.getTeacherProfile(req.user!.id);
          if (teacherProfile?.signatureUrl) {
            signatureUpdate.teacherSignatureUrl = teacherProfile.signatureUrl;
            signatureUpdate.teacherSignedBy = req.user!.id;
            signatureUpdate.teacherSignedAt = new Date();
          }
        }
      } else if (status === 'published' && !updatedReportCard.principalSignatureUrl) {
        const profile = await storage.getAdminProfile(req.user!.id);
        if (profile?.signatureUrl) {
          signatureUpdate.principalSignatureUrl = profile.signatureUrl;
          signatureUpdate.principalSignedBy = req.user!.id;
          signatureUpdate.principalSignedAt = new Date();
        }
      }

      if (Object.keys(signatureUpdate).length > 0) {
        await db.update(schema.reportCards)
          .set(signatureUpdate)
          .where(eq(schema.reportCards.id, Number(reportCardId)));
        Object.assign(updatedReportCard, signatureUpdate);
      }

      // Emit realtime event
      const eventType = status === 'published' ? 'published' : status === 'finalized' ? 'finalized' : 'reverted';
      realtimeService.emitReportCardEvent(Number(reportCardId), eventType, {
        reportCardId: Number(reportCardId),
        status,
        studentId: updatedReportCard.studentId,
        classId: updatedReportCard.classId,
        termId: updatedReportCard.termId
      }, req.user!.id);

      // Notify parents asynchronously
      if (status === 'published' && updatedReportCard.studentId) {
        setImmediate(async () => {
          try {
            const student = await storage.getStudent(updatedReportCard.studentId);
            if (student?.parentId) {
              realtimeService.emitToUser(student.parentId, 'reportcard.published', {
                reportCardId: Number(reportCardId),
                status,
                studentId: updatedReportCard.studentId
              });
            }
          } catch (e) {
            console.warn('Could not notify parent:', e);
          }
        });
      }

      let message = 'Status updated successfully';
      if (status === 'draft') message = 'Report card reverted to draft. Editing is now enabled.';
      else if (status === 'finalized') message = previousStatus === 'published'
        ? 'Report card reverted to finalized. Ready for review before publishing.'
        : 'Report card finalized. Ready for publishing.';
      else if (status === 'published') message = 'Report card published. Students and parents can now view it.';

      res.json({ reportCard: updatedReportCard, message, status: updatedReportCard.status });
    } catch (error: any) {
      console.error('Error updating status:', error);
      const statusCode = error.message?.includes('Invalid') ? 400 : error.message?.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ message: error.message || 'Failed to update status' });
    }
  };

  /**
   * PATCH /api/reports/:reportCardId/remarks
   * Update teacher/principal remarks (strict role-based)
   */
export const updateRemarks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportCardId } = req.params;
      const { teacherRemarks, principalRemarks } = req.body;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;
      const ROLES = (await import('@shared/role-constants')).ROLE_IDS;

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        res.status(404).json({ message: 'Report card not found' });
        return;
      }

      const classInfo = await storage.getClass(reportCard.classId);
      if (!classInfo) {
        res.status(404).json({ message: 'Class not found' });
        return;
      }

      const isClassTeacher = classInfo.classTeacherId === userId;
      const isPrincipal = userRoleId === ROLES.ADMIN;
      const isAdminOrSuperAdmin = userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN;

      // Strict security checks
      if (principalRemarks !== undefined && !isPrincipal) {
        res.status(403).json({
          message: 'Only the school administrator (principal) can edit principal comments.',
          code: 'NOT_PRINCIPAL'
        });
        return;
      }

      if (teacherRemarks !== undefined && !isClassTeacher && !isAdminOrSuperAdmin) {
        res.status(403).json({
          message: 'Only the assigned class teacher can edit class teacher comments.',
          code: 'NOT_CLASS_TEACHER'
        });
        return;
      }

      if (teacherRemarks === undefined && principalRemarks === undefined) {
        res.status(400).json({ message: 'No remarks fields provided for update', code: 'NO_FIELDS' });
        return;
      }

      const updatedReportCard = await storage.updateReportCardRemarks(
        Number(reportCardId),
        teacherRemarks,
        principalRemarks
      );

      if (!updatedReportCard) {
        res.status(404).json({ message: 'Report card not found' });
        return;
      }

      realtimeService.emitReportCardEvent(Number(reportCardId), 'updated', {
        reportCardId: Number(reportCardId),
        studentId: updatedReportCard.studentId,
        classId: updatedReportCard.classId,
        termId: updatedReportCard.termId
      }, req.user!.id);

      res.json(updatedReportCard);
    } catch (error: any) {
      console.error('Error updating remarks:', error);
      res.status(500).json({ message: error.message || 'Failed to update remarks' });
    }
  };

  /**
   * GET /api/reports/:reportCardId/default-comments
   * Generate default comments based on performance
   */
