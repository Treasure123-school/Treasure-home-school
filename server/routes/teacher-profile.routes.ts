/** Auto-split from routes.ts — teacher-profile (orig lines 4549-5063). See git history. */
import * as schema from '@shared/schema.pg';
import { upload } from '../routes/upload-config';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { users } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express } from 'express';

export async function registerTeacherProfileRoutes(app: Express) {
  // Teacher profile setup (first-time login)
  app.post('/api/teacher/profile/setup', authenticateUser, authorizeRoles(ROLES.TEACHER), upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const {
        gender, dateOfBirth, staffId, nationalId, phoneNumber, recoveryEmail,
        qualification, specialization, yearsOfExperience,
        subjects, assignedClasses, department, gradingMode,
        notificationPreference, availability, agreement
      } = req.body;

      // Parse JSON arrays
      const parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
      const parsedClasses = typeof assignedClasses === 'string' ? JSON.parse(assignedClasses) : assignedClasses;

      // Upload files using organized storage system
      let profileImageUrl: string | null = null;
      let signatureUrl: string | null = null;

      if (files['profileImage']?.[0]) {
        const profileResult = await uploadFileToStorage(files['profileImage'][0], {
          uploadType: 'profile',
          userId: teacherId,
          maxSizeMB: 5,
        });
        if (profileResult.success) {
          profileImageUrl = profileResult.url!;
        }
      }

      if (files['signature']?.[0]) {
        const signatureResult = await uploadFileToStorage(files['signature'][0], {
          uploadType: 'profile',
          userId: teacherId,
          category: 'signature',
          maxSizeMB: 2,
        });
        if (signatureResult.success) {
          signatureUrl = signatureResult.url!;
        }
      }

      // Normalize gender to match database enum (Male, Female, Other)
      const normalizedGender = gender ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() : null;

      // FIX #1: Check if profile already exists FIRST
      const existingTeacherProfile = await storage.getTeacherProfile(teacherId);
      if (existingTeacherProfile) {
        return res.status(409).json({
          message: "Profile already exists. Please update your existing profile instead.",
          existingProfile: true
        });
      }
      // FIX #2: Validate user exists before proceeding
      const user = await storage.getUser(teacherId);
      if (!user) {
        return res.status(404).json({
          message: "User account not found. Please contact support.",
          code: "USER_NOT_FOUND"
        });
      }
      // FIX: Make staffId fully optional - auto-generate if not provided
      let finalStaffId: string | null = null;

      if (staffId && staffId.trim() !== '' && staffId.trim() !== 'undefined' && staffId.trim() !== 'null') {
        // User provided a staff ID - check uniqueness
        try {
          const existingProfile = await storage.getTeacherProfileByStaffId(staffId.trim());
          if (existingProfile && existingProfile.userId !== teacherId) {
            return res.status(409).json({
              message: "Staff ID already exists. Please use a unique Staff ID or leave it blank for auto-generation.",
              code: "STAFF_ID_EXISTS"
            });
          }
          finalStaffId = staffId.trim();
        } catch (staffIdError) {
          // Don't fail - just auto-generate instead
          finalStaffId = null;
        }
      }

      // Auto-generate if still null
      if (!finalStaffId) {
        try {
          const currentYear = new Date().getFullYear();
          const allTeacherProfiles = await storage.getAllTeacherProfiles();

          const teacherProfilesThisYear = allTeacherProfiles.filter((p: any) =>
            p.staffId && p.staffId.startsWith(`THS/TCH/${currentYear}/`)
          );

          const existingNumbers = teacherProfilesThisYear
            .map((p: any) => {
              const match = p.staffId?.match(/THS\/TCH\/\d{4}\/(\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
            .filter((n: number) => !isNaN(n));

          const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
          finalStaffId = `THS/TCH/${currentYear}/${String(nextNumber).padStart(3, '0')}`;

        } catch (autoGenError) {
          // Last resort - use timestamp
          finalStaffId = `THS/TCH/${new Date().getFullYear()}/${Date.now().toString().slice(-3)}`;
        }
      }

      // Create or update teacher profile
      const profileData = {
        userId: teacherId,
        staffId: finalStaffId, // Use validated staffId or null
        subjects: parsedSubjects,
        assignedClasses: parsedClasses,
        qualification,
        yearsOfExperience: parseInt(yearsOfExperience) || 0,
        specialization,
        department,
        signatureUrl,
        gradingMode,
        notificationPreference,
        availability: availability || null,
        firstLogin: false,
        verified: true, // Auto-verify on completion
        verifiedAt: new Date()
      };

      // Update user table with basic info
      const userUpdateData: any = {
        phone: phoneNumber,
        gender: normalizedGender,
        dateOfBirth,
        profileImageUrl
      };

      // Only include nationalId if provided
      if (nationalId && nationalId.trim() !== '' && nationalId !== 'undefined') {
        userUpdateData.nationalId = nationalId.trim();
      }
      // Only include recoveryEmail if provided
      if (recoveryEmail && recoveryEmail.trim() !== '' && recoveryEmail !== 'undefined') {
        userUpdateData.recoveryEmail = recoveryEmail.trim();
      }
      await storage.updateUser(teacherId, userUpdateData);

      // Detect suspicious patterns for admin notification (informational only)
      const isSuspicious = (
        parsedSubjects.length === 0 ||
        parsedClasses.length === 0 ||
        !department ||
        yearsOfExperience === 0
      );

      // Create teacher profile with verified status and theory grading preferences
      // FIX: Always auto-verify completed profiles, suspicious check is for admin notification only
      const profile = await storage.createTeacherProfile({
        ...profileData,
        firstLogin: false,
        autoGradeTheoryQuestions: req.body.autoGradeTheoryQuestions === 'true',
        theoryGradingInstructions: req.body.theoryGradingInstructions || null
      });

      // Send additional notification for admin review if suspicious (informational only)
      if (isSuspicious) {
        const teacher = await storage.getUser(teacherId);
        const teacherFullName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Teacher';

        const missingFields = [];
        if (parsedSubjects.length === 0) missingFields.push('subjects');
        if (parsedClasses.length === 0) missingFields.push('classes');
        if (!department) missingFields.push('department');
        if (yearsOfExperience === 0) missingFields.push('experience');

        await storage.createNotification({
          userId: (await storage.getUsersByRole(ROLES.ADMIN))[0]?.id,
          type: 'teacher_profile_review_required',
          title: '⚠️ Teacher Profile Has Incomplete Data',
          message: `${teacherFullName}'s profile was auto-verified but has incomplete data (missing: ${missingFields.join(', ')}). Please review and update if needed.`,
          relatedEntityType: 'teacher_profile',
          relatedEntityId: profile.id.toString(),
          isRead: false
        });
      }
      // Update user's profile completion status
      await storage.updateUser(teacherId, {
        profileCompleted: true,
        profileCompletionPercentage: 100
      });

      // Get teacher's full name from user record
      const teacher = await storage.getUser(teacherId);
      const teacherFullName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Teacher';

      // Create notification for admins (informational only)
      const admins = await storage.getUsersByRole(ROLES.ADMIN);
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'teacher_profile_created',
          title: '🎉 New Teacher Auto-Verified',
          message: `${teacherFullName} completed profile setup and has been automatically verified. Department: ${department}, Subjects: ${parsedSubjects.length}, Classes: ${parsedClasses.length}`,
          relatedEntityType: 'teacher_profile',
          relatedEntityId: profile.id.toString(),
          isRead: false
        });

        // Send email notification to admin with enhanced details
        try {
          const { sendEmail } = await import('../email-service');

          // Get subject and class names for better readability with error handling
          let subjectNames: string[] = [];
          let classNames: string[] = [];

          try {
            const subjects = await storage.getSubjects();
            subjectNames = parsedSubjects.map((subjectId: number) => {
              const subject = subjects.find((s: any) => s.id === subjectId);
              return subject?.name || `Subject #${subjectId}`;
            });
          } catch (error) {
            subjectNames = parsedSubjects.map((id: number) => `Subject #${id}`);
          }
          try {
            const classes = await storage.getAllClasses(true);
            classNames = parsedClasses.map((classId: number) => {
              const cls = classes.find((c: any) => c.id === classId);
              return cls?.name || `Class #${classId}`;
            });
          } catch (error) {
            classNames = parsedClasses.map((id: number) => `Class #${id}`);
          }

          const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/portal/admin/teachers`;
          const emailBody = `
            <h2>🎉 New Teacher Auto-Verified</h2>
            <p><strong>Teacher:</strong> ${teacherFullName}</p>
            <p><strong>Department:</strong> ${department}</p>
            <p><strong>Subjects:</strong> ${subjectNames.join(', ')}</p>
            <p><strong>Classes:</strong> ${classNames.join(', ')}</p>
            <p><strong>Qualification:</strong> ${qualification}</p>
            <p><strong>Years of Experience:</strong> ${yearsOfExperience}</p>
            <p><strong>Staff ID:</strong> ${staffId || 'Pending'}</p>
            <p><a href="${dashboardUrl}">View in Admin Dashboard</a></p>
          `;

          await sendEmail({
            to: admin.email,
            subject: '🎉 New Teacher Auto-Verified - THS Portal',
            html: emailBody
          });
        } catch (emailError) {
          // Don't fail the entire process if email fails
        }
      }

      // Log audit event
      await storage.createAuditLog({
        userId: teacherId,
        action: 'teacher_profile_setup_completed',
        entityType: 'teacher_profile',
        entityId: String(profile.id),
        newValue: JSON.stringify({ staffId: finalStaffId, subjects: parsedSubjects, classes: parsedClasses }),
        reason: 'Teacher completed first-time profile setup',
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || null
      });

      // Return complete profile with correct field names
      const completeProfileResponse = {
        id: profile.id,
        userId: profile.userId,
        staffId: profile.staffId,
        subjects: Array.isArray(profile.subjects) ? profile.subjects : (profile.subjects ? [profile.subjects] : []),
        assignedClasses: Array.isArray(profile.assignedClasses) ? profile.assignedClasses : (profile.assignedClasses ? [profile.assignedClasses] : []), // FIX: Use correct field name
        department: profile.department,
        qualification: profile.qualification,
        yearsOfExperience: profile.yearsOfExperience,
        specialization: profile.specialization,
        verified: profile.verified,
        firstLogin: profile.firstLogin
      };


      res.json({
        message: 'Profile setup completed successfully! You can now access your dashboard.',
        hasProfile: true,
        verified: profile.verified,
        profile: completeProfileResponse
      });
    } catch (error) {
      // Extract meaningful error information
      let errorMessage = 'Failed to setup teacher profile';
      let statusCode = 500;
      let errorCode = 'UNKNOWN_ERROR';

      if (error instanceof Error) {
        // Check for PostgreSQL/database specific errors
        const dbError = error as any;

        // Unique constraint violation
        if (dbError.code === '23505' || dbError.constraint) {
          errorMessage = `A profile with this ${dbError.constraint?.includes('staff_id') ? 'Staff ID' : 'information'} already exists.`;
          statusCode = 409;
          errorCode = 'DUPLICATE_ENTRY';
        }
        // Foreign key violation
        else if (dbError.code === '23503') {
          errorMessage = 'Invalid reference data provided. Please check your selections.';
          statusCode = 400;
          errorCode = 'INVALID_REFERENCE';
        }
        // Not null violation
        else if (dbError.code === '23502') {
          errorMessage = `Required field missing: ${dbError.column || 'unknown'}`;
          statusCode = 400;
          errorCode = 'MISSING_REQUIRED_FIELD';
        }
        // Check constraint violation
        else if (dbError.code === '23514') {
          errorMessage = 'Invalid data provided. Please check your input values.';
          statusCode = 400;
          errorCode = 'INVALID_DATA';
        }
        // Generic error message extraction
        else if (error.message) {
          errorMessage = error.message;

          // Determine status code based on message
          if (error.message.toLowerCase().includes('already exists') ||
            error.message.toLowerCase().includes('duplicate')) {
            statusCode = 409;
            errorCode = 'DUPLICATE_ENTRY';
          } else if (error.message.toLowerCase().includes('not found')) {
            statusCode = 404;
            errorCode = 'NOT_FOUND';
          } else if (error.message.toLowerCase().includes('invalid') ||
            error.message.toLowerCase().includes('validation')) {
            statusCode = 400;
            errorCode = 'VALIDATION_ERROR';
          }
        }
      }
      res.status(statusCode).json({
        message: errorMessage,
        code: errorCode,
        details: error instanceof Error ? error.message : undefined,
        constraint: (error as any)?.constraint
      });
    }
  });

  // Get teacher profile status (check if setup is needed)
  app.get('/api/teacher/profile/status', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const profile = await storage.getTeacherProfile(teacherId);
      const user = await storage.getUser(teacherId);

      // Check if profile has minimum required fields filled (AND-based for core professional fields)
      // Profile is complete when: has at least department OR qualification, AND has subjects or classes assigned
      const hasBasicProfessionalInfo = profile && (profile.department || profile.qualification);
      const hasAssignments = profile && (
        (profile.subjects && profile.subjects.length > 0) ||
        (profile.assignedClasses && profile.assignedClasses.length > 0)
      );

      // Profile is considered complete when it has basic info OR has assignments
      // This allows admins to assign classes/subjects without requiring all fields
      const isProfileComplete = profile && (hasBasicProfessionalInfo || hasAssignments);

      const status = {
        hasProfile: !!profile,
        profileCompleted: !!isProfileComplete,
        verified: profile?.verified || false,
        firstLogin: profile?.firstLogin !== false
      };


      res.json(status);
    } catch (error) {
      res.status(500).json({ message: 'Failed to check profile status' });
    }
  });

  // Skip teacher profile setup
  app.post('/api/teacher/profile/skip', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req, res) => {
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
        message: 'Profile setup skipped. You can complete it later from your dashboard.',
        skipped: true
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to skip profile setup' });
    }
  });

  // Get teacher's own profile with user data
  app.get('/api/teacher/profile/me', authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profile = await storage.getTeacherProfile(userId);

      // Get user data first
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // If no profile exists, return user data with empty profile fields
      // This allows the profile page to display an empty form for new teachers
      if (!profile) {
        const emptyProfile = {
          id: null,
          userId: userId,
          staffId: null,
          subjects: [],
          assignedClasses: [],
          department: null,
          qualification: null,
          yearsOfExperience: null,
          specialization: null,
          verified: false,
          firstLogin: true,
          gradingMode: 'manual',
          notificationPreference: 'all',
          availability: 'full-time',
          signatureUrl: null,
          // User fields
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || '',
          gender: user.gender || '',
          dateOfBirth: user.dateOfBirth || '',
          nationalId: user.nationalId || '',
          address: user.address || '',
          recoveryEmail: user.recoveryEmail || '',
          profileImageUrl: user.profileImageUrl || '',
          updatedAt: null,
          isNewProfile: true // Flag to indicate this is a new profile that needs creation
        };
        return res.json(emptyProfile);
      }

      // Build complete profile with ALL fields merged from both tables
      const completeProfile = {
        // Profile fields
        id: profile.id,
        userId: profile.userId,
        staffId: profile.staffId,
        subjects: Array.isArray(profile.subjects) ? profile.subjects : (profile.subjects ? [profile.subjects] : []),
        assignedClasses: Array.isArray(profile.assignedClasses) ? profile.assignedClasses : (profile.assignedClasses ? [profile.assignedClasses] : []),
        department: profile.department,
        qualification: profile.qualification,
        yearsOfExperience: profile.yearsOfExperience,
        specialization: profile.specialization,
        verified: profile.verified,
        firstLogin: profile.firstLogin,

        // CRITICAL FIX: Include ALL user fields from users table
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        gender: user.gender || '',
        dateOfBirth: user.dateOfBirth || '',
        nationalId: user.nationalId || '', // ✅ FIX: From users.national_id column
        address: user.address || '',
        recoveryEmail: user.recoveryEmail || '', // ✅ FIX: From users.recovery_email column
        profileImageUrl: user.profileImageUrl || '', // ✅ FIX: From users.profile_image_url column

        // Additional profile fields
        gradingMode: profile.gradingMode,
        notificationPreference: profile.notificationPreference,
        availability: profile.availability,
        signatureUrl: profile.signatureUrl,
        updatedAt: profile.updatedAt
      };

      res.json(completeProfile);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
    }
  });

  // Get teacher dashboard data (profile, timetable, assignments)
  app.get('/api/teacher/dashboard', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const dashboardData = await storage.getTeacherDashboardData(teacherId);

      res.json(dashboardData);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
    }
  });

  // GET class detail with student list (joined with user info) for teacher
}
