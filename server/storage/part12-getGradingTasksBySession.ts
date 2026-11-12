/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { ApprovedTeacher, AuditLog, Exam, ExamPayment, GradingTask, InsertExamPayment, InsertNotification, InsertSchoolEvent, InsertSystemSettings, InsertTeacherApplication, InsertVacancy, Notification, SchoolEvent, StudentAnswer, SystemSettings, TeacherApplication, Vacancy } from '@shared/schema';
import { and, asc, desc, eq, gte, lte, or, sql as dsql } from 'drizzle-orm';
import { DatabaseStorageP11 } from './part11-calculateGradeDistribution'
import type { IStorage } from './types'

export class DatabaseStorageP12 extends DatabaseStorageP11 {
  async getGradingTasksBySession(sessionId: number): Promise<GradingTask[]> {
    try {
      return await this.db.select().from(schema.gradingTasks)
        .where(eq(schema.gradingTasks.sessionId, sessionId))
        .orderBy(desc(schema.gradingTasks.priority), asc(schema.gradingTasks.createdAt));
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return [];
      }
      throw error;
    }
  }


  async updateGradingTaskStatus(taskId: number, status: string, completedAt?: Date): Promise<GradingTask | undefined> {
    try {
      const updateData: any = { status };
      if (completedAt) {
        updateData.completedAt = completedAt;
      }
      const result = await this.db.update(schema.gradingTasks)
        .set(updateData)
        .where(eq(schema.gradingTasks.id, taskId))
        .returning();
      return result[0];
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }


  async completeGradingTask(taskId: number, pointsEarned: number, feedbackText?: string): Promise<{ task: GradingTask; answer: StudentAnswer } | undefined> {
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // Get the task
      const tasks = await this.db.select().from(schema.gradingTasks)
        .where(eq(schema.gradingTasks.id, taskId))
        .limit(1);

      if (tasks.length === 0) {
        return undefined;
      }
      const task = tasks[0];

      // Update the student answer
      const answers = await this.db.update(schema.studentAnswers)
        .set({
          pointsEarned,
          feedbackText,
          autoScored: false,
          manualOverride: true
        })
        .where(eq(schema.studentAnswers.id, task.answerId))
        .returning();

      // Mark task as completed
      const updatedTasks = await this.db.update(schema.gradingTasks)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(schema.gradingTasks.id, taskId))
        .returning();

      return {
        task: updatedTasks[0],
        answer: answers[0]
      };
    } catch (error: any) {
      if (error?.cause?.code === '42P01') {
        return undefined;
      }
      throw error;
    }
  }

  // Audit logging implementation

  async getAuditLogs(filters?: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(schema.auditLogs.userId, filters.userId));
    }
    if (filters?.entityType) {
      conditions.push(eq(schema.auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(schema.auditLogs.entityId, filters.entityId));
    }
    if (filters?.action) {
      conditions.push(eq(schema.auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(dsql`${schema.auditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(dsql`${schema.auditLogs.createdAt} <= ${filters.endDate}`);
    }
    let query = this.db.select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    return await query;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await this.db.select()
      .from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entityType, entityType),
        eq(schema.auditLogs.entityId, entityId)
      ))
      .orderBy(desc(schema.auditLogs.createdAt));
  }
  // Notification management implementation

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await this.db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await this.db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await this.db.select({ count: dsql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  async markNotificationAsRead(notificationId: number): Promise<Notification | undefined> {
    const result = await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, notificationId))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
  }
  // Password reset attempt tracking for rate limiting

  async createPasswordResetAttempt(identifier: string, ipAddress: string, success: boolean): Promise<any> {
    const result = await this.db.insert(schema.passwordResetAttempts).values({
      identifier,
      ipAddress,
      success,
    }).returning();
    return result[0];
  }

  async getRecentPasswordResetAttempts(identifier: string, minutesAgo: number): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return await this.db.select()
      .from(schema.passwordResetAttempts)
      .where(and(
        eq(schema.passwordResetAttempts.identifier, identifier),
        dsql`${schema.passwordResetAttempts.attemptedAt} > ${cutoffTime}`
      ))
      .orderBy(desc(schema.passwordResetAttempts.attemptedAt));
  }

  async deleteOldPasswordResetAttempts(hoursAgo: number): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    await this.db.delete(schema.passwordResetAttempts)
      .where(dsql`${schema.passwordResetAttempts.attemptedAt} < ${cutoffTime}`);
    return true;
  }
  // Account security methods

  async lockAccount(userId: string, lockUntil: Date): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({ accountLockedUntil: lockUntil })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }

  async unlockAccount(userId: string): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({ accountLockedUntil: null })
      .where(eq(schema.users.id, userId))
      .returning();
    return result.length > 0;
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.db.select({ accountLockedUntil: schema.users.accountLockedUntil })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].accountLockedUntil) {
      return false;
    }
    return new Date(user[0].accountLockedUntil) > new Date();
  }
  // Admin recovery powers

  async adminResetUserPassword(userId: string, newPasswordHash: string, resetBy: string, forceChange: boolean): Promise<boolean> {
    const result = await this.db.update(schema.users)
      .set({
        passwordHash: newPasswordHash,
        mustChangePassword: forceChange
      })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length > 0) {
      await this.createAuditLog({
        userId: resetBy,
        action: 'admin_password_reset',
        entityType: 'user',
        entityId: '0',
        oldValue: null,
        newValue: JSON.stringify({ targetUserId: userId, forceChange }),
        reason: 'Admin initiated password reset',
        ipAddress: null,
        userAgent: null,
      });
    }
    return result.length > 0;
  }

  async updateRecoveryEmail(userId: string, recoveryEmail: string, updatedBy: string): Promise<boolean> {
    const oldUser = await this.getUser(userId);
    const result = await this.db.update(schema.users)
      .set({ recoveryEmail })
      .where(eq(schema.users.id, userId))
      .returning();

    if (result.length > 0) {
      await this.createAuditLog({
        userId: updatedBy,
        action: 'recovery_email_updated',
        entityType: 'user',
        entityId: '0',
        oldValue: oldUser?.recoveryEmail || null,
        newValue: recoveryEmail,
        reason: 'Recovery email updated by admin',
        ipAddress: null,
        userAgent: null,
      });
    }
    return result.length > 0;
  }
  // NEW METHODS FOR EXAM PUBLISHING

  async getScheduledExamsToPublish(now: Date): Promise<Exam[]> {
    // Convert Date to ISO string for PostgreSQL compatibility
    const nowISO = now.toISOString();
    return await this.db
      .select()
      .from(schema.exams)
      .where(
        and(
          eq(schema.exams.isPublished, false),
          dsql`${schema.exams.startTime} <= ${nowISO}`,
          eq(schema.exams.timerMode, 'global') // Only publish global timer exams automatically
        )
      )
      .limit(50);
  }
  // Settings management methods (Module 1)

  async getSetting(key: string): Promise<any | undefined> {
    const result = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .limit(1);
    return result[0];
  }

  async getAllSettings(): Promise<any[]> {
    return await this.db
      .select()
      .from(schema.settings)
      .orderBy(asc(schema.settings.key));
  }

  async createSetting(setting: any): Promise<any> {
    const result = await this.db
      .insert(schema.settings)
      .values(setting)
      .returning();
    return result[0];
  }

  async updateSetting(key: string, value: string, updatedBy: string): Promise<any | undefined> {
    const result = await this.db
      .update(schema.settings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(schema.settings.key, key))
      .returning();
    return result[0];
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.settings)
      .where(eq(schema.settings.key, key))
      .returning();
    return result.length > 0;
  }
  // Counters for atomic sequence generation (Module 1)

  async getNextSequence(classCode: string, year: string): Promise<number> {
    // Use PostgreSQL's UPSERT with atomic increment to prevent race conditions
    const result = await this.db
      .insert(schema.counters)
      .values({
        classCode,
        year,
        sequence: 1
      })
      .onConflictDoUpdate({
        target: [schema.counters.classCode, schema.counters.year],
        set: {
          sequence: dsql`${schema.counters.sequence} + 1`,
          updatedAt: new Date()
        }
      })
      .returning();

    return result[0].sequence;
  }

  async getCounter(classCode: string, year: string): Promise<any | undefined> {
    const result = await this.db
      .select()
      .from(schema.counters)
      .where(
        and(
          eq(schema.counters.classCode, classCode),
          eq(schema.counters.year, year)
        )
      )
      .limit(1);
    return result[0];
  }

  async resetCounter(classCode: string, year: string): Promise<boolean> {
    const result = await this.db
      .update(schema.counters)
      .set({ sequence: 0, updatedAt: new Date() })
      .where(
        and(
          eq(schema.counters.classCode, classCode),
          eq(schema.counters.year, year)
        )
      )
      .returning();
    return result.length > 0;
  }
  // Job Vacancy System implementations

  async createVacancy(vacancy: InsertVacancy): Promise<Vacancy> {
    const result = await this.db.insert(schema.vacancies).values(vacancy).returning();
    return result[0];
  }

  async getVacancy(id: string): Promise<Vacancy | undefined> {
    const result = await this.db.select().from(schema.vacancies).where(eq(schema.vacancies.id, id)).limit(1);
    return result[0];
  }

  async getAllVacancies(status?: string): Promise<Vacancy[]> {
    if (status) {
      return await this.db.select().from(schema.vacancies).where(eq(schema.vacancies.status, status as "open" | "closed" | "filled")).orderBy(desc(schema.vacancies.createdAt));
    }
    return await this.db.select().from(schema.vacancies).orderBy(desc(schema.vacancies.createdAt));
  }

  async updateVacancy(id: string, updates: Partial<InsertVacancy>): Promise<Vacancy | undefined> {
    const result = await this.db
      .update(schema.vacancies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.vacancies.id, id))
      .returning();
    return result[0];
  }

  async deleteVacancy(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.vacancies).where(eq(schema.vacancies.id, id)).returning();
    return result.length > 0;
  }
  // Teacher Applications implementations

  async createTeacherApplication(application: InsertTeacherApplication): Promise<TeacherApplication> {
    const result = await this.db.insert(schema.teacherApplications).values(application).returning();
    return result[0];
  }

  async getTeacherApplication(id: string): Promise<TeacherApplication | undefined> {
    const result = await this.db.select().from(schema.teacherApplications).where(eq(schema.teacherApplications.id, id)).limit(1);
    return result[0];
  }

  async getAllTeacherApplications(status?: string): Promise<TeacherApplication[]> {
    if (status) {
      return await this.db.select().from(schema.teacherApplications).where(eq(schema.teacherApplications.status, status as "pending" | "approved" | "rejected")).orderBy(desc(schema.teacherApplications.dateApplied));
    }
    return await this.db.select().from(schema.teacherApplications).orderBy(desc(schema.teacherApplications.dateApplied));
  }

  async updateTeacherApplication(id: string, updates: Partial<TeacherApplication>): Promise<TeacherApplication | undefined> {
    const result = await this.db
      .update(schema.teacherApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.teacherApplications.id, id))
      .returning();
    return result[0];
  }

  async approveTeacherApplication(applicationId: string, approvedBy: string): Promise<{ application: TeacherApplication; approvedTeacher: ApprovedTeacher }> {
    const application = await this.getTeacherApplication(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }
    // Update application status
    const updatedApplication = await this.db
      .update(schema.teacherApplications)
      .set({
        status: 'approved',
        reviewedBy: approvedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherApplications.id, applicationId))
      .returning();

    // Add to approved teachers
    const approvedTeacher = await this.db
      .insert(schema.approvedTeachers)
      .values({
        applicationId: applicationId,
        googleEmail: application.googleEmail,
        fullName: application.fullName,
        subjectSpecialty: application.subjectSpecialty,
        approvedBy: approvedBy,
      })
      .returning();

    return {
      application: updatedApplication[0],
      approvedTeacher: approvedTeacher[0],
    };
  }

  async rejectTeacherApplication(applicationId: string, reviewedBy: string, reason: string): Promise<TeacherApplication | undefined> {
    const result = await this.db
      .update(schema.teacherApplications)
      .set({
        status: 'rejected',
        reviewedBy: reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.teacherApplications.id, applicationId))
      .returning();
    return result[0];
  }
  // Approved Teachers implementations

  async getApprovedTeacherByEmail(email: string): Promise<ApprovedTeacher | undefined> {
    const result = await this.db.select().from(schema.approvedTeachers).where(eq(schema.approvedTeachers.googleEmail, email)).limit(1);
    return result[0];
  }

  async getAllApprovedTeachers(): Promise<ApprovedTeacher[]> {
    return await this.db.select().from(schema.approvedTeachers).orderBy(desc(schema.approvedTeachers.dateApproved));
  }

  async deleteApprovedTeacher(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.approvedTeachers).where(eq(schema.approvedTeachers.id, id)).returning();
    return result.length > 0;
  }
  // Super Admin implementations

  async getSuperAdminStats(): Promise<{
    totalAdmins: number;
    totalUsers: number;
    activeSessions: number;
    totalExams: number;
  }> {
    const [admins, users, exams] = await Promise.all([
      this.getUsersByRole(1), // Admins have roleId 1
      this.getAllUsers(),
      this.db.select().from(schema.exams),
    ]);

    // Count active sessions (users logged in recently, within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeSessions = users.filter(u => u.updatedAt && u.updatedAt > oneHourAgo).length;

    return {
      totalAdmins: admins.length,
      totalUsers: users.length,
      activeSessions,
      totalExams: exams.length,
    };
  }

  async updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    const existing = await this.getSystemSettings();
    const updateData: any = { ...settings };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Safety check: ensure we don't accidentally overwrite absolute URLs with relative paths if they contain http
    for (const key in updateData) {
      if (typeof updateData[key] === 'string' && (updateData[key].startsWith('http') || updateData[key].includes('cloudinary.com'))) {
        // Keep absolute URLs as is
        console.log(`[STORAGE] Preserving absolute URL for ${key}:`, updateData[key]);
      }
    }

    if (existing) {
      console.log('[SETTINGS UPDATE] primaryColor received:', updateData.primaryColor, '| secondaryColor:', updateData.secondaryColor, '| keys:', Object.keys(updateData).join(','));
      const result = await db
        .update(schema.systemSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(schema.systemSettings.id, existing.id))
        .returning();

      const rows = result as any[];
      if (!rows || !rows.length) throw new Error("Update failed");
      return rows[0];
    } else {
      const result = await db
        .insert(schema.systemSettings)
        .values({ ...updateData, createdAt: new Date(), updatedAt: new Date() })
        .returning();

      const rows = result as any[];
      if (!rows || !rows.length) throw new Error("Insert failed");
      return rows[0];
    }
  }

  // Exam payment implementations

  async getExamPayment(studentId: string, termId: number): Promise<ExamPayment | undefined> {
    const result = await this.db.select().from(schema.examPayments)
      .where(and(
        eq(schema.examPayments.studentId, studentId),
        eq(schema.examPayments.termId, termId),
        eq(schema.examPayments.status, "paid")
      ))
      .limit(1);
    return result[0];
  }


  async getExamPaymentByReference(reference: string): Promise<ExamPayment | undefined> {
    const result = await this.db.select().from(schema.examPayments)
      .where(eq(schema.examPayments.paymentReference, reference))
      .limit(1);
    return result[0];
  }


  async getExamPaymentsByTerm(termId: number): Promise<ExamPayment[]> {
    return await this.db.select().from(schema.examPayments)
      .where(eq(schema.examPayments.termId, termId))
      .orderBy(desc(schema.examPayments.createdAt));
  }


  async getExamPaymentsByStudent(studentId: string): Promise<ExamPayment[]> {
    return await this.db.select().from(schema.examPayments)
      .where(and(
        eq(schema.examPayments.studentId, studentId),
        eq(schema.examPayments.status, "paid")
      ))
      .orderBy(desc(schema.examPayments.createdAt));
  }


  async updateExamPayment(id: number, data: Partial<InsertExamPayment>): Promise<ExamPayment | undefined> {
    const result = await this.db.update(schema.examPayments)
      .set(data)
      .where(eq(schema.examPayments.id, id))
      .returning();
    return result[0];
  }


  async createExamPayment(data: InsertExamPayment): Promise<ExamPayment> {
    try {
      const result = await this.db.insert(schema.examPayments).values(data).returning();
      return result[0];
    } catch (err: any) {
      // Unique constraint violation — a record already exists for this student+term.
      // This can happen when the webhook ran before verify-by-ref, or due to a race condition.
      // Fetch the existing record and update it to the new values instead.
      if (err.code === "23505") {
        const existing = await this.db.select().from(schema.examPayments)
          .where(and(
            eq(schema.examPayments.studentId, data.studentId),
            eq(schema.examPayments.termId, data.termId!),
          ))
          .limit(1);
        if (existing[0]) {
          const updated = await this.updateExamPayment(existing[0].id, {
            status: data.status ?? existing[0].status,
            amountPaid: data.amountPaid ?? existing[0].amountPaid,
            paymentMethod: data.paymentMethod ?? existing[0].paymentMethod,
            paymentReference: data.paymentReference ?? existing[0].paymentReference,
            gatewayResponse: data.gatewayResponse ?? existing[0].gatewayResponse,
            paidAt: data.paidAt ?? existing[0].paidAt,
          });
          return updated!;
        }
      }
      throw err;
    }
  }


  async getPendingExamPayment(studentId: string, termId: number): Promise<ExamPayment | undefined> {
    // Return any non-paid record (pending/failed) that has a reference we can re-verify
    const rows = await this.db.select().from(schema.examPayments)
      .where(and(
        eq(schema.examPayments.studentId, studentId),
        eq(schema.examPayments.termId, termId),
      ))
      .orderBy(desc(schema.examPayments.createdAt))
      .limit(1);
    const row = rows[0];
    // Only return it if it's not already paid and has a reference to check
    if (row && row.status !== 'paid' && row.paymentReference) return row;
    return undefined;
  }


  async getAnyExamPaymentByStudentTerm(studentId: string, termId: number): Promise<ExamPayment | undefined> {
    // Return ANY record for this student+term, regardless of status or reference
    const rows = await this.db.select().from(schema.examPayments)
      .where(and(
        eq(schema.examPayments.studentId, studentId),
        eq(schema.examPayments.termId, termId),
      ))
      .orderBy(desc(schema.examPayments.createdAt))
      .limit(1);
    return rows[0];
  }


  async initiatePendingExamPayment(studentId: string, termId: number, reference: string, amountPaid: number): Promise<ExamPayment> {
    // Look for any existing record (paid, pending, or failed) for this student+term
    const existingRows = await this.db.select().from(schema.examPayments)
      .where(and(
        eq(schema.examPayments.studentId, studentId),
        eq(schema.examPayments.termId, termId),
      ))
      .orderBy(desc(schema.examPayments.createdAt))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      if (existing.status === 'paid') {
        throw new Error('ALREADY_PAID');
      }
      // Reuse the existing row — just update the reference so the verify endpoint can find it
      const updated = await this.updateExamPayment(existing.id, {
        paymentReference: reference,
        amountPaid,
        status: 'pending',
      });
      return updated!;
    }
    const result = await this.db.insert(schema.examPayments).values({
      studentId,
      termId,
      amountPaid,
      paymentMethod: 'online',
      paymentReference: reference,
      status: 'pending',
    }).returning();
    return result[0];
  }


  async deleteExamPayment(id: number): Promise<boolean> {
    const result = await this.db.delete(schema.examPayments)
      .where(eq(schema.examPayments.id, id))
      .returning();
    return result.length > 0;
  }

  // School Events / Calendar implementations

  async getSchoolEvents(filters?: { eventType?: string; startDate?: string; endDate?: string; isActive?: boolean }): Promise<SchoolEvent[]> {
    const conditions: any[] = [];
    if (filters?.eventType) conditions.push(eq(schema.schoolEvents.eventType, filters.eventType));
    if (filters?.startDate) conditions.push(gte(schema.schoolEvents.startDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(schema.schoolEvents.startDate, filters.endDate));
    if (filters?.isActive !== undefined) conditions.push(eq(schema.schoolEvents.isActive, filters.isActive));
    const query = this.db.select().from(schema.schoolEvents);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(asc(schema.schoolEvents.startDate));
    }
    return await query.orderBy(asc(schema.schoolEvents.startDate));
  }


  async getSchoolEvent(id: number): Promise<SchoolEvent | undefined> {
    const rows = await this.db.select().from(schema.schoolEvents).where(eq(schema.schoolEvents.id, id)).limit(1);
    return rows[0];
  }


  async createSchoolEvent(data: InsertSchoolEvent): Promise<SchoolEvent> {
    const result = await this.db.insert(schema.schoolEvents).values(data).returning();
    return result[0];
  }

}
