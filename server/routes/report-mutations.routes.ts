/** Generate-enhanced, auto-populate, score override, status, remarks — split from enhanced-report-cards.routes.ts. */
/** Auto-split from routes.ts — enhanced-report-cards (orig lines 12109-13017). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { generatePrincipalComment, generateTeacherComment, resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';


  // ==================== ENHANCED REPORT CARD ROUTES (Teacher Portal) ====================

  // Get teacher's accessible report cards - shows only subjects where they created exams
  // This endpoint returns report cards with items filtered to show only subjects
  // where the teacher created the test or main exam
export async function registerReportMutationsRoutes(app: Express) {

  // Generate report cards for a class with auto-population (Enhanced version) - FALLBACK
  // NOTE: Report cards are normally auto-generated when students complete exams
  // This route is a fallback for teachers/admins to regenerate or update report cards
  app.post('/api/reports/generate-enhanced/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { termId, gradingScale = 'standard' } = req.body;

      if (!termId) {
        return res.status(400).json({ message: 'Term ID is required' });
      }

      const result = await storage.generateReportCardsForClass(
        Number(classId),
        Number(termId),
        gradingScale,
        req.user!.id
      );

      res.json({
        message: `Report cards generated: ${result.created} created, ${result.updated} updated`,
        ...result
      });
    } catch (error: any) {
      console.error('Error generating report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to generate report cards' });
    }
  });

  // Auto-populate scores for a specific report card
  app.post('/api/reports/:reportCardId/auto-populate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;

      const result = await storage.autoPopulateReportCardScores(Number(reportCardId));

      res.json({
        message: `Scores populated for ${result.populated} subjects`,
        ...result
      });
    } catch (error: any) {
      console.error('Error auto-populating scores:', error);
      res.status(500).json({ message: error.message || 'Failed to auto-populate scores' });
    }
  });

  // Override a report card item score (Teacher override)
  // Teachers can edit scores if:
  // - They created the exam (testExamCreatedBy/examExamCreatedBy matches), OR
  // - They are assigned to teach this class/subject, OR
  // - No exam exists yet for this score type (null creator)
  // Admins and Super Admins can edit all scores
  app.patch('/api/reports/items/:itemId/override', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const { testScore, testMaxScore, examScore, examMaxScore, teacherRemarks } = req.body;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      // Validate itemId
      const parsedItemId = Number(itemId);
      if (isNaN(parsedItemId) || parsedItemId <= 0) {
        return res.status(400).json({
          message: 'Invalid item ID provided',
          code: 'INVALID_ITEM_ID'
        });
      }

      // Get the current report card item to check permissions
      const currentItem = await storage.getReportCardItemById(parsedItemId);
      if (!currentItem) {
        return res.status(404).json({
          message: 'Report card item not found. It may have been deleted.',
          code: 'ITEM_NOT_FOUND'
        });
      }

      // Get the report card to check class info
      const reportCard = await storage.getReportCard(currentItem.reportCardId);
      if (!reportCard) {
        return res.status(404).json({
          message: 'Report card not found',
          code: 'REPORT_CARD_NOT_FOUND'
        });
      }

      // Check if report card is locked — published cards are locked for teachers,
      // but admins and super-admins can always edit scores regardless of status (Priority 2)
      if (reportCard.status === 'published') {
        const isAdminEdit = userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN;
        if (!isAdminEdit) {
          return res.status(403).json({
            message: 'This report card has been published and cannot be edited. Contact an administrator to unlock it.',
            code: 'REPORT_LOCKED'
          });
        }
        // Admins fall through — proceed to permission checks below
      }

      // Use shared permission utility for consistent permission checks
      // This ensures identical logic between GET /api/reports/:id/full and this PATCH endpoint
      const { calculateScorePermissions, getPermissionDeniedMessage } = await import('@shared/score-permissions');

      // Check if teacher is assigned to this subject for this class
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

      const isAdmin = permissions.isAdmin;
      const canEditTest = permissions.canEditTest;
      const canEditExam = permissions.canEditExam;
      const canEditAny = canEditTest || canEditExam;

      // Validate and check permissions for each score type
      const isEditingTestScore = testScore !== undefined || testMaxScore !== undefined;
      const isEditingExamScore = examScore !== undefined || examMaxScore !== undefined;
      const isEditingRemarks = teacherRemarks !== undefined;

      // Permission checks for teachers (ownership or assignment based)
      // Uses shared getPermissionDeniedMessage for consistent error messaging
      const permissionContext = {
        loggedInUserId: userId,
        loggedInRoleId: userRoleId,
        testExamCreatedBy: currentItem.testExamCreatedBy,
        examExamCreatedBy: currentItem.examExamCreatedBy,
        assignedTeacherId: isAssignedToSubject ? userId : null
      };

      if (!isAdmin) {
        if (isEditingRemarks && !canEditAny) {
          return res.status(403).json({
            message: getPermissionDeniedMessage('remarks', permissionContext),
            code: 'PERMISSION_DENIED_REMARKS',
            details: { subjectId: currentItem.subjectId }
          });
        }

        if (isEditingTestScore && !canEditTest) {
          return res.status(403).json({
            message: getPermissionDeniedMessage('test', permissionContext),
            code: 'PERMISSION_DENIED_TEST',
            details: {
              subjectId: currentItem.subjectId,
              testCreatedBy: currentItem.testExamCreatedBy
            }
          });
        }

        if (isEditingExamScore && !canEditExam) {
          return res.status(403).json({
            message: getPermissionDeniedMessage('exam', permissionContext),
            code: 'PERMISSION_DENIED_EXAM',
            details: {
              subjectId: currentItem.subjectId,
              examCreatedBy: currentItem.examExamCreatedBy
            }
          });
        }
      }

      // Validate score values
      const validationErrors: string[] = [];

      if (testScore !== undefined && testScore !== '' && testScore !== null) {
        const numTestScore = Number(testScore);
        if (isNaN(numTestScore)) {
          validationErrors.push('Test score must be a valid number');
        } else if (numTestScore < 0) {
          validationErrors.push('Test score cannot be negative');
        } else if (testMaxScore !== undefined && numTestScore > Number(testMaxScore)) {
          validationErrors.push('Test score cannot exceed maximum score');
        } else if (currentItem.testMaxScore && numTestScore > currentItem.testMaxScore) {
          validationErrors.push(`Test score cannot exceed maximum of ${currentItem.testMaxScore}`);
        }
      }

      if (examScore !== undefined && examScore !== '' && examScore !== null) {
        const numExamScore = Number(examScore);
        if (isNaN(numExamScore)) {
          validationErrors.push('Exam score must be a valid number');
        } else if (numExamScore < 0) {
          validationErrors.push('Exam score cannot be negative');
        } else if (examMaxScore !== undefined && numExamScore > Number(examMaxScore)) {
          validationErrors.push('Exam score cannot exceed maximum score');
        } else if (currentItem.examMaxScore && numExamScore > currentItem.examMaxScore) {
          validationErrors.push(`Exam score cannot exceed maximum of ${currentItem.examMaxScore}`);
        }
      }

      if (testMaxScore !== undefined && testMaxScore !== '' && testMaxScore !== null) {
        const numTestMax = Number(testMaxScore);
        if (isNaN(numTestMax) || numTestMax <= 0) {
          validationErrors.push('Test maximum score must be a positive number');
        }
      }

      if (examMaxScore !== undefined && examMaxScore !== '' && examMaxScore !== null) {
        const numExamMax = Number(examMaxScore);
        if (isNaN(numExamMax) || numExamMax <= 0) {
          validationErrors.push('Exam maximum score must be a positive number');
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: validationErrors.join('. '),
          code: 'VALIDATION_ERROR',
          errors: validationErrors
        });
      }

      // Build the update payload - only include fields that were actually provided
      const updatePayload: any = { overriddenBy: userId };

      if (testScore !== undefined && testScore !== '') {
        updatePayload.testScore = Number(testScore);
      }
      if (testMaxScore !== undefined && testMaxScore !== '') {
        updatePayload.testMaxScore = Number(testMaxScore);
      }
      if (examScore !== undefined && examScore !== '') {
        updatePayload.examScore = Number(examScore);
      }
      if (examMaxScore !== undefined && examMaxScore !== '') {
        updatePayload.examMaxScore = Number(examMaxScore);
      }
      if (teacherRemarks !== undefined) {
        updatePayload.teacherRemarks = teacherRemarks || null;
      }

      // Log the override attempt for audit
      console.log(`Score override by ${userId} (roleId: ${userRoleId}) for item ${parsedItemId}:`, {
        isAdmin,
        canEditTest,
        canEditExam,
        payload: Object.keys(updatePayload)
      });

      const updatedItem = await storage.overrideReportCardItemScore(parsedItemId, updatePayload);

      if (!updatedItem) {
        return res.status(500).json({
          message: 'Failed to save score changes. Please try again.',
          code: 'UPDATE_FAILED'
        });
      }

      // Fetch the updated report card with recalculated totals for the response.
      // overrideReportCardItemScore already called recalculateReportCard + recalculateClassPositions
      // internally, so these DB reads return the freshly-computed values.
      let reportCardTotals: { totalScore: number; averageScore: number; averagePercentage: number; overallGrade: string; position?: number } | undefined;
      if (updatedItem.reportCardId) {
        const updatedReportCard = await storage.getReportCard(updatedItem.reportCardId) as any;
        if (updatedReportCard) {
          reportCardTotals = {
            totalScore: updatedReportCard.totalScore ?? 0,
            averageScore: updatedReportCard.averageScore ?? 0,
            averagePercentage: updatedReportCard.averagePercentage ?? 0,
            overallGrade: updatedReportCard.overallGrade ?? '',
            position: updatedReportCard.position ?? undefined
          };
        }
      }

      // Compute fresh class stats (highest / lowest / average) so the client can
      // update those summary cards immediately without a separate refetch.
      // Uses the same formula as the GET report-card endpoints.
      let classStats: { highestScore: number; lowestScore: number; classAverage: number } | undefined;
      if (reportCard.classId && reportCard.termId) {
        try {
          const allClassCards = await db
            .select({ averagePercentage: schema.reportCards.averagePercentage })
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.classId, reportCard.classId),
              eq(schema.reportCards.termId,  reportCard.termId),
            ));
          const validScores = allClassCards
            .filter((r: any) => r.averagePercentage !== null && r.averagePercentage > 0)
            .map((r: any) => r.averagePercentage as number);
          if (validScores.length > 0) {
            classStats = {
              highestScore: Math.round(Math.max(...validScores)),
              lowestScore:  Math.round(Math.min(...validScores)),
              classAverage: Math.round(
                (validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length) * 10
              ) / 10,
            };
          }
        } catch (statsErr: any) {
          console.warn('[OVERRIDE] Class stats refresh failed (non-fatal):', statsErr.message);
        }
      }

      // Emit realtime event for score override
      realtimeService.emitTableChange('report_card_items', 'UPDATE', updatedItem, undefined, userId);

      // Also emit report card update event for dashboard refresh
      if (updatedItem.reportCardId) {
        realtimeService.emitReportCardEvent(updatedItem.reportCardId, 'updated', {
          itemId: updatedItem.id,
          subjectId: updatedItem.subjectId,
          testScore: updatedItem.testScore,
          examScore: updatedItem.examScore,
          grade: updatedItem.grade,
          percentage: updatedItem.percentage,
          overriddenBy: userId,
          reportCardTotals,
          classStats,
        }, userId);
      }

      res.json({
        ...updatedItem,
        message: 'Score updated successfully',
        canEditTest,
        canEditExam,
        reportCardTotals,
        classStats,
      });
    } catch (error: any) {
      console.error('Error overriding score:', error);
      res.status(500).json({
        message: error.message || 'An unexpected error occurred while saving the score. Please try again.',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Update report card status (finalize, publish, revert) - OPTIMIZED for instant response
  app.patch('/api/reports/:reportCardId/status', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      // Single optimized call - storage method handles validation and returns result with previous status
      const result = await storage.updateReportCardStatusOptimized(
        Number(reportCardId),
        status,
        req.user!.id
      );

      if (!result) {
        return res.status(500).json({ message: 'Failed to update report card status' });
      }

      const { reportCard: updatedReportCard, previousStatus } = result;

      // Apply signatures when status changes to finalized or published
      let signatureUpdate: Record<string, any> = {};
      if (status === 'finalized' && updatedReportCard && !updatedReportCard.teacherSignatureUrl) {
        // Only apply teacher signature if the requesting user is the assigned class teacher
        const classInfo = await storage.getClass(updatedReportCard.classId);
        if (classInfo?.classTeacherId === req.user!.id) {
          const teacherProfile = await storage.getTeacherProfile(req.user!.id);
          if (teacherProfile?.signatureUrl) {
            signatureUpdate.teacherSignatureUrl = teacherProfile.signatureUrl;
            signatureUpdate.teacherSignedBy = req.user!.id;
            signatureUpdate.teacherSignedAt = new Date();
          }
        }
      } else if (status === 'published' && updatedReportCard && !updatedReportCard.principalSignatureUrl) {
        // Apply principal signature from admin profile
        let principalSig: string | null = null;
        const profile = await storage.getAdminProfile(req.user!.id);
        principalSig = profile?.signatureUrl || null;
        if (principalSig) {
          signatureUpdate.principalSignatureUrl = principalSig;
          signatureUpdate.principalSignedBy = req.user!.id;
          signatureUpdate.principalSignedAt = new Date();
        }
      }

      // Persist signature data if applicable
      if (Object.keys(signatureUpdate).length > 0) {
        await db.update(schema.reportCards)
          .set(signatureUpdate)
          .where(eq(schema.reportCards.id, Number(reportCardId)));
        Object.assign(updatedReportCard, signatureUpdate);
      }

      // Emit realtime event IMMEDIATELY for instant UI updates (CRITICAL FIX)
      const eventType = status === 'published' ? 'published' :
        status === 'finalized' ? 'finalized' : 'reverted';

      // Emit the event immediately so connected clients update their UI
      realtimeService.emitReportCardEvent(Number(reportCardId), eventType, {
        reportCardId: Number(reportCardId),
        status,
        studentId: updatedReportCard.studentId,
        classId: updatedReportCard.classId,
        termId: updatedReportCard.termId
      }, req.user!.id);

      // Fetch parent IDs asynchronously for parent notifications (non-blocking)
      if (status === 'published' && updatedReportCard.studentId) {
        setImmediate(async () => {
          try {
            const student = await storage.getStudent(updatedReportCard.studentId);
            if (student?.parentId) {
              // Send additional notification to parents
              realtimeService.emitToUser(student.parentId, 'reportcard.published', {
                reportCardId: Number(reportCardId),
                status,
                studentId: updatedReportCard.studentId
              });
            }
          } catch (e) {
            console.warn('Could not fetch parent ID for notification:', e);
          }
        });
      }

      // Return descriptive message based on transition
      let message = 'Status updated successfully';
      if (status === 'draft') {
        message = 'Report card reverted to draft. Editing is now enabled.';
      } else if (status === 'finalized') {
        message = previousStatus === 'published'
          ? 'Report card reverted to finalized. Ready for review before publishing.'
          : 'Report card finalized. Ready for publishing.';
      } else if (status === 'published') {
        message = 'Report card published. Students and parents can now view it.';
      }

      res.json({ reportCard: updatedReportCard, message, status: updatedReportCard.status });
    } catch (error: any) {
      console.error('Error updating status:', error);
      // Handle specific error messages from storage layer
      if (error.message?.includes('Invalid status') || error.message?.includes('Invalid state transition')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to update status' });
    }
  });

  // Update report card remarks with strict role-based access control
  // - Class teacher (or admin) can edit teacherRemarks
  // - Only admin can edit principalRemarks
  // SECURITY: Rejects requests where user submits unauthorized fields
  app.patch('/api/reports/:reportCardId/remarks', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { teacherRemarks, principalRemarks } = req.body;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      // Get the report card and class info
      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const classInfo = await storage.getClass(reportCard.classId);
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }

      const isClassTeacher = classInfo.classTeacherId === userId;
      // For principal remarks: ONLY Admin role (not SuperAdmin) can edit
      // This reflects the principal's administrative role
      const isPrincipal = userRoleId === ROLES.ADMIN;
      // For teacher remarks: Admin, SuperAdmin, or the assigned class teacher can edit
      const isAdminOrSuperAdmin = userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN;

      // STRICT SECURITY: Reject unauthorized field submissions immediately
      // Only Admin (principal role) can edit principalRemarks - NOT SuperAdmin
      if (principalRemarks !== undefined && !isPrincipal) {
        return res.status(403).json({
          message: 'Only the school administrator (principal) can edit principal comments. This field is not allowed in your request.',
          code: 'NOT_PRINCIPAL'
        });
      }

      // Non-class teachers cannot submit teacherRemarks (unless admin/superadmin)
      if (teacherRemarks !== undefined && !isClassTeacher && !isAdminOrSuperAdmin) {
        return res.status(403).json({
          message: 'Only the assigned class teacher can edit class teacher comments. This field is not allowed in your request.',
          code: 'NOT_CLASS_TEACHER'
        });
      }

      // At least one valid field must be provided
      const hasTeacherRemarks = teacherRemarks !== undefined;
      const hasPrincipalRemarks = principalRemarks !== undefined;

      if (!hasTeacherRemarks && !hasPrincipalRemarks) {
        return res.status(400).json({
          message: 'No remarks fields provided for update',
          code: 'NO_FIELDS'
        });
      }

      // Build update object with only authorized fields
      const updateData: { teacherRemarks?: string; principalRemarks?: string } = {};
      if (hasTeacherRemarks) {
        updateData.teacherRemarks = teacherRemarks;
      }
      if (hasPrincipalRemarks) {
        updateData.principalRemarks = principalRemarks;
      }

      // Use the existing update method - it only updates fields that are provided
      const updatedReportCard = await storage.updateReportCardRemarks(
        Number(reportCardId),
        updateData.teacherRemarks,
        updateData.principalRemarks
      );

      if (!updatedReportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Emit realtime event for remarks update
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
  });
}
