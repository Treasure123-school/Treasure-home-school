/** Enhanced report cards — views & generation (getMyReportCards, getReportCardsByClassTerm, getReportCardFull, generateEnhanced, autoPopulate) — extracted from enhanced.controller.ts. */
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
export const getMyReportCards = async (req: Request, res: Response): Promise<void> => {
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
export const getReportCardsByClassTerm = async (req: Request, res: Response): Promise<void> => {
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
export const getReportCardFull = async (req: Request, res: Response): Promise<void> => {
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
export const generateEnhanced = async (req: Request, res: Response): Promise<void> => {
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
export const autoPopulate = async (req: Request, res: Response): Promise<void> => {
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
