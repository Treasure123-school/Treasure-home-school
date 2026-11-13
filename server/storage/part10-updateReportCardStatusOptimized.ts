/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { getActiveGradingConfig } from '../grade-scale-service';
import { calculateGradeFromConfig, calculateWeightedScore } from '../grading-config';
import { Exam, ReportCard, Student, Subject } from '@shared/schema.pg';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { DatabaseStorageP09 } from './part09-recalculateClassPositions'
import type { IStorage } from './types'

export class DatabaseStorageP10 extends DatabaseStorageP09 {
  async updateReportCardStatusOptimized(reportCardId: number, status: string, userId: string): Promise<{ reportCard: ReportCard; previousStatus: string } | undefined> {
    try {
      // Validate status value upfront
      const validStatuses = ['draft', 'finalized', 'published'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Single efficient query to get just the current status
      const current = await db.select({
        id: schema.reportCards.id,
        status: schema.reportCards.status
      })
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, reportCardId))
        .limit(1);

      if (!current.length) {
        throw new Error('Report card not found');
      }

      const currentStatus = current[0].status || 'draft';

      // Short-circuit: If already in the target status, get and return full report card
      if (currentStatus === status) {
        const existing = await db.select()
          .from(schema.reportCards)
          .where(eq(schema.reportCards.id, reportCardId))
          .limit(1);
        return { reportCard: existing[0], previousStatus: currentStatus };
      }

      // Validate state transition
      const validTransitions: Record<string, string[]> = {
        'draft': ['finalized'],
        'finalized': ['draft', 'published'],
        'published': ['draft', 'finalized']
      };

      const allowedNextStatuses = validTransitions[currentStatus] || [];
      if (!allowedNextStatuses.includes(status)) {
        throw new Error(`Invalid state transition: Cannot move from '${currentStatus}' to '${status}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`);
      }

      // Build update data based on target status
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

      // Execute update and return in single operation
      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      const updatedReportCard = result[0];

      // CRITICAL: When finalizing, recalculate and persist report card totals and class positions
      // This ensures admin/parent/student views show correct class statistics
      if (status === 'finalized' && updatedReportCard) {
        console.log(`[REPORT-CARD-STATUS] Recalculating totals for finalized report card ${reportCardId}`);

        // Recalculate this report card's totals (averagePercentage, totalScore, etc.)
        await this.recalculateReportCard(reportCardId, updatedReportCard.gradingScale || 'standard');

        // Recalculate class positions for all students in this class/term
        if (updatedReportCard.classId && updatedReportCard.termId) {
          await this.recalculateClassPositions(updatedReportCard.classId, updatedReportCard.termId);
        }

        // Fetch the updated report card with recalculated values
        const finalResult = await db.select()
          .from(schema.reportCards)
          .where(eq(schema.reportCards.id, reportCardId))
          .limit(1);

        return { reportCard: finalResult[0], previousStatus: currentStatus };
      }

      return { reportCard: updatedReportCard, previousStatus: currentStatus };
    } catch (error) {
      console.error('Error updating report card status (optimized):', error);
      throw error;
    }
  }


  async updateReportCardRemarks(reportCardId: number, teacherRemarks?: string, principalRemarks?: string): Promise<ReportCard | undefined> {
    try {
      const updateData: any = { updatedAt: new Date() };
      if (teacherRemarks !== undefined) updateData.teacherRemarks = teacherRemarks;
      if (principalRemarks !== undefined) updateData.principalRemarks = principalRemarks;

      const result = await db.update(schema.reportCards)
        .set(updateData)
        .where(eq(schema.reportCards.id, reportCardId))
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error updating report card remarks:', error);
      return undefined;
    }
  }

  // Report comment template methods

  async getReportCommentTemplates(role?: string): Promise<any[]> {
    try {
      if (role) {
        return await db.select()
          .from(schema.reportCommentTemplates)
          .where(eq(schema.reportCommentTemplates.role, role))
          .orderBy(desc(schema.reportCommentTemplates.minPercentage));
      }
      return await db.select()
        .from(schema.reportCommentTemplates)
        .orderBy(schema.reportCommentTemplates.role, desc(schema.reportCommentTemplates.minPercentage));
    } catch (error) {
      console.error('Error getting report comment templates:', error);
      return [];
    }
  }


  async getReportCommentTemplate(id: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCommentTemplates)
        .where(eq(schema.reportCommentTemplates.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting report comment template:', error);
      return undefined;
    }
  }


  async createReportCommentTemplate(template: any): Promise<any> {
    try {
      const result = await db.insert(schema.reportCommentTemplates)
        .values(template)
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error creating report comment template:', error);
      throw error;
    }
  }


  async updateReportCommentTemplate(id: number, template: any): Promise<any | undefined> {
    try {
      const result = await db.update(schema.reportCommentTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(schema.reportCommentTemplates.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating report comment template:', error);
      return undefined;
    }
  }


  async deleteReportCommentTemplate(id: number): Promise<boolean> {
    try {
      await db.delete(schema.reportCommentTemplates)
        .where(eq(schema.reportCommentTemplates.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting report comment template:', error);
      return false;
    }
  }


  async getCommentTemplateByPerformance(role: string, percentage: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCommentTemplates)
        .where(
          and(
            eq(schema.reportCommentTemplates.role, role),
            eq(schema.reportCommentTemplates.isActive, true),
            lte(schema.reportCommentTemplates.minPercentage, percentage),
            gte(schema.reportCommentTemplates.maxPercentage, percentage)
          )
        )
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting comment template by performance:', error);
      return undefined;
    }
  }


  async getExamsWithSubjectsByClassAndTerm(classId: number, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        id: schema.exams.id,
        title: schema.exams.title,
        subjectId: schema.exams.subjectId,
        subjectName: schema.subjects.name,
        examType: schema.exams.examType,
        totalMarks: schema.exams.totalMarks,
        examDate: schema.exams.examDate,
        status: schema.exams.status,
        termId: schema.exams.termId
      })
        .from(schema.exams)
        .innerJoin(schema.subjects, eq(schema.exams.subjectId, schema.subjects.id))
        .where(eq(schema.exams.classId, classId));

      if (termId) {
        query = query.where(and(
          eq(schema.exams.classId, classId),
          eq(schema.exams.termId, termId)
        ));
      }

      return await query.orderBy(desc(schema.exams.examDate));
    } catch (error) {
      console.error('Error getting exams by class and term:', error);
      return [];
    }
  }


  async syncExamScoreToReportCard(studentId: string, examId: number, score: number, maxScore: number, forceSync: boolean = false): Promise<{ success: boolean; reportCardId?: number; message: string; isNewReportCard?: boolean }> {
    try {
      console.log(`[REPORT-CARD-SYNC] Starting sync for student ${studentId}, exam ${examId}, score ${score}/${maxScore}`);

      // 1. Get exam details to find subject, class, term, and type
      const exam = await db.select()
        .from(schema.exams)
        .where(eq(schema.exams.id, examId))
        .limit(1);

      if (exam.length === 0) {
        return { success: false, message: 'Exam not found' };
      }

      const examData = exam[0];
      const { subjectId, classId, termId, examType, gradingScale: examGradingScale, createdBy: examCreatedBy } = examData;

      if (!subjectId || !classId || !termId) {
        return { success: false, message: 'Exam missing required fields (subject, class, or term)' };
      }

      // 2. Get student to verify class assignment
      const student = await db.select()
        .from(schema.students)
        .where(eq(schema.students.id, studentId))
        .limit(1);

      if (student.length === 0) {
        return { success: false, message: 'Student not found' };
      }

      // 2b. Get academic term to fetch session year
      const academicTerm = await db.select()
        .from(schema.academicTerms)
        .where(eq(schema.academicTerms.id, termId))
        .limit(1);

      const sessionYear = academicTerm.length > 0
        ? `${academicTerm[0].year}/${academicTerm[0].year + 1}`
        : null;

      // 3. Find or create report card for this student/term
      let reportCard = await db.select()
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.studentId, studentId),
          eq(schema.reportCards.termId, termId)
        ))
        .limit(1);

      let reportCardId: number;
      let isNewReportCard = false;
      const gradingScale = examGradingScale || 'standard';

      if (reportCard.length === 0) {
        // Create new report card (auto-generated)
        console.log(`[REPORT-CARD-SYNC] Auto-creating new report card for student ${studentId}, term ${termId}`);
        isNewReportCard = true;
        const newReportCard = await db.insert(schema.reportCards)
          .values({
            studentId,
            classId,
            termId,
            sessionYear,
            status: 'draft',
            gradingScale,
            scoreAggregationMode: 'last',
            generatedAt: new Date(),
            autoGenerated: true,
            locked: false
          })
          .returning();
        reportCardId = newReportCard[0].id;

        // Get student's class to check if Senior Secondary
        const studentClass = await db.select()
          .from(schema.classes)
          .where(eq(schema.classes.id, classId))
          .limit(1);

        const isSeniorSecondary = studentClass.length > 0 &&
          (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
        // Normalize department - treat empty/whitespace-only as undefined
        const rawDepartment = (student[0].department || '').trim().toLowerCase();
        const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

        // PRIORITY 1: Check student's personal subject assignments (from studentSubjectAssignments table)
        // This is the authoritative source for what subjects a student should have on their report card
        const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
          .from(schema.studentSubjectAssignments)
          .where(and(
            eq(schema.studentSubjectAssignments.studentId, studentId),
            eq(schema.studentSubjectAssignments.classId, classId),
            eq(schema.studentSubjectAssignments.isActive, true)
          ));

        let relevantSubjects: any[] = [];

        if (studentSubjectAssignments.length > 0) {
          // Use student's personal subject assignments - respects department selection
          const studentSubjectIds = studentSubjectAssignments.map((a: { subjectId: number }) => a.subjectId);
          relevantSubjects = await db.select()
            .from(schema.subjects)
            .where(and(
              inArray(schema.subjects.id, studentSubjectIds),
              eq(schema.subjects.isActive, true)
            ));
          console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from student's personal assignments`);
        } else {
          // PRIORITY 2: Use class_subject_mappings as SINGLE SOURCE OF TRUTH
          // NO FALLBACK - Admin must configure subjects via Subject Manager
          relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);

          if (relevantSubjects.length > 0) {
            console.log(`[REPORT-CARD-SYNC] Using ${relevantSubjects.length} subjects from class_subject_mappings (department: ${studentDepartment || 'none'})`);
          } else {
            // No fallback - if no mappings exist, create empty report card
            // Admin must assign subjects via the Subject Manager
            console.log(`[REPORT-CARD-SYNC] No subjects found in class_subject_mappings for class ${classId}, department: ${studentDepartment || 'none'}. Admin must assign subjects.`);
          }
        }

        console.log(`[REPORT-CARD-SYNC] Creating ${relevantSubjects.length} subject items for ${isSeniorSecondary ? `SS ${studentDepartment || 'no-dept'}` : 'non-SS'} student`);

        for (const subject of relevantSubjects) {
          await db.insert(schema.reportCardItems)
            .values({
              reportCardId,
              subjectId: subject.id,
              totalMarks: 100,
              obtainedMarks: 0,
              percentage: 0
            })
            .onConflictDoNothing();
        }
      } else {
        reportCardId = reportCard[0].id;

        // ALSO check existing report cards for missing subjects and add them
        // This ensures students get all their assigned subjects even if report card was created before assignments
        const existingItems = await db.select({ subjectId: schema.reportCardItems.subjectId })
          .from(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCardId));

        const existingSubjectIds = new Set(existingItems.map((item: { subjectId: number }) => item.subjectId));

        // Get student's class and department info
        const studentClass = await db.select()
          .from(schema.classes)
          .where(eq(schema.classes.id, classId))
          .limit(1);

        const isSeniorSecondary = studentClass.length > 0 &&
          (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
        const rawDepartment = (student[0].department || '').trim().toLowerCase();
        const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

        // Get all subjects that should be assigned
        const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
          .from(schema.studentSubjectAssignments)
          .where(and(
            eq(schema.studentSubjectAssignments.studentId, studentId),
            eq(schema.studentSubjectAssignments.classId, classId),
            eq(schema.studentSubjectAssignments.isActive, true)
          ));

        let assignedSubjectIds: number[] = [];

        if (studentSubjectAssignments.length > 0) {
          assignedSubjectIds = studentSubjectAssignments.map((a: { subjectId: number }) => a.subjectId);
        } else {
          const relevantSubjects = await this.getSubjectsByClassAndDepartment(classId, studentDepartment);
          assignedSubjectIds = relevantSubjects.map(s => s.id);
        }

        // Find and add missing subjects
        const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));

        if (missingSubjectIds.length > 0) {
          console.log(`[REPORT-CARD-SYNC] Adding ${missingSubjectIds.length} missing subjects to existing report card ${reportCardId} for student ${studentId}`);

          for (const missingSubjectId of missingSubjectIds) {
            await db.insert(schema.reportCardItems)
              .values({
                reportCardId,
                subjectId: missingSubjectId,
                totalMarks: 100,
                obtainedMarks: 0,
                percentage: 0
              })
              .onConflictDoNothing();
          }
        }
      }

      // 4. Find the report card item for this subject
      let reportCardItem = await db.select()
        .from(schema.reportCardItems)
        .where(and(
          eq(schema.reportCardItems.reportCardId, reportCardId),
          eq(schema.reportCardItems.subjectId, subjectId)
        ))
        .limit(1);

      // Create item if not exists
      if (reportCardItem.length === 0) {
        const newItem = await db.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .onConflictDoNothing()
          .returning();
        if (newItem.length > 0) {
          reportCardItem = newItem;
        } else {
          // Conflict: another concurrent insert won — re-fetch the existing row
          reportCardItem = await db.select()
            .from(schema.reportCardItems)
            .where(and(
              eq(schema.reportCardItems.reportCardId, reportCardId),
              eq(schema.reportCardItems.subjectId, subjectId)
            ))
            .limit(1);
        }
      }

      // 5. Skip if manually overridden — unless forceSync is true (explicit teacher/admin sync)
      if (reportCardItem[0].isOverridden && !forceSync) {
        console.log(`[REPORT-CARD-SYNC] Item ${reportCardItem[0].id} is manually overridden, skipping auto-update`);
        return { success: true, reportCardId, message: 'Skipped - item manually overridden' };
      }
      // If force-syncing an overridden item, clear the override flag first
      if (reportCardItem[0].isOverridden && forceSync) {
        console.log(`[REPORT-CARD-SYNC] Item ${reportCardItem[0].id} was overridden — clearing override for force-sync`);
        await db.update(schema.reportCardItems)
          .set({ isOverridden: false, overriddenBy: null, overriddenAt: null })
          .where(eq(schema.reportCardItems.id, reportCardItem[0].id));
      }

      // 6. Determine if this is a test or exam and update accordingly
      const isTest = ['test', 'quiz', 'assignment'].includes(examType);
      const isMainExam = ['exam', 'final', 'midterm'].includes(examType);

      // CRITICAL: Ensure all values are proper JavaScript numbers to avoid PostgreSQL type conversion errors
      const safeScore = typeof score === 'number' ? score : parseInt(String(score), 10) || 0;
      const safeMaxScore = typeof maxScore === 'number' ? maxScore : parseInt(String(maxScore), 10) || 0;
      const safeExamId = typeof examId === 'number' ? examId : parseInt(String(examId), 10);

      console.log(`[REPORT-CARD-SYNC] Type-safe values: score=${safeScore}, maxScore=${safeMaxScore}, examId=${safeExamId}, examType=${examType}`);

      const updateData: any = {
        updatedAt: new Date()
      };

      if (isTest) {
        updateData.testExamId = safeExamId;
        updateData.testExamCreatedBy = examCreatedBy; // Store which teacher created this test
        updateData.testScore = safeScore;
        updateData.testMaxScore = safeMaxScore;
      } else if (isMainExam) {
        updateData.examExamId = safeExamId;
        updateData.examExamCreatedBy = examCreatedBy; // Store which teacher created this exam
        updateData.examScore = safeScore;
        updateData.examMaxScore = safeMaxScore;
      } else {
        // Default to test if type is unknown
        updateData.testExamId = safeExamId;
        updateData.testExamCreatedBy = examCreatedBy;
        updateData.testScore = safeScore;
        updateData.testMaxScore = safeMaxScore;
      }

      // 7. Calculate weighted score with existing scores
      const existingItem = reportCardItem[0];
      const finalTestScore = isTest ? safeScore : (existingItem.testScore ?? null);
      const finalTestMaxScore = isTest ? safeMaxScore : (existingItem.testMaxScore ?? null);
      const finalExamScore = isMainExam ? safeScore : (existingItem.examScore ?? null);
      const finalExamMaxScore = isMainExam ? safeMaxScore : (existingItem.examMaxScore ?? null);

      // Use the active DB grade scale, then overlay system-settings weights so this
      // function is consistent with autoPopulateReportCardScores and reapplyWeightedScoresToItems.
      let gradingConfig = await getActiveGradingConfig();
      const syncSysRows = await db
        .select({ testWeight: schema.systemSettings.testWeight, examWeight: schema.systemSettings.examWeight })
        .from(schema.systemSettings)
        .limit(1);
      if (syncSysRows[0]) {
        gradingConfig = {
          ...gradingConfig,
          testWeight: syncSysRows[0].testWeight ?? gradingConfig.testWeight,
          examWeight: syncSysRows[0].examWeight ?? gradingConfig.examWeight,
        };
      }
      const weighted = calculateWeightedScore(finalTestScore, finalTestMaxScore, finalExamScore, finalExamMaxScore, gradingConfig);
      const gradeInfo = calculateGradeFromConfig(weighted.percentage, gradingConfig);

      // CRITICAL: Ensure all weighted values are finite integers, defaulting to 0 for NaN/Infinity
      const safeTestWeighted = Number.isFinite(weighted.testWeighted) ? Math.round(weighted.testWeighted) : 0;
      const safeExamWeighted = Number.isFinite(weighted.examWeighted) ? Math.round(weighted.examWeighted) : 0;
      const safeObtainedMarks = Number.isFinite(weighted.weightedScore) ? Math.round(weighted.weightedScore) : 0;
      const safePercentage = Number.isFinite(weighted.percentage) ? Math.round(weighted.percentage) : 0;

      updateData.testWeightedScore = safeTestWeighted;
      updateData.examWeightedScore = safeExamWeighted;
      updateData.obtainedMarks = safeObtainedMarks;
      updateData.percentage = safePercentage;
      updateData.grade = gradeInfo.grade;
      updateData.remarks = gradeInfo.remarks;

      console.log(`[REPORT-CARD-SYNC] Update data: testWeighted=${safeTestWeighted}, examWeighted=${safeExamWeighted}, obtained=${safeObtainedMarks}, pct=${safePercentage}, grade=${gradeInfo.grade}`);

      // 8. Update the report card item
      await db.update(schema.reportCardItems)
        .set(updateData)
        .where(eq(schema.reportCardItems.id, existingItem.id));

      console.log(`[REPORT-CARD-SYNC] Updated report card item ${existingItem.id} with ${isTest ? 'test' : 'exam'} score: ${score}/${maxScore}, grade: ${gradeInfo.grade}`);

      // 9. Recalculate report card totals
      await this.recalculateReportCard(reportCardId, gradingScale);

      // 10. Recalculate class positions
      await this.recalculateClassPositions(classId, termId);

      console.log(`[REPORT-CARD-SYNC] Successfully synced exam ${examId} to report card ${reportCardId} (new: ${isNewReportCard})`);

      return {
        success: true,
        reportCardId,
        isNewReportCard,
        message: isNewReportCard
          ? `New report card auto-created. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)`
          : `Score synced to report card. Grade: ${gradeInfo.grade} (${Math.round(weighted.percentage)}%)`
      };
    } catch (error: any) {
      console.error('[REPORT-CARD-SYNC] Error syncing exam score to report card:', error);
      return { success: false, message: error.message || 'Failed to sync score to report card' };
    }
  }

  // Get report cards accessible by a specific teacher (only subjects where they created exams)
  // This allows teachers to see and edit only the subjects where they created the test or main exam

  async getTeacherAccessibleReportCards(teacherId: string, termId?: number, classId?: number): Promise<any[]> {
    try {
      // Build conditions for filtering
      const conditions: any[] = [
        or(
          eq(schema.reportCardItems.testExamCreatedBy, teacherId),
          eq(schema.reportCardItems.examExamCreatedBy, teacherId)
        )
      ];

      if (termId) {
        conditions.push(eq(schema.reportCards.termId, termId));
      }
      if (classId) {
        conditions.push(eq(schema.reportCards.classId, classId));
      }

      // Get all report card items where teacher created the test or main exam
      const items = await db.select({
        itemId: schema.reportCardItems.id,
        reportCardId: schema.reportCardItems.reportCardId,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        totalMarks: schema.reportCardItems.totalMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        remarks: schema.reportCardItems.remarks,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        testExamCreatedBy: schema.reportCardItems.testExamCreatedBy,
        examExamCreatedBy: schema.reportCardItems.examExamCreatedBy,
        overriddenBy: schema.reportCardItems.overriddenBy,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        status: schema.reportCards.status,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        admissionNumber: schema.students.admissionNumber,
        className: schema.classes.name,
        termName: schema.academicTerms.name,
        canEditTest: sql<boolean>`CASE WHEN ${schema.reportCardItems.testExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as('canEditTest'),
        canEditExam: sql<boolean>`CASE WHEN ${schema.reportCardItems.examExamCreatedBy} = ${teacherId} THEN true ELSE false END`.as('canEditExam')
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .innerJoin(schema.academicTerms, eq(schema.reportCards.termId, schema.academicTerms.id))
        .where(and(...conditions))
        .orderBy(desc(schema.reportCards.id), schema.subjects.name);

      // Group items by report card for easier frontend consumption
      const reportCardMap = new Map<number, any>();

      for (const item of items) {
        if (!reportCardMap.has(item.reportCardId)) {
          reportCardMap.set(item.reportCardId, {
            reportCardId: item.reportCardId,
            studentId: item.studentId,
            studentName: item.studentName,
            admissionNumber: item.admissionNumber,
            classId: item.classId,
            className: item.className,
            termId: item.termId,
            termName: item.termName,
            status: item.status,
            items: []
          });
        }

        reportCardMap.get(item.reportCardId)!.items.push({
          itemId: item.itemId,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          testScore: item.testScore,
          testMaxScore: item.testMaxScore,
          examScore: item.examScore,
          examMaxScore: item.examMaxScore,
          testWeightedScore: item.testWeightedScore,
          examWeightedScore: item.examWeightedScore,
          obtainedMarks: item.obtainedMarks,
          totalMarks: item.totalMarks,
          percentage: item.percentage,
          grade: item.grade,
          remarks: item.remarks,
          teacherRemarks: item.teacherRemarks,
          canEditTest: item.canEditTest,
          canEditExam: item.canEditExam
        });
      }

      return Array.from(reportCardMap.values());
    } catch (error) {
      console.error('Error getting teacher accessible report cards:', error);
      return [];
    }
  }

  // Analytics and Reports
}
