import { eq, inArray, or, and, sql as dsql } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";
import { DeletionService, formatDeletionLog, DeletionResult } from "./deletion-service";
import { deleteFile, useCloudinary } from "../cloudinary-service";
import { v2 as cloudinary } from 'cloudinary';

export interface DeletionValidation {
  canDelete: boolean;
  reason?: string;
  blockedBy?: {
    type: string;
    description: string;
    count?: number;
  }[];
  affectedRecords?: {
    tableName: string;
    count: number;
  }[];
  filesToDelete?: string[];
}

export interface SmartDeletionResult extends DeletionResult {
  userId: string;
  userRole: string;
  userEmail?: string;
  username?: string;
}

type UserRole = 'Super Admin' | 'Admin' | 'Teacher' | 'Student' | 'Parent' | 'Unknown';

export class SmartDeletionManager {
  private deletionService: DeletionService;
  private filesToDelete: string[] = [];

  constructor() {
    this.deletionService = new DeletionService();
  }

  private getRoleFromId(roleId: number): UserRole {
    switch (roleId) {
      case 1: return 'Super Admin';
      case 2: return 'Admin';
      case 3: return 'Teacher';
      case 4: return 'Student';
      case 5: return 'Parent';
      default: return 'Unknown';
    }
  }

  private addFileToDelete(url: string | null | undefined) {
    if (url && typeof url === 'string' && url.trim().length > 0) {
      this.filesToDelete.push(url);
    }
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
      const role = this.getRoleFromId(roleId);

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
    this.filesToDelete = [];

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
      const userRole = this.getRoleFromId(user[0].roleId);
      const userEmail = user[0].email;
      const username = user[0].username || undefined;

      console.log(`\n[SmartDeletion] Starting comprehensive deletion for ${userRole}: ${userEmail || username}`);
      console.log(`[SmartDeletion] User ID: ${userId}`);
      console.log(`[SmartDeletion] Performed by: ${performedBy || 'system'}`);

      if (user[0].profileImageUrl) {
        this.addFileToDelete(user[0].profileImageUrl);
      }

      switch (userRole) {
        case 'Student':
          await this.deleteStudentData(userId);
          break;
        case 'Teacher':
          await this.deleteTeacherData(userId);
          break;
        case 'Parent':
          await this.deleteParentData(userId);
          break;
        case 'Admin':
          await this.deleteAdminData(userId);
          break;
        case 'Super Admin':
          await this.deleteSuperAdminData(userId);
          break;
      }

      await this.deleteCommonUserData(userId);

      if (this.filesToDelete.length > 0) {
        console.log(`[SmartDeletion] Deleting ${this.filesToDelete.length} files from storage...`);
        await this.deleteFilesInBatch(this.filesToDelete);
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

  private async deleteStudentData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting student-specific data...');

    try {
      const examSessions = await db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.studentId, userId));
      
      const sessionIds = examSessions.map(s => s.id);
      
      if (sessionIds.length > 0) {
        try {
          const gradingResult = await db.delete(schema.gradingTasks)
            .where(inArray(schema.gradingTasks.sessionId, sessionIds))
            .returning();
          this.deletionService.recordDeletion('grading_tasks', gradingResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting grading tasks: ${(e as Error).message}`);
        }

        try {
          const perfResult = await db.delete(schema.performanceEvents)
            .where(inArray(schema.performanceEvents.sessionId, sessionIds))
            .returning();
          this.deletionService.recordDeletion('performance_events', perfResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting performance events: ${(e as Error).message}`);
        }

        try {
          const answersResult = await db.delete(schema.studentAnswers)
            .where(inArray(schema.studentAnswers.sessionId, sessionIds))
            .returning();
          this.deletionService.recordDeletion('student_answers', answersResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting student answers: ${(e as Error).message}`);
        }

        try {
          const sessionsResult = await db.delete(schema.examSessions)
            .where(inArray(schema.examSessions.id, sessionIds))
            .returning();
          this.deletionService.recordDeletion('exam_sessions', sessionsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting exam sessions: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.deletionService.recordError(`Error deleting exam sessions: ${(e as Error).message}`);
    }

    try {
      const examResultsResult = await db.delete(schema.examResults)
        .where(eq(schema.examResults.studentId, userId))
        .returning();
      this.deletionService.recordDeletion('exam_results', examResultsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting exam results: ${(e as Error).message}`);
    }

    try {
      const attendanceResult = await db.delete(schema.attendance)
        .where(eq(schema.attendance.studentId, userId))
        .returning();
      this.deletionService.recordDeletion('attendance', attendanceResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting attendance: ${(e as Error).message}`);
    }

    try {
      const caResult = await db.delete(schema.continuousAssessment)
        .where(eq(schema.continuousAssessment.studentId, userId))
        .returning();
      this.deletionService.recordDeletion('continuous_assessment', caResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting continuous assessment: ${(e as Error).message}`);
    }

    try {
      const subjectAssignResult = await db.delete(schema.studentSubjectAssignments)
        .where(eq(schema.studentSubjectAssignments.studentId, userId))
        .returning();
      this.deletionService.recordDeletion('student_subject_assignments', subjectAssignResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting student subject assignments: ${(e as Error).message}`);
    }

    try {
      const reportCards = await db.select({ id: schema.reportCards.id })
        .from(schema.reportCards)
        .where(eq(schema.reportCards.studentId, userId));
      
      const reportCardIds = reportCards.map(r => r.id);
      
      if (reportCardIds.length > 0) {
        try {
          const rcItemsResult = await db.delete(schema.reportCardItems)
            .where(inArray(schema.reportCardItems.reportCardId, reportCardIds))
            .returning();
          this.deletionService.recordDeletion('report_card_items', rcItemsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting report card items: ${(e as Error).message}`);
        }

        try {
          const reportCardsResult = await db.delete(schema.reportCards)
            .where(eq(schema.reportCards.studentId, userId))
            .returning();
          this.deletionService.recordDeletion('report_cards', reportCardsResult.length);
        } catch (e) {
          this.deletionService.recordError(`Error deleting report cards: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.deletionService.recordError(`Error deleting report cards: ${(e as Error).message}`);
    }

    try {
      const studentResult = await db.delete(schema.students)
        .where(eq(schema.students.id, userId))
        .returning();
      this.deletionService.recordDeletion('students', studentResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting student record: ${(e as Error).message}`);
    }
  }

  private async deleteTeacherData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting teacher-specific data...');

    try {
      const teacherProfile = await db.select({ signatureUrl: schema.teacherProfiles.signatureUrl })
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, userId))
        .limit(1);
      
      if (teacherProfile[0]?.signatureUrl) {
        this.addFileToDelete(teacherProfile[0].signatureUrl);
      }
    } catch (e) {
      this.deletionService.recordError(`Error getting teacher signature: ${(e as Error).message}`);
    }

    try {
      const exams = await db.select({ id: schema.exams.id })
        .from(schema.exams)
        .where(eq(schema.exams.createdBy, userId));
      
      for (const exam of exams) {
        await this.deleteExamCompletely(exam.id);
      }
    } catch (e) {
      this.deletionService.recordError(`Error deleting teacher exams: ${(e as Error).message}`);
    }

    try {
      const questionBanks = await db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.createdBy, userId));
      
      for (const qb of questionBanks) {
        await this.deleteQuestionBankCompletely(qb.id);
      }
    } catch (e) {
      this.deletionService.recordError(`Error deleting question banks: ${(e as Error).message}`);
    }

    try {
      const teacherAssignmentsResult = await db.delete(schema.teacherClassAssignments)
        .where(eq(schema.teacherClassAssignments.teacherId, userId))
        .returning();
      this.deletionService.recordDeletion('teacher_class_assignments', teacherAssignmentsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting teacher assignments: ${(e as Error).message}`);
    }

    try {
      const historyResult = await db.delete(schema.teacherAssignmentHistory)
        .where(eq(schema.teacherAssignmentHistory.teacherId, userId))
        .returning();
      this.deletionService.recordDeletion('teacher_assignment_history', historyResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting assignment history: ${(e as Error).message}`);
    }

    try {
      const timetableResult = await db.delete(schema.timetable)
        .where(eq(schema.timetable.teacherId, userId))
        .returning();
      this.deletionService.recordDeletion('timetable', timetableResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting timetable: ${(e as Error).message}`);
    }

    try {
      const gradingResult = await db.delete(schema.gradingTasks)
        .where(eq(schema.gradingTasks.teacherId, userId))
        .returning();
      this.deletionService.recordDeletion('grading_tasks', gradingResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting grading tasks: ${(e as Error).message}`);
    }

    try {
      await db.update(schema.continuousAssessment)
        .set({ teacherId: null })
        .where(eq(schema.continuousAssessment.teacherId, userId));
    } catch (e) {}

    try {
      await db.update(schema.continuousAssessment)
        .set({ enteredBy: null })
        .where(eq(schema.continuousAssessment.enteredBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.continuousAssessment)
        .set({ verifiedBy: null })
        .where(eq(schema.continuousAssessment.verifiedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.continuousAssessment)
        .set({ lockedBy: null })
        .where(eq(schema.continuousAssessment.lockedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCardItems)
        .set({ teacherId: null })
        .where(eq(schema.reportCardItems.teacherId, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCardItems)
        .set({ testExamCreatedBy: null })
        .where(eq(schema.reportCardItems.testExamCreatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCardItems)
        .set({ examExamCreatedBy: null })
        .where(eq(schema.reportCardItems.examExamCreatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCardItems)
        .set({ overriddenBy: null })
        .where(eq(schema.reportCardItems.overriddenBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.exams)
        .set({ createdBy: null })
        .where(eq(schema.exams.createdBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.exams)
        .set({ teacherInChargeId: null })
        .where(eq(schema.exams.teacherInChargeId, userId));
    } catch (e) {}

    try {
      await db.update(schema.classes)
        .set({ classTeacherId: null })
        .where(eq(schema.classes.classTeacherId, userId));
    } catch (e) {}

    try {
      const teacherProfileResult = await db.delete(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, userId))
        .returning();
      this.deletionService.recordDeletion('teacher_profiles', teacherProfileResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting teacher profile: ${(e as Error).message}`);
    }
  }

  private async deleteParentData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting parent-specific data...');

    try {
      await db.update(schema.students)
        .set({ parentId: null })
        .where(eq(schema.students.parentId, userId));
    } catch (e) {
      this.deletionService.recordError(`Error unlinking parent from students: ${(e as Error).message}`);
    }

    try {
      const parentResult = await db.delete(schema.parentProfiles)
        .where(eq(schema.parentProfiles.userId, userId))
        .returning();
      this.deletionService.recordDeletion('parent_profiles', parentResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting parent profile: ${(e as Error).message}`);
    }
  }

  private async deleteAdminData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting admin-specific data...');

    try {
      const vacanciesResult = await db.delete(schema.vacancies)
        .where(eq(schema.vacancies.createdBy, userId))
        .returning();
      this.deletionService.recordDeletion('vacancies', vacanciesResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting vacancies: ${(e as Error).message}`);
    }

    try {
      await db.update(schema.teacherApplications)
        .set({ reviewedBy: null })
        .where(eq(schema.teacherApplications.reviewedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.approvedTeachers)
        .set({ approvedBy: null })
        .where(eq(schema.approvedTeachers.approvedBy, userId));
    } catch (e) {}

    try {
      const adminResult = await db.delete(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, userId))
        .returning();
      this.deletionService.recordDeletion('admin_profiles', adminResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting admin profile: ${(e as Error).message}`);
    }
  }

  private async deleteSuperAdminData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting super admin-specific data...');

    await this.deleteAdminData(userId);

    try {
      const superAdminResult = await db.delete(schema.superAdminProfiles)
        .where(eq(schema.superAdminProfiles.userId, userId))
        .returning();
      this.deletionService.recordDeletion('super_admin_profiles', superAdminResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting super admin profile: ${(e as Error).message}`);
    }
  }

  private async deleteCommonUserData(userId: string): Promise<void> {
    console.log('[SmartDeletion] Deleting common user data...');

    try {
      const homePageContent = await db.select({ imageUrl: schema.homePageContent.imageUrl })
        .from(schema.homePageContent)
        .where(eq(schema.homePageContent.uploadedBy, userId));
      
      for (const content of homePageContent) {
        this.addFileToDelete(content.imageUrl);
      }
      
      await db.update(schema.homePageContent)
        .set({ uploadedBy: null })
        .where(eq(schema.homePageContent.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling homepage content: ${(e as Error).message}`);
    }

    try {
      const galleryItems = await db.select({ imageUrl: schema.gallery.imageUrl })
        .from(schema.gallery)
        .where(eq(schema.gallery.uploadedBy, userId));
      
      for (const item of galleryItems) {
        this.addFileToDelete(item.imageUrl);
      }
      
      await db.update(schema.gallery)
        .set({ uploadedBy: null })
        .where(eq(schema.gallery.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling gallery: ${(e as Error).message}`);
    }

    try {
      const studyResources = await db.select({ fileUrl: schema.studyResources.fileUrl })
        .from(schema.studyResources)
        .where(eq(schema.studyResources.uploadedBy, userId));
      
      for (const resource of studyResources) {
        this.addFileToDelete(resource.fileUrl);
      }
      
      await db.update(schema.studyResources)
        .set({ uploadedBy: null })
        .where(eq(schema.studyResources.uploadedBy, userId));
    } catch (e) {
      this.deletionService.recordError(`Error handling study resources: ${(e as Error).message}`);
    }

    try {
      const tokensResult = await db.delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, userId))
        .returning();
      this.deletionService.recordDeletion('password_reset_tokens', tokensResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting password tokens: ${(e as Error).message}`);
    }

    try {
      const invitesAcceptedResult = await db.delete(schema.invites)
        .where(eq(schema.invites.acceptedBy, userId))
        .returning();
      const invitesCreatedResult = await db.delete(schema.invites)
        .where(eq(schema.invites.createdBy, userId))
        .returning();
      this.deletionService.recordDeletion('invites', invitesAcceptedResult.length + invitesCreatedResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting invites: ${(e as Error).message}`);
    }

    try {
      const notificationsResult = await db.delete(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .returning();
      this.deletionService.recordDeletion('notifications', notificationsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting notifications: ${(e as Error).message}`);
    }

    try {
      const messagesResult = await db.delete(schema.messages)
        .where(or(
          eq(schema.messages.senderId, userId),
          eq(schema.messages.recipientId, userId)
        ))
        .returning();
      this.deletionService.recordDeletion('messages', messagesResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting messages: ${(e as Error).message}`);
    }

    try {
      const announcementsResult = await db.delete(schema.announcements)
        .where(eq(schema.announcements.authorId, userId))
        .returning();
      this.deletionService.recordDeletion('announcements', announcementsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting announcements: ${(e as Error).message}`);
    }

    try {
      const perfEventsResult = await db.delete(schema.performanceEvents)
        .where(eq(schema.performanceEvents.userId, userId))
        .returning();
      this.deletionService.recordDeletion('performance_events', perfEventsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting performance events: ${(e as Error).message}`);
    }

    try {
      const auditResult = await db.delete(schema.auditLogs)
        .where(eq(schema.auditLogs.userId, userId))
        .returning();
      this.deletionService.recordDeletion('audit_logs', auditResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting audit logs: ${(e as Error).message}`);
    }

    try {
      const accessLogsResult = await db.delete(schema.unauthorizedAccessLogs)
        .where(eq(schema.unauthorizedAccessLogs.userId, userId))
        .returning();
      this.deletionService.recordDeletion('unauthorized_access_logs', accessLogsResult.length);
    } catch (e) {
      this.deletionService.recordError(`Error deleting access logs: ${(e as Error).message}`);
    }

    try {
      await db.update(schema.contactMessages)
        .set({ respondedBy: null })
        .where(eq(schema.contactMessages.respondedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.systemSettings)
        .set({ updatedBy: null })
        .where(eq(schema.systemSettings.updatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.settings)
        .set({ updatedBy: null })
        .where(eq(schema.settings.updatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.attendance)
        .set({ recordedBy: null })
        .where(eq(schema.attendance.recordedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.questionBanks)
        .set({ createdBy: null })
        .where(eq(schema.questionBanks.createdBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.gradingBoundaries)
        .set({ createdBy: null })
        .where(eq(schema.gradingBoundaries.createdBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherClassAssignments)
        .set({ assignedBy: null })
        .where(eq(schema.teacherClassAssignments.assignedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherAssignmentHistory)
        .set({ performedBy: null })
        .where(eq(schema.teacherAssignmentHistory.performedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.studentSubjectAssignments)
        .set({ assignedBy: null })
        .where(eq(schema.studentSubjectAssignments.assignedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCards)
        .set({ generatedBy: null })
        .where(eq(schema.reportCards.generatedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.reportCards)
        .set({ signedBy: null })
        .where(eq(schema.reportCards.signedBy, userId));
    } catch (e) {}

    try {
      await db.update(schema.teacherProfiles)
        .set({ verifiedBy: null })
        .where(eq(schema.teacherProfiles.verifiedBy, userId));
    } catch (e) {}
  }

  private async deleteExamCompletely(examId: number): Promise<void> {
    try {
      const questions = await db.select({ id: schema.examQuestions.id, imageUrl: schema.examQuestions.imageUrl })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.examId, examId));
      
      const questionIds = questions.map(q => q.id);
      
      for (const question of questions) {
        this.addFileToDelete(question.imageUrl);
      }

      if (questionIds.length > 0) {
        const sessions = await db.select({ id: schema.examSessions.id })
          .from(schema.examSessions)
          .where(eq(schema.examSessions.examId, examId));
        
        const sessionIds = sessions.map(s => s.id);
        
        if (sessionIds.length > 0) {
          try {
            const gtResult = await db.delete(schema.gradingTasks)
              .where(inArray(schema.gradingTasks.sessionId, sessionIds))
              .returning();
            this.deletionService.recordDeletion('grading_tasks', gtResult.length);
          } catch (e) {}

          try {
            const peResult = await db.delete(schema.performanceEvents)
              .where(inArray(schema.performanceEvents.sessionId, sessionIds))
              .returning();
            this.deletionService.recordDeletion('performance_events', peResult.length);
          } catch (e) {}

          try {
            const saResult = await db.delete(schema.studentAnswers)
              .where(inArray(schema.studentAnswers.sessionId, sessionIds))
              .returning();
            this.deletionService.recordDeletion('student_answers', saResult.length);
          } catch (e) {}
          
          try {
            const esResult = await db.delete(schema.examSessions)
              .where(inArray(schema.examSessions.id, sessionIds))
              .returning();
            this.deletionService.recordDeletion('exam_sessions', esResult.length);
          } catch (e) {}
        }

        try {
          const qoResult = await db.delete(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds))
            .returning();
          this.deletionService.recordDeletion('question_options', qoResult.length);
        } catch (e) {}
        
        try {
          const eqResult = await db.delete(schema.examQuestions)
            .where(eq(schema.examQuestions.examId, examId))
            .returning();
          this.deletionService.recordDeletion('exam_questions', eqResult.length);
        } catch (e) {}
      }

      try {
        const erResult = await db.delete(schema.examResults)
          .where(eq(schema.examResults.examId, examId))
          .returning();
        this.deletionService.recordDeletion('exam_results', erResult.length);
      } catch (e) {}

      try {
        await db.update(schema.reportCardItems)
          .set({ testExamId: null })
          .where(eq(schema.reportCardItems.testExamId, examId));
      } catch (e) {}

      try {
        await db.update(schema.reportCardItems)
          .set({ examExamId: null })
          .where(eq(schema.reportCardItems.examExamId, examId));
      } catch (e) {}

      const result = await db.delete(schema.exams)
        .where(eq(schema.exams.id, examId))
        .returning();
      
      this.deletionService.recordDeletion('exams', result.length);
    } catch (error) {
      this.deletionService.recordError(`Failed to delete exam ${examId}: ${(error as Error).message}`);
    }
  }

  private async deleteQuestionBankCompletely(bankId: number): Promise<void> {
    try {
      const items = await db.select({ 
        id: schema.questionBankItems.id, 
        imageUrl: schema.questionBankItems.imageUrl, 
        practicalFileUrl: schema.questionBankItems.practicalFileUrl 
      })
        .from(schema.questionBankItems)
        .where(eq(schema.questionBankItems.bankId, bankId));
      
      const itemIds = items.map(i => i.id);
      
      for (const item of items) {
        this.addFileToDelete(item.imageUrl);
        this.addFileToDelete(item.practicalFileUrl);
      }

      if (itemIds.length > 0) {
        try {
          const qboResult = await db.delete(schema.questionBankOptions)
            .where(inArray(schema.questionBankOptions.questionItemId, itemIds))
            .returning();
          this.deletionService.recordDeletion('question_bank_options', qboResult.length);
        } catch (e) {}
        
        try {
          const qbiResult = await db.delete(schema.questionBankItems)
            .where(eq(schema.questionBankItems.bankId, bankId))
            .returning();
          this.deletionService.recordDeletion('question_bank_items', qbiResult.length);
        } catch (e) {}
      }

      const result = await db.delete(schema.questionBanks)
        .where(eq(schema.questionBanks.id, bankId))
        .returning();
      
      this.deletionService.recordDeletion('question_banks', result.length);
    } catch (error) {
      this.deletionService.recordError(`Failed to delete question bank ${bankId}: ${(error as Error).message}`);
    }
  }

  private async deleteFilesInBatch(urls: string[]): Promise<number> {
    const validUrls = urls.filter(url => url && url.trim().length > 0);
    if (validUrls.length === 0) return 0;

    let successCount = 0;

    if (useCloudinary) {
      const cloudinaryUrls: string[] = [];
      const localUrls: string[] = [];

      for (const url of validUrls) {
        if (url.includes('cloudinary.com')) {
          cloudinaryUrls.push(url);
        } else {
          localUrls.push(url);
        }
      }

      if (cloudinaryUrls.length > 0) {
        const publicIds = cloudinaryUrls.map(url => {
          const match = url.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
          return match ? match[1] : url;
        }).filter(Boolean);

        try {
          const batchSize = 100;
          for (let i = 0; i < publicIds.length; i += batchSize) {
            const batch = publicIds.slice(i, i + batchSize);
            try {
              const result = await cloudinary.api.delete_resources(batch);
              const batchSuccess = Object.values(result.deleted || {}).filter(v => v === 'deleted').length;
              successCount += batchSuccess;
              this.deletionService.recordDeletion('cloudinary_files', batchSuccess);
              console.log(`[SmartDeletion] Cloudinary batch: ${batchSuccess}/${batch.length} files deleted`);
            } catch (batchError: any) {
              console.error(`[SmartDeletion] Cloudinary batch error:`, batchError.message);
              this.deletionService.recordError(`Cloudinary batch error: ${batchError.message}`);
              for (const id of batch) {
                try {
                  const singleResult = await cloudinary.uploader.destroy(id);
                  if (singleResult.result === 'ok') {
                    successCount++;
                    this.deletionService.recordDeletion('cloudinary_files', 1);
                  }
                } catch (singleError) {
                  console.error(`[SmartDeletion] Failed to delete ${id}`);
                }
              }
            }
          }
        } catch (error: any) {
          console.error('[SmartDeletion] Cloudinary deletion failed:', error.message);
          this.deletionService.recordError(`Cloudinary deletion failed: ${error.message}`);
        }
      }

      for (const url of localUrls) {
        const success = await deleteFile(url);
        if (success) {
          successCount++;
          this.deletionService.recordDeletion('local_files', 1);
        }
      }
    } else {
      for (const url of validUrls) {
        const success = await deleteFile(url);
        if (success) {
          successCount++;
          this.deletionService.recordDeletion('local_files', 1);
        }
      }
    }

    console.log(`[SmartDeletion] File cleanup complete: ${successCount}/${validUrls.length} files deleted`);
    return successCount;
  }
}

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
