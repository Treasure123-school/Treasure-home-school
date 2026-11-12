/** Auto-split from routes.ts — student-portal-subjects (orig lines 14809-15060). See git history. */
import * as schema from '@shared/schema.pg';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentPortalSubjectsRoutes(app: Express) {
  // ==================== STUDENT PORTAL SUBJECT ROUTES ====================

  // Get current student's assigned subjects (for student portal)
  // Uses class_subject_mappings as the single source of truth
  app.get('/api/my-subjects', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Find student by user ID
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      if (!student.classId) {
        return res.json([]);
      }

      // Get class info to determine if it's JSS or SSS
      const classInfo = await storage.getClass(student.classId);
      if (!classInfo) {
        return res.json([]);
      }

      // PRIMARY SOURCE: Use class_subject_mappings as the single source of truth
      // For JSS: get all mappings with department = null
      // For SSS: get mappings with department matching student's department OR null (general subjects shared with that dept)
      const level = classInfo?.level ?? '';
      const isSSS = classInfo?.name?.startsWith('SS') || level.includes('Senior Secondary');

      let mappings;
      if (isSSS && student.department) {
        // For SSS students with a department, get mappings for their specific department
        mappings = await storage.getClassSubjectMappings(student.classId, student.department);
      } else {
        // For JSS students or SSS students without department, get mappings with department = null
        mappings = await storage.getClassSubjectMappings(student.classId);
      }

      // If no mappings exist yet for this class, return empty array
      // This ensures admin must configure subjects first
      if (mappings.length === 0) {
        console.log(`[MY-SUBJECTS] No class-subject mappings found for class ${classInfo.name}${student.department ? ` (${student.department})` : ''}`);
        return res.json([]);
      }

      // Enrich with subject details
      const enrichedSubjects = await Promise.all(mappings.map(async (mapping) => {
        const subject = await storage.getSubject(mapping.subjectId);
        return {
          id: mapping.id, // Use mapping ID for consistency
          subjectId: mapping.subjectId,
          subjectName: subject?.name,
          subjectCode: subject?.code,
          category: subject?.category || 'general',
          isCompulsory: mapping.isCompulsory,
          department: mapping.department
        };
      }));

      // Filter out any entries where subject wasn't found
      const validSubjects = enrichedSubjects.filter(s => s.subjectName);

      console.log(`[MY-SUBJECTS] Returned ${validSubjects.length} subjects for student in ${classInfo.name}${student.department ? ` (${student.department})` : ''}`);

      res.json(validSubjects);
    } catch (error: any) {
      console.error('Error fetching my subjects:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch subjects' });
    }
  });

  // Get teachers for current student's subjects (for student portal)
  // Uses class_subject_mappings as the single source of truth
  app.get('/api/my-subject-teachers', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Find student by user ID
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      if (!student.classId) {
        return res.json({});
      }

      // Get class info to determine if it's JSS or SSS
      const classInfo = await storage.getClass(student.classId);
      if (!classInfo) {
        return res.json({});
      }

      // Use class_subject_mappings as the single source of truth
      const level = classInfo?.level ?? '';
      const isSSS = classInfo?.name?.startsWith('SS') || level.includes('Senior Secondary');

      let mappings;
      if (isSSS && student.department) {
        mappings = await storage.getClassSubjectMappings(student.classId, student.department);
      } else {
        mappings = await storage.getClassSubjectMappings(student.classId);
      }

      // Get teachers for each mapped subject
      const teacherMap: Record<number, any> = {};

      for (const mapping of mappings) {
        try {
          const teachers = await storage.getTeachersForClassSubject(student.classId, mapping.subjectId);
          if (teachers && teachers.length > 0) {
            const teacher = teachers[0];
            teacherMap[mapping.subjectId] = {
              id: teacher.id,
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              email: teacher.email,
              profileImageUrl: teacher.profileImageUrl,
            };
          }
        } catch (e) {
          // Subject may not have a teacher assigned
        }
      }

      res.json(teacherMap);
    } catch (error: any) {
      console.error('Error fetching subject teachers:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch teachers' });
    }
  });

  // Get active exams for current student's subjects (for student portal highlighting)
  // Uses class_subject_mappings as single source of truth (consistent with /api/my-subjects)
  app.get('/api/my-active-exams', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Find student by user ID
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      if (!student.classId) {
        return res.json({ activeExams: {}, examCounts: {} });
      }

      // Get class info to determine if it's JSS or SSS
      const classInfo = await storage.getClass(student.classId);
      if (!classInfo) {
        return res.json({ activeExams: {}, examCounts: {} });
      }

      // Use class_subject_mappings as single source of truth (consistent with /api/my-subjects)
      const level = classInfo?.level ?? '';
      const isSSS = classInfo?.name?.startsWith('SS') || level.includes('Senior Secondary');

      let mappings;
      if (isSSS && student.department) {
        // For SSS students with a department, get mappings for their specific department
        mappings = await storage.getClassSubjectMappings(student.classId, student.department);
      } else {
        // For JSS students or SSS students without department, get mappings with department = null
        mappings = await storage.getClassSubjectMappings(student.classId);
      }

      if (mappings.length === 0) {
        return res.json({ activeExams: {}, examCounts: {} });
      }

      const subjectIds = new Set(mappings.map(m => m.subjectId));

      // Get exams scoped to student's class only (efficient database query)
      const classExams = await storage.getExamsByClass(student.classId);
      const now = new Date();

      // Filter active exams for the student's assigned subjects only
      const activeExamsBySubject: Record<number, any[]> = {};
      const examCountsBySubject: Record<number, number> = {};

      for (const exam of classExams) {
        // Skip if exam is not for student's assigned subjects
        if (!subjectIds.has(exam.subjectId!)) continue;

        // Check if exam is published and active
        const isPublished = exam.isPublished;
        const startTime = exam.startTime ? new Date(exam.startTime) : null;
        const endTime = exam.endTime ? new Date(exam.endTime) : null;

        const isActiveNow = isPublished &&
          (!startTime || startTime <= now) &&
          (!endTime || endTime >= now);

        // Count all available exams per subject (published and not ended)
        if (isPublished && (!endTime || endTime >= now)) {
          examCountsBySubject[exam.subjectId!] = (examCountsBySubject[exam.subjectId!] || 0) + 1;
        }

        if (isActiveNow) {
          if (!activeExamsBySubject[exam.subjectId!]) {
            activeExamsBySubject[exam.subjectId!] = [];
          }
          activeExamsBySubject[exam.subjectId!].push({
            id: exam.id,
            title: exam.name,
            examType: exam.examType,
            duration: exam.timeLimit,
            startDate: exam.startTime,
            endDate: exam.endTime,
          });
        }
      }

      res.json({
        activeExams: activeExamsBySubject,
        examCounts: examCountsBySubject,
      });
    } catch (error: any) {
      console.error('Error fetching active exams:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch active exams' });
    }
  });

  // Student: get syllabus topics for their class (scheme of work view)
  app.get('/api/my-syllabus-topics', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const student = await storage.getStudentByUserId(userId);
      if (!student || !student.classId) {
        return res.json([]);
      }
      const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : undefined;
      const termId    = req.query.termId    ? parseInt(req.query.termId    as string) : undefined;
      const filters: { classId?: number; subjectId?: number; termId?: number; isActive?: boolean; isPublished?: boolean } = {
        classId: student.classId,
        isActive: true,
        isPublished: true,
      };
      if (subjectId && !isNaN(subjectId)) filters.subjectId = subjectId;
      if (termId    && !isNaN(termId))    filters.termId    = termId;
      const topics = await storage.getSyllabusTopics(filters);
      res.json(topics);
    } catch (error: any) {
      console.error('Error fetching syllabus topics for student:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch syllabus topics' });
    }
  });

  // ==================== END STUDENT SUBJECT ASSIGNMENT ROUTES ====================

}
