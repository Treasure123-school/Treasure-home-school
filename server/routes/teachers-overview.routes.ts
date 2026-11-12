/** Auto-split from routes.ts — teachers-overview (orig lines 5064-5278). See git history. */
import * as schema from '@shared/schema.pg';
import { upload } from '../routes/upload-config';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { replaceFile } from '../upload-service';
import { students } from '@shared/schema.pg';
import { and } from 'drizzle-orm';
import { type Express } from 'express';
import session from 'express-session';

export async function registerTeachersOverviewRoutes(app: Express) {
  app.get('/api/teacher/classes/:classId/detail', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
    try {
      const classId = parseInt(req.params.classId);
      if (isNaN(classId)) return res.status(400).json({ message: 'Invalid class ID' });

      const classInfo = await storage.getClass(classId);
      if (!classInfo) return res.status(404).json({ message: 'Class not found' });

      const studentRows = await storage.getStudentsByClass(classId);
      const studentsWithUsers = await Promise.all(
        studentRows.map(async (s) => {
          const user = await storage.getUser(s.id);
          return {
            id: s.id,
            admissionNumber: s.admissionNumber,
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            email: user?.email || '',
            isActive: user?.isActive ?? true,
            profileImageUrl: user?.profileImageUrl || null,
            department: s.department || null,
          };
        })
      );

      const teacherUser = classInfo.classTeacherId ? await storage.getUser(classInfo.classTeacherId) : null;

      const subjectsAssigned = req.user!.roleId === ROLES.TEACHER
        ? await storage.getTeacherAssignmentsForClass(req.user!.id, classId)
        : [];

      res.json({
        class: {
          id: classInfo.id,
          name: classInfo.name,
          level: classInfo.level,
          capacity: classInfo.capacity,
          classTeacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : null,
        },
        students: studentsWithUsers,
        subjects: subjectsAssigned,
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch class detail', error: error.message });
    }
  });

  // Update teacher profile (PUT endpoint for editing)
  app.put('/api/teacher/profile/me', authenticateUser, authorizeRoles(ROLES.TEACHER), upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const teacherId = req.user!.id;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Parse the update data
      const updateData = req.body;

      // Handle file uploads using organized storage system
      let profileImageUrl = updateData.profileImageUrl;
      let signatureUrl = updateData.signatureUrl;

      if (files['profileImage']?.[0]) {
        const profileResult = await replaceFile(
          files['profileImage'][0],
          profileImageUrl || undefined,
          {
            uploadType: 'profile',
            userId: teacherId,
            maxSizeMB: 5,
          }
        );
        if (profileResult.success) {
          profileImageUrl = profileResult.url!;
        }
      }

      if (files['signature']?.[0]) {
        const signatureResult = await replaceFile(
          files['signature'][0],
          signatureUrl || undefined,
          {
            uploadType: 'profile',
            userId: teacherId,
            category: 'signature',
            maxSizeMB: 2,
          }
        );
        if (signatureResult.success) {
          signatureUrl = signatureResult.url!;
        }
      }
      // Parse JSON fields
      const subjects = typeof updateData.subjects === 'string' ? JSON.parse(updateData.subjects) : updateData.subjects;
      const assignedClasses = typeof updateData.assignedClasses === 'string' ? JSON.parse(updateData.assignedClasses) : updateData.assignedClasses;

      // Update user table (personal information)
      const userUpdateData: any = {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        phone: updateData.phone || null,
        address: updateData.address || null,
        recoveryEmail: updateData.recoveryEmail || null,
        gender: updateData.gender || null,
        dateOfBirth: updateData.dateOfBirth || null,
        nationalId: updateData.nationalId || null,
      };

      if (profileImageUrl) {
        userUpdateData.profileImageUrl = profileImageUrl;
      }
      await storage.updateUser(teacherId, userUpdateData);

      // Check if profile exists
      const existingProfile = await storage.getTeacherProfile(teacherId);

      // Prepare profile data
      const profileData: any = {
        qualification: updateData.qualification || null,
        specialization: updateData.specialization || null,
        yearsOfExperience: parseInt(updateData.yearsOfExperience) || 0,
        department: updateData.department || null,
        gradingMode: updateData.gradingMode || 'manual',
        notificationPreference: updateData.notificationPreference || 'all',
        availability: updateData.availability || 'full-time',
        subjects: subjects || [],
        assignedClasses: assignedClasses || [],
        updatedAt: new Date()
      };

      if (signatureUrl) {
        profileData.signatureUrl = signatureUrl;
      }

      // Create or update teacher profile
      if (!existingProfile) {
        // Create new profile
        await storage.createTeacherProfile({
          userId: teacherId,
          staffId: updateData.staffId || null,
          ...profileData,
          verified: false,
          firstLogin: false,
        });
      } else {
        // Update existing profile
        await storage.updateTeacherProfile(teacherId, profileData);
      }

      // Fetch and return updated profile
      const updatedProfile = await storage.getTeacherProfile(teacherId);
      const updatedUser = await storage.getUser(teacherId);

      const completeProfile = {
        ...updatedProfile,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        email: updatedUser?.email,
        phone: updatedUser?.phone,
        gender: updatedUser?.gender,
        dateOfBirth: updatedUser?.dateOfBirth,
        nationalId: updatedUser?.nationalId,
        address: updatedUser?.address,
        recoveryEmail: updatedUser?.recoveryEmail,
        profileImageUrl: updatedUser?.profileImageUrl,
      };

      res.json({
        message: 'Profile updated successfully',
        profile: completeProfile
      });

    } catch (error) {
      res.status(500).json({
        message: 'Failed to update profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get teacher overview for admin dashboard (with auto-verified indicator)
  app.get('/api/admin/teachers/overview', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req, res) => {
    try {
      // Get all teachers
      const teachers = await storage.getUsersByRole(ROLES.TEACHER);

      // Get all teacher profiles
      const overview = await Promise.all(teachers.map(async (teacher: any) => {
        const profile = await storage.getTeacherProfile(teacher.id);

        return {
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          phone: teacher.phone,
          staffId: profile?.staffId || null,
          department: profile?.department || null,
          subjects: profile?.subjects || [],
          classes: profile?.assignedClasses || [],
          verified: profile?.verified || false,
          hasProfile: !!profile,
          createdAt: teacher.createdAt,
        };
      }));

      res.json(overview);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch teacher overview' });
    }
  });

  // Initialize session middleware (required for Passport OAuth)
  // CRITICAL: Session must support cross-domain for Render (backend) + Vercel (frontend)
}
