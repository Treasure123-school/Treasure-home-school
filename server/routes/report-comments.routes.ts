/** Default comments + comment backfill (admin) — split from enhanced-report-cards.routes.ts. */
/** Auto-split from routes.ts — enhanced-report-cards (orig lines 12109-13017). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { generatePrincipalComment, generateTeacherComment, resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';


  // ==================== ENHANCED REPORT CARD ROUTES (Teacher Portal) ====================

  // Get teacher's accessible report cards - shows only subjects where they created exams
  // This endpoint returns report cards with items filtered to show only subjects
  // where the teacher created the test or main exam
export async function registerReportCommentsRoutes(app: Express) {
  // Get default comments based on student performance
  app.get('/api/reports/:reportCardId/default-comments', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const student = await storage.getStudent(reportCard.studentId);
      // getStudent returns user fields merged with student data (firstName, lastName, etc.)
      const studentName = student ? `${(student as any).firstName || 'Student'}` : 'Student';
      const percentage = reportCard.averagePercentage || 0;

      // Generate encouraging comments based on performance
      const teacherComment = generateTeacherComment(studentName, percentage);
      const principalComment = generatePrincipalComment(studentName, percentage);

      res.json({
        teacherComment,
        principalComment,
        studentName,
        averagePercentage: percentage
      });
    } catch (error: any) {
      console.error('Error generating default comments:', error);
      res.status(500).json({ message: error.message || 'Failed to generate comments' });
    }
  });

  // Backfill default comments for all report cards that don't have comments
  // Admin-only endpoint to populate existing reports with auto-generated comments
  app.post('/api/reports/backfill-comments', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { termId, classId, overwrite = false } = req.body;

      // Build query conditions
      const conditions: any[] = [];
      if (termId) conditions.push(eq(schema.reportCards.termId, Number(termId)));
      if (classId) conditions.push(eq(schema.reportCards.classId, Number(classId)));

      // Get report cards that need comments (no existing comments unless overwrite is true)
      let query = db.select({
        id: schema.reportCards.id,
        studentId: schema.reportCards.studentId,
        averagePercentage: schema.reportCards.averagePercentage,
        teacherRemarks: schema.reportCards.teacherRemarks,
        principalRemarks: schema.reportCards.principalRemarks,
      }).from(schema.reportCards);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const reportCards = await query;

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const rc of reportCards) {
        try {
          // Skip if both comments exist and overwrite is false
          if (!overwrite && rc.teacherRemarks && rc.principalRemarks) {
            skipped++;
            continue;
          }

          // Get student last name for personalized comments (school convention uses lastName)
          // getStudent returns user fields merged with student data (firstName, lastName, etc.)
          const student = await storage.getStudent(rc.studentId);
          let studentName = 'Student';
          if (student) {
            studentName = (student as any).lastName || 'Student';
          }

          const percentage = rc.averagePercentage || 0;

          // Prepare update data
          const updateData: any = { updatedAt: new Date() };

          // Only update if empty or overwrite is true
          if (overwrite || !rc.teacherRemarks) {
            updateData.teacherRemarks = generateTeacherComment(studentName, percentage);
          }
          if (overwrite || !rc.principalRemarks) {
            updateData.principalRemarks = generatePrincipalComment(studentName, percentage);
          }

          await db.update(schema.reportCards)
            .set(updateData)
            .where(eq(schema.reportCards.id, rc.id));

          updated++;
        } catch (err: any) {
          errors.push(`Report card ${rc.id}: ${err.message}`);
        }
      }

      res.json({
        message: `Backfill completed. Updated ${updated} report cards, skipped ${skipped}.`,
        updated,
        skipped,
        total: reportCards.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error: any) {
      console.error('Error backfilling comments:', error);
      res.status(500).json({ message: error.message || 'Failed to backfill comments' });
    }
  });
}
