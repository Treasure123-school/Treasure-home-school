/** Student views — self profile, by-id, class history + admin delete.
/** Auto-split from routes.ts — student-profile (orig lines 9355-10067). See git history. */
import * as schema from '@shared/schema.pg';
import { BCRYPT_ROUNDS } from '../routes/upload-config';
import { invalidateVisibilityCache } from '../exam-visibility';
import { generatePassword, generateStudentPassword } from '../auth-utils';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { generateParentUsername, generateStudentUsername } from '../username-generator';
import { createStudentSchema } from '@shared/schema.pg';
import { students, users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';
import { ZodError } from 'zod';


export function registerStudentViewRoutes(app: Express) {

  // Get current student's info (for student portal)
  // NOTE: must be registered BEFORE '/api/students/:id' below — otherwise
  // Express matches "me" as the :id param and this handler is never reached.
  app.get('/api/students/me', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Find student by user ID
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      // Get user info for firstName, lastName, dateOfBirth
      const user = await storage.getUser(userId);

      // Get class info if assigned
      let className = null;
      if (student.classId) {
        const classInfo = await storage.getClass(student.classId);
        className = classInfo?.name;
      }

      res.json({
        id: student.id,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        studentId: student.admissionNumber,
        classId: student.classId,
        className,
        department: student.department,
        dateOfBirth: user?.dateOfBirth || null,
        enrollmentDate: student.admissionDate,
      });
    } catch (error: any) {
      console.error('Error fetching student info:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch student info' });
    }
  });

  // Get student profile by ID
  app.get('/api/students/:id', authenticateUser, async (req, res) => {
    try {
      const studentId = req.params.id;

      // Ensure student can only access their own profile (or admin/teacher can access)
      if (req.user!.id !== studentId && req.user!.roleId !== ROLES.ADMIN && req.user!.roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const student = await storage.getStudent(studentId);

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      res.json(student);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch student data' });
    }
  });

  // Get student's assigned classes
  app.get('/api/students/:id/classes', authenticateUser, async (req, res) => {
    try {
      const studentId = req.params.id;

      // Ensure student can only access their own classes (or admin/teacher can access)
      if (req.user!.id !== studentId && req.user!.roleId !== ROLES.ADMIN && req.user!.roleId !== ROLES.TEACHER) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const student = await storage.getStudent(studentId);
      const classes = student?.classId ? await storage.getClass(student.classId) : null;
      res.json(classes);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch classes' });
    }
  });

  // Update student profile
  app.patch('/api/students/:id', authenticateUser, async (req, res) => {
    try {
      const studentId = req.params.id;

      // Ensure student can only update their own profile (or admin can update)
      if (req.user!.id !== studentId && req.user!.roleId !== ROLES.ADMIN) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      const updates = req.body;

      // Separate user fields from student fields
      const userFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'recoveryEmail', 'dateOfBirth', 'gender', 'profileImageUrl'];
      const studentFields = ['emergencyContact', 'emergencyPhone', 'medicalInfo', 'guardianName', 'department', 'classId'];

      const userPatch: any = {};
      const studentPatch: any = {};

      // Separate the fields and prune undefined values
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && updates[key] !== null) {
          if (userFields.includes(key)) {
            userPatch[key] = updates[key];
          } else if (studentFields.includes(key)) {
            studentPatch[key] = updates[key];
          }
        }
      });

      // Get existing student for realtime event and validation
      const existingStudent = await storage.getStudent(studentId);

      // Determine the target class ID (new class if provided, otherwise existing)
      const targetClassId = studentPatch.classId || existingStudent?.classId;

      // Get the target class info to check if it's senior secondary
      // Use the class level field for reliable detection
      let isSeniorSecondary = false;
      if (targetClassId) {
        const classInfo = await storage.getClass(targetClassId);
        const classLevel = (classInfo?.level || '').toLowerCase();
        isSeniorSecondary = classLevel.includes('senior secondary') || classLevel.includes('senior_secondary');
      }

      // Handle department validation based on class type
      if (studentPatch.department !== undefined) {
        if (!isSeniorSecondary) {
          // Non-senior secondary students cannot have departments
          delete studentPatch.department;
          console.log(`[UPDATE-STUDENT] Department update ignored for non-senior secondary class`);
        } else if (studentPatch.department) {
          // Normalize and validate department value
          const normalizedDept = studentPatch.department.toLowerCase();
          const validDepartments = ['science', 'art', 'commercial'];
          if (validDepartments.includes(normalizedDept)) {
            studentPatch.department = normalizedDept;
          } else {
            delete studentPatch.department;
          }
        }
      }

      // If changing from SS class to non-SS class, clear the department
      if (studentPatch.classId && existingStudent?.classId) {
        const oldClassInfo = await storage.getClass(existingStudent.classId);
        const oldClassLevel = (oldClassInfo?.level || '').toLowerCase();
        const wasInSeniorSecondary = oldClassLevel.includes('senior secondary') || oldClassLevel.includes('senior_secondary');

        if (wasInSeniorSecondary && !isSeniorSecondary) {
          // Moving from SS class to non-SS class - clear department
          studentPatch.department = null;
          console.log(`[UPDATE-STUDENT] Clearing department as student moved from SS class to non-SS class`);
        }
      }

      // Update student record
      const updatedStudent = await storage.updateStudent(studentId, {
        userPatch: Object.keys(userPatch).length > 0 ? userPatch : undefined,
        studentPatch: Object.keys(studentPatch).length > 0 ? studentPatch : undefined
      });

      if (!updatedStudent) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // ── Recalculate and persist profile completion after every update ──────
      // Canonical 7-field set (must match /api/student/profile/status and the frontend hook).
      const merged = updatedStudent;
      const completionFields = [
        merged.user?.phone,
        merged.user?.address,
        merged.user?.dateOfBirth,
        merged.user?.gender,
        merged.student?.emergencyContact,
        merged.student?.medicalInfo,
        merged.user?.profileImageUrl,
      ];
      const filledCount = completionFields.filter(f => f !== null && f !== undefined && f !== '').length;
      const newPct = Math.round((filledCount / completionFields.length) * 100);
      const newIsComplete = newPct === 100;
      await storage.updateStudent(studentId, {
        userPatch: {
          profileCompletionPercentage: newPct,
          profileCompleted: newIsComplete,
        }
      });

      const visibilityChanged =
        existingStudent?.classId !== updatedStudent.student.classId ||
        existingStudent?.department !== updatedStudent.student.department;

      if (visibilityChanged) {
        invalidateVisibilityCache({ studentId });
        const affectedClassIds = new Set([existingStudent?.classId, updatedStudent.student.classId]);
        for (const affectedClassId of affectedClassIds) {
          if (affectedClassId) {
            invalidateVisibilityCache({ classId: affectedClassId });
          }
        }
      }

      // Emit realtime event for student update
      realtimeService.emitTableChange('students', 'UPDATE', updatedStudent, existingStudent, req.user!.id);
      realtimeService.emitToRole('admin', 'student.updated', updatedStudent);
      if (updatedStudent.student.classId) {
        realtimeService.emitToClass(updatedStudent.student.classId.toString(), 'student.updated', updatedStudent);
      }

      res.json({ ...updatedStudent, profileCompletionPercentage: newPct, profileCompleted: newIsComplete });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update student profile' });
    }
  });

  // Block / Unblock student (Admin only)
  app.patch('/api/students/:id/block', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const studentId = req.params.id;
      const { isActive } = req.body;
      const adminUser = req.user!;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: 'isActive must be a boolean value' });
      }

      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Update both isActive flag and status so login is properly blocked/allowed
      const newStatus = isActive ? 'active' : 'suspended';
      await storage.setUserActive(studentId, isActive);
      await storage.updateUserStatus(studentId, newStatus, adminUser.id,
        isActive ? 'Account unblocked by admin' : 'Account blocked by admin'
      );

      // Audit log (non-blocking)
      storage.createAuditLog({
        userId: adminUser.id,
        action: isActive ? 'student_unblocked' : 'student_blocked',
        entityType: 'user',
        entityId: studentId,
        newValue: JSON.stringify({ studentId, isActive, status: newStatus }),
        reason: isActive ? `Admin unblocked student account` : `Admin blocked student account`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});

      res.json({
        message: isActive ? 'Student account unblocked successfully' : 'Student account blocked successfully',
        studentId,
        isActive,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update student status' });
    }
  });

  // Delete student (soft delete - sets isActive to false)
  app.delete('/api/students/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const studentId = req.params.id;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(studentId)) {
        return res.status(400).json({ message: 'Invalid student ID format' });
      }
      // Check if student exists
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      // Perform soft delete (sets isActive = false, records deletion timestamp)
      const deleted = await storage.deleteStudent(studentId, req.user!.id);

      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete student' });
      }

      // Emit realtime event for student deletion
      realtimeService.emitTableChange('students', 'DELETE', { id: studentId }, student, req.user!.id);
      realtimeService.emitToRole('admin', 'student.deleted', { ...student, id: studentId });
      if (student.classId) {
        realtimeService.emitToClass(student.classId.toString(), 'student.deleted', { ...student, id: studentId });
      }

      res.json({
        success: true,
        message: 'Student deleted successfully',
        studentId: studentId
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete student' });
    }
  });
}
