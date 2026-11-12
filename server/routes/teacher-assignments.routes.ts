/** Auto-split from routes.ts — teacher-assignments (orig lines 13433-13736). See git history. */
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { and } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerTeacherAssignmentsRoutes(app: Express) {
  // ==================== TEACHER ASSIGNMENT ROUTES ====================

  // Create teacher class/subject assignment (Admin only)
  app.post('/api/teacher-assignments', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { teacherId, classId, subjectId, termId } = req.body;

      if (!teacherId || !classId || !subjectId) {
        return res.status(400).json({ message: "teacherId, classId, and subjectId are required" });
      }
      // Check if teacher exists and has teacher role
      const teacher = await storage.getUser(teacherId);
      if (!teacher || teacher.roleId !== ROLES.TEACHER) {
        return res.status(400).json({ message: "Invalid teacher ID" });
      }
      // Check if class exists
      const classExists = await storage.getClass(classId);
      if (!classExists) {
        return res.status(400).json({ message: "Class not found" });
      }
      // Check if subject exists
      const subjectExists = await storage.getSubject(subjectId);
      if (!subjectExists) {
        return res.status(400).json({ message: "Subject not found" });
      }
      const assignment = await storage.createTeacherClassAssignment({
        teacherId,
        classId,
        subjectId,
        termId: termId || null,
        assignedBy: req.user!.id,
        isActive: true
      });

      // Also create a class-subject mapping for department tracking
      // This ensures the class has a record of what subjects are offered
      try {
        const subjectInfo = await storage.getSubject(subjectId);
        const classInfo = await storage.getClass(classId);

        if (subjectInfo && classInfo) {
          const subjectCategory = (subjectInfo.category || 'general').toLowerCase();
          const isSeniorSecondary = (classInfo.level || '').toLowerCase().includes('senior secondary');

          // For SS classes with department subjects, create mapping with department
          // For other classes, create mapping without department
          const department = (isSeniorSecondary && subjectCategory !== 'general') ? subjectCategory : null;

          await storage.createClassSubjectMapping({
            classId,
            subjectId,
            department,
            isCompulsory: false
          });
          console.log(`[TEACHER-ASSIGNMENT] Also created class-subject mapping for ${classInfo.name} - ${subjectInfo.name}`);
        }
      } catch (mappingError: any) {
        // Don't fail if mapping already exists or fails
        console.log(`[TEACHER-ASSIGNMENT] Class-subject mapping creation note: ${mappingError.message}`);
      }

      // Emit real-time event for teacher assignment creation
      realtimeService.emitTableChange('teacher_class_assignments', 'INSERT', assignment, undefined, req.user!.id);

      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create teacher assignment" });
    }
  });

  // Get teacher assignments (Admin gets all, Teacher gets own)
  app.get('/api/teacher-assignments', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { teacherId } = req.query;

      // Teachers can only view their own assignments
      if (req.user!.roleId === ROLES.TEACHER) {
        const assignments = await storage.getTeacherClassAssignments(req.user!.id);

        // Enrich with class and subject names
        const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
          const classInfo = await storage.getClass(assignment.classId);
          const subjectInfo = await storage.getSubject(assignment.subjectId);
          return {
            ...assignment,
            className: classInfo?.name,
            subjectName: subjectInfo?.name
          };
        }));

        return res.json(enrichedAssignments);
      }
      // Only admins and super admins can view assignments for other teachers
      if (req.user!.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      // Admins can view all or filter by teacherId
      if (teacherId) {
        const assignments = await storage.getTeacherClassAssignments(teacherId as string);

        const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
          const classInfo = await storage.getClass(assignment.classId);
          const subjectInfo = await storage.getSubject(assignment.subjectId);
          const teacher = await storage.getUser(assignment.teacherId);
          return {
            ...assignment,
            className: classInfo?.name,
            subjectName: subjectInfo?.name,
            teacherName: `${teacher?.firstName} ${teacher?.lastName}`
          };
        }));

        return res.json(enrichedAssignments);
      }
      // Get all assignments (Admin only)
      // Note: This could be large, consider pagination in future
      res.json({ message: "Please specify teacherId parameter" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teacher assignments" });
    }
  });

  // Get all teachers assigned to a specific class and subject
  app.get('/api/classes/:classId/subjects/:subjectId/teachers', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { classId, subjectId } = req.params;

      const teachers = await storage.getTeachersForClassSubject(Number(classId), Number(subjectId));

      const sanitizedTeachers = teachers.map(teacher => {
        const { passwordHash, ...safeTeacher } = teacher;
        return safeTeacher;
      });

      res.json(sanitizedTeachers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Get all classes and subjects assigned to a specific teacher
  app.get('/api/teachers/:teacherId/assignments', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { teacherId } = req.params;

      // Teachers can only view their own assignments
      if (req.user!.roleId === ROLES.TEACHER && req.user!.id !== teacherId) {
        return res.status(403).json({ message: "You can only view your own assignments" });
      }
      const assignments = await storage.getTeacherClassAssignments(teacherId);

      // Group assignments by class
      const groupedByClass: any = {};

      for (const assignment of assignments) {
        const classInfo = await storage.getClass(assignment.classId);
        const subjectInfo = await storage.getSubject(assignment.subjectId);

        if (!groupedByClass[assignment.classId]) {
          groupedByClass[assignment.classId] = {
            classId: assignment.classId,
            className: classInfo?.name,
            subjects: []
          };
        }
        groupedByClass[assignment.classId].subjects.push({
          assignmentId: assignment.id,
          subjectId: assignment.subjectId,
          subjectName: subjectInfo?.name,
          termId: assignment.termId,
          isActive: assignment.isActive
        });
      }
      res.json(Object.values(groupedByClass));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teacher assignments" });
    }
  });

  // Update teacher assignment (Admin only)
  app.put('/api/teacher-assignments/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedAssignment = await storage.updateTeacherClassAssignment(Number(id), updateData);

      if (!updatedAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Emit real-time event for teacher assignment update
      realtimeService.emitTableChange('teacher_class_assignments', 'UPDATE', updatedAssignment, undefined, req.user!.id);

      res.json(updatedAssignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update teacher assignment" });
    }
  });

  // Delete teacher assignment (Admin only)
  app.delete('/api/teacher-assignments/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteTeacherClassAssignment(Number(id));

      if (!success) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Emit real-time event for teacher assignment deletion
      realtimeService.emitTableChange('teacher_class_assignments', 'DELETE', { id: Number(id) }, undefined, req.user!.id);

      res.json({ message: "Teacher assignment deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete teacher assignment" });
    }
  });

  // Get teachers for a specific class and subject (for exam creation)
  app.get('/api/teachers-for-subject', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { classId, subjectId } = req.query;

      if (!classId || !subjectId) {
        return res.status(400).json({ message: "Both classId and subjectId are required" });
      }
      const teachers = await storage.getTeachersForClassSubject(Number(classId), Number(subjectId));

      if (teachers.length === 0) {
        return res.json([]);
      }
      // Return teacher data with essential information
      const teacherData = teachers.map((teacher) => ({
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        username: teacher.username,
      }));

      res.json(teacherData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Get current teacher's assigned classes and subjects (for filtering in exam creation, score entry, etc.)
  app.get('/api/my-assignments', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const roleId = req.user!.roleId;

      // Admins and Super Admins can see all classes and subjects
      if (roleId === ROLES.SUPER_ADMIN || roleId === ROLES.ADMIN) {
        const allClasses = await storage.getClasses();
        const allSubjects = await storage.getSubjects();
        return res.json({
          isAdmin: true,
          classes: allClasses,
          subjects: allSubjects,
          assignments: [],
        });
      }

      // Teachers can only see their assigned classes and subjects
      if (roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: "Only teachers can access their assignments" });
      }

      const assignments = await storage.getTeacherClassAssignments(userId);

      // Get unique class IDs and subject IDs
      const classIds = [...new Set(assignments.map(a => a.classId))];
      const subjectIds = [...new Set(assignments.map(a => a.subjectId))];

      // Fetch full class and subject details
      const classes = await Promise.all(classIds.map(id => storage.getClass(id)));
      const subjects = await Promise.all(subjectIds.map(id => storage.getSubject(id)));

      // Create a mapping of valid class-subject combinations
      const validCombinations = assignments.map(a => ({
        classId: a.classId,
        subjectId: a.subjectId,
        department: a.department,
        termId: a.termId,
        isActive: a.isActive,
      }));

      res.json({
        isAdmin: false,
        classes: classes.filter(Boolean),
        subjects: subjects.filter(Boolean),
        assignments: validCombinations,
      });
    } catch (error) {
      console.error('Error fetching my assignments:', error);
      res.status(500).json({ message: "Failed to fetch your assignments" });
    }
  });

  // ==================== END TEACHER ASSIGNMENT ROUTES ====================

}
