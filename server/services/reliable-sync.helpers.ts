/** Reliable sync helpers — report card item init, missing subjects, recalc
 *  (TX + non-TX variants) + createFailedResult. Extracted from reliable-sync-service.ts. */
import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq, and, or, inArray, isNull, lte, desc, sql } from 'drizzle-orm';
import { calculateGradeFromConfig } from '../grading-config';
import { calculateWeightedScore } from '../../shared/grading-utils';
import { getActiveGradingConfig } from '../grade-scale-service';
import type { SyncResult } from './reliable-sync.types';

export async function initializeReportCardItemsTx(
    tx: any,
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const studentClass = await tx.select()
      .from(schema.classes)
      .where(eq(schema.classes.id, classId))
      .limit(1);

    const isSeniorSecondary = studentClass.length > 0 &&
      (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await tx.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let relevantSubjects: any[] = [];

    if (studentSubjectAssignments.length > 0) {
      const studentSubjectIds = studentSubjectAssignments.map((a: any) => a.subjectId);
      relevantSubjects = await tx.select()
        .from(schema.subjects)
        .where(and(
          inArray(schema.subjects.id, studentSubjectIds),
          eq(schema.subjects.isActive, true)
        ));
    } else {
      relevantSubjects = await getSubjectsByClassAndDepartmentTx(tx, classId, studentDepartment);
    }

    console.log(`[RELIABLE-SYNC-TX] Initializing ${relevantSubjects.length} subject items for report card ${reportCardId}`);

    for (const subject of relevantSubjects) {
      await tx.insert(schema.reportCardItems)
        .values({
          reportCardId,
          subjectId: subject.id,
          totalMarks: 100,
          obtainedMarks: 0,
          percentage: 0
        })
        .onConflictDoNothing();
    }
  }

  // Transaction-aware version of ensureMissingSubjectsAdded
export async function ensureMissingSubjectsAddedTx(
    tx: any,
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const existingItems = await tx.select({ subjectId: schema.reportCardItems.subjectId })
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    const existingSubjectIds = new Set(existingItems.map((item: any) => item.subjectId));

    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await tx.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let assignedSubjectIds: number[] = [];

    if (studentSubjectAssignments.length > 0) {
      assignedSubjectIds = studentSubjectAssignments.map((a: any) => a.subjectId);
    } else {
      const relevantSubjects = await getSubjectsByClassAndDepartmentTx(tx, classId, studentDepartment);
      assignedSubjectIds = relevantSubjects.map((s: any) => s.id);
    }

    const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));

    if (missingSubjectIds.length > 0) {
      console.log(`[RELIABLE-SYNC-TX] Adding ${missingSubjectIds.length} missing subjects to report card ${reportCardId}`);

      for (const subjectId of missingSubjectIds) {
        await tx.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .onConflictDoNothing();
      }
    }
  }

  // Transaction-aware version of getSubjectsByClassAndDepartment
export async function getSubjectsByClassAndDepartmentTx(tx: any, classId: number, department?: string): Promise<any[]> {
    const mappings = await tx.select({
      subjectId: schema.classSubjectMappings.subjectId
    })
      .from(schema.classSubjectMappings)
      .where(
        department
          ? and(
              eq(schema.classSubjectMappings.classId, classId),
              or(
                eq(schema.classSubjectMappings.department, department),
                isNull(schema.classSubjectMappings.department)
              )
            )
          : eq(schema.classSubjectMappings.classId, classId)
      );

    if (mappings.length === 0) {
      return [];
    }

    const subjectIds = mappings.map((m: any) => m.subjectId);
    const subjects = await tx.select()
      .from(schema.subjects)
      .where(and(
        inArray(schema.subjects.id, subjectIds),
        eq(schema.subjects.isActive, true)
      ));

    return subjects;
  }

  // Transaction-aware version of recalculateReportCard
export async function recalculateReportCardTx(tx: any, reportCardId: number, gradingScale: string): Promise<void> {
    const items = await tx.select()
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    if (items.length === 0) return;

    // Filter by raw score nullability — correctly includes students who scored 0.
    const itemsWithScores = items.filter((item: any) =>
      item.testScore !== null || item.examScore !== null
    );

    if (itemsWithScores.length === 0) return;

    const totalObtained = itemsWithScores.reduce((sum: number, item: any) => sum + (item.obtainedMarks || 0), 0);
    const averageScore = Math.round(totalObtained / itemsWithScores.length);
    // averagePercentage = average of per-item percentages (equivalent since percentage=obtainedMarks when fullWeight=100)
    const averagePercentage = Math.round(
      itemsWithScores.reduce((sum: number, item: any) => sum + (item.percentage || 0), 0) / itemsWithScores.length
    );

    const activeConfig = await getActiveGradingConfig();
    const gradeInfo = calculateGradeFromConfig(averagePercentage, activeConfig);

    // Use the actual reportCards column names: totalScore, averageScore, averagePercentage, overallGrade
    await tx.update(schema.reportCards)
      .set({
        totalScore: totalObtained,
        averageScore,
        averagePercentage,
        overallGrade: gradeInfo.grade,
        updatedAt: new Date()
      })
      .where(eq(schema.reportCards.id, reportCardId));
  }

export async function initializeReportCardItems(
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const studentClass = await db.select()
      .from(schema.classes)
      .where(eq(schema.classes.id, classId))
      .limit(1);

    const isSeniorSecondary = studentClass.length > 0 &&
      (studentClass[0].level || '').trim().toLowerCase() === 'senior secondary';
    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let relevantSubjects: any[] = [];

    if (studentSubjectAssignments.length > 0) {
      const studentSubjectIds = studentSubjectAssignments.map((a) => a.subjectId);
      relevantSubjects = await db.select()
        .from(schema.subjects)
        .where(and(
          inArray(schema.subjects.id, studentSubjectIds),
          eq(schema.subjects.isActive, true)
        ));
    } else {
      relevantSubjects = await getSubjectsByClassAndDepartment(classId, studentDepartment);
    }

    console.log(`[RELIABLE-SYNC] Initializing ${relevantSubjects.length} subject items for report card ${reportCardId}`);

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
  }

export async function ensureMissingSubjectsAdded(
    reportCardId: number,
    studentId: string,
    classId: number,
    studentData: any
  ): Promise<void> {
    const existingItems = await db.select({ subjectId: schema.reportCardItems.subjectId })
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    const existingSubjectIds = new Set(existingItems.map((item) => item.subjectId));

    const rawDepartment = (studentData.department || '').trim().toLowerCase();
    const studentDepartment = rawDepartment.length > 0 ? rawDepartment : undefined;

    const studentSubjectAssignments = await db.select({ subjectId: schema.studentSubjectAssignments.subjectId })
      .from(schema.studentSubjectAssignments)
      .where(and(
        eq(schema.studentSubjectAssignments.studentId, studentId),
        eq(schema.studentSubjectAssignments.classId, classId),
        eq(schema.studentSubjectAssignments.isActive, true)
      ));

    let assignedSubjectIds: number[] = [];

    if (studentSubjectAssignments.length > 0) {
      assignedSubjectIds = studentSubjectAssignments.map((a) => a.subjectId);
    } else {
      const relevantSubjects = await getSubjectsByClassAndDepartment(classId, studentDepartment);
      assignedSubjectIds = relevantSubjects.map(s => s.id);
    }

    const missingSubjectIds = assignedSubjectIds.filter(id => !existingSubjectIds.has(id));

    if (missingSubjectIds.length > 0) {
      console.log(`[RELIABLE-SYNC] Adding ${missingSubjectIds.length} missing subjects to report card ${reportCardId}`);

      for (const subjectId of missingSubjectIds) {
        await db.insert(schema.reportCardItems)
          .values({
            reportCardId,
            subjectId,
            totalMarks: 100,
            obtainedMarks: 0,
            percentage: 0
          })
          .onConflictDoNothing();
      }
    }
  }

export async function getSubjectsByClassAndDepartment(classId: number, department?: string): Promise<any[]> {
    const mappings = await db.select({
      subjectId: schema.classSubjectMappings.subjectId
    })
      .from(schema.classSubjectMappings)
      .where(
        department
          ? and(
              eq(schema.classSubjectMappings.classId, classId),
              or(
                eq(schema.classSubjectMappings.department, department),
                isNull(schema.classSubjectMappings.department)
              )
            )
          : eq(schema.classSubjectMappings.classId, classId)
      );

    if (mappings.length === 0) {
      return [];
    }

    const subjectIds = mappings.map(m => m.subjectId);
    const subjects = await db.select()
      .from(schema.subjects)
      .where(and(
        inArray(schema.subjects.id, subjectIds),
        eq(schema.subjects.isActive, true)
      ));

    return subjects;
  }

export async function recalculateReportCard(reportCardId: number, gradingScale: string): Promise<void> {
    const items = await db.select()
      .from(schema.reportCardItems)
      .where(eq(schema.reportCardItems.reportCardId, reportCardId));

    if (items.length === 0) return;

    // Filter by raw score nullability — correctly includes students who scored 0.
    const itemsWithScores = items.filter(item =>
      item.testScore !== null || item.examScore !== null
    );

    if (itemsWithScores.length === 0) return;

    const totalObtained = itemsWithScores.reduce((sum, item) => sum + (item.obtainedMarks || 0), 0);
    // Average the per-item percentages directly (reliable when fullWeight may vary per item).
    const averagePercentage = Math.round(
      itemsWithScores.reduce((sum, item) => sum + (item.percentage || 0), 0) / itemsWithScores.length
    );

    const activeConfig = await getActiveGradingConfig();
    const gradeInfo = calculateGradeFromConfig(averagePercentage, activeConfig);

    await db.update(schema.reportCards)
      .set({
        totalScore: totalObtained,
        averageScore: Math.round(totalObtained / itemsWithScores.length),
        averagePercentage,
        overallGrade: gradeInfo.grade,
        updatedAt: new Date()
      })
      .where(eq(schema.reportCards.id, reportCardId));
  }

export async function recalculateClassPositions(classId: number, termId: number): Promise<void> {
    try {
      const reportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        averagePercentage: schema.reportCards.averagePercentage
      })
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ))
        .orderBy(desc(schema.reportCards.averagePercentage));

      if (reportCards.length === 0) return;

      const positionMap = new Map<number, number>();
      let currentPosition = 1;
      let previousPercentage: number | null = null;
      let samePositionCount = 0;

      for (const card of reportCards) {
        const percentage = card.averagePercentage ?? 0;

        if (previousPercentage !== null && percentage === previousPercentage) {
          samePositionCount++;
        } else {
          currentPosition += samePositionCount;
          samePositionCount = 1;
        }

        positionMap.set(card.id, currentPosition);
        previousPercentage = percentage;
      }

      const totalStudentsInClass = reportCards.length;

      for (const card of reportCards) {
        const position = positionMap.get(card.id) || 0;
        await db.update(schema.reportCards)
          .set({
            position,
            totalStudentsInClass,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCards.id, card.id));
      }
    } catch (error) {
      console.error(`[RELIABLE-SYNC] Error calculating positions:`, error);
    }
  }


export function createFailedResult(message: string, errorCode: string): SyncResult {
    return { success: false, message, errorCode };
  }

