/** Enhanced report cards — default/backfill comments — extracted from enhanced.controller.ts. */
/**
 * Enhanced Report Cards Controller
 * Handles teacher portal operations: score overrides, status management, remarks
 */
import { Request, Response } from 'express';
import { storage, db } from '../../storage';
import * as schema from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { realtimeService } from '../../realtime-service';
import { resolveDesignatedPrincipal } from '../../routes/report-helpers';
export const getDefaultComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportCardId } = req.params;
      const { generateTeacherComment, generatePrincipalComment } = await import('../../routes/report-helpers');

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        res.status(404).json({ message: 'Report card not found' });
        return;
      }

      const student = await storage.getStudent(reportCard.studentId);
      const studentName = student ? `${(student as any).firstName || 'Student'}` : 'Student';
      const percentage = reportCard.averagePercentage || 0;

      const teacherComment = generateTeacherComment(studentName, percentage);
      const principalComment = generatePrincipalComment(studentName, percentage);

      res.json({ teacherComment, principalComment, studentName, averagePercentage: percentage });
    } catch (error: any) {
      console.error('Error generating default comments:', error);
      res.status(500).json({ message: error.message || 'Failed to generate comments' });
    }
  };

  /**
   * POST /api/reports/backfill-comments
   * Backfill comments for report cards without them (admin only)
   */
export const backfillComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { termId, classId, overwrite = false } = req.body;
      const { generateTeacherComment, generatePrincipalComment } = await import('../../routes/report-helpers');

      const conditions: any[] = [];
      if (termId) conditions.push(eq(schema.reportCards.termId, Number(termId)));
      if (classId) conditions.push(eq(schema.reportCards.classId, Number(classId)));

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
          if (!overwrite && rc.teacherRemarks && rc.principalRemarks) {
            skipped++;
            continue;
          }

          const student = await storage.getStudent(rc.studentId);
          const studentName = student ? ((student as any).lastName || 'Student') : 'Student';
          const percentage = rc.averagePercentage || 0;

          const updateData: any = { updatedAt: new Date() };
          if (overwrite || !rc.teacherRemarks) updateData.teacherRemarks = generateTeacherComment(studentName, percentage);
          if (overwrite || !rc.principalRemarks) updateData.principalRemarks = generatePrincipalComment(studentName, percentage);

          await db.update(schema.reportCards).set(updateData).where(eq(schema.reportCards.id, rc.id));
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
  };
