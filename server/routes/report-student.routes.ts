/** Student report card endpoint (comprehensive single-student report) — split from report-cards.routes.ts. */
/** Auto-split from routes.ts — report-cards (orig lines 10780-12108). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerReportStudentRoutes(app: Express) {
  // Get student report card for a specific term
  app.get('/api/reports/student-report-card/:studentId', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const { termId } = req.query;

      if (!termId) {
        return res.status(400).json({ message: 'Term ID is required' });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      if (!student.classId) {
        return res.status(400).json({ message: 'Student not assigned to a class' });
      }

      // Authorization: Students can only view their own, parents can view their children's
      // Teachers can only view students in their assigned classes
      if (req.user!.roleId === ROLES.STUDENT) {
        if (req.user!.id !== studentId) {
          return res.status(403).json({ message: 'You can only view your own report card' });
        }
      } else if (req.user!.roleId === ROLES.PARENT) {
        const children = await storage.getStudentsByParentId(req.user!.id);
        if (!children.some(c => c.id === studentId)) {
          return res.status(403).json({ message: 'You can only view your children\'s report cards' });
        }
      } else if (req.user!.roleId === ROLES.TEACHER) {
        const teacherAssignments = await storage.getTeacherClassAssignments(req.user!.id);
        const isAssignedToClass = teacherAssignments.some(a => a.classId === student.classId);
        if (!isAssignedToClass) {
          return res.status(403).json({ message: 'You are not authorized to view report cards for students in this class' });
        }
      }
      // Admin and Super Admin can view any student's report card

      // Check for published report card in the database
      const publishedReportCard = await db.select()
        .from(schema.reportCards)
        .where(
          and(
            eq(schema.reportCards.studentId, studentId),
            eq(schema.reportCards.termId, Number(termId))
          )
        )
        .limit(1);

      // For students and parents, require published status
      if (req.user!.roleId === ROLES.STUDENT || req.user!.roleId === ROLES.PARENT) {
        if (!publishedReportCard.length || publishedReportCard[0].status !== 'published') {
          return res.status(404).json({
            message: 'Report card not yet published. Please check back later.',
            status: 'not_published'
          });
        }
      }

      const user = await storage.getUser(studentId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const studentClass = await storage.getClass(student.classId);
      const term = await storage.getAcademicTerm(Number(termId));

      // If we have a published report card, use the stored data with all computed fields
      if (publishedReportCard.length > 0) {
        const dbReportCard = publishedReportCard[0];

        // Fetch report card items (subjects) from the database
        const reportCardItems = await db.select({
          id: schema.reportCardItems.id,
          subjectId: schema.reportCardItems.subjectId,
          subjectName: schema.subjects.name,
          testScore: schema.reportCardItems.testScore,
          testMaxScore: schema.reportCardItems.testMaxScore,
          testWeightedScore: schema.reportCardItems.testWeightedScore,
          examScore: schema.reportCardItems.examScore,
          examMaxScore: schema.reportCardItems.examMaxScore,
          examWeightedScore: schema.reportCardItems.examWeightedScore,
          totalMarks: schema.reportCardItems.totalMarks,
          obtainedMarks: schema.reportCardItems.obtainedMarks,
          percentage: schema.reportCardItems.percentage,
          grade: schema.reportCardItems.grade,
          remarks: schema.reportCardItems.remarks,
          teacherRemarks: schema.reportCardItems.teacherRemarks
        })
          .from(schema.reportCardItems)
          .innerJoin(schema.subjects, eq(schema.reportCardItems.subjectId, schema.subjects.id))
          .where(eq(schema.reportCardItems.reportCardId, dbReportCard.id))
          .orderBy(schema.subjects.name);

        // Fetch skills from database
        const savedSkills = await storage.getReportCardSkills(dbReportCard.id);

        // Get class statistics for this term (highest, lowest, average scores)
        const classReportCards = await db.select({
          id: schema.reportCards.id,
          studentId: schema.reportCards.studentId,
          totalScore: schema.reportCards.totalScore,
          averagePercentage: schema.reportCards.averagePercentage,
          averageScore: schema.reportCards.averageScore
        })
          .from(schema.reportCards)
          .where(
            and(
              eq(schema.reportCards.classId, student.classId!),
              eq(schema.reportCards.termId, Number(termId))
            )
          );

        // Calculate class statistics - use stored averagePercentage if valid, otherwise compute from items
        const totalStudentsInClass = dbReportCard.totalStudentsInClass || classReportCards.length;

        // First try to use stored averagePercentage values (filter out null and 0)
        let validScores = classReportCards
          .filter((r: { averagePercentage: number | null }) => r.averagePercentage !== null && r.averagePercentage > 0)
          .map((r: { averagePercentage: number | null }) => r.averagePercentage as number);

        // If stored values are all 0/null, compute fresh from report card items for each student
        if (validScores.length === 0 && classReportCards.length > 0) {
          console.log(`[REPORT-CARD] Computing class statistics dynamically for class ${student.classId}, term ${termId}`);
          const computedScores: number[] = [];

          for (const rc of classReportCards) {
            // Get items for this report card and compute average
            const items = await db.select({
              obtainedMarks: schema.reportCardItems.obtainedMarks,
              totalMarks: schema.reportCardItems.totalMarks
            })
              .from(schema.reportCardItems)
              .where(eq(schema.reportCardItems.reportCardId, rc.id));

            if (items.length > 0) {
              const totalObt = items.reduce((sum: number, i: any) => sum + (i.obtainedMarks || 0), 0);
              const totalMax = items.reduce((sum: number, i: any) => sum + (i.totalMarks || 100), 0);
              if (totalMax > 0) {
                const pct = (totalObt / totalMax) * 100;
                if (pct > 0) {
                  computedScores.push(pct);
                }
              }
            }
          }

          if (computedScores.length > 0) {
            validScores = computedScores;
          }
        }

        const classHighest = validScores.length > 0 ? Math.max(...validScores) : 0;
        const classLowest = validScores.length > 0 ? Math.min(...validScores) : 0;
        const classAverage = validScores.length > 0 ? validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length : 0;

        // Compute per-subject class averages in one batch query.
        // This populates the CLASS AVG column in the print template (CognitiveDomain).
        const classRcIds = classReportCards.map((r: any) => r.id as number);
        const subjectAvgMap = new Map<number, number>();
        if (classRcIds.length > 0) {
          const allClassSubjectItems = await db.select({
            subjectId: schema.reportCardItems.subjectId,
            obtainedMarks: schema.reportCardItems.obtainedMarks,
          })
            .from(schema.reportCardItems)
            .where(inArray(schema.reportCardItems.reportCardId, classRcIds));

          const subjectGroups = new Map<number, number[]>();
          for (const si of allClassSubjectItems) {
            if (si.subjectId && si.obtainedMarks && si.obtainedMarks > 0) {
              if (!subjectGroups.has(si.subjectId)) subjectGroups.set(si.subjectId, []);
              subjectGroups.get(si.subjectId)!.push(si.obtainedMarks);
            }
          }
          for (const [sid, scores] of subjectGroups) {
            subjectAvgMap.set(sid, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
          }
        }

        // Map items to the expected format
        const items = reportCardItems.map((item: any) => ({
          id: item.id,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          testScore: item.testScore ?? item.testWeightedScore ?? 0,
          testWeightedScore: item.testWeightedScore ?? item.testScore ?? 0,
          testMaxScore: item.testMaxScore || 40,
          examScore: item.examScore ?? item.examWeightedScore ?? 0,
          examWeightedScore: item.examWeightedScore ?? item.examScore ?? 0,
          examMaxScore: item.examMaxScore || 60,
          totalMarks: item.totalMarks || 100,
          obtainedMarks: item.obtainedMarks ?? 0,
          percentage: item.percentage ?? 0,
          grade: item.grade || '-',
          remarks: item.remarks || item.teacherRemarks || '-',
          hasData: (item.obtainedMarks ?? 0) > 0 || (item.testScore ?? 0) > 0 || (item.testWeightedScore ?? 0) > 0 || (item.examScore ?? 0) > 0 || (item.examWeightedScore ?? 0) > 0,
          classAverage: subjectAvgMap.get(item.subjectId) ?? null,
        }));

        // Calculate total score from items
        const totalObtained = items.reduce((sum: number, item: any) => sum + (item.obtainedMarks || 0), 0);
        const totalMax = items.length * 100;

        // Determine if this is an SSS class for department display
        const isSSS = studentClass?.name?.startsWith('SS') || studentClass?.level?.includes('Senior Secondary');

        const reportCard = {
          id: dbReportCard.id,
          status: dbReportCard.status,
          // Flat fields for easy frontend access
          studentName: `${user.firstName} ${user.lastName}`,
          studentPhoto: user.profileImageUrl || null,
          admissionNumber: student.admissionNumber,
          className: studentClass?.name || 'Unknown',
          classLevel: studentClass?.level || 'Unknown',
          department: isSSS ? student.department : null,
          isSSS: isSSS,
          termName: term?.name || 'Unknown',
          termYear: term?.year?.toString() || '',
          // Use term year directly as it's stored in YYYY/YYYY format (e.g., "2024/2025")
          academicSession: term?.year || '2024/2025',
          // Nested objects (backwards compatibility)
          student: {
            id: studentId,
            name: `${user.firstName} ${user.lastName}`,
            admissionNumber: student.admissionNumber,
            className: studentClass?.name || 'Unknown',
            classLevel: studentClass?.level || 'Unknown',
            department: isSSS ? student.department : null
          },
          term: term ? {
            id: term.id,
            name: term.name,
            year: term.year,
            startDate: term.startDate,
            endDate: term.endDate
          } : null,
          items,
          subjects: items, // Keep for backwards compatibility
          totalScore: dbReportCard.totalScore ?? totalObtained,
          averageScore: dbReportCard.averageScore ?? Math.round(totalObtained / (items.length || 1)),
          averagePercentage: dbReportCard.averagePercentage ?? Math.round((totalObtained / totalMax) * 100),
          overallGrade: dbReportCard.overallGrade || '-',
          position: dbReportCard.position,
          totalStudentsInClass: totalStudentsInClass,
          totalStudents: totalStudentsInClass,
          classStatistics: {
            highestScore: Math.round(classHighest),
            lowestScore: Math.round(classLowest),
            classAverage: Math.round(classAverage * 10) / 10,
            totalStudents: totalStudentsInClass
          },
          teacherRemarks: dbReportCard.teacherRemarks,
          principalRemarks: dbReportCard.principalRemarks,
          attendance: {
            timesSchoolOpened: 0,
            timesPresent: 0,
            timesAbsent: 0,
            attendancePercentage: 0
          },
          affectiveTraits: {
            punctuality: savedSkills?.punctuality || 0,
            neatness: savedSkills?.neatness || 0,
            attentiveness: savedSkills?.attentiveness || 0,
            teamwork: savedSkills?.teamwork || 0,
            leadership: savedSkills?.leadership || 0,
            assignments: savedSkills?.assignments || 0,
            classParticipation: savedSkills?.classParticipation || 0,
            honesty: savedSkills?.honesty || 0,
            politeness: savedSkills?.politeness || 0,
            selfControl: savedSkills?.selfControl || 0,
            obedience: savedSkills?.obedience || 0,
            reliability: savedSkills?.reliability || 0,
            senseOfResponsibility: savedSkills?.senseOfResponsibility || 0,
            relationshipWithOthers: savedSkills?.relationshipWithOthers || 0
          },
          psychomotorSkills: {
            sports: savedSkills?.sports || 0,
            handwriting: savedSkills?.handwriting || 0,
            musicalSkills: savedSkills?.musicalSkills || 0,
            creativity: savedSkills?.creativity || 0,
            handlingOfTools: savedSkills?.handlingOfTools || 0,
            drawingPainting: savedSkills?.drawingPainting || 0,
            publicSpeaking: savedSkills?.publicSpeaking || 0,
            speechFluency: savedSkills?.speechFluency || 0
          },
          summary: {
            percentage: dbReportCard.averagePercentage ?? Math.round((totalObtained / totalMax) * 100),
            grade: dbReportCard.overallGrade || '-',
            remarks: dbReportCard.teacherRemarks || '-',
            subjectsCount: items.length,
            subjectsWithData: items.filter((s: any) => s.hasData).length
          },
          generatedAt: dbReportCard.generatedAt?.toISOString() || new Date().toISOString(),
          publishedAt: dbReportCard.publishedAt?.toISOString(),
          // Signature fields - use stored values or dynamically fetch from profiles
          teacherSignatureUrl: dbReportCard.teacherSignatureUrl || null,
          teacherSignedAt: dbReportCard.teacherSignedAt?.toISOString() || null,
          teacherSignedBy: dbReportCard.teacherSignedBy || null,
          principalSignatureUrl: dbReportCard.principalSignatureUrl || null,
          principalSignedAt: dbReportCard.principalSignedAt ? new Date(dbReportCard.principalSignedAt).toISOString() : null,
          principalSignedBy: dbReportCard.principalSignedBy || null,
          teacherName: '',
          principalName: '',
          dateOfBirth: user.dateOfBirth || null,
          gender: user.gender || null,
        };

        // Dynamically fetch teacher signature if not stored on report card
        if (!reportCard.teacherSignatureUrl && studentClass?.classTeacherId) {
          const teacherProfile = await storage.getTeacherProfile(studentClass.classTeacherId);
          if (teacherProfile?.signatureUrl) {
            reportCard.teacherSignatureUrl = teacherProfile.signatureUrl;
          }
        }

        // Resolve teacher name (the assigned class teacher)
        if (studentClass?.classTeacherId) {
          const teacherUser = await storage.getUser(studentClass.classTeacherId);
          if (teacherUser) {
            reportCard.teacherName = `${teacherUser.firstName || ''} ${teacherUser.lastName || ''}`.trim();
          }
        }

        // Resolve principal name + signature using designated principal helper
        const { principalName: resolvedPrincipalName, principalSignatureUrl: resolvedPrincipalSigUrl } =
          await resolveDesignatedPrincipal(db, storage, dbReportCard.principalSignedBy);
        if (resolvedPrincipalName) reportCard.principalName = resolvedPrincipalName;
        if (!reportCard.principalSignatureUrl && resolvedPrincipalSigUrl) {
          reportCard.principalSignatureUrl = resolvedPrincipalSigUrl;
        }

        return res.json(reportCard);
      }

      // Fallback: If no report card exists in database, calculate from exam results
      // This is only for teachers/admins previewing before generation
      const { calculateGrade, calculateWeightedScore } = await import('../grading-config');
      const exams = await storage.getExamsByClassAndTerm(student.classId, Number(termId));

      // PRIMARY SOURCE: Use class_subject_mappings as the single source of truth for report card subjects
      const classLevel = studentClass?.level ?? '';
      const isSSS = studentClass?.name?.startsWith('SS') || classLevel.includes('Senior Secondary');

      let mappings;
      if (isSSS && student.department) {
        mappings = await storage.getClassSubjectMappings(student.classId, student.department);
      } else {
        mappings = await storage.getClassSubjectMappings(student.classId);
      }

      // Get subject details for each mapping
      const classSubjects: any[] = [];
      for (const mapping of mappings) {
        const subject = await storage.getSubject(mapping.subjectId);
        if (subject && subject.isActive) {
          classSubjects.push(subject);
        }
      }

      // Fallback to exam-based subjects if no mappings exist
      if (classSubjects.length === 0) {
        const classSubjectIds = new Set(exams.map(e => e.subjectId));
        const allSubjects = await storage.getSubjects();
        classSubjects.push(...allSubjects.filter(s => classSubjectIds.has(s.id)));
      }

      const subjectScores: Record<number, { testScores: number[], testMax: number[], examScores: number[], examMax: number[], subjectName: string, hasData: boolean }> = {};

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
        const result = await storage.getExamResultByExamAndStudent(exam.id, studentId);
        if (result && result.marksObtained !== null) {
          const actualMaxScore = result.maxScore || exam.totalMarks;
          subjectScores[exam.subjectId!].hasData = true;
          if (exam.examType === 'test' || exam.examType === 'quiz') {
            subjectScores[exam.subjectId!].testScores.push(result.marksObtained);
            subjectScores[exam.subjectId!].testMax.push(actualMaxScore);
          } else {
            subjectScores[exam.subjectId!].examScores.push(result.marksObtained);
            subjectScores[exam.subjectId!].examMax.push(actualMaxScore);
          }
        }
      }

      const subjects: any[] = [];
      let totalWeightedPercentage = 0;
      const totalSubjects = Object.keys(subjectScores).length;

      for (const [subjectIdStr, scores] of Object.entries(subjectScores)) {
        const subjectId = Number(subjectIdStr);
        const testScore = scores.testScores.reduce((a, b) => a + b, 0);
        const testMax = scores.testMax.reduce((a, b) => a + b, 0);
        const examScore = scores.examScores.reduce((a, b) => a + b, 0);
        const examMax = scores.examMax.reduce((a, b) => a + b, 0);

        const weighted = calculateWeightedScore(testScore, testMax, examScore, examMax);
        const gradeInfo = calculateGrade(weighted.percentage);

        subjects.push({
          subjectId,
          subjectName: scores.subjectName,
          testScore: weighted.testWeighted,
          testMaxScore: 40,
          examScore: weighted.examWeighted,
          examMaxScore: 60,
          obtainedMarks: weighted.weightedScore,
          totalMarks: 100,
          percentage: weighted.percentage,
          grade: gradeInfo.grade,
          remarks: gradeInfo.remarks,
          hasData: scores.hasData
        });

        totalWeightedPercentage += weighted.percentage;
      }

      const overallPercentage = totalSubjects > 0 ? totalWeightedPercentage / totalSubjects : 0;
      const overallGradeInfo = calculateGrade(overallPercentage);
      const totalObtained = subjects.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);

      // Calculate class statistics for draft mode
      // IMPORTANT: Always include the current student's freshly computed percentage
      // This ensures draft previews match what the final published view will show
      const allClassReportCards = await db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        totalScore: schema.reportCards.totalScore,
        averagePercentage: schema.reportCards.averagePercentage
      })
        .from(schema.reportCards)
        .where(
          and(
            eq(schema.reportCards.classId, student.classId!),
            eq(schema.reportCards.termId, Number(termId))
          )
        );

      // Build score map with fresh calculation for current student
      const scoreMap = new Map<string, number>();

      // Add all existing report card scores (excluding current student - we'll add fresh calc)
      for (const rc of allClassReportCards) {
        if (rc.studentId !== studentId && rc.averagePercentage !== null && rc.averagePercentage > 0) {
          scoreMap.set(rc.studentId, rc.averagePercentage);
        }
      }

      // ALWAYS include current student's freshly computed score (this is the key fix)
      // This ensures the preview matches what will be saved/published
      // Include even zero scores to ensure accurate class counts and statistics
      const currentStudentScore = Math.round(overallPercentage);
      scoreMap.set(studentId, currentStudentScore);

      // Convert to array for statistics calculation.
      // Filter out 0-scores (students with no exams) to keep highest/lowest/average
      // consistent with the stored-report-card endpoint and the admin full-report
      // endpoint — all three paths exclude unscored students from class statistics.
      const validDraftScores = Array.from(scoreMap.values()).filter(s => s > 0);
      const totalStudentsInClassDraft = Math.max(allClassReportCards.length, scoreMap.size);

      // Calculate statistics - use current student's score as fallback if no other data
      const draftClassHighest = validDraftScores.length > 0
        ? Math.max(...validDraftScores)
        : currentStudentScore;
      const draftClassLowest = validDraftScores.length > 0
        ? Math.min(...validDraftScores)
        : currentStudentScore;
      const draftClassAverage = validDraftScores.length > 0
        ? validDraftScores.reduce((a: number, b: number) => a + b, 0) / validDraftScores.length
        : currentStudentScore;

      // Compute per-subject class averages for draft view.
      // Combines current student's freshly-computed scores with stored scores of other students.
      // Powers the CLASS AVG column in the print template (CognitiveDomain).
      const draftSubjectAvgMap = new Map<number, number>();
      {
        const subjectGroups = new Map<number, number[]>();
        // Seed with current student's fresh subject scores
        for (const s of subjects) {
          if (s.subjectId && s.obtainedMarks && s.obtainedMarks > 0) {
            if (!subjectGroups.has(s.subjectId)) subjectGroups.set(s.subjectId, []);
            subjectGroups.get(s.subjectId)!.push(s.obtainedMarks);
          }
        }
        // Add stored items for other students in the class
        const otherRcIds = allClassReportCards
          .filter((r: any) => r.studentId !== studentId && r.id)
          .map((r: any) => r.id as number);
        if (otherRcIds.length > 0) {
          const otherItems = await db.select({
            subjectId: schema.reportCardItems.subjectId,
            obtainedMarks: schema.reportCardItems.obtainedMarks,
          })
            .from(schema.reportCardItems)
            .where(inArray(schema.reportCardItems.reportCardId, otherRcIds));
          for (const si of otherItems) {
            if (si.subjectId && si.obtainedMarks && si.obtainedMarks > 0) {
              if (!subjectGroups.has(si.subjectId)) subjectGroups.set(si.subjectId, []);
              subjectGroups.get(si.subjectId)!.push(si.obtainedMarks);
            }
          }
        }
        for (const [sid, scores] of subjectGroups) {
          draftSubjectAvgMap.set(sid, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10);
        }
      }
      // Inject classAverage into each subject item
      const subjectsWithClassAvg = subjects.map((s: any) => ({
        ...s,
        classAverage: draftSubjectAvgMap.get(s.subjectId) ?? null,
      }));

      const reportCard = {
        status: 'draft',
        // Flat fields for easy frontend access
        studentName: `${user.firstName} ${user.lastName}`,
        admissionNumber: student.admissionNumber,
        className: studentClass?.name || 'Unknown',
        classLevel: studentClass?.level || 'Unknown',
        department: isSSS ? student.department : null,
        isSSS: isSSS,
        termName: term?.name || 'Unknown',
        termYear: term?.year?.toString() || '',
        // Use term year directly as it's stored in YYYY/YYYY format (e.g., "2024/2025")
        academicSession: term?.year || '2024/2025',
        // Nested objects (backwards compatibility)
        student: {
          id: studentId,
          name: `${user.firstName} ${user.lastName}`,
          admissionNumber: student.admissionNumber,
          className: studentClass?.name || 'Unknown',
          classLevel: studentClass?.level || 'Unknown',
          department: isSSS ? student.department : null
        },
        term: term ? {
          id: term.id,
          name: term.name,
          year: term.year,
          startDate: term.startDate,
          endDate: term.endDate
        } : null,
        items: subjectsWithClassAvg,
        subjects: subjectsWithClassAvg,
        totalScore: totalObtained,
        averageScore: Math.round(totalObtained / (subjects.length || 1)),
        averagePercentage: Math.round(overallPercentage),
        overallGrade: overallGradeInfo.grade,
        position: null,
        totalStudentsInClass: totalStudentsInClassDraft,
        totalStudents: totalStudentsInClassDraft,
        classStatistics: {
          highestScore: Math.round(draftClassHighest),
          lowestScore: Math.round(draftClassLowest),
          classAverage: Math.round(draftClassAverage * 10) / 10,
          totalStudents: totalStudentsInClassDraft
        },
        summary: {
          percentage: Math.round(overallPercentage * 10) / 10,
          grade: overallGradeInfo.grade,
          remarks: overallGradeInfo.remarks,
          subjectsCount: totalSubjects,
          subjectsWithData: subjects.filter(s => s.hasData).length
        },
        generatedAt: new Date().toISOString()
      };

      res.json(reportCard);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate report card' });
    }
  });
}
