/** Student admin CRUD — list + create (with parent/student account provisioning).
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


export function registerStudentCrudRoutes(app: Express) {
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
}
