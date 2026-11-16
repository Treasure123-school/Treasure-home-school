/** Student profile onboarding — status, setup, skip.
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


export function registerStudentOnboardingRoutes(app: Express) {

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
}
