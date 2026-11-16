/** Teacher my-report-cards + class-term listing — split from enhanced-report-cards.routes.ts. */
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
export async function registerReportTeacherCardsRoutes(app: Express) {
  // where the teacher created the test or main exam
  app.get('/api/teacher/my-report-cards', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req: Request, res: Response) => {
    try {
      const teacherId = req.user!.id;
      const { termId, classId } = req.query;

      // Get report cards containing items where this teacher created the exams
      const reportCards = await storage.getTeacherAccessibleReportCards(
        teacherId,
        termId ? Number(termId) : undefined,
        classId ? Number(classId) : undefined
      );

      res.json(reportCards);
    } catch (error: any) {
      console.error('Error getting teacher report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to get teacher report cards' });
    }
  });

  // Get all report cards for a class and term
  app.get('/api/reports/class-term/:classId/:termId', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { classId, termId } = req.params;
      const reportCards = await storage.getReportCardsByClassAndTerm(Number(classId), Number(termId));
      res.json(reportCards);
    } catch (error: any) {
      console.error('Error getting report cards:', error);
      res.status(500).json({ message: error.message || 'Failed to get report cards' });
    }
  });
}
