/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { SmartDeletionManager } from '../services/smart-deletion-manager';
import { Class, ClassSubjectMapping, InsertClassSubjectMapping, InsertSchoolEvent, InsertStudentSubjectAssignment, Role, SchoolEvent, Student, StudentSubjectAssignment, Subject, User } from '@shared/schema.pg';
import { and, asc, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import { DatabaseStorageP12 } from './part12-getGradingTasksBySession'
import type { IStorage } from './types'

export class DatabaseStorageP13 extends DatabaseStorageP12 {
  async updateSchoolEvent(id: number, data: Partial<InsertSchoolEvent>): Promise<SchoolEvent | undefined> {
    const result = await this.db.update(schema.schoolEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.schoolEvents.id, id))
      .returning();
    return result[0];
  }


  async deleteSchoolEvent(id: number): Promise<boolean> {
    const result = await this.db.delete(schema.schoolEvents).where(eq(schema.schoolEvents.id, id)).returning();
    return result.length > 0;
  }

  // User recovery management implementations

  async getDeletedUsers(roleFilter?: number[]): Promise<User[]> {
    // Get users that have been soft-deleted (deletedAt is set)
    if (roleFilter && roleFilter.length > 0) {
      return await this.db.select()
        .from(schema.users)
        .where(and(
          sql`${schema.users.deletedAt} IS NOT NULL`,
          inArray(schema.users.roleId, roleFilter)
        ))
        .orderBy(desc(schema.users.deletedAt));
    }
    return await this.db.select()
      .from(schema.users)
      .where(sql`${schema.users.deletedAt} IS NOT NULL`)
      .orderBy(desc(schema.users.deletedAt));
  }


  async restoreUser(userId: string, restoredBy: string): Promise<User | undefined> {
    // Restore a soft-deleted user by clearing deletedAt and setting isActive to true
    const result = await this.db.update(schema.users)
      .set({
        isActive: true,
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }


  async softDeleteUser(userId: string, deletedBy: string): Promise<boolean> {
    // Soft delete a user by setting deletedAt and isActive to false
    const result = await this.db.update(schema.users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: deletedBy
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }


  async permanentlyDeleteUser(userId: string): Promise<boolean> {
    // Permanently delete user and all associated data
    try {
      const user = await this.getUser(userId);
      if (!user) return false;

      // Use hard delete based on role
      const roleId = user.roleId;

      // Role 4 = Student
      if (roleId === 4) {
        return await this.hardDeleteStudent(userId);
      }

      // For other roles, use the smart deletion manager
      const deletionManager = new SmartDeletionManager();
      const result = await deletionManager.deleteUser(userId);
      return result.success;
    } catch (error) {
      console.error('Error permanently deleting user:', error);
      return false;
    }
  }


  async getExpiredDeletedUsers(retentionDays: number): Promise<User[]> {
    // Get users whose deletion date has exceeded the retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return await this.db.select()
      .from(schema.users)
      .where(and(
        sql`${schema.users.deletedAt} IS NOT NULL`,
        lte(schema.users.deletedAt, cutoffDate)
      ))
      .orderBy(asc(schema.users.deletedAt));
  }


  async permanentlyDeleteExpiredUsers(retentionDays: number): Promise<{ deleted: number; errors: string[] }> {
    const expiredUsers = await this.getExpiredDeletedUsers(retentionDays);
    let deleted = 0;
    const errors: string[] = [];

    for (const user of expiredUsers) {
      try {
        const success = await this.permanentlyDeleteUser(user.id);
        if (success) {
          deleted++;
          console.log(`Permanently deleted expired user: ${user.username || user.email} (ID: ${user.id})`);
        } else {
          errors.push(`Failed to delete user ${user.id}`);
        }
      } catch (error: any) {
        errors.push(`Error deleting user ${user.id}: ${error.message}`);
      }
    }

    return { deleted, errors };
  }

  // Student subject assignment implementations

  async createStudentSubjectAssignment(assignment: InsertStudentSubjectAssignment): Promise<StudentSubjectAssignment> {
    const result = await this.db
      .insert(schema.studentSubjectAssignments)
      .values(assignment)
      .returning();
    return result[0];
  }


  async getStudentSubjectAssignments(studentId: string): Promise<StudentSubjectAssignment[]> {
    return await this.db
      .select()
      .from(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.studentId, studentId));
  }


  async getStudentSubjectAssignmentsByClass(classId: number): Promise<StudentSubjectAssignment[]> {
    return await this.db
      .select()
      .from(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.classId, classId));
  }


  async deleteStudentSubjectAssignment(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.id, id))
      .returning();
    return result.length > 0;
  }


  async deleteStudentSubjectAssignmentsByStudent(studentId: string): Promise<boolean> {
    await this.db
      .delete(schema.studentSubjectAssignments)
      .where(eq(schema.studentSubjectAssignments.studentId, studentId));
    return true;
  }


  async assignSubjectsToStudent(
    studentId: string,
    classId: number,
    subjectIds: number[],
    termId?: number,
    assignedBy?: string
  ): Promise<StudentSubjectAssignment[]> {
    const assignments: StudentSubjectAssignment[] = [];

    for (const subjectId of subjectIds) {
      try {
        const result = await this.db
          .insert(schema.studentSubjectAssignments)
          .values({
            studentId,
            classId,
            subjectId,
            termId: termId || null,
            assignedBy: assignedBy || null,
            isActive: true,
          })
          .onConflictDoNothing()
          .returning();
        if (result[0]) {
          assignments.push(result[0]);
        }
      } catch (e) {
        // Skip duplicates
      }
    }

    return assignments;
  }

  // Class subject mapping implementations

  async createClassSubjectMapping(mapping: InsertClassSubjectMapping): Promise<ClassSubjectMapping> {
    // Use onConflictDoNothing to handle duplicate mappings gracefully
    const result = await this.db
      .insert(schema.classSubjectMappings)
      .values(mapping)
      .onConflictDoNothing()
      .returning();

    // If conflict occurred (no result), fetch the existing mapping
    if (!result[0]) {
      const existing = await this.db
        .select()
        .from(schema.classSubjectMappings)
        .where(
          and(
            eq(schema.classSubjectMappings.classId, mapping.classId),
            eq(schema.classSubjectMappings.subjectId, mapping.subjectId)
          )
        )
        .limit(1);
      return existing[0];
    }
    return result[0];
  }


  async getClassSubjectMappingById(id: number): Promise<ClassSubjectMapping | undefined> {
    const result = await this.db
      .select()
      .from(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.id, id))
      .limit(1);
    return result[0];
  }


  async getAllClassSubjectMappings(): Promise<ClassSubjectMapping[]> {
    return await this.db
      .select()
      .from(schema.classSubjectMappings);
  }


  async deleteClassSubjectMapping(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.id, id))
      .returning();
    return result.length > 0;
  }


  async deleteClassSubjectMappingsByClass(classId: number): Promise<boolean> {
    await this.db
      .delete(schema.classSubjectMappings)
      .where(eq(schema.classSubjectMappings.classId, classId));
    return true;
  }


  async bulkUpdateClassSubjectMappings(
    additions: Array<{ classId: number; subjectId: number; department: string | null; isCompulsory?: boolean }>,
    removals: Array<{ classId: number; subjectId: number; department: string | null }>
  ): Promise<{ added: number; removed: number; affectedClassIds: number[] }> {
    // Use transaction for atomic updates - all changes commit or rollback together
    return await this.db.transaction(async (tx: any) => {
      const affectedClassIds = new Set<number>();
      let addedCount = 0;
      let removedCount = 0;

      // Process removals first (within transaction)
      for (const removal of removals) {
        const { classId, subjectId, department } = removal;
        if (!classId || !subjectId) continue;

        affectedClassIds.add(classId);

        // Delete matching mapping
        if (department === null) {
          const result = await tx
            .delete(schema.classSubjectMappings)
            .where(
              and(
                eq(schema.classSubjectMappings.classId, classId),
                eq(schema.classSubjectMappings.subjectId, subjectId),
                sql`${schema.classSubjectMappings.department} IS NULL`
              )
            )
            .returning();
          removedCount += result.length;
        } else {
          const result = await tx
            .delete(schema.classSubjectMappings)
            .where(
              and(
                eq(schema.classSubjectMappings.classId, classId),
                eq(schema.classSubjectMappings.subjectId, subjectId),
                eq(schema.classSubjectMappings.department, department)
              )
            )
            .returning();
          removedCount += result.length;
        }
      }

      // Process additions (within transaction)
      for (const addition of additions) {
        const { classId, subjectId, department, isCompulsory } = addition;
        if (!classId || !subjectId) continue;

        affectedClassIds.add(classId);

        // Use upsert to handle potential conflicts
        const result = await tx
          .insert(schema.classSubjectMappings)
          .values({
            classId,
            subjectId,
            department: department || null,
            isCompulsory: isCompulsory || false
          })
          .onConflictDoNothing()
          .returning();

        if (result.length > 0) {
          addedCount++;
        }
      }

      return {
        added: addedCount,
        removed: removedCount,
        affectedClassIds: Array.from(affectedClassIds)
      };
    });
  }

  // Department-based subject logic implementations

  async getSubjectsByCategory(category: string): Promise<Subject[]> {
    return await this.db
      .select()
      .from(schema.subjects)
      .where(
        and(
          eq(schema.subjects.category, category),
          eq(schema.subjects.isActive, true)
        )
      );
  }


  async getSubjectsForClassLevel(classLevel: string, department?: string): Promise<Subject[]> {
    // SINGLE SOURCE OF TRUTH: Use class_subject_mappings table only
    // No fallback to category-based logic - admin must assign subjects
    // Find a class with this level and get its mapped subjects
    const classesAtLevel = await this.db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.level, classLevel))
      .limit(1);

    if (classesAtLevel.length > 0) {
      const classId = classesAtLevel[0].id;
      // Use class_subject_mappings through getSubjectsByClassAndDepartment
      const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, department);

      if (mappedSubjects.length > 0) {
        return mappedSubjects;
      }
    }

    // No fallback - return empty array if no mappings exist
    // Admin must configure subjects via Subject Manager > Class-Level & Department Assignment
    console.log(`[SUBJECT-ASSIGNMENT] No class_subject_mappings found for level ${classLevel}, department: ${department || 'none'}. Admin must assign subjects.`);
    return [];
  }


  async autoAssignSubjectsToStudent(
    studentId: string,
    classId: number,
    department?: string
  ): Promise<StudentSubjectAssignment[]> {
    // Get the class to determine level
    const classInfo = await this.getClass(classId);
    if (!classInfo) {
      throw new Error('Class not found');
    }

    // Get current term
    const currentTerm = await this.getCurrentTerm();
    const termId = currentTerm?.id;

    // Get subjects based on class level and department
    // SINGLE SOURCE OF TRUTH: Only use class_subject_mappings - no fallback
    const subjects = await this.getSubjectsForClassLevel(classInfo.level, department);

    if (subjects.length === 0) {
      // No fallback - admin must configure subjects via Subject Manager
      console.log(`[AUTO-ASSIGN] No subjects found for class ${classId}, department: ${department || 'none'}. Admin must assign subjects.`);
      return [];
    }

    const subjectIds = subjects.map(s => s.id);
    return await this.assignSubjectsToStudent(studentId, classId, subjectIds, termId);
  }


  async syncStudentsWithClassMappings(classId: number, department?: string): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      const classInfo = await this.getClass(classId);
      if (!classInfo) {
        return { synced: 0, errors: ['Class not found'] };
      }

      const isSeniorSecondary = classInfo.level &&
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level =>
          classInfo.level?.toLowerCase().includes(level.toLowerCase())
        );

      const students = await this.getStudentsByClass(classId);

      for (const student of students) {
        try {
          const studentDept = (student as any).department?.toLowerCase()?.trim() || undefined;

          if (department && studentDept !== department.toLowerCase().trim()) {
            continue;
          }

          const effectiveDept = isSeniorSecondary ? studentDept : undefined;
          const mappedSubjects = await this.getSubjectsByClassAndDepartment(classId, effectiveDept);

          if (mappedSubjects.length === 0) {
            errors.push(`No subjects mapped for student ${student.id} (class ${classId}, dept: ${effectiveDept || 'none'})`);
            continue;
          }

          await db.delete(schema.studentSubjectAssignments)
            .where(eq(schema.studentSubjectAssignments.studentId, student.id));

          const currentTerm = await this.getCurrentTerm();
          for (const subject of mappedSubjects) {
            await db.insert(schema.studentSubjectAssignments)
              .values({
                studentId: student.id,
                classId: classId,
                subjectId: subject.id,
                termId: currentTerm?.id || null,
                isActive: true
              })
              .onConflictDoNothing();
          }

          synced++;
        } catch (studentError: any) {
          errors.push(`Failed to sync student ${student.id}: ${studentError.message}`);
        }
      }

      console.log(`[SYNC] Synced ${synced} students in class ${classId}${department ? ` (${department})` : ''}`);
      return { synced, errors };
    } catch (error: any) {
      console.error('[SYNC] Error syncing students with class mappings:', error);
      return { synced: 0, errors: [error.message] };
    }
  }


  async syncAllStudentsWithMappings(): Promise<{ synced: number; errors: string[] }> {
    let totalSynced = 0;
    const allErrors: string[] = [];

    try {
      const classes = await this.getClasses();

      for (const classInfo of classes) {
        const result = await this.syncStudentsWithClassMappings(classInfo.id);
        totalSynced += result.synced;
        allErrors.push(...result.errors);
      }

      console.log(`[SYNC] Total synced: ${totalSynced} students across ${classes.length} classes`);
      return { synced: totalSynced, errors: allErrors };
    } catch (error: any) {
      console.error('[SYNC] Error syncing all students:', error);
      return { synced: 0, errors: [error.message] };
    }
  }


  async cleanupReportCardItems(studentId: string): Promise<{ removed: number; kept: number }> {
    try {
      const student = await this.getStudent(studentId);
      if (!student || !student.classId) {
        return { removed: 0, kept: 0 };
      }

      const classInfo = await this.getClass(student.classId);
      if (!classInfo) {
        return { removed: 0, kept: 0 };
      }

      const isSeniorSecondary = classInfo.level &&
        ['SS1', 'SS2', 'SS3', 'Senior Secondary'].some(level =>
          classInfo.level?.toLowerCase().includes(level.toLowerCase()) ||
          classInfo.name?.toLowerCase().includes(level.toLowerCase())
        );

      const studentDept = (student as any).department?.toLowerCase()?.trim() || undefined;
      const effectiveDept = isSeniorSecondary ? studentDept : undefined;

      const allowedSubjects = await this.getSubjectsByClassAndDepartment(student.classId, effectiveDept);
      const allowedSubjectIds = new Set(allowedSubjects.map(s => s.id));

      const reportCards = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.studentId, studentId));

      let totalRemoved = 0;
      let totalKept = 0;

      for (const reportCard of reportCards) {
        const items = await db.select()
          .from(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCard.id));

        for (const item of items) {
          if (!allowedSubjectIds.has(item.subjectId)) {
            // Subject is no longer mapped to this class/department in the subject setup page.
            // The subject setup page is the single source of truth — remove the report card
            // item unconditionally, even if it has scores recorded.
            console.log(`[CLEANUP] Student ${studentId}: removing item ${item.id} (subject ${item.subjectId}) — subject deselected in setup page (test: ${item.testScore}, exam: ${item.examScore})`);
            await db.delete(schema.reportCardItems)
              .where(eq(schema.reportCardItems.id, item.id));
            totalRemoved++;
          } else {
            totalKept++;
          }
        }
      }

      console.log(`[CLEANUP] Student ${studentId}: removed ${totalRemoved} empty items, kept ${totalKept}`);
      return { removed: totalRemoved, kept: totalKept };
    } catch (error: any) {
      console.error(`[CLEANUP] Error cleaning up report card for student ${studentId}:`, error);
      return { removed: 0, kept: 0 };
    }
  }


  async cleanupReportCardsForClasses(classIds: number[]): Promise<{ studentsProcessed: number; itemsRemoved: number; errors: string[] }> {
    let studentsProcessed = 0;
    let totalItemsRemoved = 0;
    const errors: string[] = [];

    if (!classIds || classIds.length === 0) {
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [] };
    }

    try {
      // Get only students in the affected classes
      const students = await db.select({ id: schema.students.id })
        .from(schema.students)
        .where(inArray(schema.students.classId, classIds));

      console.log(`[CLEANUP] Processing ${students.length} students from ${classIds.length} affected classes`);

      for (const student of students) {
        try {
          const result = await this.cleanupReportCardItems(student.id);
          totalItemsRemoved += result.removed;
          studentsProcessed++;
        } catch (error: any) {
          errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
        }
      }

      console.log(`[CLEANUP] Processed ${studentsProcessed} students in affected classes, removed ${totalItemsRemoved} report card items`);
      return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
    } catch (error: any) {
      console.error('[CLEANUP] Error cleaning up report cards for classes:', error);
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
    }
  }


  async cleanupAllReportCards(): Promise<{ studentsProcessed: number; itemsRemoved: number; errors: string[] }> {
    let studentsProcessed = 0;
    let totalItemsRemoved = 0;
    const errors: string[] = [];

    try {
      const students = await db.select({ id: schema.students.id })
        .from(schema.students);

      for (const student of students) {
        try {
          const result = await this.cleanupReportCardItems(student.id);
          totalItemsRemoved += result.removed;
          studentsProcessed++;
        } catch (error: any) {
          errors.push(`Failed to cleanup student ${student.id}: ${error.message}`);
        }
      }

      console.log(`[CLEANUP] Processed ${studentsProcessed} students, removed ${totalItemsRemoved} report card items`);
      return { studentsProcessed, itemsRemoved: totalItemsRemoved, errors };
    } catch (error: any) {
      console.error('[CLEANUP] Error cleaning up all report cards:', error);
      return { studentsProcessed: 0, itemsRemoved: 0, errors: [error.message] };
    }
  }

  /**
   * FIX: Add missing subjects to existing report cards when new mappings are added
   * This ensures report cards are updated when admin adds new subjects to class/department mappings
   */
  /**
   * Batched rewrite — replaces the original N+1 loop.
   * Previous approach: ~(5 × students × reportCards × missingSubjects) round-trips.
   * New approach: ~8 bulk queries + O(changedItems) score updates.
   */
}
