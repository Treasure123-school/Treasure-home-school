/**
 * Report Cards Service
 * Business logic for report card operations
 * Handles generation, calculation, status management, and retrieval
 */
import { db, storage } from '../../storage';
import * as schema from '@shared/schema.pg';
import { and, eq, inArray, desc, sql } from 'drizzle-orm';
import { realtimeService } from '../../realtime-service';

export class ReportCardsService {
  /**
   * Get grading configuration with active DB scale
   */
  async getGradingConfig() {
    const { getActiveGradingConfig } = await import('../../grade-scale-service');
    const systemSettings = await storage.getSystemSettings();
    const activeConfig = await getActiveGradingConfig();
    
    const scales = await db.select({ name: schema.gradeScales.name })
      .from(schema.gradeScales);

    return {
      currentConfig: {
        ...activeConfig,
        testWeight: systemSettings?.testWeight ?? 40,
        examWeight: systemSettings?.examWeight ?? 60,
      },
      availableScales: scales.map((s: any) => s.name),
      dbSettings: {
        testWeight: systemSettings?.testWeight ?? 40,
        examWeight: systemSettings?.examWeight ?? 60,
        defaultGradingScale: activeConfig.name,
      }
    };
  }

  /**
   * Update grading settings (test/exam weights, grading scale)
   */
  async updateGradingSettings(data: {
    testWeight?: number;
    examWeight?: number;
    defaultGradingScale?: string;
    updatedBy: string;
  }) {
    // Validate weights
    if (data.testWeight !== undefined && data.examWeight !== undefined) {
      if (data.testWeight + data.examWeight !== 100) {
        throw { statusCode: 400, message: 'Test weight and exam weight must sum to 100%' };
      }
      if (data.testWeight < 0 || data.testWeight > 100 || data.examWeight < 0 || data.examWeight > 100) {
        throw { statusCode: 400, message: 'Weights must be between 0 and 100' };
      }
    }

    const updateData: any = { updatedBy: data.updatedBy };
    if (data.testWeight !== undefined) updateData.testWeight = data.testWeight;
    if (data.examWeight !== undefined) updateData.examWeight = data.examWeight;
    if (data.defaultGradingScale !== undefined) updateData.defaultGradingScale = data.defaultGradingScale;

    const settings = await storage.updateSystemSettings(updateData);

    // Audit log
    await storage.createAuditLog({
      userId: data.updatedBy,
      action: 'grading_settings_updated',
      entityType: 'system_settings',
      entityId: String(settings.id),
      reason: `Grading settings updated: Test ${settings.testWeight}%, Exam ${settings.examWeight}%`,
    });

    // Emit realtime event
    realtimeService.emitGradingSettingsEvent('updated', {
      testWeight: settings.testWeight,
      examWeight: settings.examWeight,
      gradingScale: settings.defaultGradingScale,
    }, data.updatedBy);

    return {
      testWeight: settings.testWeight,
      examWeight: settings.examWeight,
      defaultGradingScale: settings.defaultGradingScale
    };
  }

  /**
   * Get positioning method setting
   */
  async getPositioningMethod() {
    const settings = await storage.getSystemSettings();
    return settings?.positioningMethod || 'average';
  }

  /**
   * Update positioning method (average vs total)
   */
  async updatePositioningMethod(positioningMethod: string, updatedBy: string) {
    if (!['average', 'total'].includes(positioningMethod)) {
      throw { statusCode: 400, message: 'Invalid positioning method. Must be "average" or "total".' };
    }

    const settings = await storage.updateSystemSettings({ positioningMethod, updatedBy });

    await storage.createAuditLog({
      userId: updatedBy,
      action: 'positioning_method_updated',
      entityType: 'system_settings',
      entityId: String(settings.id),
      reason: `Class position calculation method changed to: ${positioningMethod}`,
    });

    return settings.positioningMethod;
  }

  /**
   * Get student report card with full details
   * Handles authorization, published vs draft, calculations
   */
  async getStudentReportCard(studentId: string, termId: number, userId: string, roleId: number) {
    const ROLES = (await import('@shared/role-constants')).ROLE_IDS;
    
    const student = await storage.getStudent(studentId);
    if (!student) throw { statusCode: 404, message: 'Student not found' };
    if (!student.classId) throw { statusCode: 400, message: 'Student not assigned to a class' };

    // Authorization checks
    await this.checkReportCardAuthorization(studentId, student.classId, userId, roleId);

    // Check for published report card
    const publishedReportCard = await db.select()
      .from(schema.reportCards)
      .where(and(
        eq(schema.reportCards.studentId, studentId),
        eq(schema.reportCards.termId, termId)
      ))
      .limit(1);

    // Students/parents require published status
    if (roleId === ROLES.STUDENT || roleId === ROLES.PARENT) {
      if (!publishedReportCard.length || publishedReportCard[0].status !== 'published') {
        throw {
          statusCode: 404,
          message: 'Report card not yet published. Please check back later.',
          status: 'not_published'
        };
      }
    }

    const user = await storage.getUser(studentId);
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const studentClass = await storage.getClass(student.classId);
    const term = await storage.getAcademicTerm(termId);

    // If published report exists, return stored data
    if (publishedReportCard.length > 0) {
      return await this.formatPublishedReportCard(publishedReportCard[0], student, user, studentClass, term);
    }

    // Otherwise calculate from exam results (draft mode for teachers/admins)
    return await this.calculateDraftReportCard(studentId, student, user, studentClass, term, termId);
  }

  /**
   * Get all report cards for a class
   */
  async getClassReportCards(classId: number, termId: number, userId: string, roleId: number) {
    const ROLES = (await import('@shared/role-constants')).ROLE_IDS;
    
    const classInfo = await storage.getClass(classId);
    if (!classInfo) throw { statusCode: 404, message: 'Class not found' };

    // Authorization for teachers
    if (roleId === ROLES.TEACHER) {
      const teacherAssignments = await storage.getTeacherClassAssignments(userId);
      const isAssignedToClass = teacherAssignments.some(a => a.classId === classId);
      if (!isAssignedToClass) {
        throw { statusCode: 403, message: 'You are not authorized to view report cards for this class' };
      }
    }

    const students = await storage.getStudentsByClass(classId);
    const term = await storage.getAcademicTerm(termId);
    const exams = await storage.getExamsByClassAndTerm(classId, termId);

    const classSubjectIds = new Set(exams.map(e => e.subjectId));
    const allSubjects = await storage.getSubjects();
    const classSubjects = allSubjects.filter(s => classSubjectIds.has(s.id));

    const { calculateGrade, calculateWeightedScore } = await import('../../grading-config');
    const studentReports: any[] = [];

    for (const student of students) {
      const user = await storage.getUser(student.id);
      if (!user) continue;

      const subjectScores: Record<number, any> = {};

      for (const subject of classSubjects) {
        subjectScores[subject.id] = {
          testScores: [], testMax: [], examScores: [], examMax: [],
          subjectName: subject.name, hasData: false
        };
      }

      for (const exam of exams) {
        if (!subjectScores[exam.subjectId!]) continue;
        const result = await storage.getExamResultByExamAndStudent(exam.id, student.id);
        if (result && result.marksObtained !== null) {
          subjectScores[exam.subjectId!].hasData = true;
          if (exam.examType === 'test' || exam.examType === 'quiz') {
            subjectScores[exam.subjectId!].testScores.push(result.marksObtained);
            subjectScores[exam.subjectId!].testMax.push(exam.totalMarks);
          } else {
            subjectScores[exam.subjectId!].examScores.push(result.marksObtained);
            subjectScores[exam.subjectId!].examMax.push(exam.totalMarks);
          }
        }
      }

      const subjects: any[] = [];
      let totalWeightedPercentage = 0;
      let subjectsWithData = 0;

      for (const [subjectIdStr, scores] of Object.entries(subjectScores)) {
        const testScore = scores.testScores.reduce((a: number, b: number) => a + b, 0);
        const testMax = scores.testMax.reduce((a: number, b: number) => a + b, 0);
        const examScore = scores.examScores.reduce((a: number, b: number) => a + b, 0);
        const examMax = scores.examMax.reduce((a: number, b: number) => a + b, 0);

        const weighted = calculateWeightedScore(testScore, testMax, examScore, examMax);
        const gradeInfo = calculateGrade(weighted.percentage);

        subjects.push({
          subjectId: Number(subjectIdStr),
          subjectName: scores.subjectName,
          testScore, examScore,
          percentage: weighted.percentage,
          grade: gradeInfo.grade,
          hasData: scores.hasData
        });

        totalWeightedPercentage += weighted.percentage;
        if (scores.hasData) subjectsWithData++;
      }

      const overallPercentage = subjects.length > 0 ? totalWeightedPercentage / subjects.length : 0;
      const overallGradeInfo = calculateGrade(overallPercentage);

      studentReports.push({
        studentId: student.id,
        studentName: `${user.firstName} ${user.lastName}`,
        admissionNumber: student.admissionNumber,
        subjects,
        percentage: Math.round(overallPercentage * 10) / 10,
        grade: overallGradeInfo.grade,
        subjectsCount: subjects.length,
        subjectsWithData
      });
    }

    // Calculate positions
    studentReports.sort((a, b) => b.percentage - a.percentage);
    studentReports.forEach((report, index) => {
      report.position = index + 1;
      report.totalStudents = studentReports.length;
    });

    return {
      class: { id: classInfo.id, name: classInfo.name, level: classInfo.level },
      term: term ? { id: term.id, name: term.name, year: term.year } : null,
      students: studentReports,
      totalStudents: studentReports.length,
      totalSubjects: classSubjects.length
    };
  }

  /**
   * Generate or update report card for a student
   */
  async generateReportCard(data: {
    studentId: string;
    termId: number;
    teacherRemarks?: string;
    status?: string;
    generatedBy: string;
  }) {
    const student = await storage.getStudent(data.studentId);
    if (!student || !student.classId) {
      throw { statusCode: 404, message: 'Student not found or not assigned to a class' };
    }

    const { calculateGrade, calculateWeightedScore } = await import('../../grading-config');
    const exams = await storage.getExamsByClassAndTerm(student.classId, data.termId);
    const allSubjects = await storage.getSubjects();

    const reportCardData = {
      studentId: data.studentId,
      classId: student.classId,
      termId: data.termId,
      teacherRemarks: data.teacherRemarks || null,
      status: data.status || 'draft',
      generatedBy: data.generatedBy,
      generatedAt: new Date()
    };

    const subjectScores: Record<number, any> = {};

    for (const exam of exams) {
      if (!subjectScores[exam.subjectId!]) {
        subjectScores[exam.subjectId!] = { testScores: [], testMax: [], examScores: [], examMax: [] };
      }

      const result = await storage.getExamResultByExamAndStudent(exam.id, data.studentId);
      if (result && result.marksObtained !== null) {
        if (exam.examType === 'test' || exam.examType === 'quiz') {
          subjectScores[exam.subjectId!].testScores.push(result.marksObtained);
          subjectScores[exam.subjectId!].testMax.push(exam.totalMarks);
        } else {
          subjectScores[exam.subjectId!].examScores.push(result.marksObtained);
          subjectScores[exam.subjectId!].examMax.push(exam.totalMarks);
        }
      }
    }

    const grades: any[] = [];
    let totalScore = 0;
    let subjectCount = 0;

    for (const [subjectIdStr, scores] of Object.entries(subjectScores)) {
      if (scores.testScores.length === 0 && scores.examScores.length === 0) continue;

      const subjectId = Number(subjectIdStr);
      const testScore = scores.testScores.reduce((a: number, b: number) => a + b, 0);
      const testMax = scores.testMax.reduce((a: number, b: number) => a + b, 0);
      const examScore = scores.examScores.reduce((a: number, b: number) => a + b, 0);
      const examMax = scores.examMax.reduce((a: number, b: number) => a + b, 0);

      const weighted = calculateWeightedScore(testScore, testMax, examScore, examMax);
      const gradeInfo = calculateGrade(weighted.percentage);

      grades.push({
        subjectId,
        score: Math.round(weighted.weightedScore),
        maxScore: 100,
        grade: gradeInfo.grade,
        remarks: gradeInfo.remarks
      });

      totalScore += weighted.percentage;
      subjectCount++;
    }

    const averageScore = subjectCount > 0 ? Math.round(totalScore / subjectCount) : 0;

    // Check if report card exists
    const existingReportCard = await db.select()
      .from(schema.reportCards)
      .where(and(
        eq(schema.reportCards.studentId, data.studentId),
        eq(schema.reportCards.termId, data.termId)
      ))
      .limit(1);

    let reportCard;
    if (existingReportCard.length > 0) {
      [reportCard] = await db.update(schema.reportCards)
        .set({ ...reportCardData, totalScore, averageScore, updatedAt: new Date() })
        .where(eq(schema.reportCards.id, existingReportCard[0].id))
        .returning();

      await db.delete(schema.reportCardItems)
        .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
    } else {
      // Race-safe: unique index on (student_id, term_id); on conflict, update
      // the card a concurrent sync already created instead of failing.
      const inserted = await db.insert(schema.reportCards)
        .values({ ...reportCardData, totalScore, averageScore })
        .onConflictDoNothing({ target: [schema.reportCards.studentId, schema.reportCards.termId] })
        .returning();
      if (inserted.length > 0) {
        reportCard = inserted[0];
      } else {
        const winner = await db.select()
          .from(schema.reportCards)
          .where(and(
            eq(schema.reportCards.studentId, data.studentId),
            eq(schema.reportCards.termId, data.termId)
          ))
          .limit(1);
        if (winner.length === 0) {
          throw { statusCode: 500, message: 'Report card conflict but no existing card found' };
        }
        [reportCard] = await db.update(schema.reportCards)
          .set({ ...reportCardData, totalScore, averageScore, updatedAt: new Date() })
          .where(eq(schema.reportCards.id, winner[0].id))
          .returning();
        await db.delete(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
      }
    }

    // Insert report card items
    for (const grade of grades) {
      await db.insert(schema.reportCardItems)
        .values({
          reportCardId: reportCard.id,
          subjectId: grade.subjectId,
          score: grade.score,
          maxScore: grade.maxScore,
          grade: grade.grade,
          remarks: grade.remarks
        });
    }

    // Emit realtime event
    const operation = existingReportCard.length > 0 ? 'UPDATE' : 'INSERT';
    realtimeService.emitTableChange('report_cards', operation, reportCard, existingReportCard[0], data.generatedBy);
    realtimeService.emitReportCardEvent(reportCard.id, 'updated', {
      reportCardId: reportCard.id,
      studentId: data.studentId,
      classId: student.classId
    });

    return {
      id: reportCard.id,
      studentId: data.studentId,
      termId: data.termId,
      totalScore,
      averageScore,
      status: reportCard.status,
      gradesCount: grades.length
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async checkReportCardAuthorization(studentId: string, classId: number, userId: string, roleId: number) {
    const ROLES = (await import('@shared/role-constants')).ROLE_IDS;

    if (roleId === ROLES.STUDENT) {
      if (userId !== studentId) {
        throw { statusCode: 403, message: 'You can only view your own report card' };
      }
    } else if (roleId === ROLES.PARENT) {
      const children = await storage.getStudentsByParentId(userId);
      if (!children.some(c => c.id === studentId)) {
        throw { statusCode: 403, message: 'You can only view your children\'s report cards' };
      }
    } else if (roleId === ROLES.TEACHER) {
      const teacherAssignments = await storage.getTeacherClassAssignments(userId);
      const isAssignedToClass = teacherAssignments.some(a => a.classId === classId);
      if (!isAssignedToClass) {
        throw { statusCode: 403, message: 'You are not authorized to view report cards for students in this class' };
      }
    }
  }

  private async formatPublishedReportCard(dbReportCard: any, student: any, user: any, studentClass: any, term: any) {
    // Implementation continues... (formatting logic from routes)
    // This is a placeholder - full implementation will be in next iteration
    return { /* formatted report card */ };
  }

  private async calculateDraftReportCard(studentId: string, student: any, user: any, studentClass: any, term: any, termId: number) {
    // Implementation continues... (draft calculation logic from routes)
    // This is a placeholder - full implementation will be in next iteration
    return { /* calculated report card */ };
  }
}
