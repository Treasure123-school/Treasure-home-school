/** Realtime sync + exam list/create/detail endpoints — split from realtime-sync.routes.ts. */
/** Auto-split from routes.ts — realtime-sync (orig lines 1326-2212). See git history. */
import * as schema from '@shared/schema.pg';
import { getVisibleExamsForParent, getVisibleExamsForStudent, invalidateVisibilityCache } from '../exam-visibility';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { validateTeacherCanCreateExam, validateTeacherInChargeId } from '../teacher-auth-middleware';
import { insertExamSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request } from 'express';
import session from 'express-session';
import { ZodError } from 'zod';


export async function registerSyncExamsRoutes(app: Express) {

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
  app.post('/api/exams', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER), validateTeacherCanCreateExam, async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const teacherAssignment = await validateTeacherInChargeId(req.body.teacherInChargeId, teacherId);
      if (!teacherAssignment.valid) {
        return res.status(400).json({ message: teacherAssignment.message });
      }
      const assignedTeacherId = teacherAssignment.value;

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
}
