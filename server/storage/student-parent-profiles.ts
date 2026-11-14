/** Storage layer: student + parent profiles, profile completion, linked students.
 *  Chain: DatabaseStorageStudentParentProfiles → extends into attendance-exams.ts */
import { db, normalizeUuid, schema } from '../storage/helpers';
import { getPgPool } from '../db';
import { AcademicSession, AcademicTerm, Attendance, Class, Exam, InsertAcademicSession, InsertAttendance, InsertClass, InsertParentProfile, InsertStudent, InsertSubject, InsertUser, ParentProfile, Role, Student, Subject, User } from '@shared/schema.pg';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { DatabaseStorageUserLifecycle } from './user-lifecycle-management'
import type { IStorage } from './types'

export class DatabaseStorageStudentParentProfiles extends DatabaseStorageUserLifecycle {
  async createParentProfile(profile: InsertParentProfile): Promise<ParentProfile> {
    const result = await this.db.insert(schema.parentProfiles)
      .values(profile)
      .returning();
    return result[0];
  }

  async updateParentProfile(userId: string, profile: Partial<InsertParentProfile>): Promise<ParentProfile | undefined> {
    const result = await this.db.update(schema.parentProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.parentProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const result = await this.db
      .select({
        // Student fields
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        department: schema.students.department,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        emergencyPhone: schema.students.emergencyPhone,
        medicalInfo: schema.students.medicalInfo,
        guardianName: schema.students.guardianName,
        createdAt: schema.students.createdAt,
        // User fields (merged into student object)
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        address: schema.users.address,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        profileImageUrl: schema.users.profileImageUrl,
        recoveryEmail: schema.users.recoveryEmail,
        // Class name (from classes table)
        className: schema.classes.name,
      })
      .from(schema.students)
      .leftJoin(schema.users, eq(schema.students.id, schema.users.id))
      .leftJoin(schema.classes, eq(schema.students.classId, schema.classes.id))
      .where(eq(schema.students.id, id))
      .limit(1);

    const student = result[0];
    if (student && student.id) {
      const normalizedId = normalizeUuid(student.id);
      if (normalizedId) {
        student.id = normalizedId;
      }
    }
    return student as any;
  }

  // Batch-fetch students (with merged user fields) by id list to avoid N+1 queries
  // in endpoints that enrich a list of exam results with student names.

  async calculateProfileCompletion(userId: string, roleId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) return 0;

    const requiredFields = [
      'firstName', 'lastName', 'email', 'phone', 'address',
      'dateOfBirth', 'gender', 'profileImageUrl', 'state', 'country',
      'securityQuestion', 'securityAnswerHash', 'dataPolicyAgreed'
    ];

    let completedFields = 0;
    requiredFields.forEach(field => {
      if (user[field as keyof User]) {
        completedFields++;
      }
    });

    // Check role-specific profile completion
    // Role IDs: 1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent
    if (roleId === 1) { // Super Admin
      const superAdminProfile = await this.getSuperAdminProfile(userId);
      if (superAdminProfile?.department) completedFields++;
      if (superAdminProfile?.accessLevel) completedFields++;
      if (superAdminProfile?.twoFactorEnabled !== undefined) completedFields++;
    } else if (roleId === 2) { // Admin
      const adminProfile = await this.getAdminProfile(userId);
      if (adminProfile?.department) completedFields++;
      if (adminProfile?.roleDescription) completedFields++;
      if (adminProfile?.accessLevel) completedFields++;
    } else if (roleId === 3) { // Teacher
      const teacherProfile = await this.getTeacherProfile(userId);
      if (teacherProfile?.subjects && teacherProfile.subjects.length > 0) completedFields++;
      if (teacherProfile?.assignedClasses && teacherProfile.assignedClasses.length > 0) completedFields++;
      if (teacherProfile?.qualification) completedFields++;
      if (teacherProfile?.yearsOfExperience) completedFields++;
    } else if (roleId === 4) { // Student
      const student = await this.getStudent(userId);
      if (student?.classId) completedFields++;
      if (student?.guardianName) completedFields++;
      if (student?.emergencyContact) completedFields++;
    } else if (roleId === 5) { // Parent
      const parentProfile = await this.getParentProfile(userId);
      if (parentProfile?.occupation) completedFields++;
      if (parentProfile?.contactPreference) completedFields++;
      if (parentProfile?.linkedStudents && parentProfile.linkedStudents.length > 0) completedFields++;
    }
    const totalFields = requiredFields.length + 3; // 3 role-specific fields on average
    return Math.round((completedFields / totalFields) * 100);
  }
  // Student management

  async getStudentsByIds(ids: string[]): Promise<Map<string, any>> {
    const map = new Map<string, any>();
    if (ids.length === 0) return map;
    const uniqueIds = Array.from(new Set(ids));
    const result = await this.db
      .select({
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        username: schema.users.username,
      })
      .from(schema.students)
      .leftJoin(schema.users, eq(schema.students.id, schema.users.id))
      .where(inArray(schema.students.id, uniqueIds));

    for (const row of result) {
      const normalizedId = normalizeUuid(row.id) || row.id;
      map.set(normalizedId, row);
    }
    return map;
  }


  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    return this.getStudent(userId);
  }


  async getLinkedStudents(parentId: string): Promise<Student[]> {
    const result = await this.db
      .select({
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        department: schema.students.department,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        emergencyPhone: schema.students.emergencyPhone,
        medicalInfo: schema.students.medicalInfo,
        guardianName: schema.students.guardianName,
        createdAt: schema.students.createdAt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        address: schema.users.address,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        profileImageUrl: schema.users.profileImageUrl,
        className: schema.classes.name,
      })
      .from(schema.students)
      .leftJoin(schema.users, eq(schema.students.id, schema.users.id))
      .leftJoin(schema.classes, eq(schema.students.classId, schema.classes.id))
      .where(eq(schema.students.parentId, parentId));

    return result.map((student: any) => {
      if (student && student.id) {
        const normalizedId = normalizeUuid(student.id);
        if (normalizedId) {
          student.id = normalizedId;
        }
      }
      return student;
    }) as any[];
  }


  async getAllUsernames(): Promise<string[]> {
    const result = await this.db.select({ username: schema.users.username }).from(schema.users).where(sql`${schema.users.username} IS NOT NULL`);
    return result.map((r: { username: string | null }) => r.username).filter((u: string | null): u is string => u !== null);
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const result = await db.insert(schema.students).values(student).returning();
    return result[0];
  }

  async updateStudent(id: string, updates: { userPatch?: Partial<InsertUser>; studentPatch?: Partial<InsertStudent> }): Promise<{ user: User; student: Student } | undefined> {
    // NOTE: Neon HTTP driver does NOT support transactions
    // Using direct operations instead
    try {
      let updatedUser: User | undefined;
      let updatedStudent: Student | undefined;

      // Update user if userPatch is provided
      if (updates.userPatch && Object.keys(updates.userPatch).length > 0) {
        const userResult = await this.db.update(schema.users)
          .set(updates.userPatch)
          .where(eq(schema.users.id, id))
          .returning();
        updatedUser = userResult[0];
      } else {
        // Get current user data if no updates
        const userResult = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
        updatedUser = userResult[0];
      }
      // Update student if studentPatch is provided
      if (updates.studentPatch && Object.keys(updates.studentPatch).length > 0) {
        const studentResult = await this.db.update(schema.students)
          .set(updates.studentPatch)
          .where(eq(schema.students.id, id))
          .returning();
        updatedStudent = studentResult[0];
      } else {
        // Get current student data if no updates
        const studentResult = await this.db.select().from(schema.students).where(eq(schema.students.id, id)).limit(1);
        updatedStudent = studentResult[0];
      }
      if (updatedUser && updatedStudent) {
        return { user: updatedUser, student: updatedStudent };
      }
      return undefined;
    } catch (error) {
      throw error;
    }
  }

  async setUserActive(id: string, isActive: boolean): Promise<User | undefined> {
    const result = await this.db.update(schema.users)
      .set({ isActive })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async deleteStudent(id: string, deletedBy?: string): Promise<boolean> {
    // Soft deletion by setting user as inactive and recording deletion timestamp
    // This preserves referential integrity for attendance, exams, etc.
    // User can be recovered within retention period
    const result = await this.db.update(schema.users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: deletedBy || null
      })
      .where(eq(schema.users.id, id))
      .returning();
    return result.length > 0;
  }

  async hardDeleteStudent(id: string): Promise<boolean> {
    // Hard deletion with proper cascade handling
    // Delete in correct order to respect foreign key constraints
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // 1. Get all exam sessions for this student
      const examSessions = await this.db.select({ id: schema.examSessions.id })
        .from(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));

      const sessionIds = examSessions.map((session: any) => session.id);

      // 2. Delete student answers for all their exam sessions
      if (sessionIds.length > 0) {
        await this.db.delete(schema.studentAnswers)
          .where(inArray(schema.studentAnswers.sessionId, sessionIds));
      }
      // 3. Delete exam sessions for this student
      await this.db.delete(schema.examSessions)
        .where(eq(schema.examSessions.studentId, id));

      // 4. Delete exam results for this student
      await this.db.delete(schema.examResults)
        .where(eq(schema.examResults.studentId, id));

      // 5. Delete attendance records for this student
      await this.db.delete(schema.attendance)
        .where(eq(schema.attendance.studentId, id));

      // 6. Delete the student record
      await this.db.delete(schema.students)
        .where(eq(schema.students.id, id));

      // 7. Delete the user record
      const userResult = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning();

      return userResult.length > 0;
    } catch (error) {
      throw error;
    }
  }

  async getStudentsByClass(classId: number): Promise<Student[]> {
    // Return all students in class regardless of active status for admin management
    return await db.select().from(schema.students).where(eq(schema.students.classId, classId));
  }

  async getAllStudents(includeInactive = false): Promise<Student[]> {
    if (includeInactive) {
      // Return all students regardless of active status
      return await this.db.select().from(schema.students).orderBy(asc(schema.students.createdAt));
    } else {
      // Only return students with active user accounts
      // (graduated/withdrawn accounts are preserved but hidden from active lists)
      return await this.db.select({
        id: schema.students.id,
        admissionNumber: schema.students.admissionNumber,
        classId: schema.students.classId,
        parentId: schema.students.parentId,
        admissionDate: schema.students.admissionDate,
        emergencyContact: schema.students.emergencyContact,
        emergencyPhone: schema.students.emergencyPhone,
        medicalInfo: schema.students.medicalInfo,
        createdAt: schema.students.createdAt,
      })
        .from(schema.students)
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .where(and(
          eq(schema.users.isActive, true),
          ne(schema.users.status, 'graduated'),
          ne(schema.users.status, 'withdrawn'),
        ))
        .orderBy(asc(schema.students.createdAt));
    }
  }


  async getStudentByAdmissionNumber(admissionNumber: string): Promise<Student | undefined> {
    const result = await db.select().from(schema.students).where(eq(schema.students.admissionNumber, admissionNumber)).limit(1);
    return result[0];
  }
  // Class management

  async getClasses(): Promise<Class[]> {
    return await db.select().from(schema.classes).where(eq(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
  }

  async getAllClasses(includeInactive = false): Promise<Class[]> {
    if (includeInactive) {
      return await db.select().from(schema.classes).orderBy(asc(schema.classes.name));
    } else {
      return await db.select().from(schema.classes).where(eq(schema.classes.isActive, true)).orderBy(asc(schema.classes.name));
    }
  }


  async getClass(id: number): Promise<Class | undefined> {
    const result = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
    return result[0];
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const result = await db.insert(schema.classes).values(classData).returning();
    return result[0];
  }

  async updateClass(id: number, classData: Partial<InsertClass>): Promise<Class | undefined> {
    const result = await db.update(schema.classes).set(classData).where(eq(schema.classes.id, id)).returning();
    return result[0];
  }

  async deleteClass(id: number): Promise<boolean> {
    const result = await db.delete(schema.classes).where(eq(schema.classes.id, id));
    return result.length > 0;
  }
  // Subject management

  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name));
  }


  async getActiveSubjects(): Promise<Subject[]> {
    return await db.select().from(schema.subjects)
      .where(eq(schema.subjects.isActive, true))
      .orderBy(asc(schema.subjects.name));
  }


  async getSubject(id: number): Promise<Subject | undefined> {
    const result = await db.select().from(schema.subjects).where(eq(schema.subjects.id, id)).limit(1);
    return result[0];
  }

  async createSubject(subject: InsertSubject): Promise<Subject> {
    const result = await db.insert(schema.subjects).values(subject).returning();
    return result[0];
  }

  async updateSubject(id: number, subject: Partial<InsertSubject>): Promise<Subject | undefined> {
    const result = await db.update(schema.subjects).set(subject).where(eq(schema.subjects.id, id)).returning();
    return result[0];
  }


  async archiveSubject(id: number, userId: string): Promise<Subject | undefined> {
    const subject = await this.getSubject(id);
    if (!subject) return undefined;
    const result = await db.update(schema.subjects)
      .set({ status: 'archived', isActive: false })
      .where(eq(schema.subjects.id, id))
      .returning();
    if (result[0]) {
      try {
        await this.createAuditLog({
          userId,
          action: 'subject.archived',
          entityType: 'subject',
          entityId: String(id),
          oldValue: JSON.stringify({ name: subject.name, status: subject.status ?? 'active' }),
          newValue: JSON.stringify({ name: result[0].name, status: 'archived' }),
        });
      } catch (e) { /* audit log failure must not block the operation */ }
    }
    return result[0];
  }


  async restoreSubject(id: number, userId: string): Promise<Subject | undefined> {
    const subject = await this.getSubject(id);
    if (!subject) return undefined;
    const result = await db.update(schema.subjects)
      .set({ status: 'active', isActive: true })
      .where(eq(schema.subjects.id, id))
      .returning();
    if (result[0]) {
      try {
        await this.createAuditLog({
          userId,
          action: 'subject.restored',
          entityType: 'subject',
          entityId: String(id),
          oldValue: JSON.stringify({ name: subject.name, status: 'archived' }),
          newValue: JSON.stringify({ name: result[0].name, status: 'active' }),
        });
      } catch (e) { /* audit log failure must not block the operation */ }
    }
    return result[0];
  }


  async getSubjectAudit(id: number): Promise<{
    classLinks: number;
    studentAssignments: number;
    exams: number;
    assignments: number;
    lessonNotes: number;
    syllabusTopics: number;
    questionBanks: number;
    reportCardItems: number;
    continuousAssessments: number;
    timetableEntries: number;
    studyResources: number;
    teacherAssignments: number;
    isClean: boolean;
  }> {
    const [
      classLinks, studentAssignments, exams, assignments,
      lessonNotes, syllabusTopics, questionBanks, reportCardItems,
      continuousAssessments, timetableEntries, studyResources, teacherAssignments,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(schema.classSubjectMappings).where(eq(schema.classSubjectMappings.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.studentSubjectAssignments).where(eq(schema.studentSubjectAssignments.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.exams).where(eq(schema.exams.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.assignments).where(eq(schema.assignments.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.lessonNotes).where(eq(schema.lessonNotes.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.syllabusTopics).where(eq(schema.syllabusTopics.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.questionBanks).where(eq(schema.questionBanks.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.reportCardItems).where(eq(schema.reportCardItems.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.continuousAssessment).where(eq(schema.continuousAssessment.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.timetable).where(eq(schema.timetable.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.studyResources).where(eq(schema.studyResources.subjectId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.teacherClassAssignments).where(eq(schema.teacherClassAssignments.subjectId, id)),
    ]);

    const counts = {
      classLinks: classLinks[0]?.count ?? 0,
      studentAssignments: studentAssignments[0]?.count ?? 0,
      exams: exams[0]?.count ?? 0,
      assignments: assignments[0]?.count ?? 0,
      lessonNotes: lessonNotes[0]?.count ?? 0,
      syllabusTopics: syllabusTopics[0]?.count ?? 0,
      questionBanks: questionBanks[0]?.count ?? 0,
      reportCardItems: reportCardItems[0]?.count ?? 0,
      continuousAssessments: continuousAssessments[0]?.count ?? 0,
      timetableEntries: timetableEntries[0]?.count ?? 0,
      studyResources: studyResources[0]?.count ?? 0,
      teacherAssignments: teacherAssignments[0]?.count ?? 0,
    };

    const isClean = Object.values(counts).every(v => v === 0);
    return { ...counts, isClean };
  }


  async deleteSubject(id: number, userId?: string): Promise<boolean> {
    // Safety check: only allow deletion when there are zero linked records.
    // Admins must archive, reassign, or remove linked data first.
    const audit = await this.getSubjectAudit(id);
    if (!audit.isClean) {
      throw new Error('SUBJECT_HAS_LINKED_RECORDS');
    }

    const subject = await this.getSubject(id);

    const pool = getPgPool();
    if (!pool) throw new Error('No database pool available');
    const run = (q: string) => pool.query(q, [id]);

    // Null out nullable FKs to preserve audit trail
    await run(`UPDATE school_lesson_notes SET subject_id = NULL WHERE subject_id = $1`);
    await run(`UPDATE unauthorized_access_logs SET subject_id = NULL WHERE subject_id = $1`);

    // Delete grading_boundaries (subject-specific boundaries that may exist even if isClean)
    await run(`DELETE FROM grading_boundaries WHERE subject_id = $1`);

    // Delete the subject
    await run(`DELETE FROM subjects WHERE id = $1`);

    if (userId && subject) {
      try {
        await this.createAuditLog({
          userId,
          action: 'subject.deleted',
          entityType: 'subject',
          entityId: String(id),
          oldValue: JSON.stringify({ name: subject.name, status: subject.status ?? 'active', category: subject.category }),
        });
      } catch (e) { /* audit log failure must not block the operation */ }
    }
    return true;
  }
  // Academic sessions

  async getAcademicSessions(): Promise<AcademicSession[]> {
    return db.select().from(schema.academicSessions).orderBy(desc(schema.academicSessions.startDate));
  }


  async getAcademicSession(id: number): Promise<AcademicSession | undefined> {
    const result = await db.select().from(schema.academicSessions).where(eq(schema.academicSessions.id, id)).limit(1);
    return result[0];
  }


  async getActiveAcademicSession(): Promise<AcademicSession | undefined> {
    const result = await db.select().from(schema.academicSessions).where(eq(schema.academicSessions.isCurrent, true)).limit(1);
    return result[0];
  }


  async createAcademicSession(session: InsertAcademicSession): Promise<AcademicSession> {
    const result = await db.insert(schema.academicSessions).values(session).returning();
    return result[0];
  }


  async updateAcademicSession(id: number, session: Partial<InsertAcademicSession>): Promise<AcademicSession | undefined> {
    const result = await db.update(schema.academicSessions).set(session).where(eq(schema.academicSessions.id, id)).returning();
    return result[0];
  }


  async deleteAcademicSession(id: number): Promise<boolean> {
    const result = await db.delete(schema.academicSessions).where(eq(schema.academicSessions.id, id)).returning();
    return result.length > 0;
  }


  async markSessionAsCurrent(id: number): Promise<AcademicSession | undefined> {
    await db.update(schema.academicSessions).set({ isCurrent: false });
    const result = await db.update(schema.academicSessions).set({ isCurrent: true, status: 'active' }).where(eq(schema.academicSessions.id, id)).returning();
    return result[0];
  }

  // Academic terms

  async getCurrentTerm(): Promise<AcademicTerm | undefined> {
    const result = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.isCurrent, true)).limit(1);
    return result[0];
  }

  async getTerms(): Promise<AcademicTerm[]> {
    return await db.select().from(schema.academicTerms).orderBy(asc(schema.academicTerms.startDate));
  }

  async getAcademicTerms(): Promise<AcademicTerm[]> {
    try {
      const terms = await db.select().from(schema.academicTerms).orderBy(asc(schema.academicTerms.startDate));
      return terms;
    } catch (error) {
      throw error;
    }
  }


  async getAcademicTerm(id: number): Promise<AcademicTerm | undefined> {
    try {
      const result = await db.select().from(schema.academicTerms).where(eq(schema.academicTerms.id, id)).limit(1);
      return result[0];
    } catch (error) {
      throw error;
    }
  }


  async createAcademicTerm(term: any): Promise<AcademicTerm> {
    try {
      const result = await db.insert(schema.academicTerms).values(term).returning();
      return result[0];
    } catch (error) {
      throw error;
    }
  }


  async updateAcademicTerm(id: number, term: any): Promise<AcademicTerm | undefined> {
    try {
      const result = await db.update(schema.academicTerms).set(term).where(eq(schema.academicTerms.id, id)).returning();
      if (result[0]) {
      }
      return result[0];
    } catch (error) {
      throw error;
    }
  }


  async deleteAcademicTerm(id: number): Promise<boolean> {
    try {

      // First check if the term exists
      const existingTerm = await db.select().from(schema.academicTerms)
        .where(eq(schema.academicTerms.id, id))
        .limit(1);

      if (!existingTerm || existingTerm.length === 0) {
        return false;
      }

      // Check for foreign key constraints — collect what's linked to this term
      const linkedTables: Array<[any, string]> = [
        [schema.exams, 'exam(s)'],
        [schema.reportCards, 'report card(s)'],
        [schema.lessonNotes, 'lesson note(s)'],
        [schema.timetable, 'timetable entr(ies)'],
        [schema.assignments, 'assignment(s)'],
        [schema.continuousAssessment, 'continuous assessment record(s)'],
      ];
      const linked: string[] = [];
      for (const [table, label] of linkedTables) {
        try {
          const rows = await db.select({ id: table.id })
            .from(table)
            .where(eq(table.termId, id))
            .limit(1);
          if (rows && rows.length > 0) linked.push(label);
        } catch {
          // Table has no termId column — skip
        }
      }

      if (linked.length > 0) {
        throw new Error(`Cannot delete this term. It is still linked to: ${linked.join(', ')}. Reassign or delete those records first, or archive the term instead.`);
      }
      // Perform the deletion with returning clause for verification
      const result = await db.delete(schema.academicTerms)
        .where(eq(schema.academicTerms.id, id))
        .returning();

      const success = result && result.length > 0;

      if (success) {
      } else {
      }
      return success;
    } catch (error: any) {

      // Handle specific PostgreSQL errors
      if (error?.code === '23503') {
        throw new Error('Cannot delete this term because other records still reference it. Remove those associations first, or archive the term instead.');
      }
      throw error;
    }
  }


  async markTermAsCurrent(id: number): Promise<AcademicTerm | undefined> {
    try {
      // First, set all terms to not current
      await db.update(schema.academicTerms).set({ isCurrent: false });
      // Then mark the specified term as current
      const result = await db.update(schema.academicTerms).set({ isCurrent: true }).where(eq(schema.academicTerms.id, id)).returning();
      if (result[0]) {
      }
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  // Helper method to check if a term is being used

  async getExamsByTerm(termId: number): Promise<Exam[]> {
    try {
      const result = await db.select().from(schema.exams).where(eq(schema.exams.termId, termId));
      return result;
    } catch (error) {
      return [];
    }
  }

  // Attendance management

  async recordAttendance(attendance: InsertAttendance): Promise<Attendance> {
    const existing = await db.select()
      .from(schema.attendance)
      .where(and(
        eq(schema.attendance.studentId, attendance.studentId),
        eq(schema.attendance.classId, attendance.classId),
        eq(schema.attendance.date, attendance.date),
      ))
      .limit(1);

    if (existing.length > 0) {
      const result = await db.update(schema.attendance)
        .set({ status: attendance.status, notes: attendance.notes ?? null, recordedBy: attendance.recordedBy ?? null })
        .where(eq(schema.attendance.id, existing[0].id))
        .returning();
      return result[0];
    }

    const result = await db.insert(schema.attendance).values(attendance).returning();
    return result[0];
  }

  async getAttendanceByStudent(studentId: string, date?: string): Promise<Attendance[]> {
    if (date) {
      return await db.select().from(schema.attendance)
        .where(and(eq(schema.attendance.studentId, studentId), eq(schema.attendance.date, date)));
    }
    return await db.select().from(schema.attendance)
      .where(eq(schema.attendance.studentId, studentId))
      .orderBy(desc(schema.attendance.date));
  }
}
