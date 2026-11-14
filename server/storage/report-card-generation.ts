/** Storage layer: report card generation engine (positions, scores, weighting).
 *  Chain: DatabaseStorageReportCardGeneration → extends into report-card-remarks-templates.ts */
import { db, schema } from '../storage/helpers';
import { getActiveGradingConfig } from '../grade-scale-service';
import { calculateGradeFromConfig, calculateWeightedScore } from '../grading-config';
import { realtimeService } from '../realtime-service';
import { ClassSubjectMapping, ReportCard, ReportCardItem, Student, Subject, SystemSettings } from '@shared/schema.pg';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DatabaseStorageHomepageExamReports } from './homepage-exam-reports'
import type { IStorage } from './types'

export class DatabaseStorageReportCardGeneration extends DatabaseStorageHomepageExamReports {
  async recalculateClassPositions(classId: number, termId: number): Promise<void> {
    try {
      console.log(`[REPORT-CARD] Calculating class positions for class ${classId}, term ${termId}`);

      // Get positioning method from system settings (default to 'average' for fairness)
      const settings = await db.select().from(schema.systemSettings).limit(1);
      const positioningMethod = settings[0]?.positioningMethod || 'average';
      console.log(`[REPORT-CARD] Using positioning method: ${positioningMethod}`);

      // Step 1: Get all report cards for this class and term with their total scores
      const reportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore
      })
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ));

      if (reportCards.length === 0) {
        console.log(`[REPORT-CARD] No report cards found for class ${classId}, term ${termId}`);
        return;
      }

      const totalStudentsInClass = reportCards.length;

      // Step 2: Sort based on positioning method
      // 'average' = use averageScore (fair for different subject counts)
      // 'total' = use totalScore (original behavior)
      const sortedCards = [...reportCards].sort((a, b) => {
        let scoreA: number;
        let scoreB: number;

        if (positioningMethod === 'average') {
          // Use average score for fair comparison across departments
          scoreA = a.averageScore ?? 0;
          scoreB = b.averageScore ?? 0;
        } else {
          // Use total score (original behavior)
          scoreA = a.totalScore ?? a.averageScore ?? 0;
          scoreB = b.totalScore ?? b.averageScore ?? 0;
        }

        return scoreB - scoreA; // Descending order
      });

      // Step 3: Calculate positions with proper tie handling
      // Students with same score share same position, next position skips appropriately
      // e.g., if two students are 1st, the next student is 3rd (not 2nd)
      const positionMap = new Map<number, number>(); // reportCardId -> position

      let lastAssignedPosition = 1;
      let previousScore: number | null = null;

      for (let i = 0; i < sortedCards.length; i++) {
        const card = sortedCards[i];
        const score = positioningMethod === 'average'
          ? (card.averageScore ?? 0)
          : (card.totalScore ?? card.averageScore ?? 0);

        if (i === 0) {
          // First student always gets position 1
          lastAssignedPosition = 1;
        } else if (score !== previousScore) {
          // Different score from previous - position = current index + 1 (0-indexed to 1-indexed)
          // This correctly skips positions for ties (e.g., after two 1st places, next is 3rd)
          lastAssignedPosition = i + 1;
        }
        // If score equals previousScore, keep lastAssignedPosition (ties share same position)

        positionMap.set(card.id, lastAssignedPosition);
        previousScore = score;
      }

      // Step 4: Update all report cards with calculated positions
      for (const card of reportCards) {
        const position = positionMap.get(card.id) ?? reportCards.length;

        await db.update(schema.reportCards)
          .set({
            position: position,
            totalStudentsInClass: totalStudentsInClass,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCards.id, card.id));
      }

      console.log(`[REPORT-CARD] Successfully calculated positions for ${totalStudentsInClass} students in class ${classId}, term ${termId}`);

      // Emit WebSocket event for real-time position updates
      try {
        realtimeService.emitTableChange('report_cards', 'UPDATE', {
          event: 'positions_updated',
          classId,
          termId,
          totalStudents: totalStudentsInClass,
          reportCardIds: reportCards.map((rc: { id: number }) => rc.id),
          positions: Array.from(positionMap.entries()).map(([id, pos]) => ({ reportCardId: id, position: pos }))
        });
      } catch (emitError) {
        console.warn(`[REPORT-CARD] Failed to emit position update WebSocket event:`, emitError);
      }

    } catch (error) {
      console.error(`[REPORT-CARD] Error calculating class positions for class ${classId}, term ${termId}:`, error);
    }
  }

  // Auto-sync exam score to report card (called immediately after exam submission)

  async getClassSubjectMappings(classId: number, department?: string): Promise<ClassSubjectMapping[]> {
    if (department) {
      return await this.db
        .select()
        .from(schema.classSubjectMappings)
        .where(
          and(
            eq(schema.classSubjectMappings.classId, classId),
            or(
              eq(schema.classSubjectMappings.department, department),
              isNull(schema.classSubjectMappings.department)
            )
          )
        );
    }
    return await this.db
      .select()
      .from(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.classId, classId));
  }


  async getSubjectsByClassAndDepartment(classId: number, department?: string): Promise<Subject[]> {
    const mappings = await this.getClassSubjectMappings(classId, department);
    if (mappings.length === 0) return [];

    const subjectIds = mappings.map(m => m.subjectId);
    return await this.db
      .select()
      .from(schema.subjects)
      .where(
        and(
          inArray(schema.subjects.id, subjectIds),
          eq(schema.subjects.isActive, true)
        )
      );
  }


  async getExamScoresForReportCard(studentId: string, subjectId: number, termId: number): Promise<{ testExams: any[]; mainExams: any[] }> {
    try {
      // Get all exams for this subject and term
      const examResults = await db.select({
        id: schema.examResults.id,
        examId: schema.examResults.examId,
        // Use COALESCE so both the `score` column (auto-scored) and `marksObtained` column
        // (manually recorded) are captured — whichever is populated wins
        score: sql<number>`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}, 0)`,
        // exam_results.maxScore is the ACTUAL max the exam was marked out of (e.g. 60).
        // exams.totalMarks is the template default (often 100) and must only be a fallback.
        maxScore: sql<number>`COALESCE(${schema.examResults.maxScore}, ${schema.exams.totalMarks}, 100)`,
        examType: schema.exams.examType,
        examDate: schema.exams.examDate,
        createdAt: schema.examResults.createdAt
      })
        .from(schema.examResults)
        .innerJoin(schema.exams, eq(schema.examResults.examId, schema.exams.id))
        .where(and(
          eq(schema.examResults.studentId, studentId),
          eq(schema.exams.subjectId, subjectId),
          eq(schema.exams.termId, termId),
          // Only include results that actually have a score in at least one column
          sql`COALESCE(${schema.examResults.score}, ${schema.examResults.marksObtained}) IS NOT NULL`
        ))
        .orderBy(schema.examResults.createdAt);

      const testExams = examResults.filter((r: any) => r.examType === 'test' || r.examType === 'quiz' || r.examType === 'assignment');
      const mainExams = examResults.filter((r: any) => r.examType === 'exam' || r.examType === 'final' || r.examType === 'midterm');

      return { testExams, mainExams };
    } catch (error) {
      console.error('Error getting exam scores for report card:', error);
      return { testExams: [], mainExams: [] };
    }
  }


  async getSystemSettings(): Promise<SystemSettings | undefined> {
    const result = await this.db.select().from(schema.systemSettings).limit(1);
    return result[0];
  }

  async autoPopulateReportCardScores(reportCardId: number): Promise<{ populated: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let populated = 0;

      // Get the report card details
      const reportCard = await this.getReportCard(reportCardId);
      if (!reportCard) {
        return { populated: 0, errors: ['Report card not found'] };
      }

      // Use the active DB grade scale (cached), override weights from system settings
      let config = await getActiveGradingConfig();
      const systemSettings = await this.getSystemSettings();
      if (systemSettings) {
        const testWeight = systemSettings.testWeight ?? config.testWeight;
        const examWeight = systemSettings.examWeight ?? config.examWeight;
        config = { ...config, testWeight, examWeight };
      }

      // Get all report card items
      const items = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));

      for (const item of items) {
        try {
          // Skip if item has been manually overridden
          if (item.isOverridden) continue;

          // Get exam scores for this student and subject
          const examScores = await this.getExamScoresForReportCard(
            reportCard.studentId,
            item.subjectId,
            reportCard.termId
          );

          let testScore: number | null = null;
          let testMaxScore: number | null = null;
          let examScore: number | null = null;
          let examMaxScore: number | null = null;

          // Aggregate test scores (type: 'test')
          if (examScores.testExams.length > 0) {
            const lastTest = examScores.testExams[examScores.testExams.length - 1];
            testScore = lastTest.score;
            testMaxScore = lastTest.maxScore;
          }

          // Aggregate main exam scores (type: 'exam')
          if (examScores.mainExams.length > 0) {
            const lastExam = examScores.mainExams[examScores.mainExams.length - 1];
            examScore = lastExam.score;
            examMaxScore = lastExam.maxScore;
          }

          // Calculate weighted score using system settings weights
          const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config);
          const gradeInfo = calculateGradeFromConfig(weighted.percentage, config);

          // Update the report card item
          await db.update(schema.reportCardItems)
            .set({
              testScore: testScore,
              testMaxScore: testMaxScore,
              testWeightedScore: Math.round(weighted.testWeighted),
              examScore: examScore,
              examMaxScore: examMaxScore,
              examWeightedScore: Math.round(weighted.examWeighted),
              obtainedMarks: Math.round(weighted.weightedScore),
              percentage: Math.round(weighted.percentage),
              grade: gradeInfo.grade,
              remarks: gradeInfo.remarks,
              updatedAt: new Date()
            })
            .where(eq(schema.reportCardItems.id, item.id));

          populated++;
        } catch (itemError: any) {
          errors.push(`Failed to populate scores for item ${item.id}: ${itemError.message}`);
        }
      }

      // Recalculate report card totals
      await this.recalculateReportCard(reportCardId, (reportCard as any).gradingScale || 'standard');

      return { populated, errors };
    } catch (error: any) {
      console.error('Error auto-populating report card scores:', error);
      return { populated: 0, errors: [error.message] };
    }
  }

  /**
   * Re-apply the active weighted formula to scores ALREADY STORED on each item.
   * Does NOT re-fetch from exam_results — preserves manually-entered scores.
   * Skips items where isOverridden = true.
   * Use this for the individual "Recalculate" button so only the grade/percentage
   * math is corrected, not the raw scores.
   */

  async generateReportCardsForClass(classId: number, termId: number, gradingScale: string, generatedBy: string): Promise<{ created: number; updated: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let created = 0;
      let updated = 0;

      // Get all students in the class
      const students = await db.select()
        .from(schema.students)
        .where(eq(schema.students.classId, classId));

      // Get class info to determine if this is a Senior Secondary class
      const classInfo = await this.getClass(classId);
      const isSeniorSecondary = classInfo &&
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level =>
          classInfo.level?.toLowerCase().includes(level.toLowerCase())
        );

      // Get class teacher's signature for pre-population
      let classTeacherSignatureUrl: string | null = null;
      if (classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        classTeacherSignatureUrl = teacherProfile?.signatureUrl || null;
      }

      for (const student of students) {
        try {
          // Check if report card already exists
          const existingReportCard = await db.select()
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.studentId, student.id),
              eq(schema.reportCards.termId, termId)
            ))
            .limit(1);

          let reportCardId: number;

          if (existingReportCard.length === 0) {
            // Get student name for generating default comments
            const studentUser = await this.getUser(student.userId);
            const studentFirstName = studentUser?.firstName || 'Student';

            // Create new report card with pre-populated teacher signature and default comments
            // Race-safe: unique index on (student_id, term_id); on conflict, use the
            // card a concurrent generation/sync already created.
            const inserted = await db.insert(schema.reportCards)
              .values({
                studentId: student.id,
                classId: classId,
                termId: termId,
                status: 'draft',
                gradingScale: gradingScale,
                scoreAggregationMode: 'last',
                generatedBy: generatedBy,
                generatedAt: new Date(),
                // Pre-populate class teacher's signature if available
                teacherSignatureUrl: classTeacherSignatureUrl,
                teacherSignedBy: classTeacherSignatureUrl ? classInfo?.classTeacherId : null,
                teacherSignedAt: classTeacherSignatureUrl ? new Date() : null,
                // Default comments will be generated after scores are populated
              })
              .onConflictDoNothing({ target: [schema.reportCards.studentId, schema.reportCards.termId] })
              .returning();
            if (inserted.length > 0) {
              reportCardId = inserted[0].id;
              created++;
            } else {
              const winner = await db.select()
                .from(schema.reportCards)
                .where(and(
                  eq(schema.reportCards.studentId, student.id),
                  eq(schema.reportCards.termId, termId)
                ))
                .limit(1);
              if (winner.length === 0) {
                throw new Error(`Report card for student ${student.id}, term ${termId} vanished after conflict`);
              }
              reportCardId = winner[0].id;
              updated++;
            }
          } else {
            reportCardId = existingReportCard[0].id;
            updated++;
          }

          // Get student's department for SS students — normalize to lowercase to match class_subject_mappings
          const studentDepartment = (student as any).department?.trim().toLowerCase() || undefined;

          // SINGLE SOURCE OF TRUTH: Use class_subject_mappings
          // For SS students with department, get department-specific subjects
          // For JSS/other students, get all class subjects (no department filter)
          let subjects: any[];

          if (isSeniorSecondary && studentDepartment) {
            // SS students with department - get department-specific mappings
            subjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
          } else {
            // JSS/other students - get all class mappings (no department filter)
            subjects = await this.getSubjectsByClassAndDepartment(classId);
          }

          // If no subjects assigned for this class/department, log warning and skip
          if (subjects.length === 0) {
            console.log(`[REPORT-CARD] No class_subject_mappings found for class ${classId}, department: ${studentDepartment || 'none'}. Admin must assign subjects via Subject Manager.`);
            errors.push(`No subjects assigned for student ${student.id} (class ${classId}, dept: ${studentDepartment || 'none'}). Admin must configure subjects.`);
            continue;
          }

          // Get the set of valid subject IDs from class_subject_mappings
          const validSubjectIds = new Set(subjects.map(s => s.id));

          // CLEANUP: Remove report card items that are NOT in class_subject_mappings
          // This ensures only the admin-assigned subjects appear on report cards
          const existingItems = await db.select()
            .from(schema.reportCardItems)
            .where(eq(schema.reportCardItems.reportCardId, reportCardId));

          for (const item of existingItems) {
            if (!validSubjectIds.has(item.subjectId)) {
              await db.delete(schema.reportCardItems)
                .where(eq(schema.reportCardItems.id, item.id));
              console.log(`[REPORT-CARD] Removed invalid subject ${item.subjectId} from report card ${reportCardId}`);
            }
          }

          // Create or update report card items for each valid subject
          for (const subject of subjects) {
            const existingItem = await db.select()
              .from(schema.reportCardItems)
              .where(and(
                eq(schema.reportCardItems.reportCardId, reportCardId),
                eq(schema.reportCardItems.subjectId, subject.id)
              ))
              .limit(1);

            if (existingItem.length === 0) {
              await db.insert(schema.reportCardItems)
                .values({
                  reportCardId: reportCardId,
                  subjectId: subject.id,
                  totalMarks: 100,
                  obtainedMarks: 0,
                  percentage: 0
                })
                .onConflictDoNothing();
            }
          }

          // Auto-populate scores for this report card
          await this.autoPopulateReportCardScores(reportCardId);

        } catch (studentError: any) {
          errors.push(`Failed to generate report card for student ${student.id}: ${studentError.message}`);
        }
      }

      // Recalculate positions for all report cards in this class/term
      await this.recalculateClassPositions(classId, termId);

      return { created, updated, errors };
    } catch (error: any) {
      console.error('Error generating report cards for class:', error);
      return { created: 0, updated: 0, errors: [error.message] };
    }
  }


  async reapplyWeightedScoresToItems(reportCardId: number): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;
    try {
      // Fetch the report card's own gradingScale so recalculateReportCard uses the
      // correct scale instead of a hardcoded 'standard' fallback.
      const rcRows = await db
        .select({ gradingScale: schema.reportCards.gradingScale })
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, reportCardId))
        .limit(1);
      const gradingScale = rcRows[0]?.gradingScale || 'standard';

      // Get system weights (testWeight/examWeight); fall back to grading config defaults
      let config = await getActiveGradingConfig();
      const systemSettingsRows = await db
        .select({ testWeight: schema.systemSettings.testWeight, examWeight: schema.systemSettings.examWeight })
        .from(schema.systemSettings)
        .limit(1);
      if (systemSettingsRows[0]) {
        config = {
          ...config,
          testWeight:  systemSettingsRows[0].testWeight  ?? config.testWeight,
          examWeight:  systemSettingsRows[0].examWeight  ?? config.examWeight,
        };
      }

      const items = await db
        .select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));

      for (const item of items) {
        try {
          // Never touch manually-overridden items
          if (item.isOverridden) continue;

          // Use the raw scores already stored on the item (no exam_results re-fetch)
          const testScore    = item.testScore    ?? null;
          const testMaxScore = item.testMaxScore ?? null;
          const examScore    = item.examScore    ?? null;
          const examMaxScore = item.examMaxScore ?? null;

          // If the item has no scores at all yet, leave it alone
          if (testScore === null && examScore === null) continue;

          const weighted  = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config);
          const gradeInfo = calculateGradeFromConfig(weighted.percentage, config);

          await db.update(schema.reportCardItems)
            .set({
              testWeightedScore: Math.round(weighted.testWeighted),
              examWeightedScore: Math.round(weighted.examWeighted),
              obtainedMarks:     Math.round(weighted.weightedScore),
              percentage:        Math.round(weighted.percentage),
              grade:             gradeInfo.grade,
              remarks:           gradeInfo.remarks,
              updatedAt:         new Date(),
            })
            .where(eq(schema.reportCardItems.id, item.id));

          updated++;
        } catch (itemErr: any) {
          errors.push(`Item ${item.id}: ${itemErr.message}`);
        }
      }

      // Re-aggregate header (averagePercentage, overallGrade, totalScore, positions)
      await this.recalculateReportCard(reportCardId, gradingScale);
    } catch (err: any) {
      errors.push(err.message);
    }
    return { updated, errors };
  }


  async overrideReportCardItemScore(itemId: number, data: {
    testScore?: number | null;
    testMaxScore?: number | null;
    examScore?: number | null;
    examMaxScore?: number | null;
    teacherRemarks?: string | null;
    overriddenBy: string;
  }): Promise<ReportCardItem | undefined> {
    try {
      // Get the item first to get report card info
      const item = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.id, itemId))
        .limit(1);

      if (item.length === 0) return undefined;

      // Get report card for grading scale
      const reportCard = await this.getReportCard(item[0].reportCardId);
      if (!reportCard) return undefined;

      // Use the active DB grade scale, then overlay system-settings weights so this
      // function is consistent with autoPopulateReportCardScores and reapplyWeightedScoresToItems.
      let gradingConfig = await getActiveGradingConfig();
      const overrideSysRows = await db
        .select({ testWeight: schema.systemSettings.testWeight, examWeight: schema.systemSettings.examWeight })
        .from(schema.systemSettings)
        .limit(1);
      if (overrideSysRows[0]) {
        gradingConfig = {
          ...gradingConfig,
          testWeight: overrideSysRows[0].testWeight ?? gradingConfig.testWeight,
          examWeight: overrideSysRows[0].examWeight ?? gradingConfig.examWeight,
        };
      }

      // Calculate new weighted score
      const testScore = data.testScore !== undefined ? data.testScore : item[0].testScore;
      const testMaxScore = data.testMaxScore !== undefined ? data.testMaxScore : item[0].testMaxScore;
      const examScore = data.examScore !== undefined ? data.examScore : item[0].examScore;
      const examMaxScore = data.examMaxScore !== undefined ? data.examMaxScore : item[0].examMaxScore;

      const weighted = calculateWeightedScore(testScore, testMaxScore, examScore, examMaxScore, gradingConfig);
      const gradeInfo = calculateGradeFromConfig(weighted.percentage, gradingConfig);

      const result = await db.update(schema.reportCardItems)
        .set({
          testScore: testScore,
          testMaxScore: testMaxScore,
          testWeightedScore: Math.round(weighted.testWeighted),
          examScore: examScore,
          examMaxScore: examMaxScore,
          examWeightedScore: Math.round(weighted.examWeighted),
          obtainedMarks: Math.round(weighted.weightedScore),
          percentage: Math.round(weighted.percentage),
          grade: gradeInfo.grade,
          remarks: gradeInfo.remarks,
          teacherRemarks: data.teacherRemarks !== undefined ? data.teacherRemarks : item[0].teacherRemarks,
          isOverridden: true,
          overriddenBy: data.overriddenBy,
          overriddenAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.reportCardItems.id, itemId))
        .returning();

      // Recalculate report card totals
      await this.recalculateReportCard(reportCard.id, (reportCard as any).gradingScale || 'standard');

      // Recalculate class positions since scores changed
      if (reportCard.classId && reportCard.termId) {
        await this.recalculateClassPositions(reportCard.classId, reportCard.termId);
      }

      console.log(`[REPORT-CARD-OVERRIDE] Successfully updated item ${itemId} with test: ${testScore}/${testMaxScore}, exam: ${examScore}/${examMaxScore}, grade: ${gradeInfo.grade}`);

      return result[0];
    } catch (error) {
      console.error('Error overriding report card item score:', error);
      return undefined;
    }
  }


  async updateReportCardStatus(reportCardId: number, status: string, userId: string): Promise<ReportCard | undefined> {
    try {
      // Validate status value
      const validStatuses = ['draft', 'finalized', 'published'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Get current report card to check current status
      const currentReportCard = await this.getReportCard(reportCardId);
      if (!currentReportCard) {
        throw new Error('Report card not found');
      }

      const currentStatus = currentReportCard.status || 'draft';

      // Short-circuit: If already in the target status, return current report card without updating timestamps
      if (currentStatus === status) {
        return currentReportCard;
      }

      // Define valid state transitions (centralized state machine)
      const validTransitions: Record<string, string[]> = {
        'draft': ['finalized'],           // Draft can only go to Finalized
        'finalized': ['draft', 'published'],  // Finalized can revert to Draft or go to Published
        'published': ['draft', 'finalized']   // Published can revert to Draft or Finalized
      };

      const allowedNextStatuses = validTransitions[currentStatus] || [];

      // Validate transition
      if (!allowedNextStatuses.includes(status)) {
        throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`);
      }

      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };

      if (status === 'draft') {
        updateData.finalizedAt = null;
        updateData.publishedAt = null;
        updateData.locked = false;
      } else if (status === 'finalized') {
        updateData.finalizedAt = new Date();
        updateData.publishedAt = null;
        updateData.locked = true;
      } else if (status === 'published') {
        updateData.publishedAt = new Date();
        updateData.locked = true;
      }

      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error updating report card status:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  // OPTIMIZED version - single query with conditional update for instant status changes
}
