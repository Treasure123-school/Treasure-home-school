/** UserRoleDataDeleter — per-role user data deletion, extracted from smart-deletion-manager.ts. */
import { eq, inArray, sql as dsql } from "drizzle-orm";
import * as schema from "@shared/schema.pg";
import { db } from "../db";
import { DeletionService } from "./deletion-service";
import { deleteFile } from "../cloudinary-service";
import { deleteExamCompletely, deleteQuestionBankCompletely } from "./exam-cleanup";

export class UserRoleDataDeleter {
  protected filesToDelete: string[] = [];

  constructor(protected deletionService: DeletionService) {}

  addFileToDelete(url: string | null | undefined) {
    if (url && typeof url === 'string' && url.trim().length > 0) {
      this.filesToDelete.push(url);
    }
  }

  async deleteStudentData(userId: string): Promise<void> {
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

  async deleteTeacherData(userId: string): Promise<void> {
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
        const examFiles = await deleteExamCompletely(exam.id, this.deletionService);
          examFiles.forEach(f => this.addFileToDelete(f));
      }
    } catch (e) {
      this.deletionService.recordError(`Error deleting teacher exams: ${(e as Error).message}`);
    }

    try {
      const questionBanks = await db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.createdBy, userId));
      
      for (const qb of questionBanks) {
        const qbFiles = await deleteQuestionBankCompletely(qb.id, this.deletionService);
          qbFiles.forEach(f => this.addFileToDelete(f));
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

  async deleteParentData(userId: string): Promise<void> {
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

  async deleteAdminData(userId: string): Promise<void> {
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

  async deleteSuperAdminData(userId: string): Promise<void> {
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

}
