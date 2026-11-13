/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, normalizeUuid, schema } from '../storage/helpers';
import { DeletionService, formatDeletionLog } from '../services/deletion-service';
import { AdminProfile, InsertAdminProfile, InsertInvite, InsertSuperAdminProfile, InsertTeacherProfile, InsertUser, Invite, ParentProfile, Role, Student, SuperAdminProfile, TeacherProfile, User } from '@shared/schema.pg';
import { and, desc, eq, inArray, isNull, or, sql, sql as dsql } from 'drizzle-orm';
import { DatabaseStorageP01 } from './part01-core'
import type { IStorage } from './types'

export class DatabaseStorageP02 extends DatabaseStorageP01 {
  async deleteUserLegacy(id: string): Promise<boolean> {
    const deletionService = new DeletionService();
    deletionService.reset();

    try {
      const user = await this.getUser(id);
      if (!user) {
        return false;
      }

      const userRole = user.roleId === 1 ? 'Super Admin' :
        user.roleId === 2 ? 'Admin' :
          user.roleId === 3 ? 'Teacher' :
            user.roleId === 4 ? 'Student' :
              user.roleId === 5 ? 'Parent' : 'Unknown';

      console.log(`\n[Legacy Deletion] Starting permanent deletion for ${userRole}: ${user.email || user.username}`);

      const filesToDelete: (string | null | undefined)[] = [];

      if (user.profileImageUrl) {
        filesToDelete.push(user.profileImageUrl);
      }

      const teacherProfile = await this.db.select({ signatureUrl: schema.teacherProfiles.signatureUrl })
        .from(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, id))
        .limit(1);

      if (teacherProfile[0]?.signatureUrl) {
        filesToDelete.push(teacherProfile[0].signatureUrl);
      }

      const teacherExams = await this.db.select({ id: schema.exams.id })
        .from(schema.exams)
        .where(eq(schema.exams.createdBy, id));

      for (const exam of teacherExams) {
        try {
          await this.deleteExam(exam.id);
          deletionService.recordDeletion('exams', 1);
        } catch (examError: any) {
          deletionService.recordError(`Failed to delete exam ${exam.id}: ${examError.message}`);
        }
      }

      const questionBanks = await this.db.select({ id: schema.questionBanks.id })
        .from(schema.questionBanks)
        .where(eq(schema.questionBanks.createdBy, id));

      for (const qb of questionBanks) {
        try {
          const qbItems = await this.db.select({ id: schema.questionBankItems.id, imageUrl: schema.questionBankItems.imageUrl })
            .from(schema.questionBankItems)
            .where(eq(schema.questionBankItems.questionBankId, qb.id));

          for (const item of qbItems) {
            if (item.imageUrl) filesToDelete.push(item.imageUrl);
          }

          const qbItemIds = qbItems.map((item: { id: number }) => item.id);
          if (qbItemIds.length > 0) {
            await this.db.delete(schema.questionBankOptions)
              .where(inArray(schema.questionBankOptions.questionId, qbItemIds));
            deletionService.recordDeletion('question_bank_options', qbItemIds.length);

            await this.db.delete(schema.questionBankItems)
              .where(eq(schema.questionBankItems.questionBankId, qb.id));
            deletionService.recordDeletion('question_bank_items', qbItemIds.length);
          }
          await this.db.delete(schema.questionBanks)
            .where(eq(schema.questionBanks.id, qb.id));
          deletionService.recordDeletion('question_banks', 1);
        } catch (qbError: any) {
          deletionService.recordError(`Failed to delete question bank ${qb.id}: ${qbError.message}`);
        }
      }

      const homePageContent = await this.db.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl })
        .from(schema.homePageContent)
        .where(eq(schema.homePageContent.uploadedBy, id));

      for (const content of homePageContent) {
        if (content.imageUrl) filesToDelete.push(content.imageUrl);
      }

      const teacherProfileResult = await this.db.delete(schema.teacherProfiles)
        .where(eq(schema.teacherProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('teacher_profiles', teacherProfileResult.length);

      try {
        const teacherAssignmentsResult = await this.db.delete(schema.teacherClassAssignments)
          .where(eq(schema.teacherClassAssignments.teacherId, id))
          .returning();
        deletionService.recordDeletion('teacher_class_assignments', teacherAssignmentsResult.length);
      } catch (e) { }

      try {
        const historyResult = await this.db.delete(schema.teacherAssignmentHistory)
          .where(eq(schema.teacherAssignmentHistory.teacherId, id))
          .returning();
        deletionService.recordDeletion('teacher_assignment_history', historyResult.length);
      } catch (e) { }

      try {
        const timetableResult = await this.db.delete(schema.timetable)
          .where(eq(schema.timetable.teacherId, id))
          .returning();
        deletionService.recordDeletion('timetable', timetableResult.length);
      } catch (e) { }

      try {
        const gradingResult = await this.db.delete(schema.gradingTasks)
          .where(eq(schema.gradingTasks.assignedTeacherId, id))
          .returning();
        deletionService.recordDeletion('grading_tasks', gradingResult.length);
      } catch (e) { }

      const adminResult = await this.db.delete(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('admin_profiles', adminResult.length);

      const parentResult = await this.db.delete(schema.parentProfiles)
        .where(eq(schema.parentProfiles.userId, id))
        .returning();
      deletionService.recordDeletion('parent_profiles', parentResult.length);

      try {
        const superAdminResult = await this.db.delete(schema.superAdminProfiles)
          .where(eq(schema.superAdminProfiles.userId, id))
          .returning();
        deletionService.recordDeletion('super_admin_profiles', superAdminResult.length);
      } catch (e) { }

      const tokensResult = await this.db.delete(schema.passwordResetTokens)
        .where(eq(schema.passwordResetTokens.userId, id))
        .returning();
      deletionService.recordDeletion('password_reset_tokens', tokensResult.length);

      const invitesAcceptedResult = await this.db.delete(schema.invites)
        .where(eq(schema.invites.acceptedBy, id))
        .returning();
      const invitesCreatedResult = await this.db.delete(schema.invites)
        .where(eq(schema.invites.createdBy, id))
        .returning();
      deletionService.recordDeletion('invites', invitesAcceptedResult.length + invitesCreatedResult.length);

      const notificationsResult = await this.db.delete(schema.notifications)
        .where(eq(schema.notifications.userId, id))
        .returning();
      deletionService.recordDeletion('notifications', notificationsResult.length);

      const messagesResult = await this.db.delete(schema.messages)
        .where(or(
          eq(schema.messages.senderId, id),
          eq(schema.messages.recipientId, id)
        ))
        .returning();
      deletionService.recordDeletion('messages', messagesResult.length);

      const announcementsResult = await this.db.delete(schema.announcements)
        .where(eq(schema.announcements.authorId, id))
        .returning();
      deletionService.recordDeletion('announcements', announcementsResult.length);

      try {
        const perfEventsResult = await this.db.delete(schema.performanceEvents)
          .where(eq(schema.performanceEvents.userId, id))
          .returning();
        deletionService.recordDeletion('performance_events', perfEventsResult.length);
      } catch (e) { }

      try {
        const auditResult = await this.db.delete(schema.auditLogs)
          .where(eq(schema.auditLogs.userId, id))
          .returning();
        deletionService.recordDeletion('audit_logs', auditResult.length);
      } catch (e) { }

      try {
        const accessLogsResult = await this.db.delete(schema.unauthorizedAccessLogs)
          .where(eq(schema.unauthorizedAccessLogs.userId, id))
          .returning();
        deletionService.recordDeletion('unauthorized_access_logs', accessLogsResult.length);
      } catch (e) { }

      const examSessions = await this.db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));

      const sessionIds = examSessions.map((s: { id: number }) => s.id);

      if (sessionIds.length > 0) {
        try {
          const sessionGradingResult = await this.db.delete(schema.gradingTasks)
            .where(inArray(schema.gradingTasks.sessionId, sessionIds))
            .returning();
          deletionService.recordDeletion('grading_tasks', sessionGradingResult.length);
        } catch (e) { }

        try {
          const sessionPerfResult = await this.db.delete(schema.performanceEvents)
            .where(inArray(schema.performanceEvents.sessionId, sessionIds))
            .returning();
          deletionService.recordDeletion('performance_events', sessionPerfResult.length);
        } catch (e) { }

        const answersResult = await this.db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds))
          .returning();
        deletionService.recordDeletion('student_answers', answersResult.length);

        const sessionsResult = await this.db.delete(schema.examSessions)
          .where(inArray(schema.examSessions.id, sessionIds))
          .returning();
        deletionService.recordDeletion('exam_sessions', sessionsResult.length);
      }

      const examResultsResult = await this.db.delete(schema.examResults)
        .where(eq(schema.examResults.studentId, id))
        .returning();
      deletionService.recordDeletion('exam_results', examResultsResult.length);

      const attendanceResult = await this.db.delete(schema.attendance)
        .where(eq(schema.attendance.studentId, id))
        .returning();
      deletionService.recordDeletion('attendance', attendanceResult.length);

      try {
        const caResult = await this.db.delete(schema.continuousAssessment)
          .where(eq(schema.continuousAssessment.studentId, id))
          .returning();
        deletionService.recordDeletion('continuous_assessment', caResult.length);
      } catch (e) { }

      try {
        const subjectAssignResult = await this.db.delete(schema.studentSubjectAssignments)
          .where(eq(schema.studentSubjectAssignments.studentId, id))
          .returning();
        deletionService.recordDeletion('student_subject_assignments', subjectAssignResult.length);
      } catch (e) { }

      try {
        const reportCardItems = await this.db.select({ id: schema.reportCardItems.id })
          .from(schema.reportCardItems)
          .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
          .where(eq(schema.reportCards.studentId, id));

        if (reportCardItems.length > 0) {
          const reportCardItemIds = reportCardItems.map((r: any) => r.report_card_items?.id || r.id);
          await this.db.delete(schema.reportCardItems)
            .where(inArray(schema.reportCardItems.id, reportCardItemIds));
          deletionService.recordDeletion('report_card_items', reportCardItemIds.length);
        }
      } catch (e) { }

      try {
        const reportCardsResult = await this.db.delete(schema.reportCards)
          .where(eq(schema.reportCards.studentId, id))
          .returning();
        deletionService.recordDeletion('report_cards', reportCardsResult.length);
      } catch (e) { }

      await this.db.update(schema.students)
        .set({ parentId: null })
        .where(eq(schema.students.parentId, id));

      const studentResult = await this.db.delete(schema.students)
        .where(eq(schema.students.id, id))
        .returning();
      deletionService.recordDeletion('students', studentResult.length);

      try {
        await this.db.update(schema.classes)
          .set({ classTeacherId: null })
          .where(eq(schema.classes.classTeacherId, id));
      } catch (e) { }

      try {
        await this.db.update(schema.contactMessages)
          .set({ respondedBy: null })
          .where(eq(schema.contactMessages.respondedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.systemSettings)
          .set({ updatedBy: null })
          .where(eq(schema.systemSettings.updatedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.settings)
          .set({ updatedBy: null })
          .where(eq(schema.settings.updatedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.reportCardItems)
          .set({ teacherId: null })
          .where(eq(schema.reportCardItems.teacherId, id));
      } catch (e) { }

      try {
        await this.db.update(schema.reportCardItems)
          .set({ testExamCreatedBy: null })
          .where(eq(schema.reportCardItems.testExamCreatedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.reportCardItems)
          .set({ examExamCreatedBy: null })
          .where(eq(schema.reportCardItems.examExamCreatedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.exams)
          .set({ createdBy: null })
          .where(eq(schema.exams.createdBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.exams)
          .set({ teacherInChargeId: null })
          .where(eq(schema.exams.teacherInChargeId, id));
      } catch (e) { }

      try {
        const vacanciesResult = await this.db.delete(schema.vacancies)
          .where(eq(schema.vacancies.createdBy, id))
          .returning();
        deletionService.recordDeletion('vacancies', vacanciesResult.length);
      } catch (e) { }

      try {
        await this.db.update(schema.teacherApplications)
          .set({ reviewedBy: null })
          .where(eq(schema.teacherApplications.reviewedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.approvedTeachers)
          .set({ approvedBy: null })
          .where(eq(schema.approvedTeachers.approvedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.attendance)
          .set({ recordedBy: null })
          .where(eq(schema.attendance.recordedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.questionBanks)
          .set({ createdBy: null })
          .where(eq(schema.questionBanks.createdBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.homePageContent)
          .set({ uploadedBy: null })
          .where(eq(schema.homePageContent.uploadedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.gallery)
          .set({ uploadedBy: null })
          .where(eq(schema.gallery.uploadedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.studyResources)
          .set({ uploadedBy: null })
          .where(eq(schema.studyResources.uploadedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.studentSubjectAssignments)
          .set({ assignedBy: null })
          .where(eq(schema.studentSubjectAssignments.assignedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.teacherClassAssignments)
          .set({ assignedBy: null })
          .where(eq(schema.teacherClassAssignments.assignedBy, id));
      } catch (e) { }

      try {
        await this.db.update(schema.teacherAssignmentHistory)
          .set({ performedBy: null })
          .where(eq(schema.teacherAssignmentHistory.performedBy, id));
      } catch (e) { }

      if (filesToDelete.length > 0) {
        console.log(`[Smart Deletion] Deleting ${filesToDelete.length} files from storage...`);
        await deletionService.deleteFilesInBatch(filesToDelete);
      }

      const result = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning();
      deletionService.recordDeletion('users', result.length);

      const deletionResult = deletionService.getResult();
      const logOutput = formatDeletionLog(deletionResult, id, userRole);
      console.log(logOutput);

      await this.createAuditLog({
        userId: id,
        action: 'user_permanently_deleted',
        entityType: 'user',
        entityId: id,
        oldValue: JSON.stringify({
          email: user.email,
          username: user.username,
          role: userRole,
          firstName: user.firstName,
          lastName: user.lastName
        }),
        newValue: JSON.stringify(deletionResult),
        reason: `Permanent deletion of ${userRole} account: ${user.email || user.username}`,
        ipAddress: 'system',
        userAgent: 'Smart Deletion Service'
      }).catch(() => { });

      return result.length > 0;
    } catch (error: any) {
      deletionService.recordError(`Fatal error in deleteUser: ${error.message}`);
      console.error('[Smart Deletion] Error in deleteUser:', error);
      throw error;
    }
  }


  async getUsersByRole(roleId: number): Promise<User[]> {
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(eq(schema.users.roleId, roleId));
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }

  async getUsersByStatus(status: string): Promise<User[]> {
    const result = await this.db.select().from(schema.users).where(sql`${schema.users.status} = ${status}`);
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users);
    return result.map((user: User) => {
      if (user && user.id) {
        const normalizedId = normalizeUuid(user.id);
        if (normalizedId) {
          user.id = normalizedId;
        }
      }
      return user;
    });
  }

  async approveUser(userId: string, approvedBy: string): Promise<User> {
    const result = await this.db.update(schema.users)
      .set({
        status: 'active',
        approvedBy,
        approvedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }

  async updateUserStatus(userId: string, status: string, updatedBy: string, reason?: string): Promise<User> {
    // Only set approvedBy/approvedAt for actual approvals (status='active')
    // For other status changes (reject/suspend/disable), only update status
    const updates: any = { status };

    if (status === 'active') {
      updates.approvedBy = updatedBy;
      updates.approvedAt = new Date();
    }
    const result = await this.db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning();

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }
  // Role management

  async getRoles(): Promise<Role[]> {
    return await this.db.select().from(schema.roles);
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await this.db.select().from(schema.roles).where(eq(schema.roles.name, name)).limit(1);
    return result[0];
  }

  async getRole(roleId: number): Promise<Role | undefined> {
    const result = await this.db.select().from(schema.roles).where(eq(schema.roles.id, roleId)).limit(1);
    return result[0];
  }
  // Invite management

  async createInvite(invite: InsertInvite): Promise<Invite> {
    const result = await this.db.insert(schema.invites).values(invite).returning();
    return result[0];
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const result = await this.db.select().from(schema.invites)
      .where(and(
        eq(schema.invites.token, token),
        isNull(schema.invites.acceptedAt),
        dsql`${schema.invites.expiresAt} > NOW()`
      ))
      .limit(1);
    return result[0];
  }

  async getPendingInviteByEmail(email: string): Promise<Invite | undefined> {
    const result = await this.db.select().from(schema.invites)
      .where(and(
        eq(schema.invites.email, email),
        isNull(schema.invites.acceptedAt)
      ))
      .limit(1);
    return result[0];
  }

  async getAllInvites(): Promise<Invite[]> {
    return await this.db.select().from(schema.invites)
      .orderBy(desc(schema.invites.createdAt));
  }

  async getPendingInvites(): Promise<Invite[]> {
    return await this.db.select().from(schema.invites)
      .where(isNull(schema.invites.acceptedAt))
      .orderBy(desc(schema.invites.createdAt));
  }

  async markInviteAsAccepted(inviteId: number, acceptedBy: string): Promise<void> {
    await this.db.update(schema.invites)
      .set({ acceptedAt: new Date(), acceptedBy })
      .where(eq(schema.invites.id, inviteId));
  }

  async deleteInvite(inviteId: number): Promise<boolean> {
    const result = await this.db.delete(schema.invites)
      .where(eq(schema.invites.id, inviteId))
      .returning();
    return result.length > 0;
  }

  async deleteExpiredInvites(): Promise<boolean> {
    const result = await this.db.delete(schema.invites)
      .where(and(
        dsql`${schema.invites.expiresAt} < NOW()`,
        isNull(schema.invites.acceptedAt)
      ))
      .returning();
    return result.length > 0;
  }
  // Profile management

  async updateUserProfile(userId: string, profileData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await this.db.update(schema.users)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  async getTeacherProfile(userId: string): Promise<TeacherProfile | undefined> {
    const [profile] = await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, userId));
    return profile || undefined;
  }

  async updateTeacherProfile(userId: string, profile: Partial<InsertTeacherProfile>): Promise<TeacherProfile | undefined> {
    const result = await this.db.update(schema.teacherProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.teacherProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getTeacherProfileByStaffId(staffId: string): Promise<TeacherProfile | undefined> {
    const [profile] = await db.select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.staffId, staffId));
    return profile || undefined;
  }

  async getAllTeacherProfiles(): Promise<TeacherProfile[]> {
    const profiles = await db.select().from(schema.teacherProfiles);
    return profiles;
  }

  async createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile> {
    const result = await this.db.insert(schema.teacherProfiles)
      .values(profile)
      .returning();
    return result[0];
  }

  async getAdminProfile(userId: string): Promise<AdminProfile | undefined> {
    const result = await this.db.select().from(schema.adminProfiles)
      .where(eq(schema.adminProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async createAdminProfile(profile: InsertAdminProfile): Promise<AdminProfile> {
    const result = await this.db.insert(schema.adminProfiles)
      .values(profile)
      .returning();
    return result[0];
  }

  async updateAdminProfile(userId: string, profile: Partial<InsertAdminProfile>): Promise<AdminProfile | undefined> {
    const result = await this.db.update(schema.adminProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.adminProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getSuperAdminProfile(userId: string): Promise<SuperAdminProfile | undefined> {
    const result = await this.db.select().from(schema.superAdminProfiles)
      .where(eq(schema.superAdminProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async createSuperAdminProfile(profile: InsertSuperAdminProfile): Promise<SuperAdminProfile> {
    const result = await this.db.insert(schema.superAdminProfiles)
      .values(profile)
      .returning();
    return result[0];
  }

  async updateSuperAdminProfile(userId: string, profile: Partial<InsertSuperAdminProfile>): Promise<SuperAdminProfile | undefined> {
    const result = await this.db.update(schema.superAdminProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.superAdminProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getParentProfile(userId: string): Promise<ParentProfile | undefined> {
    const result = await this.db.select().from(schema.parentProfiles)
      .where(eq(schema.parentProfiles.userId, userId))
      .limit(1);
    return result[0];
  }
}
