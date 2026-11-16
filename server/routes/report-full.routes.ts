/** Full report card fetch with permission checks — split from enhanced-report-cards.routes.ts. */
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
export async function registerReportFullRoutes(app: Express) {
  // Get report card with all items (full details)
  // Includes canEditTest/canEditExam permissions for each item based on the logged-in user
  // Permission is granted if teacher created the exam OR is assigned to the subject
  app.get('/api/reports/:reportCardId/full', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const reportCard = await storage.getReportCardWithItems(Number(reportCardId));

      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Calculate permission flags for each item using the shared permission utility
      // This ensures identical logic between this GET endpoint and the PATCH override endpoint
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;
      const { calculateScorePermissions } = await import('@shared/score-permissions');

      // Get teacher's subject assignments for this class (for non-admins)
      // This allows teachers to edit scores for subjects they are assigned to teach
      let teacherSubjectAssignments: Set<number> = new Set();
      const isAdmin = [1, 2].includes(userRoleId); // Super Admin = 1, Admin = 2

      if (!isAdmin && reportCard.classId) {
        const assignments = await storage.getTeacherAssignmentsForClass(userId, reportCard.classId);
        teacherSubjectAssignments = new Set(assignments.map((a: any) => a.subjectId));
      }

      const enhancedItems = reportCard.items.map((item: any) => {
        // Check if teacher is assigned to this subject for this class
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

      // Fix stale derived values: items synced before the weighted-score recalculation
      // step was added may have obtainedMarks=0 even when testScore/examScore are set.
      // Recompute on-the-fly here so the display is correct without a DB migration.
      let finalItems = enhancedItems;
      const hasStaleItems = enhancedItems.some(
        (item: any) =>
          (item.testScore !== null || item.examScore !== null) &&
          (item.obtainedMarks === 0 || item.obtainedMarks === null)
      );
      if (hasStaleItems) {
        const { calculateWeightedScore: calcW, calculateGradeFromConfig: calcG } = await import('../grading-config');
        const { getActiveGradingConfig } = await import('../grade-scale-service');
        const activeConfig = await getActiveGradingConfig();
        finalItems = enhancedItems.map((item: any) => {
          const hasScores = item.testScore !== null || item.examScore !== null;
          const isStale = hasScores && (item.obtainedMarks === 0 || item.obtainedMarks === null);
          if (!isStale) return item;
          const weighted = calcW(
            item.testScore ?? null,
            item.testMaxScore ?? null,
            item.examScore ?? null,
            item.examMaxScore ?? null,
            activeConfig
          );
          const gradeInfo = calcG(weighted.percentage, activeConfig);
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

      // Calculate class statistics for this report card's class and term
      // This calculation matches exactly what the teacher view does in TeacherReportCards.tsx
      let classStatistics = {
        highestScore: 0,
        lowestScore: 0,
        classAverage: 0,
        totalStudents: 0
      };

      if (reportCard.classId && reportCard.termId) {
        try {
          // Get all report cards for this class and term to calculate statistics
          const allClassReportCards = await storage.getReportCardsByClassAndTerm(
            reportCard.classId,
            reportCard.termId
          );

          if (allClassReportCards && allClassReportCards.length > 0) {
            // Filter to only students with actual scores (averagePercentage > 0).
            // This matches the logic in GET /api/report-cards/:reportCardId and the
            // draft preview endpoint, ensuring all three views show consistent stats.
            // Using > 0 (not just !== null) keeps unscored students (stored as 0) out
            // of highest/lowest/average so the class stats aren't skewed by empty cards.
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

            // Compute per-subject class averages and inject into finalItems.
            // Powers the CLASS AVG column in the print template (CognitiveDomain).
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
              const subjectAvgMapFull = new Map<number, number>();
              for (const [sid, scores] of subjectGroups) {
                subjectAvgMapFull.set(sid, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
              }
              finalItems = finalItems.map((item: any) => ({
                ...item,
                classAverage: subjectAvgMapFull.get(item.subjectId) ?? item.classAverage ?? null,
              }));
            }
          }
        } catch (statsError) {
          console.error('Error calculating class statistics:', statsError);
        }
      }

      // Resolve teacher name, principal name, DOB, gender, and signatures for PDF/export
      let teacherName = '';
      let principalName = '';
      let dateOfBirth = (reportCard as any).dateOfBirth || null;
      let gender = (reportCard as any).gender || null;
      let teacherSignatureUrl = (reportCard as any).teacherSignatureUrl || null;
      let principalSignatureUrl = (reportCard as any).principalSignatureUrl || null;

      // Get student's DOB and gender from user record
      if (reportCard.studentId) {
        const studentUser = await storage.getUser(reportCard.studentId as any);
        if (studentUser) {
          dateOfBirth = studentUser.dateOfBirth || null;
          gender = studentUser.gender || null;
        }
      }

      // Resolve teacher name and signature from class teacher
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

      // Resolve principal name + signature using designated principal helper
      {
        const resolved = await resolveDesignatedPrincipal(db, storage, (reportCard as any).principalSignedBy);
        if (!principalName) principalName = resolved.principalName;
        if (!principalSignatureUrl) principalSignatureUrl = resolved.principalSignatureUrl;
      }

      res.json({
        ...reportCard,
        items: finalItems,
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
  });
}
