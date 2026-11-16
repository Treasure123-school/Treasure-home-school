/** SmartDeletionManager — orchestrates safe user deletion with validation,
 *  per-role data cleanup (UserRoleDataDeleter/UserDataDeleter), file cleanup,
 *  audit logging. Split out: deletion.types.ts, user-role-deleter.ts,
 *  user-common-deleter.ts, exam-cleanup.ts, orphan-cleanup.ts. */
import { eq, and, or } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";
import { DeletionService, formatDeletionLog, DeletionResult } from "./deletion-service";
import { DeletionValidation, SmartDeletionResult, UserRole, getRoleFromId } from "./deletion.types";
import { UserDataDeleter } from "./user-common-deleter";

export class SmartDeletionManager {
  private deletionService: DeletionService;
  private userDataDeleter: UserDataDeleter;

  constructor() {
    this.deletionService = new DeletionService();
    this.userDataDeleter = new UserDataDeleter(this.deletionService);
  }

  async validateDeletion(userId: string): Promise<DeletionValidation> {
    try {
      const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      
      if (!user[0]) {
        return { canDelete: false, reason: 'User not found' };
      }

      const blockedBy: { type: string; description: string; count?: number }[] = [];
      const affectedRecords: { tableName: string; count: number }[] = [];
      const filesToDelete: string[] = [];

      if (user[0].profileImageUrl) {
        filesToDelete.push(user[0].profileImageUrl);
      }

      const roleId = user[0].roleId;
      const role = getRoleFromId(roleId);

      if (role === 'Student') {
        const activeExamSessions = await db.select({ id: schema.examSessions.id })
          .from(schema.examSessions)
          .innerJoin(schema.exams, eq(schema.examSessions.examId, schema.exams.id))
          .where(and(
            eq(schema.examSessions.studentId, userId),
            eq(schema.examSessions.status, 'in_progress')
          ));
        
        if (activeExamSessions.length > 0) {
          blockedBy.push({
            type: 'active_exam_session',
            description: 'Student has active exam sessions in progress',
            count: activeExamSessions.length
          });
        }

        const draftReportCards = await db.select({ id: schema.reportCards.id })
          .from(schema.reportCards)
          .where(and(
            eq(schema.reportCards.studentId, userId),
            eq(schema.reportCards.status, 'draft')
          ));

        if (draftReportCards.length > 0) {
          affectedRecords.push({ tableName: 'draft_report_cards', count: draftReportCards.length });
        }

        const examSessions = await db.select({ id: schema.examSessions.id })
          .from(schema.examSessions)
          .where(eq(schema.examSessions.studentId, userId));
        if (examSessions.length > 0) {
          affectedRecords.push({ tableName: 'exam_sessions', count: examSessions.length });
        }

        const examResults = await db.select({ id: schema.examResults.id })
          .from(schema.examResults)
          .where(eq(schema.examResults.studentId, userId));
        if (examResults.length > 0) {
          affectedRecords.push({ tableName: 'exam_results', count: examResults.length });
        }

        const attendance = await db.select({ id: schema.attendance.id })
          .from(schema.attendance)
          .where(eq(schema.attendance.studentId, userId));
        if (attendance.length > 0) {
          affectedRecords.push({ tableName: 'attendance', count: attendance.length });
        }

        const reportCards = await db.select({ id: schema.reportCards.id })
          .from(schema.reportCards)
          .where(eq(schema.reportCards.studentId, userId));
        if (reportCards.length > 0) {
          affectedRecords.push({ tableName: 'report_cards', count: reportCards.length });
        }

        const continuousAssessment = await db.select({ id: schema.continuousAssessment.id })
          .from(schema.continuousAssessment)
          .where(eq(schema.continuousAssessment.studentId, userId));
        if (continuousAssessment.length > 0) {
          affectedRecords.push({ tableName: 'continuous_assessment', count: continuousAssessment.length });
        }

        const studentSubjectAssignments = await db.select({ id: schema.studentSubjectAssignments.id })
          .from(schema.studentSubjectAssignments)
          .where(eq(schema.studentSubjectAssignments.studentId, userId));
        if (studentSubjectAssignments.length > 0) {
          affectedRecords.push({ tableName: 'student_subject_assignments', count: studentSubjectAssignments.length });
        }
      }

      if (role === 'Teacher') {
        const activeExams = await db.select({ id: schema.exams.id })
          .from(schema.exams)
          .where(and(
            eq(schema.exams.createdBy, userId),
            eq(schema.exams.isPublished, true)
          ));
        
        if (activeExams.length > 0) {
          blockedBy.push({
            type: 'active_exams',
            description: 'Teacher has active exams that need to be completed first',
            count: activeExams.length
          });
        }

        const teacherProfile = await db.select({ signatureUrl: schema.teacherProfiles.signatureUrl })
          .from(schema.teacherProfiles)
          .where(eq(schema.teacherProfiles.userId, userId))
          .limit(1);
        if (teacherProfile[0]?.signatureUrl) {
          filesToDelete.push(teacherProfile[0].signatureUrl);
        }

        const exams = await db.select({ id: schema.exams.id })
          .from(schema.exams)
          .where(eq(schema.exams.createdBy, userId));
        if (exams.length > 0) {
          affectedRecords.push({ tableName: 'exams', count: exams.length });
        }

        const questionBanks = await db.select({ id: schema.questionBanks.id })
          .from(schema.questionBanks)
          .where(eq(schema.questionBanks.createdBy, userId));
        if (questionBanks.length > 0) {
          affectedRecords.push({ tableName: 'question_banks', count: questionBanks.length });
        }

        const teacherClassAssignments = await db.select({ id: schema.teacherClassAssignments.id })
          .from(schema.teacherClassAssignments)
          .where(eq(schema.teacherClassAssignments.teacherId, userId));
        if (teacherClassAssignments.length > 0) {
          affectedRecords.push({ tableName: 'teacher_class_assignments', count: teacherClassAssignments.length });
        }

        const timetable = await db.select({ id: schema.timetable.id })
          .from(schema.timetable)
          .where(eq(schema.timetable.teacherId, userId));
        if (timetable.length > 0) {
          affectedRecords.push({ tableName: 'timetable', count: timetable.length });
        }
      }

      if (role === 'Parent') {
        const linkedStudents = await db.select({ id: schema.students.id })
          .from(schema.students)
          .where(eq(schema.students.parentId, userId));
        if (linkedStudents.length > 0) {
          affectedRecords.push({ tableName: 'linked_students', count: linkedStudents.length });
        }
      }

      const messages = await db.select({ id: schema.messages.id })
        .from(schema.messages)
        .where(or(
          eq(schema.messages.senderId, userId),
          eq(schema.messages.recipientId, userId)
        ));
      if (messages.length > 0) {
        affectedRecords.push({ tableName: 'messages', count: messages.length });
      }

      const notifications = await db.select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId));
      if (notifications.length > 0) {
        affectedRecords.push({ tableName: 'notifications', count: notifications.length });
      }

      const announcements = await db.select({ id: schema.announcements.id })
        .from(schema.announcements)
        .where(eq(schema.announcements.authorId, userId));
      if (announcements.length > 0) {
        affectedRecords.push({ tableName: 'announcements', count: announcements.length });
      }

      const canDelete = blockedBy.filter(b => 
        b.type === 'active_exam_session' || 
        b.type === 'active_exams'
      ).length === 0;

      return {
        canDelete,
        reason: !canDelete ? 'User has active resources that must be completed first' : undefined,
        blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
        affectedRecords,
        filesToDelete
      };
    } catch (error: any) {
      return { canDelete: false, reason: error.message };
    }
  }

  async deleteUser(userId: string, performedBy?: string): Promise<SmartDeletionResult> {
    this.deletionService.reset();
    this.userDataDeleter.resetFiles();

    try {
      const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      
      if (!user[0]) {
        return {
          success: false,
          userId,
          userRole: 'Unknown',
          deletedRecords: [],
          deletedFiles: [],
          errors: ['User not found'],
          summary: 'Deletion failed: User not found',
          duration: 0
        };
      }

      const startTime = Date.now();
      const userRole = getRoleFromId(user[0].roleId);
      const userEmail = user[0].email;
      const username = user[0].username || undefined;

      console.log(`\n[SmartDeletion] Starting comprehensive deletion for ${userRole}: ${userEmail || username}`);
      console.log(`[SmartDeletion] User ID: ${userId}`);
      console.log(`[SmartDeletion] Performed by: ${performedBy || 'system'}`);

      if (user[0].profileImageUrl) {
        this.userDataDeleter.addFileToDelete(user[0].profileImageUrl);
      }

      switch (userRole) {
        case 'Student':
          await this.userDataDeleter.deleteStudentData(userId);
          break;
        case 'Teacher':
          await this.userDataDeleter.deleteTeacherData(userId);
          break;
        case 'Parent':
          await this.userDataDeleter.deleteParentData(userId);
          break;
        case 'Admin':
          await this.userDataDeleter.deleteAdminData(userId);
          break;
        case 'Super Admin':
          await this.userDataDeleter.deleteSuperAdminData(userId);
          break;
      }

      await this.userDataDeleter.deleteCommonUserData(userId);

      const filesToDelete = this.userDataDeleter.getFilesToDelete();
      if (filesToDelete.length > 0) {
        console.log(`[SmartDeletion] Deleting ${filesToDelete.length} files from storage...`);
        await this.userDataDeleter.deleteFilesInBatch(filesToDelete);
      }

      const result = await db.delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning();
      this.deletionService.recordDeletion('users', result.length);

      const deletionResult = this.deletionService.getResult();
      const logOutput = formatDeletionLog(deletionResult, userId, userRole);
      console.log(logOutput);

      try {
        await db.insert(schema.auditLogs).values({
          userId: performedBy || userId,
          action: 'user_permanently_deleted',
          entityType: 'user',
          entityId: userId,
          oldValue: JSON.stringify({
            email: userEmail,
            username: username,
            role: userRole,
            firstName: user[0].firstName,
            lastName: user[0].lastName
          }),
          newValue: JSON.stringify(deletionResult),
          reason: `Permanent deletion of ${userRole} account: ${userEmail || username}`,
          ipAddress: 'system',
          userAgent: 'Smart Deletion Manager'
        });
      } catch (auditError) {
        console.log('[SmartDeletion] Could not create audit log for deleted user');
      }

      const duration = Date.now() - startTime;

      return {
        ...deletionResult,
        userId,
        userRole,
        userEmail,
        username,
        duration
      };
    } catch (error: any) {
      this.deletionService.recordError(`Fatal error in deleteUser: ${error.message}`);
      console.error('[SmartDeletion] Error:', error);
      return {
        success: false,
        userId,
        userRole: 'Unknown',
        deletedRecords: this.deletionService.getResult().deletedRecords,
        deletedFiles: this.deletionService.getResult().deletedFiles,
        errors: [...this.deletionService.getResult().errors, error.message],
        summary: `Deletion failed: ${error.message}`,
        duration: 0
      };
    }
  }

}

export {
  cleanupOrphanRecords,
} from './orphan-cleanup';
export type { DeletionValidation, SmartDeletionResult, UserRole } from './deletion.types';

export async function bulkDeleteUsers(userIds: string[], performedBy?: string): Promise<{
  successful: string[];
  failed: { userId: string; error: string }[];
}> {
  const successful: string[] = [];
  const failed: { userId: string; error: string }[] = [];
  
  const manager = new SmartDeletionManager();
  
  for (const userId of userIds) {
    try {
      const result = await manager.deleteUser(userId, performedBy);
      if (result.success) {
        successful.push(userId);
      } else {
        failed.push({ userId, error: result.errors.join(', ') || 'Unknown error' });
      }
    } catch (error: any) {
      failed.push({ userId, error: error.message });
    }
  }
  
  return { successful, failed };
}

export const smartDeletionManager = new SmartDeletionManager();
