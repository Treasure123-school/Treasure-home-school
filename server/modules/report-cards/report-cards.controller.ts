/**
 * Report Cards Controller
 * Handles core report card HTTP requests
 */
import { Request, Response } from 'express';
import { ReportCardsService } from './report-cards.service';

export class ReportCardsController {
  private service: ReportCardsService;

  constructor() {
    this.service = new ReportCardsService();
  }

  /**
   * GET /api/reports/student-report-card/:studentId
   */
  getStudentReportCard = async (req: Request, res: Response): Promise<void> => {
    try {
      const { studentId } = req.params;
      const termId = Number(req.query.termId);

      if (!termId) {
        res.status(400).json({ message: 'Term ID is required' });
        return;
      }

      const reportCard = await this.service.getStudentReportCard(
        studentId,
        termId,
        req.user!.id,
        req.user!.roleId
      );

      res.json(reportCard);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to get report card',
        status: error.status
      });
    }
  };

  /**
   * GET /api/reports/class/:classId
   */
  getClassReportCards = async (req: Request, res: Response): Promise<void> => {
    try {
      const classId = Number(req.params.classId);
      const termId = Number(req.query.termId);

      if (!termId) {
        res.status(400).json({ message: 'Term ID is required' });
        return;
      }

      const result = await this.service.getClassReportCards(
        classId,
        termId,
        req.user!.id,
        req.user!.roleId
      );

      res.json(result);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to get class report cards'
      });
    }
  };

  /**
   * POST /api/reports/generate
   */
  generateReportCard = async (req: Request, res: Response): Promise<void> => {
    try {
      const { studentId, termId, teacherRemarks, status } = req.body;

      if (!studentId || !termId) {
        res.status(400).json({ message: 'Student ID and Term ID are required' });
        return;
      }

      const result = await this.service.generateReportCard({
        studentId,
        termId,
        teacherRemarks,
        status,
        generatedBy: req.user!.id
      });

      res.json({ message: 'Report card generated successfully', reportCard: result });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to generate report card'
      });
    }
  };
}
