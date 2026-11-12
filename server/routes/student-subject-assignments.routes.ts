/** Auto-split from routes.ts — student-subject-assignments (orig lines 13737-13857). See git history. */
import * as schema from '@shared/schema.pg';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentSubjectAssignmentsRoutes(app: Express) {
  // ==================== STUDENT SUBJECT ASSIGNMENT ROUTES ====================

  // Get subjects for a student based on their class and department
  app.get('/api/students/:studentId/subjects', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;

      // Get student info
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Get assigned subjects
      const assignments = await storage.getStudentSubjectAssignments(studentId);

      // Enrich with subject details
      const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
        const subject = await storage.getSubject(assignment.subjectId);
        return {
          ...assignment,
          subjectName: subject?.name,
          subjectCode: subject?.code,
          category: subject?.category
        };
      }));

      res.json(enrichedAssignments);
    } catch (error: any) {
      console.error('Error fetching student subjects:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch student subjects' });
    }
  });

  // Auto-assign subjects to student based on class level and department
  app.post('/api/students/:studentId/auto-assign-subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;

      // Get student info
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      if (!student.classId) {
        return res.status(400).json({ message: 'Student has no class assigned' });
      }

      // Auto-assign subjects
      const assignments = await storage.autoAssignSubjectsToStudent(
        studentId,
        student.classId,
        student.department || undefined
      );

      res.json({
        message: `Successfully assigned ${assignments.length} subjects to student`,
        assignments
      });
    } catch (error: any) {
      console.error('Error auto-assigning subjects:', error);
      res.status(500).json({ message: error.message || 'Failed to auto-assign subjects' });
    }
  });

  // Manually assign subjects to student
  app.post('/api/students/:studentId/subjects', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const { subjectIds, termId } = req.body;

      if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: 'subjectIds array is required' });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      if (!student.classId) {
        return res.status(400).json({ message: 'Student has no class assigned' });
      }

      const assignments = await storage.assignSubjectsToStudent(
        studentId,
        student.classId,
        subjectIds,
        termId,
        req.user!.id
      );

      res.status(201).json({
        message: `Successfully assigned ${assignments.length} subjects`,
        assignments
      });
    } catch (error: any) {
      console.error('Error assigning subjects:', error);
      res.status(500).json({ message: error.message || 'Failed to assign subjects' });
    }
  });

  // Remove subject assignment from student
  app.delete('/api/student-subject-assignments/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteStudentSubjectAssignment(Number(id));

      if (!success) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      res.json({ message: 'Subject assignment removed successfully' });
    } catch (error: any) {
      console.error('Error removing subject assignment:', error);
      res.status(500).json({ message: error.message || 'Failed to remove subject assignment' });
    }
  });

}
