/** Storage layer: users, roles, password-reset tokens.
 *  Chain: DatabaseStorageUsers → extends into user-lifecycle-management.ts */
import { db, normalizeUuid, schema } from '../storage/helpers';
import { deleteFile } from '../cloudinary-service';
import { SmartDeletionManager, SmartDeletionResult, bulkDeleteUsers, cleanupOrphanRecords } from '../services/smart-deletion-manager';
import { AuditLog, Exam, InsertAuditLog, InsertUser, Student, User } from '@shared/schema.pg';
import { randomUUID } from 'crypto';
import { and, eq, ilike, inArray, or, sql as dsql } from 'drizzle-orm';
import type { IStorage } from './types'

export class DatabaseStorageUsers {
  public db: any;


  constructor() {
    // Use the centralized database instance from db.ts
    this.db = db;
    if (!this.db) {
      throw new Error('Database not available - DATABASE_URL not set or invalid');
    }
  }

  // User management

  async getUser(id: string): Promise<User | undefined> {
    // Only select columns that exist in the current database schema
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      recoveryEmail: schema.users.recoveryEmail,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      nationalId: schema.users.nationalId,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(eq(schema.users.id, id)).limit(1);

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Only select columns that exist in the current database schema
    const result = await this.db.select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      recoveryEmail: schema.users.recoveryEmail,
      passwordHash: schema.users.passwordHash,
      mustChangePassword: schema.users.mustChangePassword,
      roleId: schema.users.roleId,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      address: schema.users.address,
      dateOfBirth: schema.users.dateOfBirth,
      gender: schema.users.gender,
      nationalId: schema.users.nationalId,
      profileImageUrl: schema.users.profileImageUrl,
      isActive: schema.users.isActive,
      authProvider: schema.users.authProvider,
      googleId: schema.users.googleId,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    }).from(schema.users).where(ilike(schema.users.email, email)).limit(1);

    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(schema.users).where(ilike(schema.users.username, username)).limit(1);
    const user = result[0];
    if (user && user.id) {
      const normalizedId = normalizeUuid(user.id);
      if (normalizedId) {
        user.id = normalizedId;
      }
    }
    return user;
  }


  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    // Try UUID first
    if (normalizeUuid(identifier)) {
      const user = await this.getUser(identifier);
      if (user) return user;
    }

    // Try Username
    const userByUsername = await this.getUserByUsername(identifier);
    if (userByUsername) return userByUsername;

    // Try Email
    const userByEmail = await this.getUserByEmail(identifier);
    if (userByEmail) return userByEmail;

    // Try Admission Number (Student)
    const [student] = await this.db.select()
      .from(schema.students)
      .where(ilike(schema.students.admissionNumber, identifier))
      .limit(1);
    
    if (student) {
      return await this.getUser(student.id);
    }

    // Try Staff ID (Teacher)
    const [teacher] = await this.db.select()
      .from(schema.teacherProfiles)
      .where(ilike(schema.teacherProfiles.staffId, identifier))
      .limit(1);
    
    if (teacher) {
      return await this.getUser(teacher.userId);
    }

    return undefined;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date, ipAddress?: string, resetBy?: string): Promise<any> {
    const result = await this.db.insert(schema.passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      ipAddress,
      resetBy,
    }).returning();
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<any | undefined> {
    const result = await this.db.select()
      .from(schema.passwordResetTokens)
      .where(and(
        eq(schema.passwordResetTokens.token, token),
        dsql`${schema.passwordResetTokens.expiresAt} > NOW()`,
        dsql`${schema.passwordResetTokens.usedAt} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const result = await this.db.update(schema.passwordResetTokens)
      .set({ usedAt: dsql`NOW()` })
      .where(eq(schema.passwordResetTokens.token, token))
      .returning();
    return result.length > 0;
  }

  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    await this.db.delete(schema.passwordResetTokens)
      .where(dsql`${schema.passwordResetTokens.expiresAt} < NOW()`);
    return true;
  }

  async createUser(user: InsertUser): Promise<User> {
    // PostgreSQL requires explicit UUID for varchar primary key
    // Auto-generate if not provided to ensure consistency across all user creation paths
    const userWithId = {
      ...user,
      id: (user as any).id || randomUUID(),
    };

    const result = await this.db.insert(schema.users).values(userWithId).returning();
    const createdUser = result[0];
    if (createdUser && createdUser.id) {
      const normalizedId = normalizeUuid(createdUser.id);
      if (normalizedId) {
        createdUser.id = normalizedId;
      }
    }
    return createdUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const result = await this.db.update(schema.users).set(user).where(eq(schema.users.id, id)).returning();
      const updatedUser = result[0];
      if (updatedUser && updatedUser.id) {
        const normalizedId = normalizeUuid(updatedUser.id);
        if (normalizedId) {
          updatedUser.id = normalizedId;
        }
      }
      return updatedUser;
    } catch (error: any) {
      // Handle missing column errors by filtering out non-existent fields
      if (error?.cause?.code === '42703') {
        const missingColumn = error?.cause?.message?.match(/column "(\w+)" does not exist/)?.[1];

        // Remove the problematic field and retry
        const { [missingColumn]: removed, ...safeUser } = user as any;

        // If we removed the field, retry the update
        if (Object.keys(safeUser).length > 0) {
          const result = await this.db.update(schema.users).set(safeUser).where(eq(schema.users.id, id)).returning();
          const updatedUser = result[0];
          if (updatedUser && updatedUser.id) {
            const normalizedId = normalizeUuid(updatedUser.id);
            if (normalizedId) {
              updatedUser.id = normalizedId;
            }
          }
          return updatedUser;
        }
      }
      throw error;
    }
  }


  async deleteUser(id: string, performedBy?: string): Promise<boolean> {
    try {
      const smartDeletionManager = new SmartDeletionManager();
      const result = await smartDeletionManager.deleteUser(id, performedBy);
      return result.success;
    } catch (error: any) {
      console.error('[Storage] Smart deletion failed:', error.message);
      return false;
    }
  }


  async deleteUserWithDetails(id: string, performedBy?: string): Promise<SmartDeletionResult> {
    const smartDeletionManager = new SmartDeletionManager();
    return await smartDeletionManager.deleteUser(id, performedBy);
  }


  async validateDeletion(id: string): Promise<{ canDelete: boolean; reason?: string; affectedRecords?: any[] }> {
    const smartDeletionManager = new SmartDeletionManager();
    return await smartDeletionManager.validateDeletion(id);
  }


  async cleanupOrphanRecords(): Promise<{ tableName: string; deletedCount: number }[]> {
    return await cleanupOrphanRecords();
  }


  async bulkDeleteUsers(userIds: string[], performedBy?: string): Promise<{ successful: string[]; failed: { userId: string; error: string }[] }> {
    return await bulkDeleteUsers(userIds, performedBy);
  }


  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await this.db.insert(schema.auditLogs).values(log).returning();
    return result[0];
  }

  async deleteExam(id: number): Promise<{
    success: boolean;
    deletedCounts: {
      questions: number;
      questionOptions: number;
      sessions: number;
      studentAnswers: number;
      results: number;
      gradingTasks: number;
      performanceEvents: number;
      filesDeleted: number;
      reportCardRefsCleared: number;
    };
  }> {
    const deletedCounts = {
      questions: 0,
      questionOptions: 0,
      sessions: 0,
      studentAnswers: 0,
      results: 0,
      gradingTasks: 0,
      performanceEvents: 0,
      filesDeleted: 0,
      reportCardRefsCleared: 0
    };

    try {
      console.log(`[SmartDeletion] Starting comprehensive exam deletion for exam ID: ${id}`);

      // First get all question IDs and image URLs for this exam
      const examQuestions = await db.select({
        id: schema.examQuestions.id,
        imageUrl: schema.examQuestions.imageUrl
      })
        .from(schema.examQuestions)
        .where(eq(schema.examQuestions.examId, id));

      const questionIds = examQuestions.map((q: { id: number }) => q.id);
      deletedCounts.questions = questionIds.length;

      // Delete question images from Cloudinary/local storage
      for (const question of examQuestions) {
        if (question.imageUrl) {
          try {
            const deleted = await deleteFile(question.imageUrl);
            if (deleted) deletedCounts.filesDeleted++;
          } catch (fileError) {
            console.error(`[SmartDeletion] Error deleting question image for question ${question.id}:`, fileError);
          }
        }
      }

      // Get all question option images for these questions
      let optionCount = 0;
      if (questionIds.length > 0) {
        try {
          const questionOptions = await db.select({
            id: schema.questionOptions.id,
            imageUrl: schema.questionOptions.imageUrl
          })
            .from(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds));

          optionCount = questionOptions.length;

          // Delete question option images from Cloudinary/local storage
          for (const option of questionOptions) {
            if (option.imageUrl) {
              try {
                const deleted = await deleteFile(option.imageUrl);
                if (deleted) deletedCounts.filesDeleted++;
              } catch (fileError) {
                console.error(`[SmartDeletion] Error deleting option image for option ${option.id}:`, fileError);
              }
            }
          }
        } catch (e) {
          // imageUrl column might not exist in question_options - get count without imageUrl
          const optionCountResult = await db.select({ id: schema.questionOptions.id })
            .from(schema.questionOptions)
            .where(inArray(schema.questionOptions.questionId, questionIds));
          optionCount = optionCountResult.length;
        }
      }
      deletedCounts.questionOptions = optionCount;

      // Get all session IDs for this exam (needed for cascading deletes)
      const examSessions = await db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.examId, id));

      const sessionIds = examSessions.map((s: { id: number }) => s.id);
      deletedCounts.sessions = sessionIds.length;

      // Delete in order respecting foreign key constraints
      if (sessionIds.length > 0) {
        // Delete grading tasks for these sessions
        const gradingTasksResult = await db.delete(schema.gradingTasks)
          .where(inArray(schema.gradingTasks.sessionId, sessionIds))
          .returning();
        deletedCounts.gradingTasks = gradingTasksResult.length;

        // Delete performance events for these sessions  
        const perfEventsResult = await db.delete(schema.performanceEvents)
          .where(inArray(schema.performanceEvents.sessionId, sessionIds))
          .returning();
        deletedCounts.performanceEvents = perfEventsResult.length;

        // Delete student answers by session
        const answersResult = await db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds))
          .returning();
        deletedCounts.studentAnswers = answersResult.length;
      }

      if (questionIds.length > 0) {
        // Delete any remaining student answers by question (fallback)
        const remainingAnswers = await db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.questionId, questionIds))
          .returning();
        deletedCounts.studentAnswers += remainingAnswers.length;

        // Delete question options for all questions in this exam  
        await db.delete(schema.questionOptions)
          .where(inArray(schema.questionOptions.questionId, questionIds));

        // Delete exam questions
        await db.delete(schema.examQuestions)
          .where(eq(schema.examQuestions.examId, id));
      }

      // Delete exam results
      const resultsResult = await db.delete(schema.examResults)
        .where(eq(schema.examResults.examId, id))
        .returning();
      deletedCounts.results = resultsResult.length;

      // Delete exam sessions (after their dependent records are gone)
      await db.delete(schema.examSessions)
        .where(eq(schema.examSessions.examId, id));

      // Clear exam references from report card items (set to NULL instead of deleting)
      // This preserves historical report card data while removing the exam link
      const testExamRefs = await db.update(schema.reportCardItems)
        .set({ testExamId: null })
        .where(eq(schema.reportCardItems.testExamId, id))
        .returning();

      const examExamRefs = await db.update(schema.reportCardItems)
        .set({ examExamId: null })
        .where(eq(schema.reportCardItems.examExamId, id))
        .returning();

      deletedCounts.reportCardRefsCleared = testExamRefs.length + examExamRefs.length;

      // Delete archived submissions for this exam (FK: exam_submissions_archive_exam_id_exams_id_fk)
      await db.delete(schema.examSubmissionsArchive)
        .where(eq(schema.examSubmissionsArchive.examId, id));

      // Finally delete the exam itself
      const result = await db.delete(schema.exams)
        .where(eq(schema.exams.id, id))
        .returning();

      const success = result.length > 0;

      console.log(`[SmartDeletion] Exam ${id} deletion complete:`, {
        success,
        deletedCounts
      });

      return { success, deletedCounts };
    } catch (error) {
      console.error('[SmartDeletion] Error deleting exam:', error);
      throw error;
    }
  }

}
