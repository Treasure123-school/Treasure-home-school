/** Auto-split from routes.ts — student-profile (orig lines 9355-10067). See git history. */
import * as schema from '@shared/schema.pg';
import { BCRYPT_ROUNDS } from '../routes/upload-config';
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

export async function registerStudentProfileRoutes(app: Express) {
  // ==================== STUDENT PROFILE ROUTES ====================

  // Get all students with enriched user data
  app.get('/api/students', authenticateUser, async (req, res) => {
    try {
      // Fetch all students from database
      const allStudents = await storage.getAllStudents(false); // false = only active students

      // Enrich with user data
      const enrichedStudents = await Promise.all(
        allStudents.map(async (student: any) => {
          const user = await storage.getUser(student.id);
          const classInfo = student.classId ? await storage.getClass(student.classId) : null;
          const parentUser = student.parentId ? await storage.getUser(student.parentId) : null;

          return {
            ...student,
            user: user ? {
              id: user.id,
              username: user.username,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
              gender: user.gender,
              dateOfBirth: user.dateOfBirth,
              profileImageUrl: user.profileImageUrl,
              isActive: user.isActive,
              status: user.status
            } : null,
            class: classInfo,
            parent: parentUser ? {
              id: parentUser.id,
              firstName: parentUser.firstName,
              lastName: parentUser.lastName,
              email: parentUser.email,
              phone: parentUser.phone
            } : null
          };
        })
      );

      res.json(enrichedStudents);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch students' });
    }
  });

  // Create a single student
  app.post('/api/students', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      const validatedData = createStudentSchema.parse(req.body);
      const adminUserId = req.user!.id;
      const year = new Date().getFullYear();

      const result = await db.transaction(async (tx: any) => {
        // Generate student credentials
        const studentUsername = await generateStudentUsername();
        const studentPassword = generateStudentPassword();
        const passwordHash = await bcrypt.hash(studentPassword, BCRYPT_ROUNDS);
        const studentEmail = ''; // No auto-generated email

        // Generate UUID for student (required for PostgreSQL)
        const studentId = randomUUID();

        // Create student user account
        const [studentUser] = await tx.insert(users).values({
          id: studentId, // PostgreSQL requires explicit UUID
          username: studentUsername,
          email: studentEmail,
          passwordHash,
          roleId: ROLES.STUDENT,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone || null,
          address: validatedData.address || null,
          dateOfBirth: validatedData.dateOfBirth,
          gender: validatedData.gender,
          profileImageUrl: validatedData.profileImageUrl || null,
          isActive: true,
          status: 'active',
          createdVia: 'admin',
          createdBy: adminUserId,
          mustChangePassword: true
        }).returning();

        // Generate admission number
        const admissionNumber = `THS/${year}/${String(Date.now()).slice(-6)}`;

        // Get class info to determine if department is required (SS1-SS3)
        const classInfo = await storage.getClass(validatedData.classId);
        // Use the class level field for reliable senior secondary detection
        // The level field contains "Senior Secondary" for SS classes
        const classLevel = (classInfo?.level || '').toLowerCase();
        const isSeniorSecondary = classLevel.includes('senior secondary') || classLevel.includes('senior_secondary');

        // For SS1-SS3 classes, department is required
        // If not provided, it will be set when the student selects their subjects
        let department: string | null = null;
        if (validatedData.department) {
          const normalizedDept = validatedData.department.toLowerCase();
          const validDepartments = ['science', 'art', 'commercial'];
          if (validDepartments.includes(normalizedDept)) {
            // Only allow department for senior secondary students
            if (isSeniorSecondary) {
              department = normalizedDept;
            } else {
              console.log(`[CREATE-STUDENT] Department ignored for non-senior secondary class: ${classInfo?.name}`);
            }
          }
        }

        if (isSeniorSecondary && !department) {
          console.log(`[CREATE-STUDENT] Senior Secondary student created without department - will be set when subjects are selected`);
        }

        // Create student record
        const [student] = await tx.insert(students).values({
          id: studentUser.id,
          admissionNumber,
          classId: validatedData.classId,
          admissionDate: validatedData.admissionDate,
          emergencyContact: validatedData.emergencyContact || null,
          medicalInfo: validatedData.medicalInfo || null,
          parentId: validatedData.parentId || null,
          department: department
        }).returning();

        // Handle parent linking/creation if parentPhone provided
        let parentCredentials: any = null;

        if (validatedData.parentPhone && !validatedData.parentId) {
          // Check if parent exists by phone
          const existingParent = await tx.select()
            .from(users)
            .where(and(
              eq(users.phone, validatedData.parentPhone),
              eq(users.roleId, ROLES.PARENT)
            ))
            .limit(1);

          if (existingParent.length > 0) {
            // Link to existing parent
            await tx.update(students)
              .set({ parentId: existingParent[0].id })
              .where(eq(students.id, studentUser.id));

            student.parentId = existingParent[0].id;
          } else {
            // Create new parent account
            const parentUsername = await generateParentUsername();
            const parentPassword = generatePassword();
            const parentHash = await bcrypt.hash(parentPassword, BCRYPT_ROUNDS);
            const parentEmail = ''; // No auto-generated email

            // Generate UUID for parent (required for PostgreSQL)
            const parentId = randomUUID();

            const [parentUser] = await tx.insert(users).values({
              id: parentId, // PostgreSQL requires explicit UUID
              username: parentUsername,
              email: parentEmail,
              passwordHash: parentHash,
              roleId: ROLES.PARENT,
              firstName: validatedData.guardianName || `Parent of ${validatedData.firstName}`,
              lastName: validatedData.lastName,
              phone: validatedData.parentPhone,
              isActive: true,
              status: 'active',
              createdVia: 'admin',
              createdBy: adminUserId,
              mustChangePassword: true
            }).returning();

            // Link student to new parent
            await tx.update(students)
              .set({ parentId: parentUser.id })
              .where(eq(students.id, studentUser.id));

            student.parentId = parentUser.id;
            parentCredentials = {
              username: parentUsername,
              password: parentPassword,
              email: parentEmail
            };
          }
        }

        return {
          student,
          studentUser,
          studentCredentials: {
            username: studentUsername,
            password: studentPassword,
            email: studentEmail
          },
          parentCredentials
        };
      });

      // Auto-assign subjects to student based on class and department
      try {
        const classInfo = await storage.getClass(validatedData.classId);
        const studentDepartment = validatedData.department?.toLowerCase();

        // Determine if senior secondary and get appropriate subjects
        const isSeniorSecondary = (classInfo?.level || '').toLowerCase().includes('senior secondary');

        if (isSeniorSecondary && studentDepartment) {
          // Senior secondary with department - assign department-specific subjects
          await storage.autoAssignSubjectsToStudent(
            result.studentUser.id,
            validatedData.classId,
            studentDepartment
          );
          console.log(`[CREATE-STUDENT] Auto-assigned ${studentDepartment} department subjects to student ${result.studentUser.id}`);
        } else if (!isSeniorSecondary) {
          // Non-senior secondary - assign general subjects only
          await storage.autoAssignSubjectsToStudent(
            result.studentUser.id,
            validatedData.classId
          );
          console.log(`[CREATE-STUDENT] Auto-assigned general subjects to student ${result.studentUser.id}`);
        }
        // Note: SS students without department will get subjects assigned when department is set
      } catch (assignmentError: any) {
        console.error(`[CREATE-STUDENT] Failed to auto-assign subjects:`, assignmentError.message);
        // Don't fail student creation if subject assignment fails
      }

      // Log audit event
      await storage.createAuditLog({
        userId: adminUserId,
        action: 'create_student',
        entityType: 'student',
        entityId: '0',
        newValue: JSON.stringify({
          studentId: result.studentUser.id,
          username: result.studentCredentials.username
        }),
        reason: `Created student ${result.studentUser.firstName} ${result.studentUser.lastName}`,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null
      });

      // Emit realtime event for student creation
      realtimeService.emitTableChange('students', 'INSERT', result.student, undefined, adminUserId);
      realtimeService.emitToRole('admin', 'student.created', {
        student: result.student,
        user: result.studentUser
      });
      if (result.student.classId) {
        realtimeService.emitToClass(result.student.classId.toString(), 'student.created', {
          student: result.student,
          user: result.studentUser
        });
      }

      res.status(201).json({
        message: 'Student created successfully',
        credentials: {
          student: {
            id: result.studentUser.id,
            username: result.studentCredentials.username,
            email: result.studentCredentials.email,
            password: result.studentCredentials.password,
            firstName: result.studentUser.firstName,
            lastName: result.studentUser.lastName,
            admissionNumber: result.student.admissionNumber,
            classId: result.student.classId
          },
          parent: result.parentCredentials
        },
        parentCreated: result.parentCredentials !== null
      });
    } catch (error: any) {

      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation error',
          errors: error.errors
        });
      }
      res.status(500).json({
        message: error.message || 'Failed to create student'
      });
    }
  });

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

  // Get student profile status (check if profile is complete)
  app.get('/api/student/profile/status', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const userId = req.user!.id;
      let user = await storage.getUser(userId);
      const student = await storage.getStudent(userId);

      // ── Canonical 7-field completion calculation ─────────────────────────────
      // Must stay in sync with client/src/hooks/useProfileCompletion.ts
      // recoveryEmail is a security/account field — NOT a profile-completion requirement.
      let completionPercentage = 0;
      if (student) {
        const fields = [
          user?.phone,
          user?.address,
          user?.dateOfBirth,
          user?.gender,
          student?.emergencyContact,
          student?.medicalInfo,
          user?.profileImageUrl,
        ];
        const filledFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
        completionPercentage = Math.round((filledFields / fields.length) * 100);
      }

      // Always persist the freshly calculated value so the stored value never drifts.
      const isComplete = completionPercentage === 100;
      if (
        user &&
        (user.profileCompletionPercentage !== completionPercentage ||
          !!user.profileCompleted !== isComplete)
      ) {
        const updated = await storage.updateStudent(userId, {
          userPatch: {
            profileCompleted: isComplete,
            profileCompletionPercentage: completionPercentage,
            profileSkipped: isComplete ? false : user.profileSkipped,
          }
        });
        if (updated) user = updated.user;
      }

      res.json({
        hasProfile: !!student,
        completed: isComplete,
        skipped: user?.profileSkipped || false,
        // Always return the freshly calculated value — never the stale stored value.
        percentage: completionPercentage,
        firstLogin: !isComplete,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to check profile status' });
    }
  });

  // Student profile setup (first-time login)
  app.post('/api/student/profile/setup', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const userId = req.user!.id;
      const profileData = req.body;


      // Extract user-level fields
      const { phone, address, dateOfBirth, gender, recoveryEmail, bloodGroup, emergencyContact, emergencyPhone, agreement, ...studentFields } = profileData;

      // Save the profile fields first (without hardcoding completion values)
      const updatedStudent = await storage.updateStudent(userId, {
        userPatch: {
          phone,
          address,
          dateOfBirth,
          gender,
          recoveryEmail,
          profileSkipped: false,
        },
        studentPatch: {
          emergencyContact: emergencyContact || null,
          emergencyPhone: emergencyPhone || null,
          guardianName: emergencyContact || null,
          medicalInfo: bloodGroup ? `Blood Group: ${bloodGroup}` : null,
        }
      });

      if (!updatedStudent) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Recalculate completion using the canonical 7-field set after saving
      const u = updatedStudent.user;
      const s = updatedStudent.student;
      const setupFields = [u?.phone, u?.address, u?.dateOfBirth, u?.gender, s?.emergencyContact, s?.medicalInfo, u?.profileImageUrl];
      const setupFilled = setupFields.filter(f => f !== null && f !== undefined && f !== '').length;
      const setupPct = Math.round((setupFilled / setupFields.length) * 100);
      const setupComplete = setupPct === 100;

      await storage.updateStudent(userId, {
        userPatch: {
          profileCompleted: setupComplete,
          profileCompletionPercentage: setupPct,
        }
      });

      res.json({
        message: 'Profile setup completed successfully',
        student: updatedStudent.student,
        user: updatedStudent.user,
        completionPercentage: setupPct,
        profileCompleted: setupComplete,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to setup profile', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Skip student profile setup
  app.post('/api/student/profile/skip', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Mark profile as skipped
      await storage.updateUser(userId, {
        profileSkipped: true,
        profileCompleted: false,
      });

      res.json({
        message: 'Profile setup skipped. You can complete it later in Settings.',
        skipped: true
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to skip profile setup' });
    }
  });

  // ==================== END STUDENT PROFILE ROUTES ====================

  // ==================== JOB VACANCY SYSTEM ROUTES ====================
  // EXTRACTED: See server/routes/job-vacancy.routes.ts
  // ==================== END JOB VACANCY SYSTEM ROUTES ====================
}
