/** Auto-split from routes.ts — realtime-sync (orig lines 1326-2212). See git history. */
import * as schema from '@shared/schema.pg';
import { getVisibleExamsForParent, getVisibleExamsForStudent, invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { validateTeacherCanCreateExam } from '../teacher-auth-middleware';
import { insertExamSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request } from 'express';
import session from 'express-session';
import { ZodError } from 'zod';

export async function registerRealtimeSyncRoutes(app: Express) {
  // ==================== REALTIME SYNC ENDPOINT ====================
  // This endpoint allows frontend to get initial data for tables they want to subscribe to
  // Security: Role-based access control enforced per table with scope filtering
  // Security: All-or-nothing permission check - reject entire request if ANY table is forbidden
  const ALLOWED_SYNC_TABLES = ['classes', 'subjects', 'academic_terms', 'users', 'students', 'announcements', 'exams', 'homepage_content', 'notifications'];

  // Permission matrix: Which roles can access which tables
  // true = full access, 'scoped' = filtered access, false = forbidden
  type TablePermission = boolean | 'scoped';
  const TABLE_PERMISSIONS: Record<string, Record<number, TablePermission>> = {
    'classes': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: true, [ROLES.STUDENT]: true, [ROLES.PARENT]: true },
    'subjects': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: true, [ROLES.STUDENT]: true, [ROLES.PARENT]: true },
    'academic_terms': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: true, [ROLES.STUDENT]: true, [ROLES.PARENT]: true },
    'users': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: false, [ROLES.STUDENT]: false, [ROLES.PARENT]: false },
    'students': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: 'scoped', [ROLES.STUDENT]: false, [ROLES.PARENT]: 'scoped' },
    'announcements': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: 'scoped', [ROLES.STUDENT]: 'scoped', [ROLES.PARENT]: 'scoped' },
    'exams': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: 'scoped', [ROLES.STUDENT]: 'scoped', [ROLES.PARENT]: 'scoped' },
    'homepage_content': { [ROLES.SUPER_ADMIN]: true, [ROLES.ADMIN]: true, [ROLES.TEACHER]: false, [ROLES.STUDENT]: false, [ROLES.PARENT]: false },
    'notifications': { [ROLES.SUPER_ADMIN]: 'scoped', [ROLES.ADMIN]: 'scoped', [ROLES.TEACHER]: 'scoped', [ROLES.STUDENT]: 'scoped', [ROLES.PARENT]: 'scoped' }
  };

  app.post('/api/realtime/sync', authenticateUser, async (req, res) => {
    try {
      const { tables } = req.body as { tables: string[] };

      if (!Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({ message: 'Tables array is required' });
      }

      // Validate, normalize (lowercase), and deduplicate table names
      // Security: Only accept exact lowercase matches to prevent bypass attempts
      const normalizedTables = tables
        .filter(t => typeof t === 'string' && t.length > 0)
        .map(t => t.toLowerCase().trim());

      // Security: All-or-nothing validation - reject if ANY table is not in whitelist
      const invalidTables = normalizedTables.filter(t => !ALLOWED_SYNC_TABLES.includes(t));
      if (invalidTables.length > 0) {
        return res.status(400).json({
          message: 'Request contains invalid table names',
          invalidTables,
          allowedTables: ALLOWED_SYNC_TABLES
        });
      }

      const uniqueTables = [...new Set(normalizedTables)];

      if (uniqueTables.length === 0) {
        return res.status(400).json({
          message: 'No valid tables specified',
          allowedTables: ALLOWED_SYNC_TABLES
        });
      }

      const userRoleId = req.user!.roleId;
      const userId = req.user!.id;

      // Security: Check permissions for ALL requested tables BEFORE processing ANY data
      // All-or-nothing: if user lacks permission for any table, reject entire request
      const forbiddenTables: string[] = [];
      for (const table of uniqueTables) {
        const permission = TABLE_PERMISSIONS[table]?.[userRoleId];
        if (permission === false || permission === undefined) {
          forbiddenTables.push(table);
        }
      }

      if (forbiddenTables.length > 0) {
        return res.status(403).json({
          message: 'Access denied to one or more requested tables',
          forbiddenTables,
          hint: 'Remove forbidden tables from request or use appropriate credentials'
        });
      }

      const syncData: Record<string, any> = {};

      // Helper to get user's role name for announcement filtering
      const getRoleName = (roleId: number): string | null => {
        switch (roleId) {
          case ROLES.STUDENT: return 'Student';
          case ROLES.TEACHER: return 'Teacher';
          case ROLES.PARENT: return 'Parent';
          case ROLES.ADMIN: return 'Admin';
          case ROLES.SUPER_ADMIN: return 'SuperAdmin';
          default: return null;
        }
      };

      // Now process tables - all permission checks already passed
      for (const table of uniqueTables) {
        switch (table) {
          case 'classes':
            // All authenticated users can see active classes
            syncData.classes = await storage.getClasses();
            break;

          case 'subjects':
            // All authenticated users can see subjects
            syncData.subjects = await storage.getSubjects();
            break;

          case 'academic_terms':
            // All authenticated users can see terms
            syncData.academic_terms = await storage.getAcademicTerms();
            break;

          case 'users':
            // Only admins - permission already verified
            const allUsers = await storage.getAllUsers();
            syncData.users = allUsers.map((u: any) => {
              const { passwordHash, ...safe } = u;
              return safe;
            });
            break;

          case 'students':
            // Role-based scoped access - permission already verified
            if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) {
              const allStudents = await storage.getAllStudents();
              syncData.students = Array.isArray(allStudents) ? allStudents : [];
            } else if (userRoleId === ROLES.TEACHER) {
              // Teachers only get students in their assigned classes
              const teacherProfile = await storage.getTeacherProfile(userId);
              const assignedClasses = teacherProfile?.assignedClasses;

              if (assignedClasses && Array.isArray(assignedClasses) && assignedClasses.length > 0) {
                const allStudents = await storage.getAllStudents();
                syncData.students = Array.isArray(allStudents)
                  ? allStudents.filter((s: any) => s && s.classId && assignedClasses.includes(s.classId))
                  : [];
              } else {
                // Teacher has scoped permission but no assigned classes = empty result (not error)
                syncData.students = [];
              }
            } else if (userRoleId === ROLES.PARENT) {
              // Parents only get their own children
              const children = await storage.getStudentsByParentId(userId);
              syncData.students = Array.isArray(children) ? children : [];
            }
            break;

          case 'announcements':
            // Filter announcements by target role - scoped access
            const allAnnouncements = await storage.getAnnouncements();
            const userRole = getRoleName(userRoleId);
            syncData.announcements = (Array.isArray(allAnnouncements) ? allAnnouncements : []).filter((a: any) => {
              // Show if no target role (public) or matches user's role
              if (!a.targetRole) return true;
              if (a.targetRole === userRole) return true;
              // Admins can see all announcements
              if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) return true;
              return false;
            });
            break;

          case 'exams':
            // Uses centralized visibility logic for consistency across all endpoints
            // KG1-JSS3: See all general subject exams for their class
            // SS1-SS3: See general + department-specific exams only
            if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) {
              syncData.exams = await storage.getAllExams();
            } else if (userRoleId === ROLES.TEACHER) {
              const allExams = await storage.getAllExams();
              syncData.exams = (Array.isArray(allExams) ? allExams : []).filter((e: any) =>
                e.createdBy === userId || e.teacherInChargeId === userId
              );
            } else if (userRoleId === ROLES.STUDENT) {
              syncData.exams = await getVisibleExamsForStudent(userId);
            } else if (userRoleId === ROLES.PARENT) {
              syncData.exams = await getVisibleExamsForParent(userId);
            }
            break;

          case 'homepage_content':
            // Only admins - permission already verified
            syncData.homepage_content = await storage.getHomePageContent();
            break;

          case 'notifications':
            // Users only get their own notifications - scoped
            syncData.notifications = await storage.getNotificationsByUserId(userId);
            break;
        }
      }

      res.json({
        success: true,
        data: syncData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to sync realtime data' });
    }
  });

  // Exam management routes
  // Get all exams - Uses centralized visibility logic for consistency
  app.get('/api/exams', authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      // Students: Use centralized visibility logic
      // - KG1-JSS3: See all general subject exams for their class
      // - SS1-SS3: See general + department-specific exams only
      if (userRoleId === ROLES.STUDENT) {
        const studentExams = await getVisibleExamsForStudent(userId);

        // BUGFIX: Always include published exams the student has already completed,
        // even if the exam's subject was changed after completion.
        // Subject changes must never make a student's completed exam disappear.
        try {
          const completedResults = await storage.getExamResultsByStudent(userId);
          if (completedResults.length > 0) {
            const visibleIds = new Set(studentExams.map((e: any) => e.id));
            const completedExamIds = [...new Set(completedResults.map((r: any) => r.examId))];
            const missingIds = completedExamIds.filter((id: number) => !visibleIds.has(id));
            for (const missingId of missingIds) {
              const exam = await storage.getExamById(missingId);
              if (exam && exam.isPublished) {
                studentExams.push(exam);
              }
            }
          }
        } catch (completedExamError) {
          // Non-fatal: log but still return visible exams
          console.warn('[EXAMS] Could not fetch completed exams to merge into student list:', completedExamError);
        }

        return res.json(studentExams);
      }

      // Teachers see exams they created OR are assigned to (teacherInChargeId)
      if (userRoleId === ROLES.TEACHER) {
        const allExams = await storage.getAllExams();
        const teacherExams = allExams.filter((exam: any) =>
          exam.createdBy === userId || exam.teacherInChargeId === userId
        );
        return res.json(teacherExams);
      }

      // Parents: Use centralized visibility logic for all children
      // Shows proper department-filtered exams for each child
      if (userRoleId === ROLES.PARENT) {
        const parentExams = await getVisibleExamsForParent(userId);
        return res.json(parentExams);
      }

      // Admins and Super Admins see all exams
      const exams = await storage.getAllExams();
      res.json(exams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      res.status(500).json({ message: 'Failed to fetch exams' });
    }
  });

  // Create exam - TEACHERS ONLY (with assignment validation)
  app.post('/api/exams', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), validateTeacherCanCreateExam, async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const assignedTeacherId = req.body.teacherInChargeId || teacherId;

      // SECURITY: Validate teacherInChargeId if different from creator
      if (assignedTeacherId !== teacherId) {
        const assignedUser = await storage.getUser(assignedTeacherId);
        if (!assignedUser) {
          return res.status(400).json({ message: 'Assigned teacher not found' });
        }
        if (assignedUser.roleId !== ROLES.TEACHER) {
          return res.status(400).json({ message: 'teacherInChargeId must be a teacher' });
        }
        if (!assignedUser.isActive) {
          return res.status(400).json({ message: 'Assigned teacher is not active' });
        }
      }

      // DEPARTMENT ENFORCEMENT: Validate subject is appropriate for the class
      if (req.body.classId && req.body.subjectId) {
        const classInfo = await storage.getClass(req.body.classId);
        const subjectInfo = await storage.getSubject(req.body.subjectId);

        if (classInfo && subjectInfo) {
          const isSeniorSecondary = (classInfo.level || '').toLowerCase().includes('senior secondary');
          const subjectCategory = (subjectInfo.category || 'general').toLowerCase();

          if (isSeniorSecondary && subjectCategory !== 'general') {
            // For department-specific subjects in SS classes, warn but allow
            // Teachers should only assign exams for subjects in their class's department
            console.log(`[EXAM-CREATE] Creating ${subjectCategory} subject exam for SS class ${classInfo.name}`);
          }
        }
      }

      // ROOT-CAUSE FIX: termId was optional and had no fallback. If a teacher created an
      // exam without explicitly picking a term (or the form didn't require it), the exam
      // was saved with termId = null. The report-card sync service requires termId to link
      // a score to a report card, so it would silently skip syncing (MISSING_EXAM_FIELDS) —
      // this is why report cards stopped auto-generating after a student's first completed
      // exam for some assessments. We now default to the active academic term when none is
      // provided, so every exam that should count academically has a valid term to sync to.
      let resolvedTermId = req.body.termId;
      if (resolvedTermId === undefined || resolvedTermId === null || resolvedTermId === '') {
        const currentTerm = await storage.getCurrentTerm();
        if (currentTerm) {
          resolvedTermId = currentTerm.id;
          console.log(`[EXAM-CREATE] No termId provided; defaulting to active term ${currentTerm.id} (${currentTerm.name})`);
        }
      }

      const examData = insertExamSchema.parse({
        ...req.body,
        termId: resolvedTermId,
        createdBy: teacherId,
        teacherInChargeId: assignedTeacherId
      });

      const exam = await storage.createExam(examData);

      // Invalidate exam visibility cache for students in this class
      if (exam.isPublished) {
        invalidateVisibilityCache({ examId: exam.id });
      }

      // Emit realtime event for exam creation
      realtimeService.emitTableChange('exams', 'INSERT', exam, undefined, teacherId);
      if (exam.classId) {
        realtimeService.emitToClass(exam.classId.toString(), 'exam.created', exam);
      }

      res.status(201).json(exam);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid exam data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create exam' });
    }
  });

  // Get exam question counts - MUST be before /api/exams/:id to avoid route conflict
  app.get('/api/exams/question-counts', authenticateUser, async (req, res) => {
    try {
      const examIdsParam = req.query.examIds;
      let examIds: number[] = [];

      if (typeof examIdsParam === 'string') {
        const parsed = parseInt(examIdsParam);
        if (!isNaN(parsed)) {
          examIds = [parsed];
        }
      } else if (Array.isArray(examIdsParam)) {
        examIds = examIdsParam
          .map((id) => parseInt(id as string))
          .filter((id) => !isNaN(id));
      }
      const counts: Record<number, number> = {};

      for (const examId of examIds) {
        const questions = await storage.getExamQuestions(examId);
        counts[examId] = questions.length;
      }
      res.json(counts);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch question counts' });
    }
  });

  // Get single exam
  app.get('/api/exams/:id', authenticateUser, async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const exam = await storage.getExamById(examId);

      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }
      res.json(exam);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch exam' });
    }
  });

  // Get exam results for the current logged-in student - STUDENTS ONLY
  // This endpoint returns all completed exam results for the student permanently stored in the database
  // IMPORTANT: This endpoint is designed to be robust - it always returns results from exam_results table
  // even if exam enrichment temporarily fails, ensuring students never see their scores disappear
  app.get('/api/exam-results', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const studentId = req.user!.id;

      // Get all exam results for this student from the database (permanent storage)
      const results = await storage.getExamResultsByStudent(studentId);

      // Pre-fetch all student sessions once for efficiency
      let studentSessions: any[] = [];
      try {
        studentSessions = await storage.getExamSessionsByStudent(studentId);
      } catch (sessionError) {
        console.warn('[STUDENT-EXAM-RESULTS] Could not fetch sessions, continuing with results only');
      }

      // Safely format dates - handle both Date objects and strings
      const formatDate = (dateValue: any): string | null => {
        if (!dateValue) return null;
        try {
          if (dateValue instanceof Date) {
            return dateValue.toISOString();
          }
          return new Date(dateValue).toISOString();
        } catch (e) {
          return String(dateValue);
        }
      };

      // Enrich results with exam and subject information
      // CRITICAL: Even if enrichment fails, we MUST return the core result data
      const enrichedResults = await Promise.all(results.map(async (result: any) => {
        // Start with guaranteed base data from exam_results table
        const score = result.score || result.marksObtained || 0;
        const maxScore = result.maxScore || 100;
        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const submittedAtFormatted = formatDate(result.createdAt);

        // Base result that we always return (guaranteed from database)
        const baseResult: {
          id: number;
          examId: number;
          studentId: string;
          score: number;
          maxScore: number;
          percentage: number;
          grade: string | null;
          remarks: string | null;
          submittedAt: string | null;
          timeTakenSeconds: number;
          submissionReason: string;
          violationCount: number;
          examTitle: string;
          subjectName: string;
          className: string;
          showCorrectAnswers: boolean;
          exam: {
            id: number;
            title: string;
            totalMarks: number;
            timeLimit: number | null;
            date: string | null;
          };
        } = {
          id: result.id,
          examId: result.examId,
          studentId: result.studentId,
          score: score,
          maxScore: maxScore,
          percentage: percentage,
          grade: result.grade || null,
          remarks: result.remarks || null,
          submittedAt: submittedAtFormatted,
          timeTakenSeconds: 0,
          submissionReason: 'manual',
          violationCount: 0,
          examTitle: `Exam #${result.examId}`,
          subjectName: 'Unknown Subject',
          className: 'Unknown Class',
          showCorrectAnswers: true,
          exam: {
            id: result.examId,
            title: `Exam #${result.examId}`,
            totalMarks: maxScore,
            timeLimit: null,
            date: null
          }
        };

        try {
          // Try to enrich with exam details
          const exam = await storage.getExamById(result.examId);

          // DESIGN DECISION: Exam results ALWAYS persist and are shown to students
          // The isPublished flag controls whether students can TAKE the exam, NOT view their results
          // Results should only disappear if the exam is explicitly deleted from the system
          // This ensures students never see their scores "disappear" unexpectedly

          // If exam found, enrich the result
          if (exam) {
            baseResult.examTitle = exam.name;
            baseResult.maxScore = result.maxScore || exam.totalMarks || 100;
            baseResult.percentage = baseResult.maxScore > 0 ? Math.round((score / baseResult.maxScore) * 100) : 0;
            baseResult.showCorrectAnswers = exam.showCorrectAnswers ?? true;
            baseResult.exam = {
              id: exam.id,
              title: exam.name,
              totalMarks: exam.totalMarks,
              timeLimit: exam.timeLimit ?? null,
              date: exam.date ?? null
            };

            // Try to get subject and class info
            try {
              if (exam.subjectId) {
                const subject = await storage.getSubject(exam.subjectId!);
                if (subject) baseResult.subjectName = subject.name;
              }
              if (exam.classId) {
                const examClass = await storage.getClass(exam.classId!);
                if (examClass) baseResult.className = examClass.name;
              }
            } catch (lookupError) {
              // Keep default values on lookup failure
            }
          }

          // Try to get session details for additional metadata
          const session = studentSessions.find((s: any) => s.examId === result.examId && s.isCompleted);
          if (session) {
            if (session.submittedAt) {
              baseResult.submittedAt = formatDate(session.submittedAt) || baseResult.submittedAt;
            }

            // Parse session metadata for submission details
            if (session.metadata) {
              try {
                const metadata = typeof session.metadata === 'string'
                  ? JSON.parse(session.metadata)
                  : session.metadata;
                baseResult.submissionReason = metadata.submissionReason || 'manual';
                baseResult.violationCount = metadata.violationCount || 0;
                baseResult.timeTakenSeconds = metadata.timeTakenSeconds || 0;
              } catch (e) {
                // Ignore parse errors - keep defaults
              }
            }

            // If timeTakenSeconds still 0, try computing from session start/submit times
            if (baseResult.timeTakenSeconds === 0 && session.startedAt && session.submittedAt) {
              try {
                const start = new Date(session.startedAt).getTime();
                const end = new Date(session.submittedAt).getTime();
                if (start > 0 && end > start) {
                  baseResult.timeTakenSeconds = Math.floor((end - start) / 1000);
                }
              } catch (e) { /* ignore */ }
            }
          }

          // Add formatted time for display
          if (baseResult.timeTakenSeconds > 0) {
            const mins = Math.floor(baseResult.timeTakenSeconds / 60);
            const secs = baseResult.timeTakenSeconds % 60;
            (baseResult as any).timeTakenFormatted = mins === 0
              ? `${secs} seconds`
              : `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
          }

          return baseResult;
        } catch (enrichError) {
          console.warn('[STUDENT-EXAM-RESULTS] Enrichment failed for result:', result.id, '- returning base data');
          // On ANY enrichment error, return the base result with data we have from database
          return baseResult;
        }
      }));

      // All results should be valid - we no longer filter based on publish status
      // Results only disappear if explicitly deleted, not when unpublished
      const validResults = enrichedResults.filter((r: any) => r !== null);

      // Sort by submission date (most recent first)
      validResults.sort((a: any, b: any) => {
        const dateA = new Date(a.submittedAt || 0).getTime();
        const dateB = new Date(b.submittedAt || 0).getTime();
        return dateB - dateA;
      });

      res.json(validResults);
    } catch (error: any) {
      console.error('[STUDENT-EXAM-RESULTS] Error fetching student exam results:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam results' });
    }
  });

  // STRICT MATCHING: Get a SINGLE exam result for the current student by exact exam ID
  // This endpoint guarantees the score displayed corresponds to the EXACT exam clicked
  // No fallback logic - returns 404 if no result exists for this specific exam
  app.get('/api/exam-results/student/:examId', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const studentId = req.user!.id;

      console.log(`[STRICT-EXAM-RESULT] Student ${studentId} requesting result for exam ${examId}`);

      // Validate exam ID
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Get the exam to verify it exists and get subject/class info
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // STRICT QUERY: Get ONLY the result for THIS specific exam and THIS student
      // Uses getExamResultByExamAndStudent which queries: WHERE exam_id = ? AND student_id = ?
      const result = await storage.getExamResultByExamAndStudent(examId, studentId);

      if (!result) {
        console.log(`[STRICT-EXAM-RESULT] No result found for student ${studentId}, exam ${examId}`);
        return res.status(404).json({
          message: 'No result found for this exam',
          examId: examId,
          subjectName: exam.subjectId ? (await storage.getSubject(exam.subjectId!))?.name : 'Unknown'
        });
      }

      console.log(`[STRICT-EXAM-RESULT] Found result ID ${result.id} for student ${studentId}, exam ${examId}`);

      // Map new schema fields for the frontend
      const responseData = {
        ...result,
        correct_answers: (result as any).correctAnswers ?? 0,
        incorrect_answers: (result as any).incorrectAnswers ?? 0,
        total_questions: (result as any).totalQuestions ?? 0,
        time_taken: (result as any).timeTaken ?? 0,
        submitted_at: (result as any).submittedAt ?? (result as any).createdAt
      };

      // Get subject and class information for display
      let subjectName = 'Unknown Subject';
      let className = 'Unknown Class';

      if (exam.subjectId) {
        const subject = await storage.getSubject(exam.subjectId!);
        subjectName = subject?.name || 'Unknown Subject';
      }

      if (exam.classId) {
        const classInfo = await storage.getClass(exam.classId!);
        className = classInfo?.name || 'Unknown Class';
      }

      // Get session info for time taken and submission details
      let timeTakenSeconds = 0;
      let submissionReason = 'manual';
      let violationCount = 0;

      try {
        const sessions = await storage.getExamSessionsByStudent(studentId);
        // BUG FIX: was checking s.status === 'completed' but status is 'submitted'/'graded', never 'completed'
        // Use s.isCompleted (boolean) which IS correctly set to true on submission
        const matchingSession = sessions.find((s: any) => s.examId === examId && s.isCompleted);
        if (matchingSession) {
          const metadata = typeof matchingSession.metadata === 'string'
            ? JSON.parse(matchingSession.metadata)
            : matchingSession.metadata;
          timeTakenSeconds = metadata?.timeTakenSeconds || 0;
          submissionReason = metadata?.submissionReason || 'manual';
          violationCount = metadata?.violationCount || 0;

          // Fallback: compute from session start/submit times if metadata didn't have it
          if (timeTakenSeconds === 0 && matchingSession.startedAt && matchingSession.submittedAt) {
            try {
              const start = new Date(matchingSession.startedAt).getTime();
              const end = new Date(matchingSession.submittedAt).getTime();
              if (start > 0 && end > start) {
                timeTakenSeconds = Math.floor((end - start) / 1000);
              }
            } catch (e) { /* ignore */ }
          }
        }
      } catch (sessionError) {
        // Session enrichment failed, use defaults
      }

      // Calculate score values
      const score = result.score ?? result.marksObtained ?? 0;
      const maxScore = result.maxScore ?? exam.totalMarks ?? 100;
      const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      // Get all student answers for this session
      const allSessions = await storage.getExamSessionsByStudent(studentId);
      // Look for any session for this exam, prioritizing completed ones
      const matchingSession = allSessions.find((s: any) => s.examId === examId && s.isCompleted) ||
        allSessions.find((s: any) => s.examId === examId);

      let questionDetails: any[] = [];
      if (matchingSession) {
        console.log(`[STRICT-EXAM-RESULT] Using session ${matchingSession.id} for question breakdown`);
        const answers = await storage.getStudentAnswers(matchingSession.id);
        const questions = await storage.getExamQuestions(examId);

        questionDetails = await Promise.all(questions.map(async (q: any) => {
          const studentAns = answers.find((a: any) => a.questionId === q.id);
          const options = q.questionType === 'multiple_choice' ? await storage.getQuestionOptions(q.id) : [];
          const correctOption = options.find((o: any) => o.isCorrect);

          // CRITICAL FIX: Direct mapping of student answer text
          let studentAnswerText = "No answer provided";
          let isCorrect = false;
          let pointsEarned = 0;

          if (studentAns) {
            isCorrect = studentAns.isCorrect || false;
            pointsEarned = studentAns.pointsEarned || 0;

            if (q.questionType === 'multiple_choice' && studentAns.selectedOptionId) {
              const studentOption = options.find((o: any) => o.id === studentAns.selectedOptionId);
              studentAnswerText = studentOption?.optionText || `Option (ID: ${studentAns.selectedOptionId})`;
            } else if (studentAns.textAnswer) {
              studentAnswerText = studentAns.textAnswer;
            }
          }

          // Determine correct answer text
          let correctAnswerText = "Not available";
          if (q.questionType === 'multiple_choice') {
            const correctOption = options.find((o: any) => o.isCorrect);
            correctAnswerText = correctOption?.optionText || "Not specified";
          } else {
            try {
              const expected = typeof q.expectedAnswers === 'string'
                ? JSON.parse(q.expectedAnswers)
                : q.expectedAnswers;
              correctAnswerText = Array.isArray(expected) ? expected.join(", ") : String(expected || "Not specified");
            } catch (e) {
              correctAnswerText = String(q.expectedAnswers || "Not specified");
            }
          }

          const showAnswers = exam.showCorrectAnswers ?? true;
          return {
            questionId: q.id,
            questionText: q.questionText,
            isCorrect: isCorrect,
            pointsAwarded: pointsEarned,
            maxPoints: q.points,
            studentAnswer: studentAnswerText,
            // Only expose correct answer if the teacher has enabled it
            correctAnswer: showAnswers ? correctAnswerText : undefined,
          };
        }));

        // If showCorrectAnswers is off, send empty questionDetails so no breakdown is rendered
        if (!(exam.showCorrectAnswers ?? true)) {
          questionDetails = [];
        }
      }

      // Format time taken for display
      const finalTimeTaken = (result as any).timeTaken || timeTakenSeconds;
      const formatTimeTaken = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs} seconds`;
        return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
      };

      // Return the EXACT result for this specific exam - no mixing with other exams
      const enrichedResult = {
        id: result.id,
        examId: result.examId,
        studentId: result.studentId,
        score: score,
        maxScore: maxScore,
        percentage: percentage,
        grade: result.grade || null,
        remarks: result.remarks || null,
        submittedAt: (result as any).submittedAt?.toISOString() || (result as any).createdAt?.toISOString() || null,
        correct_answers: (result as any).correctAnswers ?? 0,
        incorrect_answers: (result as any).incorrectAnswers ?? 0,
        total_questions: (result as any).totalQuestions ?? 0,
        time_taken: finalTimeTaken,
        timeTakenSeconds: finalTimeTaken,
        timeTakenFormatted: finalTimeTaken > 0 ? formatTimeTaken(finalTimeTaken) : null,
        submissionReason: submissionReason,
        violationCount: violationCount,
        examTitle: exam.name,
        subjectName: subjectName,
        className: className,
        questionDetails: questionDetails,
        // Include exam details for verification
        exam: {
          id: exam.id,
          title: exam.name,
          totalMarks: exam.totalMarks,
          timeLimit: exam.timeLimit,
          date: exam.date,
          subjectId: exam.subjectId,
          classId: exam.classId
        },
        showCorrectAnswers: exam.showCorrectAnswers ?? true,
      };

      console.log(`[STRICT-EXAM-RESULT] Returning result: exam="${exam.name}", subject="${subjectName}", score=${score}/${maxScore}`);

      res.json(enrichedResult);
    } catch (error: any) {
      console.error('[STRICT-EXAM-RESULT] Error:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam result' });
    }
  });

  // Get exam results by exam ID - TEACHERS AND ADMINS
  app.get('/api/exam-results/exam/:examId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const teacherId = req.user!.id;

      // Validate exam ID
      if (isNaN(examId) || examId <= 0) {
        return res.status(400).json({ message: 'Invalid exam ID' });
      }

      // Verify exam exists
      const exam = await storage.getExamById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // For teachers, allow viewing results if they created the exam, are the teacher in charge,
      // or teach the class-subject combination
      if (req.user!.roleId === ROLES.TEACHER) {
        const isCreator = exam.createdBy === teacherId;
        const isTeacherInCharge = exam.teacherInChargeId === teacherId;

        // Also check if teacher is assigned to this class-subject
        let isClassSubjectTeacher = false;
        if (exam.classId && exam.subjectId) {
          try {
            const teachers = await storage.getTeachersForClassSubject(exam.classId, exam.subjectId);
            isClassSubjectTeacher = teachers?.some((t: any) => t.id === teacherId) || false;
          } catch (e) {
            // Silent fail - continue with other checks
          }
        }

        if (!isCreator && !isTeacherInCharge && !isClassSubjectTeacher) {
          return res.status(403).json({ message: 'You can only view results for exams you created, are assigned to, or teach' });
        }
      }

      // Get results with student info for better display
      const results = await storage.getExamResultsByExam(examId);

      // Enrich with student information — batched into a single query instead of
      // one getStudent()+getUser() round-trip per result (was N+1).
      const studentMap = await storage.getStudentsByIds(results.map((r: any) => r.studentId));
      const enrichedResults = results.map((result: any) => {
        const student = studentMap.get(result.studentId);
        return {
          ...result,
          studentName: student?.firstName && student?.lastName
            ? `${student.firstName} ${student.lastName}`
            : student?.username || 'Unknown Student',
          studentUsername: student?.username || null,
          admissionNumber: student?.admissionNumber || null
        };
      });

      res.json(enrichedResults);
    } catch (error: any) {
      console.error('[EXAM-RESULTS] Error fetching exam results:', error?.message);
      res.status(500).json({ message: 'Failed to fetch exam results' });
    }
  });

}
