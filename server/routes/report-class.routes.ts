/** Class report cards listing endpoint (Teacher/Admin) — split from report-cards.routes.ts. */
/** Auto-split from routes.ts — report-cards (orig lines 10780-12108). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerReportClassRoutes(app: Express) {
  // Get all students in a class with their report card data (Teacher/Admin)
  app.get('/api/reports/class/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { termId } = req.query;

      if (!termId) {
        return res.status(400).json({ message: 'Term ID is required' });
      }

      const classInfo = await storage.getClass(Number(classId));
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }

      // Authorization check for teachers - verify they are assigned to this class
      if (req.user!.roleId === ROLES.TEACHER) {
        const teacherAssignments = await storage.getTeacherClassAssignments(req.user!.id);
        const isAssignedToClass = teacherAssignments.some(a => a.classId === Number(classId));
        if (!isAssignedToClass) {
          return res.status(403).json({ message: 'You are not authorized to view report cards for this class' });
        }
      }

      const students = await storage.getStudentsByClass(Number(classId));
      const term = await storage.getAcademicTerm(Number(termId));
      const exams = await storage.getExamsByClassAndTerm(Number(classId), Number(termId));

      // Get subjects that have exams for this class/term to determine class subjects
      const classSubjectIds = new Set(exams.map(e => e.subjectId));
      const allSubjects = await storage.getSubjects();
      const classSubjects = allSubjects.filter(s => classSubjectIds.has(s.id));

      const { calculateGrade, calculateWeightedScore } = await import('../grading-config');

      const studentReports: any[] = [];

      for (const student of students) {
        const user = await storage.getUser(student.id);
        if (!user) continue;

        const subjectScores: Record<number, { testScores: number[], testMax: number[], examScores: number[], examMax: number[], subjectName: string, hasData: boolean }> = {};

        // Initialize with all class subjects
        for (const subject of classSubjects) {
          subjectScores[subject.id] = {
            testScores: [],
            testMax: [],
            examScores: [],
            examMax: [],
            subjectName: subject.name,
            hasData: false
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
        const totalSubjects = Object.keys(subjectScores).length;

        for (const [subjectIdStr, scores] of Object.entries(subjectScores)) {
          const testScore = scores.testScores.reduce((a, b) => a + b, 0);
          const testMax = scores.testMax.reduce((a, b) => a + b, 0);
          const examScore = scores.examScores.reduce((a, b) => a + b, 0);
          const examMax = scores.examMax.reduce((a, b) => a + b, 0);

          // Calculate weighted score - subjects without data get 0%
          const weighted = calculateWeightedScore(testScore, testMax, examScore, examMax);
          const gradeInfo = calculateGrade(weighted.percentage);

          subjects.push({
            subjectId: Number(subjectIdStr),
            subjectName: scores.subjectName,
            testScore,
            examScore,
            percentage: weighted.percentage,
            grade: gradeInfo.grade,
            hasData: scores.hasData
          });

          // Include all subjects in total (missing data contributes 0)
          totalWeightedPercentage += weighted.percentage;
          if (scores.hasData) {
            subjectsWithData++;
          }
        }

        // Calculate average across ALL subjects (including those with 0)
        const overallPercentage = totalSubjects > 0 ? totalWeightedPercentage / totalSubjects : 0;
        const overallGradeInfo = calculateGrade(overallPercentage);

        studentReports.push({
          studentId: student.id,
          studentName: `${user.firstName} ${user.lastName}`,
          admissionNumber: student.admissionNumber,
          subjects,
          percentage: Math.round(overallPercentage * 10) / 10,
          grade: overallGradeInfo.grade,
          subjectsCount: totalSubjects,
          subjectsWithData
        });
      }

      studentReports.sort((a, b) => b.percentage - a.percentage);
      studentReports.forEach((report, index) => {
        report.position = index + 1;
        report.totalStudents = studentReports.length;
      });

      res.json({
        class: {
          id: classInfo.id,
          name: classInfo.name,
          level: classInfo.level
        },
        term: term ? {
          id: term.id,
          name: term.name,
          year: term.year
        } : null,
        students: studentReports,
        totalStudents: studentReports.length,
        totalSubjects: classSubjects.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to get class report cards' });
    }
  });
}
