/** Auto-split from storage.ts (dependency-ordered method groups). See git history. */
import { db, schema } from '../storage/helpers';
import { deleteFile } from '../cloudinary-service';
import { getPgClient, isPostgres } from '../db';
import { HomePageContent, HomepageSection, InsertHomePageContent, ReportCard, ReportCardItem, Student } from '@shared/schema.pg';
import { and, asc, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { DatabaseStorageP07 } from './part07-updateSessionProgress'
import type { IStorage } from './types'

export class DatabaseStorageP08 extends DatabaseStorageP07 {
  async getExamStudentReports(examId: number): Promise<any[]> {
    try {
      if (isPostgres) {
        const pgClient = getPgClient();
        if (!pgClient) return [];

        const result = await (db as any).execute(sql`
          SELECT
            u.id as student_id,
            u.first_name || ' ' || u.last_name as student_name,
            st.admission_number,
            COALESCE(er.marks_obtained, 0) as score,
            COALESCE(er.marks_obtained * 100.0 / e.total_marks, 0) as percentage,
            CASE
              WHEN er.marks_obtained >= e.total_marks * 0.9 THEN 'A'
              WHEN er.marks_obtained >= e.total_marks * 0.8 THEN 'B'
              WHEN er.marks_obtained >= e.total_marks * 0.7 THEN 'C'
              WHEN er.marks_obtained >= e.total_marks * 0.6 THEN 'D'
              ELSE 'F'
            END as grade,
            ROW_NUMBER() OVER (ORDER BY er.marks_obtained DESC) as rank,
            EXTRACT(EPOCH FROM (es.submitted_at - es.started_at)) as time_spent,
            es.submitted_at,
            er.auto_scored,
            CASE WHEN EXISTS (
              SELECT 1 FROM manual_scores ms
              JOIN student_answers sa ON ms.answer_id = sa.id
              WHERE sa.session_id = es.id
            ) THEN true ELSE false END as manual_scored
          FROM users u
          JOIN students st ON u.id = st.id
          JOIN exam_sessions es ON u.id = es.student_id
          JOIN exams e ON es.exam_id = e.id
          LEFT JOIN exam_results er ON e.id = er.exam_id AND u.id = er.student_id
          WHERE e.id = ${examId} AND es.is_completed = true
          ORDER BY er.marks_obtained DESC
        `);

        return (result.rows || result) as any[];
      }

      return [];
    } catch (error) {
      console.error('Error fetching exam student reports:', error);
      return [];
    }
  }


  // Home page content management

  async getHomePageContent(contentType?: string): Promise<HomePageContent[]> {
    if (contentType) {
      return await db.select().from(schema.homePageContent)
        .where(and(eq(schema.homePageContent.contentType, contentType), eq(schema.homePageContent.isActive, true)))
        .orderBy(asc(schema.homePageContent.displayOrder));
    }
    return await db.select().from(schema.homePageContent)
      .where(eq(schema.homePageContent.isActive, true))
      .orderBy(asc(schema.homePageContent.displayOrder), asc(schema.homePageContent.contentType));
  }

  async getHomePageContentById(id: number): Promise<HomePageContent | undefined> {
    const result = await db.select().from(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .limit(1);
    return result[0];
  }

  async updateHomePageContent(id: number, content: Partial<InsertHomePageContent>): Promise<HomePageContent | undefined> {
    const result = await db.update(schema.homePageContent)
      .set({ ...content, updatedAt: new Date() })
      .where(eq(schema.homePageContent.id, id))
      .returning();
    return result[0];
  }

  async deleteHomePageContent(id: number): Promise<boolean> {
    // First get the content to delete the file
    const content = await db.select({ id: schema.homePageContent.id, imageUrl: schema.homePageContent.imageUrl })
      .from(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .limit(1);

    // Delete the image file from Cloudinary/local storage
    if (content[0]?.imageUrl) {
      try {
        await deleteFile(content[0].imageUrl);
      } catch (fileError) {
        console.error(`Error deleting homepage content image for content ${id}:`, fileError);
      }
    }

    const result = await db.delete(schema.homePageContent)
      .where(eq(schema.homePageContent.id, id))
      .returning();
    return result.length > 0;
  }

  // Homepage sections management

  async getHomepageSections(): Promise<HomepageSection[]> {
    return await db.select().from(schema.homepageSections)
      .orderBy(asc(schema.homepageSections.displayOrder));
  }


  async getHomepageSection(sectionKey: string): Promise<HomepageSection | undefined> {
    const result = await db.select().from(schema.homepageSections)
      .where(eq(schema.homepageSections.sectionKey, sectionKey))
      .limit(1);
    return result[0];
  }


  async upsertHomepageSection(sectionKey: string, data: { sectionTitle?: string; isEnabled?: boolean; displayOrder?: number; content?: any; draftContent?: any; status?: string }, userId?: string): Promise<HomepageSection> {
    const existing = await this.getHomepageSection(sectionKey);
    if (existing) {
      const result = await db.update(schema.homepageSections)
        .set({ ...data, updatedAt: new Date(), updatedBy: userId || null })
        .where(eq(schema.homepageSections.sectionKey, sectionKey))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(schema.homepageSections)
        .values({ sectionKey, sectionTitle: data.sectionTitle || sectionKey, isEnabled: data.isEnabled ?? true, displayOrder: data.displayOrder ?? 0, content: data.content || null, draftContent: data.draftContent || null, status: data.status || 'published', updatedBy: userId || null })
        .returning();
      return result[0];
    }
  }


  async updateHomepageSectionsOrder(sections: { sectionKey: string; displayOrder: number }[]): Promise<void> {
    for (const s of sections) {
      await db.update(schema.homepageSections)
        .set({ displayOrder: s.displayOrder, updatedAt: new Date() })
        .where(eq(schema.homepageSections.sectionKey, s.sectionKey));
    }
  }

  // Comprehensive grade management

  async recordComprehensiveGrade(gradeData: any): Promise<any> {
    try {
      // First ensure we have a report card for this student/term
      let reportCard = await db.select()
        .from(schema.reportCards)
        .where(and(
          eq(schema.reportCards.studentId, gradeData.studentId),
          eq(schema.reportCards.termId, gradeData.termId)
        ))
        .limit(1);

      let reportCardId: number;
      if (reportCard.length === 0) {
        // Create new report card
        const newReportCard = await db.insert(schema.reportCards)
          .values({
            studentId: gradeData.studentId,
            classId: gradeData.classId || 1, // Should be provided
            termId: gradeData.termId,
            status: 'draft',
          })
          .returning();
        reportCardId = newReportCard[0].id;
      } else {
        reportCardId = reportCard[0].id;
      }
      // Check if item already exists for this report card/subject
      const existingItem = await db.select()
        .from(schema.reportCardItems)
        .where(and(
          eq(schema.reportCardItems.reportCardId, reportCardId),
          eq(schema.reportCardItems.subjectId, gradeData.subjectId)
        ))
        .limit(1);

      const comprehensiveGradeData = {
        reportCardId: reportCardId,
        subjectId: gradeData.subjectId,
        testScore: gradeData.testScore,
        testMaxScore: gradeData.testMaxScore,
        testWeightedScore: gradeData.testWeightedScore || Math.round((gradeData.testScore / gradeData.testMaxScore) * 40),
        examScore: gradeData.examScore,
        examMaxScore: gradeData.examMaxScore,
        examWeightedScore: gradeData.examWeightedScore || Math.round((gradeData.examScore / gradeData.examMaxScore) * 60),
        obtainedMarks: gradeData.testWeightedScore + gradeData.examWeightedScore || Math.round(((gradeData.testScore / gradeData.testMaxScore) * 40) + ((gradeData.examScore / gradeData.examMaxScore) * 60)),
        percentage: gradeData.percentage || Math.round(((gradeData.testScore / gradeData.testMaxScore) * 40) + ((gradeData.examScore / gradeData.examMaxScore) * 60)),
        grade: gradeData.grade,
        teacherRemarks: gradeData.teacherRemarks,
      };

      if (existingItem.length > 0) {
        // Update existing item
        const result = await db.update(schema.reportCardItems)
          .set(comprehensiveGradeData)
          .where(eq(schema.reportCardItems.id, existingItem[0].id))
          .returning();
        return result[0];
      } else {
        // Create new item
        const result = await db.insert(schema.reportCardItems)
          .values(comprehensiveGradeData)
          .onConflictDoNothing()
          .returning();
        if (result.length > 0) {
          return result[0];
        } else {
          // Conflict: re-fetch the existing row
          const existing = await db.select().from(schema.reportCardItems)
            .where(and(
              eq(schema.reportCardItems.reportCardId, comprehensiveGradeData.reportCardId),
              eq(schema.reportCardItems.subjectId, comprehensiveGradeData.subjectId)
            ))
            .limit(1);
          return existing[0];
        }
      }
    } catch (error) {
      throw error;
    }
  }


  async getComprehensiveGradesByStudent(studentId: string, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        id: schema.reportCardItems.id,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        termId: schema.reportCards.termId,
        createdAt: schema.reportCardItems.createdAt
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.reportCards.studentId, studentId));

      if (termId) {
        query = query.where(and(
          eq(schema.reportCards.studentId, studentId),
          eq(schema.reportCards.termId, termId)
        ));
      }
      return await query.orderBy(schema.subjects.name);
    } catch (error) {
      return [];
    }
  }


  async getComprehensiveGradesByClass(classId: number, termId?: number): Promise<any[]> {
    try {
      let query = db.select({
        studentId: schema.reportCards.studentId,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        admissionNumber: schema.students.admissionNumber,
        subjectName: schema.subjects.name,
        testScore: schema.reportCardItems.testScore,
        examScore: schema.reportCardItems.examScore,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        grade: schema.reportCardItems.grade,
        teacherRemarks: schema.reportCardItems.teacherRemarks
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.reportCards, eq(schema.reportCardItems.reportCardId, schema.reportCards.id))
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.students.classId, classId));

      if (termId) {
        query = query.where(and(
          eq(schema.students.classId, classId),
          eq(schema.reportCards.termId, termId)
        ));
      }
      return await query.orderBy(schema.users.firstName, schema.users.lastName, schema.subjects.name);
    } catch (error) {
      return [];
    }
  }


  async createReportCard(reportCardData: any, grades: any[]): Promise<any> {
    // NOTE: Neon HTTP driver does NOT support transactions
    try {
      // Create main report card record
      const reportCard = await this.db.insert(schema.reportCards)
        .values(reportCardData)
        .returning();

      // Link all grade items to this report card sequentially to avoid connection issues
      if (grades.length > 0) {
        for (const grade of grades) {
          await this.db.update(schema.reportCardItems)
            .set({ reportCardId: reportCard[0].id })
            .where(eq(schema.reportCardItems.id, grade.id));
        }
      }
      return {
        reportCard: reportCard[0],
        grades: grades
      };
    } catch (error) {
      throw error;
    }
  }

  async getReportCard(id: number): Promise<ReportCard | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, id))
        .limit(1);

      if (!result[0]) return undefined;

      const reportCard = result[0];

      // Dynamically fetch signatures from profiles if not stored on report card
      let teacherSignatureUrl = reportCard.teacherSignatureUrl;
      let teacherSignedBy = reportCard.teacherSignedBy;
      let principalSignatureUrl = reportCard.principalSignatureUrl;
      let principalSignedBy = reportCard.principalSignedBy;

      // Get class info to fetch class teacher's signature
      const classInfo = await this.getClass(reportCard.classId);

      // If no teacher signature stored, fetch from class teacher's profile
      if (!teacherSignatureUrl && classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        if (teacherProfile?.signatureUrl) {
          teacherSignatureUrl = teacherProfile.signatureUrl;
          // Get teacher's name
          const teacherUser = await this.getUser(classInfo.classTeacherId);
          teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
        }
      }

      // If no principal signature stored, fetch from an admin with signature
      if (!principalSignatureUrl) {
        // First, check superAdminProfiles for signatures (super admins have higher authority)
        const superAdminsWithSignature = await db.select({
          signatureUrl: schema.superAdminProfiles.signatureUrl,
          userId: schema.superAdminProfiles.userId,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          roleId: schema.users.roleId
        })
          .from(schema.superAdminProfiles)
          .innerJoin(schema.users, eq(schema.superAdminProfiles.userId, schema.users.id))
          .where(and(
            isNotNull(schema.superAdminProfiles.signatureUrl),
            ne(schema.superAdminProfiles.signatureUrl, '')
          ))
          .limit(1);

        if (superAdminsWithSignature.length > 0) {
          principalSignatureUrl = superAdminsWithSignature[0].signatureUrl;
          principalSignedBy = `${superAdminsWithSignature[0].firstName} ${superAdminsWithSignature[0].lastName}`;
        } else {
          // Fallback: check regular adminProfiles for signatures
          const adminsWithSignature = await db.select({
            signatureUrl: schema.adminProfiles.signatureUrl,
            userId: schema.adminProfiles.userId,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            roleId: schema.users.roleId
          })
            .from(schema.adminProfiles)
            .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
            .where(and(
              isNotNull(schema.adminProfiles.signatureUrl),
              ne(schema.adminProfiles.signatureUrl, '')
            ))
            .limit(1);

          if (adminsWithSignature.length > 0) {
            principalSignatureUrl = adminsWithSignature[0].signatureUrl;
            principalSignedBy = `${adminsWithSignature[0].firstName} ${adminsWithSignature[0].lastName}`;
          }
        }
      }

      return {
        ...reportCard,
        teacherSignatureUrl,
        teacherSignedBy,
        principalSignatureUrl,
        principalSignedBy
      } as ReportCard;
    } catch (error) {
      return undefined;
    }
  }


  async getReportCardsByStudentId(studentId: string): Promise<ReportCard[]> {
    try {
      return await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.studentId, studentId))
        .orderBy(desc(schema.reportCards.generatedAt));
    } catch (error) {
      return [];
    }
  }


  async getReportCardItems(reportCardId: number): Promise<ReportCardItem[]> {
    try {
      return await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCardId));
    } catch (error) {
      return [];
    }
  }


  async getReportCardItemById(itemId: number): Promise<ReportCardItem | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCardItems)
        .where(eq(schema.reportCardItems.id, itemId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting report card item by id:', error);
      return undefined;
    }
  }


  async getStudentsByParentId(parentId: string): Promise<Student[]> {
    try {
      return await db.select()
        .from(schema.students)
        .where(eq(schema.students.parentId, parentId));
    } catch (error) {
      return [];
    }
  }

  // Enhanced report card management methods

  async getReportCardsByClassAndTerm(classId: number, termId: number): Promise<any[]> {
    try {
      const results = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore,
        averagePercentage: schema.reportCards.averagePercentage,
        overallGrade: schema.reportCards.overallGrade,
        position: schema.reportCards.position,
        totalStudentsInClass: schema.reportCards.totalStudentsInClass,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
        status: schema.reportCards.status,
        gradingScale: schema.reportCards.gradingScale,
        generatedAt: schema.reportCards.generatedAt,
        finalizedAt: schema.reportCards.finalizedAt,
        publishedAt: schema.reportCards.publishedAt,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        studentUsername: schema.users.username,
        studentPhoto: schema.users.profileImageUrl,
        admissionNumber: schema.students.admissionNumber,
        department: schema.students.department,
        className: schema.classes.name,
        classLevel: schema.classes.level
      })
        .from(schema.reportCards)
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .where(and(
          eq(schema.reportCards.classId, classId),
          eq(schema.reportCards.termId, termId)
        ))
        .orderBy(schema.reportCards.position);

      return results.map((r: any) => {
        const isSSS = r.className?.startsWith('SS') || r.classLevel?.includes('Senior Secondary');
        return {
          ...r,
          isSSS,
          department: isSSS ? r.department : null
        };
      });
    } catch (error) {
      console.error('Error getting report cards by class and term:', error);
      return [];
    }
  }


  async getReportCardSkills(reportCardId: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(schema.reportCardSkills)
        .where(eq(schema.reportCardSkills.reportCardId, reportCardId))
        .limit(1);
      return result[0];
    } catch (error: any) {
      console.error('Error getting report card skills:', error);
      return undefined;
    }
  }


  async getReportCardWithItems(reportCardId: number): Promise<any> {
    try {
      const reportCard = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        classId: schema.reportCards.classId,
        termId: schema.reportCards.termId,
        totalScore: schema.reportCards.totalScore,
        averageScore: schema.reportCards.averageScore,
        averagePercentage: schema.reportCards.averagePercentage,
        overallGrade: schema.reportCards.overallGrade,
        position: schema.reportCards.position,
        totalStudentsInClass: schema.reportCards.totalStudentsInClass,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
        status: schema.reportCards.status,
        gradingScale: schema.reportCards.gradingScale,
        generatedAt: schema.reportCards.generatedAt,
        teacherSignatureUrl: schema.reportCards.teacherSignatureUrl,
        teacherSignedBy: schema.reportCards.teacherSignedBy,
        teacherSignedAt: schema.reportCards.teacherSignedAt,
        principalSignatureUrl: schema.reportCards.principalSignatureUrl,
        principalSignedBy: schema.reportCards.principalSignedBy,
        principalSignedAt: schema.reportCards.principalSignedAt,
        studentName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`.as('studentName'),
        studentUsername: schema.users.username,
        studentPhoto: schema.users.profileImageUrl,
        admissionNumber: schema.students.admissionNumber,
        department: schema.students.department,
        className: schema.classes.name,
        classLevel: schema.classes.level,
        termName: schema.academicTerms.name,
        termYear: schema.academicTerms.year
      })
        .from(schema.reportCards)
        .innerJoin(schema.students, eq(schema.reportCards.studentId, schema.students.id))
        .innerJoin(schema.users, eq(schema.students.id, schema.users.id))
        .innerJoin(schema.classes, eq(schema.reportCards.classId, schema.classes.id))
        .innerJoin(schema.academicTerms, eq(schema.reportCards.termId, schema.academicTerms.id))
        .where(eq(schema.reportCards.id, reportCardId))
        .limit(1);

      if (reportCard.length === 0) return null;

      // Add computed fields
      const isSSS = reportCard[0].className?.startsWith('SS') || reportCard[0].classLevel?.includes('Senior Secondary');
      // Use term year directly as it's stored in YYYY/YYYY format (e.g., "2024/2025")
      const academicSession = reportCard[0].termYear || '2024/2025';

      const items = await db.select({
        id: schema.reportCardItems.id,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        subjectCode: schema.subjects.code,
        testExamId: schema.reportCardItems.testExamId,
        testExamCreatedBy: schema.reportCardItems.testExamCreatedBy,
        testScore: schema.reportCardItems.testScore,
        testMaxScore: schema.reportCardItems.testMaxScore,
        testWeightedScore: schema.reportCardItems.testWeightedScore,
        examExamId: schema.reportCardItems.examExamId,
        examExamCreatedBy: schema.reportCardItems.examExamCreatedBy,
        examScore: schema.reportCardItems.examScore,
        examMaxScore: schema.reportCardItems.examMaxScore,
        examWeightedScore: schema.reportCardItems.examWeightedScore,
        totalMarks: schema.reportCardItems.totalMarks,
        obtainedMarks: schema.reportCardItems.obtainedMarks,
        percentage: schema.reportCardItems.percentage,
        grade: schema.reportCardItems.grade,
        remarks: schema.reportCardItems.remarks,
        teacherRemarks: schema.reportCardItems.teacherRemarks,
        isOverridden: schema.reportCardItems.isOverridden,
        overriddenAt: schema.reportCardItems.overriddenAt,
        overriddenBy: schema.reportCardItems.overriddenBy
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.reportCardItems.reportCardId, reportCardId))
        .orderBy(schema.subjects.name);

      // Safety net: deduplicate by subjectId, keeping the lowest-id item per subject
      const seenSubjectIds = new Set<number>();
      const deduplicatedItems = items.filter((item: { subjectId: number }) => {
        if (seenSubjectIds.has(item.subjectId)) return false;
        seenSubjectIds.add(item.subjectId);
        return true;
      });
      const uniqueItems = deduplicatedItems;

      // Dynamically fetch signatures from profiles if not stored on report card
      let teacherSignatureUrl = reportCard[0].teacherSignatureUrl;
      let teacherSignedBy = reportCard[0].teacherSignedBy;
      let principalSignatureUrl = reportCard[0].principalSignatureUrl;
      let principalSignedBy = reportCard[0].principalSignedBy;

      // Get class info to fetch class teacher's signature
      const classInfo = await this.getClass(reportCard[0].classId);

      // If no teacher signature stored, fetch from class teacher's profile
      if (!teacherSignatureUrl && classInfo?.classTeacherId) {
        const teacherProfile = await this.getTeacherProfile(classInfo.classTeacherId);
        if (teacherProfile?.signatureUrl) {
          teacherSignatureUrl = teacherProfile.signatureUrl;
          // Get teacher's name
          const teacherUser = await this.getUser(classInfo.classTeacherId);
          teacherSignedBy = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null;
        }
      }

      // If no principal signature stored, resolve from designated principal setting
      if (!principalSignatureUrl) {
        // 1. Check designated principal in system settings
        const [sysSettings] = await db.select().from(schema.systemSettings).limit(1);
        const designatedId = (sysSettings as any)?.designatedPrincipalId as string | null | undefined;
        if (designatedId) {
          const [adminProfile] = await db.select({
            signatureUrl: schema.adminProfiles.signatureUrl,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
          })
            .from(schema.adminProfiles)
            .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
            .where(eq(schema.adminProfiles.userId, designatedId))
            .limit(1);
          if (adminProfile) {
            principalSignatureUrl = adminProfile.signatureUrl || null;
            principalSignedBy = `${adminProfile.firstName} ${adminProfile.lastName}`;
          }
        }

        // 2. Fallback: first admin with a signature
        if (!principalSignatureUrl) {
          const [adminWithSig] = await db.select({
            signatureUrl: schema.adminProfiles.signatureUrl,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
          })
            .from(schema.adminProfiles)
            .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
            .where(and(
              isNotNull(schema.adminProfiles.signatureUrl),
              ne(schema.adminProfiles.signatureUrl, '')
            ))
            .limit(1);
          if (adminWithSig) {
            principalSignatureUrl = adminWithSig.signatureUrl;
            principalSignedBy = `${adminWithSig.firstName} ${adminWithSig.lastName}`;
          }
        }
      }

      // Load skills from database
      const skills = await this.getReportCardSkills(reportCardId);

      return {
        ...reportCard[0],
        isSSS: isSSS,
        academicSession: academicSession,
        department: isSSS ? reportCard[0].department : null,
        teacherSignatureUrl,
        teacherSignedBy,
        principalSignatureUrl,
        principalSignedBy,
        items: uniqueItems,
        affectiveTraits: {
          punctuality: skills?.punctuality || 0,
          neatness: skills?.neatness || 0,
          attentiveness: skills?.attentiveness || 0,
          teamwork: skills?.teamwork || 0,
          leadership: skills?.leadership || 0,
          assignments: skills?.assignments || 0,
          classParticipation: skills?.classParticipation || 0,
          honesty: skills?.honesty || 0,
          politeness: skills?.politeness || 0,
          selfControl: skills?.selfControl || 0,
          obedience: skills?.obedience || 0,
          reliability: skills?.reliability || 0,
          senseOfResponsibility: skills?.senseOfResponsibility || 0,
          relationshipWithOthers: skills?.relationshipWithOthers || 0
        },
        psychomotorSkills: {
          sports: skills?.sports || 0,
          handwriting: skills?.handwriting || 0,
          musicalSkills: skills?.musicalSkills || 0,
          creativity: skills?.creativity || 0,
          handlingOfTools: skills?.handlingOfTools || 0,
          drawingPainting: skills?.drawingPainting || 0,
          publicSpeaking: skills?.publicSpeaking || 0,
          speechFluency: skills?.speechFluency || 0
        }
      };
    } catch (error) {
      console.error('Error getting report card with items:', error);
      return null;
    }
  }

}
