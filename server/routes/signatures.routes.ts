/** Auto-split from routes.ts — signatures (orig lines 13018-13432). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { and, eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerSignaturesRoutes(app: Express) {
  // ==================== SIGNATURE ROUTES ====================

  // Sign report card as class teacher
  // SECURITY: Only the actual assigned class teacher can sign as teacher
  // Admins cannot sign as teacher - they must use the principal signing endpoint
  app.post('/api/reports/:reportCardId/sign/teacher', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { teacherRemarks } = req.body;
      const userId = req.user!.id;

      // Get the report card to check class assignment
      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Get the class to check if user is the assigned class teacher
      const classInfo = await storage.getClass(reportCard.classId);
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }

      // STRICT: Only the assigned class teacher can sign as teacher
      // No admin override allowed - this ensures proper attribution
      if (classInfo.classTeacherId !== userId) {
        return res.status(403).json({
          message: 'Only the assigned class teacher can sign this report card. Please use the principal signature option if you are an administrator.',
          code: 'NOT_CLASS_TEACHER'
        });
      }

      // Get teacher's signature from profile
      const teacherProfile = await storage.getTeacherProfile(userId);
      const signatureUrl = teacherProfile?.signatureUrl || null;

      if (!signatureUrl) {
        return res.status(400).json({
          message: 'You must set up your signature first in your profile settings',
          code: 'NO_SIGNATURE'
        });
      }

      // Update report card with teacher signature
      const updatedReportCard = await db.update(schema.reportCards)
        .set({
          teacherSignedBy: userId,
          teacherSignedAt: new Date(),
          teacherSignatureUrl: signatureUrl,
          teacherRemarks: teacherRemarks || reportCard.teacherRemarks,
          status: reportCard.status === 'draft' ? 'finalized' : reportCard.status,
          updatedAt: new Date()
        })
        .where(eq(schema.reportCards.id, Number(reportCardId)))
        .returning();

      if (!updatedReportCard.length) {
        return res.status(500).json({ message: 'Failed to sign report card' });
      }

      // Emit realtime event
      realtimeService.emitReportCardEvent(Number(reportCardId), 'updated', {
        reportCardId: Number(reportCardId),
        signedBy: 'teacher',
        signerId: userId
      }, userId);

      res.json({
        reportCard: updatedReportCard[0],
        message: 'Report card signed successfully as class teacher'
      });
    } catch (error: any) {
      console.error('Error signing report card as teacher:', error);
      res.status(500).json({ message: error.message || 'Failed to sign report card' });
    }
  });

  // Sign report card as principal (Admin/Super Admin only)
  app.post('/api/reports/:reportCardId/sign/principal', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { principalRemarks } = req.body;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      // Get the report card
      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Get admin's signature from profile
      let signatureUrl: string | null = null;

      if (userRoleId === ROLES.SUPER_ADMIN) {
        const superAdminProfile = await storage.getSuperAdminProfile(userId);
        signatureUrl = superAdminProfile?.signatureUrl || null;
      } else {
        const adminProfile = await storage.getAdminProfile(userId);
        signatureUrl = adminProfile?.signatureUrl || null;
      }

      if (!signatureUrl) {
        return res.status(400).json({
          message: 'You must set up your signature first in your profile settings',
          code: 'NO_SIGNATURE'
        });
      }

      // Update report card with principal signature
      const updatedReportCard = await db.update(schema.reportCards)
        .set({
          principalSignedBy: userId,
          principalSignedAt: new Date(),
          principalSignatureUrl: signatureUrl,
          principalRemarks: principalRemarks || reportCard.principalRemarks,
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.reportCards.id, Number(reportCardId)))
        .returning();

      if (!updatedReportCard.length) {
        return res.status(500).json({ message: 'Failed to sign report card' });
      }

      // Emit realtime event
      realtimeService.emitReportCardEvent(Number(reportCardId), 'published', {
        reportCardId: Number(reportCardId),
        signedBy: 'principal',
        signerId: userId
      }, userId);

      // Notify parent if student has parent linked
      setImmediate(async () => {
        try {
          const student = await storage.getStudent(reportCard.studentId);
          if (student?.parentId) {
            realtimeService.emitToUser(student.parentId, 'reportcard.published', {
              reportCardId: Number(reportCardId),
              studentId: reportCard.studentId
            });
          }
        } catch (e) {
          console.warn('Could not notify parent:', e);
        }
      });

      res.json({
        reportCard: updatedReportCard[0],
        message: 'Report card signed and published successfully as principal'
      });
    } catch (error: any) {
      console.error('Error signing report card as principal:', error);
      res.status(500).json({ message: error.message || 'Failed to sign report card' });
    }
  });

  // Save user signature (for admin/super admin profiles)
  app.post('/api/user/signature', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;
      const { signatureDataUrl } = req.body;

      if (!signatureDataUrl) {
        return res.status(400).json({ message: 'Signature data is required' });
      }

      // Validate it's a proper data URL
      if (!signatureDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ message: 'Invalid signature format' });
      }

      // Store signature based on user role
      if (userRoleId === ROLES.TEACHER) {
        // Check if profile exists first
        const existingProfile = await storage.getTeacherProfile(userId);
        if (!existingProfile) {
          // Create a minimal profile with just the signature
          await db.insert(schema.teacherProfiles).values({
            userId,
            signatureUrl: signatureDataUrl,
            firstLogin: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await db.update(schema.teacherProfiles)
            .set({
              signatureUrl: signatureDataUrl,
              updatedAt: new Date()
            })
            .where(eq(schema.teacherProfiles.userId, userId));
        }
      } else if (userRoleId === ROLES.ADMIN) {
        // Check if profile exists first
        const existingProfile = await storage.getAdminProfile(userId);
        if (!existingProfile) {
          await db.insert(schema.adminProfiles).values({
            userId,
            signatureUrl: signatureDataUrl,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await db.update(schema.adminProfiles)
            .set({
              signatureUrl: signatureDataUrl,
              updatedAt: new Date()
            })
            .where(eq(schema.adminProfiles.userId, userId));
        }
      } else if (userRoleId === ROLES.SUPER_ADMIN) {
        // Check if profile exists first
        const existingProfile = await storage.getSuperAdminProfile(userId);
        if (!existingProfile) {
          await db.insert(schema.superAdminProfiles).values({
            userId,
            signatureUrl: signatureDataUrl,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          await db.update(schema.superAdminProfiles)
            .set({
              signatureUrl: signatureDataUrl,
              updatedAt: new Date()
            })
            .where(eq(schema.superAdminProfiles.userId, userId));
        }
      } else {
        return res.status(403).json({ message: 'Signature not applicable for your role' });
      }

      res.json({ message: 'Signature saved successfully' });
    } catch (error: any) {
      console.error('Error saving signature:', error);
      res.status(500).json({ message: error.message || 'Failed to save signature' });
    }
  });

  // Get user signature
  app.get('/api/user/signature', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      let signatureUrl: string | null = null;

      if (userRoleId === ROLES.TEACHER) {
        const profile = await storage.getTeacherProfile(userId);
        signatureUrl = profile?.signatureUrl || null;
      } else if (userRoleId === ROLES.ADMIN) {
        const profile = await storage.getAdminProfile(userId);
        signatureUrl = profile?.signatureUrl || null;
      } else if (userRoleId === ROLES.SUPER_ADMIN) {
        const profile = await storage.getSuperAdminProfile(userId);
        signatureUrl = profile?.signatureUrl || null;
      }

      res.json({ signatureUrl, hasSignature: !!signatureUrl });
    } catch (error: any) {
      console.error('Error getting signature:', error);
      res.status(500).json({ message: error.message || 'Failed to get signature' });
    }
  });

  // Check if user can sign a report card
  app.get('/api/reports/:reportCardId/sign-permissions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const userId = req.user!.id;
      const userRoleId = req.user!.roleId;

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const classInfo = await storage.getClass(reportCard.classId);
      const isClassTeacher = classInfo?.classTeacherId === userId;
      const isAdmin = userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN;

      // Get user's signature status
      let hasSignature = false;
      if (userRoleId === ROLES.TEACHER) {
        const profile = await storage.getTeacherProfile(userId);
        hasSignature = !!profile?.signatureUrl;
      } else if (userRoleId === ROLES.ADMIN) {
        const profile = await storage.getAdminProfile(userId);
        hasSignature = !!profile?.signatureUrl;
      } else if (userRoleId === ROLES.SUPER_ADMIN) {
        const profile = await storage.getSuperAdminProfile(userId);
        hasSignature = !!profile?.signatureUrl;
      }

      res.json({
        canSignAsTeacher: isClassTeacher && !reportCard.teacherSignedBy,
        canSignAsPrincipal: isAdmin && !reportCard.principalSignedBy,
        isClassTeacher,
        isAdmin,
        hasSignature,
        teacherSigned: !!reportCard.teacherSignedBy,
        principalSigned: !!reportCard.principalSignedBy,
        teacherSignatureUrl: reportCard.teacherSignatureUrl,
        principalSignatureUrl: reportCard.principalSignatureUrl,
        teacherSignedAt: reportCard.teacherSignedAt,
        principalSignedAt: reportCard.principalSignedAt
      });
    } catch (error: any) {
      console.error('Error getting sign permissions:', error);
      res.status(500).json({ message: error.message || 'Failed to get sign permissions' });
    }
  });

  // ==================== END SIGNATURE ROUTES ====================

  // Get exams by class and term with subject info
  app.get('/api/reports/exams/:classId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId } = req.params;
      const { termId } = req.query;

      const exams = await storage.getExamsWithSubjectsByClassAndTerm(
        Number(classId),
        termId ? Number(termId) : undefined
      );

      res.json(exams);
    } catch (error: any) {
      console.error('Error getting exams:', error);
      res.status(500).json({ message: error.message || 'Failed to get exams' });
    }
  });

  // Recalculate a report card (totals, grade) and update class positions
  app.post('/api/reports/:reportCardId/recalculate', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;
      const { gradingScale = 'standard' } = req.body;

      // 1. Re-apply the weighted formula to scores ALREADY ON THE ITEMS.
      //    Does NOT re-fetch from exam_results so manually-entered raw scores
      //    are preserved.  Only re-derives obtainedMarks / percentage / grade /
      //    remarks from the stored testScore + examScore columns.
      //    Items where isOverridden=true are skipped.
      const reapplyResult = await storage.reapplyWeightedScoresToItems(Number(reportCardId));
      if (reapplyResult.errors.length > 0) {
        console.warn('[RECALC] Some items had errors:', reapplyResult.errors);
      }

      // 2. Recompute header totals + overall grade from the freshly recalculated items
      //    (reapplyWeightedScoresToItems already calls recalculateReportCard internally,
      //     but we call it again here so we always get back the latest row to return)
      const updatedReportCard = await storage.recalculateReportCard(
        Number(reportCardId),
        gradingScale
      );

      if (!updatedReportCard) {
        return res.status(404).json({ message: 'Report card not found or has no items' });
      }

      // 2. Re-rank everyone in the same class+term so positions stay accurate
      if (updatedReportCard.classId && updatedReportCard.termId) {
        try {
          const settingsRows = await db.select({ positioningMethod: schema.systemSettings.positioningMethod }).from(schema.systemSettings).limit(1);
          const positioningMethod = settingsRows[0]?.positioningMethod || 'average';

          const allCards = await db.select({
            id:           schema.reportCards.id,
            totalScore:   schema.reportCards.totalScore,
            averageScore: schema.reportCards.averageScore,
          })
            .from(schema.reportCards)
            .where(and(
              eq(schema.reportCards.classId, updatedReportCard.classId),
              eq(schema.reportCards.termId,  updatedReportCard.termId),
            ));

          const totalInClass = allCards.length;
          const sorted = [...allCards].sort((a, b) => {
            const sa = positioningMethod === 'average' ? (a.averageScore ?? 0) : (a.totalScore ?? a.averageScore ?? 0);
            const sb = positioningMethod === 'average' ? (b.averageScore ?? 0) : (b.totalScore ?? b.averageScore ?? 0);
            return sb - sa;
          });

          let lastPos = 1;
          let prevScore: number | null = null;
          for (let i = 0; i < sorted.length; i++) {
            const card = sorted[i];
            const score = positioningMethod === 'average' ? (card.averageScore ?? 0) : (card.totalScore ?? card.averageScore ?? 0);
            if (i === 0) { lastPos = 1; }
            else if (score !== prevScore) { lastPos = i + 1; }
            prevScore = score;
            await db.update(schema.reportCards)
              .set({ position: lastPos, totalStudentsInClass: totalInClass, updatedAt: new Date() })
              .where(eq(schema.reportCards.id, card.id));
          }
        } catch (posErr: any) {
          console.warn('[RECALC] Position update failed (non-fatal):', posErr.message);
        }
      }

      res.json({ ...updatedReportCard, recalculated: true });
    } catch (error: any) {
      console.error('Error recalculating report card:', error);
      res.status(500).json({ message: error.message || 'Failed to recalculate report card' });
    }
  });

  // ==================== END REPORT CARD ROUTES ====================

}
