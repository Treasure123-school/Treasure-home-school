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

export class EnhancedController {
  /**
   * GET /api/teacher/my-report-cards
   * Get teacher's accessible report cards (subjects where they created exams)
   */
  getMyReportCards = async (req: Request, res: Response): Promise<void> => {
    try {
      const teacherId = req.user!.id;
      const { termId, classId } = req.query;

      const reportCards = await storage.getTeacherAccessibleReportCards(
        teacherId,
        termId ? Number(termId) : undefined,
        classId ? Number(classId) : undefined
      );

      res.json(reportCards);
    } catch (error: any) {
      console.error('Error getting teacher report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to get teacher report cards' });
    }
  };

  /**
   * GET /api/reports/class-term/:classId/:termId
   * Get all report cards for a class and term
   */
  getReportCardsByClassTerm = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, termId } = req.params;
      const reportCards = await storage.getReportCardsByClassAndTerm(Number(classId), Number(termId));
      res.json(reportCards);
    } catch (error: any) {
      console.error('Error getting report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to get report cards' });
    }
  };

  /**
   * GET /api/reports/:reportCardId/full
   * Get report card with full details including permissions for each item
   */
  getReportCardFull = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportCardId } = req.params;
      const reportCard = await storage.getReportCardWithItems(Number(reportCardId));

      if (!reportCard) {
        res.status(404).json({ message: 'Report card not found' });
        return;
      }

      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;
      const { calculateScorePermissions } = await import('@shared/score-permissions');

      // Get teacher's subject assignments
      let teacherSubjectAssignments: Set<number> = new Set();
      const isAdmin = [1, 2].includes(userRoleId);

      if (!isAdmin && reportCard.classId) {
        const assignments = await storage.getTeacherAssignmentsForClass(userId, reportCard.classId);
        teacherSubjectAssignments = new Set(assignments.map((a: any) => a.subjectId));
      }

      // Add permission flags to each item
      let enhancedItems = reportCard.items.map((item: any) => {
        const isAssignedToSubject = teacherSubjectAssignments.has(item.subjectId);
        const permissions = calculateScorePermissions({
          loggedInUserId: userId,
          loggedInRoleId: userRoleId,
          testExamCreatedBy: item.testExamCreatedBy,
          examExamCreatedBy: item.examExamCreatedBy,
          assignedTeacherId: isAssignedToSubject ? userId : null
        });

        return {
          ...item,
          canEditTest: permissions.canEditTest,
          canEditExam: permissions.canEditExam,
          canEditRemarks: permissions.canEditRemarks
        };
      });

      // Fix stale derived values (recalculate if needed)
      const hasStaleItems = enhancedItems.some(
        (item: any) =>
          (item.testScore !== null || item.examScore !== null) &&
          (item.obtainedMarks === 0 || item.obtainedMarks === null)
      );

      if (hasStaleItems) {
        const { calculateWeightedScore, calculateGradeFromConfig } = await import('../../grading-config');
        const { getActiveGradingConfig } = await import('../../grade-scale-service');
        const activeConfig = await getActiveGradingConfig();

        enhancedItems = enhancedItems.map((item: any) => {
          const hasScores = item.testScore !== null || item.examScore !== null;
          const isStale = hasScores && (item.obtainedMarks === 0 || item.obtainedMarks === null);
          if (!isStale) return item;

          const weighted = calculateWeightedScore(
            item.testScore ?? null,
            item.testMaxScore ?? null,
            item.examScore ?? null,
            item.examMaxScore ?? null,
            activeConfig
          );
          const gradeInfo = calculateGradeFromConfig(weighted.percentage, activeConfig);

          return {
            ...item,
            testWeightedScore: Math.round(weighted.testWeighted),
            examWeightedScore: Math.round(weighted.examWeighted),
            obtainedMarks: Math.round(weighted.weightedScore),
            percentage: Math.round(weighted.percentage),
            grade: gradeInfo.grade,
            remarks: gradeInfo.remarks,
          };
        });
      }

      // Calculate class statistics
      let classStatistics = { highestScore: 0, lowestScore: 0, classAverage: 0, totalStudents: 0 };

      if (reportCard.classId && reportCard.termId) {
        try {
          const allClassReportCards = await storage.getReportCardsByClassAndTerm(
            reportCard.classId,
            reportCard.termId
          );

          if (allClassReportCards && allClassReportCards.length > 0) {
            const scoredCards = allClassReportCards.filter(
              (rc: any) => rc.averagePercentage !== null && rc.averagePercentage > 0
            );
            const scoredPercentages = scoredCards.map((rc: any) => rc.averagePercentage as number);

            if (scoredPercentages.length > 0) {
              classStatistics = {
                highestScore: Math.round(Math.max(...scoredPercentages)),
                lowestScore: Math.round(Math.min(...scoredPercentages)),
                classAverage: Math.round(
                  (scoredPercentages.reduce((sum: number, p: number) => sum + p, 0) / scoredPercentages.length) * 10
                ) / 10,
                totalStudents: allClassReportCards.length
              };
            }

            // Compute per-subject class averages
            const fullRcIds = allClassReportCards.map((r: any) => r.id as number);
            if (fullRcIds.length > 0) {
              const allClassSubjectItems = await db.select({
                subjectId: schema.reportCardItems.subjectId,
                obtainedMarks: schema.reportCardItems.obtainedMarks,
              })
                .from(schema.reportCardItems)
                .where(inArray(schema.reportCardItems.reportCardId, fullRcIds));

              const subjectGroups = new Map<number, number[]>();
              for (const si of allClassSubjectItems) {
                if (si.subjectId && si.obtainedMarks && si.obtainedMarks > 0) {
                  if (!subjectGroups.has(si.subjectId)) subjectGroups.set(si.subjectId, []);
                  subjectGroups.get(si.subjectId)!.push(si.obtainedMarks);
                }
              }

              const subjectAvgMap = new Map<number, number>();
              for (const [sid, scores] of subjectGroups) {
                subjectAvgMap.set(sid, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
              }

              enhancedItems = enhancedItems.map((item: any) => ({
                ...item,
                classAverage: subjectAvgMap.get(item.subjectId) ?? item.classAverage ?? null,
              }));
            }
          }
        } catch (statsError) {
          console.error('Error calculating class statistics:', statsError);
        }
      }

      // Resolve teacher and principal details
      let teacherName = '';
      let principalName = '';
      let dateOfBirth = (reportCard as any).dateOfBirth || null;
      let gender = (reportCard as any).gender || null;
      let teacherSignatureUrl = (reportCard as any).teacherSignatureUrl || null;
      let principalSignatureUrl = (reportCard as any).principalSignatureUrl || null;

      if (reportCard.studentId) {
        const studentUser = await storage.getUser(reportCard.studentId as any);
        if (studentUser) {
          dateOfBirth = studentUser.dateOfBirth || null;
          gender = studentUser.gender || null;
        }
      }

      if (reportCard.classId) {
        const classInfo = await storage.getClass(reportCard.classId);
        if (classInfo?.classTeacherId) {
          const teacherUser = await storage.getUser(classInfo.classTeacherId);
          if (teacherUser) {
            teacherName = `${teacherUser.firstName || ''} ${teacherUser.lastName || ''}`.trim();
          }
          if (!teacherSignatureUrl) {
            const teacherProfile = await storage.getTeacherProfile(classInfo.classTeacherId);
            if (teacherProfile?.signatureUrl) teacherSignatureUrl = teacherProfile.signatureUrl;
          }
        }
      }

      const resolved = await resolveDesignatedPrincipal(db, storage, (reportCard as any).principalSignedBy);
      if (!principalName) principalName = resolved.principalName;
      if (!principalSignatureUrl) principalSignatureUrl = resolved.principalSignatureUrl;

      res.json({
        ...reportCard,
        items: enhancedItems,
        classStatistics,
        teacherName,
        principalName,
        dateOfBirth,
        gender,
        teacherSignatureUrl,
        principalSignatureUrl,
      });
    } catch (error: any) {
      console.error('Error getting report card:', error);
      res.status(500).json({ message: error.message || 'Failed to get report card' });
    }
  };

  /**
   * POST /api/reports/generate-enhanced/:classId
   * Generate report cards for entire class (fallback/admin tool)
   */
  generateEnhanced = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId } = req.params;
      const { termId, gradingScale = 'standard' } = req.body;

      if (!termId) {
        res.status(400).json({ message: 'Term ID is required' });
        return;
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
  };

  /**
   * POST /api/reports/:reportCardId/auto-populate
   * Auto-populate scores from exams
   */
  autoPopulate = async (req: Request, res: Response): Promise<void> => {
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
  };

  /**
   * PATCH /api/reports/items/:itemId/override
   * Override individual subject score (teacher/admin)
   */
  overrideItemScore = async (req: Request, res: Response): Promise<void> => {
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
  updateStatus = async (req: Request, res: Response): Promise<void> => {
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
  updateRemarks = async (req: Request, res: Response): Promise<void> => {
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
  getDefaultComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportCardId } = req.params;
      const { generateTeacherComment, generatePrincipalComment } = await import('../../routes/report-helpers');

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        res.status(404).json({ message: 'Report card not found' });
        return;
      }

      const student = await storage.getStudent(reportCard.studentId);
      const studentName = student ? `${(student as any).firstName || 'Student'}` : 'Student';
      const percentage = reportCard.averagePercentage || 0;

      const teacherComment = generateTeacherComment(studentName, percentage);
      const principalComment = generatePrincipalComment(studentName, percentage);

      res.json({ teacherComment, principalComment, studentName, averagePercentage: percentage });
    } catch (error: any) {
      console.error('Error generating default comments:', error);
      res.status(500).json({ message: error.message || 'Failed to generate comments' });
    }
  };

  /**
   * POST /api/reports/backfill-comments
   * Backfill comments for report cards without them (admin only)
   */
  backfillComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { termId, classId, overwrite = false } = req.body;
      const { generateTeacherComment, generatePrincipalComment } = await import('../../routes/report-helpers');

      const conditions: any[] = [];
      if (termId) conditions.push(eq(schema.reportCards.termId, Number(termId)));
      if (classId) conditions.push(eq(schema.reportCards.classId, Number(classId)));

      let query = db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        averagePercentage: schema.reportCards.averagePercentage,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
      }).from(schema.reportCards);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const reportCards = await query;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const rc of reportCards) {
        try {
          if (!overwrite && rc.teacherRemarks && rc.principalRemarks) {
            skipped++;
            continue;
          }

          const student = await storage.getStudent(rc.studentId);
          const studentName = student ? ((student as any).lastName || 'Student') : 'Student';
          const percentage = rc.averagePercentage || 0;

          const updateData: any = { updatedAt: new Date() };
          if (overwrite || !rc.teacherRemarks) updateData.teacherRemarks = generateTeacherComment(studentName, percentage);
          if (overwrite || !rc.principalRemarks) updateData.principalRemarks = generatePrincipalComment(studentName, percentage);

          await db.update(schema.reportCards).set(updateData).where(eq(schema.reportCards.id, rc.id));
          updated++;
        } catch (err: any) {
          errors.push(`Report card ${rc.id}: ${err.message}`);
        }
      }

      res.json({
        message: `Backfill completed. Updated ${updated} report cards, skipped ${skipped}.`,
        updated,
        skipped,
        total: reportCards.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error: any) {
      console.error('Error backfilling comments:', error);
      res.status(500).json({ message: error.message || 'Failed to backfill comments' });
    }
  };
}
