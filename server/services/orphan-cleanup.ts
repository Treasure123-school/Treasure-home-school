/** Orphan record cleanup — extracted from smart-deletion-manager.ts. */
import { and, sql as dsql } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";

export async function cleanupOrphanRecords(): Promise<{ tableName: string; deletedCount: number }[]> {
  const results: { tableName: string; deletedCount: number }[] = [];
  console.log('[OrphanCleanup] Starting database orphan cleanup...');

  try {
    const orphanSessions = await db.delete(schema.examSessions)
      .where(dsql`${schema.examSessions.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanSessions.length > 0) {
      results.push({ tableName: 'exam_sessions', deletedCount: orphanSessions.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] exam_sessions:', (e as Error).message);
  }

  try {
    const orphanResults = await db.delete(schema.examResults)
      .where(dsql`${schema.examResults.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanResults.length > 0) {
      results.push({ tableName: 'exam_results', deletedCount: orphanResults.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] exam_results:', (e as Error).message);
  }

  try {
    const orphanAttendance = await db.delete(schema.attendance)
      .where(dsql`${schema.attendance.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanAttendance.length > 0) {
      results.push({ tableName: 'attendance', deletedCount: orphanAttendance.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] attendance:', (e as Error).message);
  }

  try {
    const orphanCA = await db.delete(schema.continuousAssessment)
      .where(dsql`${schema.continuousAssessment.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanCA.length > 0) {
      results.push({ tableName: 'continuous_assessment', deletedCount: orphanCA.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] continuous_assessment:', (e as Error).message);
  }

  try {
    const orphanReportCards = await db.delete(schema.reportCards)
      .where(dsql`${schema.reportCards.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanReportCards.length > 0) {
      results.push({ tableName: 'report_cards', deletedCount: orphanReportCards.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] report_cards:', (e as Error).message);
  }

  try {
    const orphanSubjectAssignments = await db.delete(schema.studentSubjectAssignments)
      .where(dsql`${schema.studentSubjectAssignments.studentId} NOT IN (SELECT id FROM students)`)
      .returning();
    if (orphanSubjectAssignments.length > 0) {
      results.push({ tableName: 'student_subject_assignments', deletedCount: orphanSubjectAssignments.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] student_subject_assignments:', (e as Error).message);
  }

  try {
    const expiredTokens = await db.delete(schema.passwordResetTokens)
      .where(dsql`${schema.passwordResetTokens.expiresAt} < NOW()`)
      .returning();
    if (expiredTokens.length > 0) {
      results.push({ tableName: 'password_reset_tokens', deletedCount: expiredTokens.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] password_reset_tokens:', (e as Error).message);
  }

  try {
    const expiredInvites = await db.delete(schema.invites)
      .where(and(
        dsql`${schema.invites.expiresAt} < NOW()`,
        dsql`${schema.invites.acceptedAt} IS NULL`
      ))
      .returning();
    if (expiredInvites.length > 0) {
      results.push({ tableName: 'invites', deletedCount: expiredInvites.length });
    }
  } catch (e) {
    console.log('[OrphanCleanup] invites:', (e as Error).message);
  }

  console.log('[OrphanCleanup] Cleanup complete:', results);
  return results;
}
