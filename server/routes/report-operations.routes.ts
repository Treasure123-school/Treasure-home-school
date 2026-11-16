/** Report generation, update, fetch, parent view, class generation — split from report-cards.routes.ts. */
/** Auto-split from routes.ts — report-cards (orig lines 10780-12108). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerReportOperationsRoutes(app: Express) {
  // Generate/Update report card for a student (Teacher/Admin)
  app.post('/api/reports/generate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { studentId, termId, teacherRemarks, status } = req.body;

      if (!studentId || !termId) {
        return res.status(400).json({ message: 'Student ID and Term ID are required' });
      }

      const student = await storage.getStudent(studentId);
      if (!student || !student.classId) {
        return res.status(404).json({ message: 'Student not found or not assigned to a class' });
      }

      // Authorization check for teachers
      if (req.user!.roleId === ROLES.TEACHER) {
        const teacherAssignments = await storage.getTeacherClassAssignments(req.user!.id);
        const isAssignedToClass = teacherAssignments.some(a => a.classId === student.classId);
        if (!isAssignedToClass) {
          return res.status(403).json({ message: 'You are not authorized to generate report cards for students in this class' });
        }
      }

      const { calculateGrade, calculateWeightedScore } = await import('../grading-config');

      const exams = await storage.getExamsByClassAndTerm(student.classId, termId);
      const allSubjects = await storage.getSubjects();

      const reportCardData = {
        studentId,
        classId: student.classId,
        termId,
        teacherRemarks: teacherRemarks || null,
        status: status || 'draft',
        generatedBy: req.user!.id,
        generatedAt: new Date()
      };

      const subjectScores: Record<number, { testScores: number[], testMax: number[], examScores: number[], examMax: number[] }> = {};

      for (const exam of exams) {
        if (!subjectScores[exam.subjectId!]) {
          subjectScores[exam.subjectId!] = { testScores: [], testMax: [], examScores: [], examMax: [] };
        }

        const result = await storage.getExamResultByExamAndStudent(exam.id, studentId);
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
        const testScore = scores.testScores.reduce((a, b) => a + b, 0);
        const testMax = scores.testMax.reduce((a, b) => a + b, 0);
        const examScore = scores.examScores.reduce((a, b) => a + b, 0);
        const examMax = scores.examMax.reduce((a, b) => a + b, 0);

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

      const existingReportCard = await db.select()
        .from(schema.reportCards)
        .where(
          and(
            eq(schema.reportCards.studentId, studentId),
            eq(schema.reportCards.termId, termId)
          )
        )
        .limit(1);

      let reportCard;
      if (existingReportCard.length > 0) {
        [reportCard] = await db.update(schema.reportCards)
          .set({
            ...reportCardData,
            totalScore,
            averageScore,
            updatedAt: new Date()
          })
          .where(eq(schema.reportCards.id, existingReportCard[0].id))
          .returning();

        await db.delete(schema.reportCardItems)
          .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
      } else {
        // Race-safe: unique index on (student_id, term_id); on conflict, update
        // the card a concurrent sync already created instead of failing.
        const inserted = await db.insert(schema.reportCards)
          .values({
            ...reportCardData,
            totalScore,
            averageScore
          })
          .onConflictDoNothing({ target: [schema.reportCards.studentId, schema.reportCards.termId] })
          .returning();
        if (inserted.length > 0) {
          reportCard = inserted[0];
        } else {
          const winner = await db.select()
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.studentId, studentId),
              eq(schema.reportCards.termId, termId)
            ))
            .limit(1);
          if (winner.length === 0) {
            throw new Error('Report card conflict but no existing card found');
          }
          [reportCard] = await db.update(schema.reportCards)
            .set({
              ...reportCardData,
              totalScore,
              averageScore,
              updatedAt: new Date()
            })
            .where(eq(schema.reportCards.id, winner[0].id))
            .returning();
          await db.delete(schema.reportCardItems)
            .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
        }
      }

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

      const reportCardResult = {
        message: 'Report card generated successfully',
        reportCard: {
          id: reportCard.id,
          studentId,
          termId,
          totalScore,
          averageScore,
          status: reportCard.status,
          gradesCount: grades.length
        }
      };

      // Emit realtime event for report card generation
      const operation = existingReportCard.length > 0 ? 'UPDATE' : 'INSERT';
      realtimeService.emitTableChange('report_cards', operation, reportCard, existingReportCard[0] || undefined, req.user!.id);
      realtimeService.emitReportCardEvent(reportCard.id, 'updated', {
        reportCardId: reportCard.id,
        studentId,
        classId: student.classId
      });

      res.json(reportCardResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate report card' });
    }
  });

  // Update report card remarks/status (Teacher/Admin)
  app.put('/api/reports/:reportCardId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { teacherRemarks, principalRemarks, status } = req.body;

      // Get existing report card for realtime event
      const [existingReportCard] = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, Number(reportCardId)))
        .limit(1);

      const [updatedReportCard] = await db.update(schema.reportCards)
        .set({
          teacherRemarks,
          principalRemarks,
          status,
          updatedAt: new Date()
        })
        .where(eq(schema.reportCards.id, Number(reportCardId)))
        .returning();

      if (!updatedReportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Emit realtime event for report card update
      realtimeService.emitTableChange('report_cards', 'UPDATE', updatedReportCard, existingReportCard, req.user!.id);
      realtimeService.emitReportCardEvent(Number(reportCardId), 'updated', {
        reportCardId: Number(reportCardId),
        studentId: updatedReportCard.studentId,
        classId: updatedReportCard.classId
      });

      res.json(updatedReportCard);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update report card' });
    }
  });

  // Get report card by ID with items
  app.get('/api/reports/:reportCardId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;

      const [reportCard] = await db.select()
        .from(schema.reportCards)
        .where(eq(schema.reportCards.id, Number(reportCardId)))
        .limit(1);

      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const items = await db.select({
        id: schema.reportCardItems.id,
        subjectId: schema.reportCardItems.subjectId,
        subjectName: schema.subjects.name,
        score: schema.reportCardItems.obtainedMarks,
        maxScore: schema.reportCardItems.totalMarks,
        grade: schema.reportCardItems.grade,
        remarks: schema.reportCardItems.remarks
      })
        .from(schema.reportCardItems)
        .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
        .where(eq(schema.reportCardItems.reportCardId, Number(reportCardId)));

      const student = await storage.getStudent(reportCard.studentId);
      const user = student ? await storage.getUser(student.id) : null;
      const classInfo = reportCard.classId ? await storage.getClass(reportCard.classId) : null;
      const term = await storage.getAcademicTerm(reportCard.termId);

      res.json({
        ...reportCard,
        student: user ? {
          id: student?.id,
          name: `${user.firstName} ${user.lastName}`,
          admissionNumber: student?.admissionNumber
        } : null,
        class: classInfo ? {
          id: classInfo.id,
          name: classInfo.name,
          level: classInfo.level
        } : null,
        term: term ? {
          id: term.id,
          name: term.name,
          year: term.year
        } : null,
        items
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get report card' });
    }
  });

  // Get report cards for parent (view children's report cards)
  app.get('/api/reports/parent/:parentId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;
      const { termId } = req.query;

      if (req.user!.id !== parentId && req.user!.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'You can only view your own children\'s report cards' });
      }

      const children = await storage.getStudentsByParentId(parentId);

      const reports: any[] = [];
      for (const child of children) {
        const user = await storage.getUser(child.id);
        if (!user) continue;

        // Only show PUBLISHED report cards to parents (not draft or finalized)
        let reportCards;
        if (termId) {
          reportCards = await db.select()
            .from(schema.reportCards)
            .where(
              and(
                eq(schema.reportCards.studentId, child.id),
                eq(schema.reportCards.termId, Number(termId)),
                eq(schema.reportCards.status, 'published')
              )
            );
        } else {
          reportCards = await db.select()
            .from(schema.reportCards)
            .where(
              and(
                eq(schema.reportCards.studentId, child.id),
                eq(schema.reportCards.status, 'published')
              )
            )
            .orderBy(schema.reportCards.createdAt);
        }

        reports.push({
          student: {
            id: child.id,
            name: `${user.firstName} ${user.lastName}`,
            admissionNumber: child.admissionNumber,
            classId: child.classId
          },
          reportCards
        });
      }

      res.json(reports);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get children\'s report cards' });
    }
  });

  // Bulk generate report cards for a class (Admin only) - FALLBACK for edge cases
  // NOTE: Report cards are normally auto-generated when students complete exams
  // This route is a fallback for administrative purposes or data recovery
  app.post('/api/reports/generate-class/:classId', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { termId, status } = req.body;

      if (!termId) {
        return res.status(400).json({ message: 'Term ID is required' });
      }

      const students = await storage.getStudentsByClass(Number(classId));
      const { calculateGrade, calculateWeightedScore } = await import('../grading-config');
      const exams = await storage.getExamsByClassAndTerm(Number(classId), termId);

      const results: any[] = [];
      const errors: any[] = [];

      for (const student of students) {
        try {
          const subjectScores: Record<number, { testScores: number[], testMax: number[], examScores: number[], examMax: number[] }> = {};

          for (const exam of exams) {
            if (!subjectScores[exam.subjectId!]) {
              subjectScores[exam.subjectId!] = { testScores: [], testMax: [], examScores: [], examMax: [] };
            }

            const result = await storage.getExamResultByExamAndStudent(exam.id, student.id);
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
            const testScore = scores.testScores.reduce((a, b) => a + b, 0);
            const testMax = scores.testMax.reduce((a, b) => a + b, 0);
            const examScore = scores.examScores.reduce((a, b) => a + b, 0);
            const examMax = scores.examMax.reduce((a, b) => a + b, 0);

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

          const existingReportCard = await db.select()
            .from(schema.reportCards)
            .where(
              and(
                eq(schema.reportCards.studentId, student.id),
                eq(schema.reportCards.termId, termId)
              )
            )
            .limit(1);

          let reportCard;
          if (existingReportCard.length > 0) {
            [reportCard] = await db.update(schema.reportCards)
              .set({
                totalScore,
                averageScore,
                status: status || 'draft',
                generatedBy: req.user!.id,
                generatedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(schema.reportCards.id, existingReportCard[0].id))
              .returning();

            await db.delete(schema.reportCardItems)
              .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
          } else {
            // Race-safe: unique index on (student_id, term_id); on conflict, update
            // the card a concurrent sync already created instead of failing.
            const inserted = await db.insert(schema.reportCards)
              .values({
                studentId: student.id,
                classId: Number(classId),
                termId,
                totalScore,
                averageScore,
                status: status || 'draft',
                generatedBy: req.user!.id,
                generatedAt: new Date()
              })
              .onConflictDoNothing({ target: [schema.reportCards.studentId, schema.reportCards.termId] })
              .returning();
            if (inserted.length > 0) {
              reportCard = inserted[0];
            } else {
              const winner = await db.select()
                .from(schema.reportCards)
                .where(
                  and(
                    eq(schema.reportCards.studentId, student.id),
                    eq(schema.reportCards.termId, termId)
                  )
                )
                .limit(1);
              if (winner.length === 0) {
                throw new Error(`Report card for student ${student.id}, term ${termId} vanished after conflict`);
              }
              [reportCard] = await db.update(schema.reportCards)
                .set({
                  totalScore,
                  averageScore,
                  status: status || 'draft',
                  generatedBy: req.user!.id,
                  generatedAt: new Date(),
                  updatedAt: new Date()
                })
                .where(eq(schema.reportCards.id, winner[0].id))
                .returning();
              await db.delete(schema.reportCardItems)
                .where(eq(schema.reportCardItems.reportCardId, reportCard.id));
            }
          }

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

          results.push({
            studentId: student.id,
            reportCardId: reportCard.id,
            averageScore,
            gradesCount: grades.length
          });
        } catch (err: any) {
          errors.push({
            studentId: student.id,
            error: err.message
          });
        }
      }

      res.json({
        message: `Generated ${results.length} report cards`,
        success: results,
        errors,
        totalStudents: students.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate class report cards' });
    }
  });
}
