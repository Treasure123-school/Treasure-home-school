/**
 * Grading Configuration Controller
 * Handles grading settings and positioning method
 */
import { Request, Response } from 'express';
import { ReportCardsService } from './report-cards.service';

export class GradingController {
  private service: ReportCardsService;

  constructor() {
    this.service = new ReportCardsService();
  }

  /**
   * GET /api/grading-config
   */
  getGradingConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = await this.service.getGradingConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get grading configuration' });
    }
  };

  /**
   * PUT /api/grading-settings
   */
  updateGradingSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { testWeight, examWeight, defaultGradingScale } = req.body;

      const settings = await this.service.updateGradingSettings({
        testWeight,
        examWeight,
        defaultGradingScale,
        updatedBy: req.user!.id
      });

      res.json({
        message: 'Grading settings updated successfully',
        settings
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to update grading settings'
      });
    }
  };

  /**
   * GET /api/settings/positioning-method
   */
  getPositioningMethod = async (req: Request, res: Response): Promise<void> => {
    try {
      const positioningMethod = await this.service.getPositioningMethod();
      res.json({ positioningMethod });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get positioning method setting' });
    }
  };

  /**
   * PATCH /api/settings/positioning-method
   */
  updatePositioningMethod = async (req: Request, res: Response): Promise<void> => {
    try {
      const { positioningMethod } = req.body;

      const result = await this.service.updatePositioningMethod(
        positioningMethod,
        req.user!.id
      );

      res.json({
        message: 'Positioning method updated successfully',
        positioningMethod: result
      });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        message: error.message || 'Failed to update positioning method setting'
      });
    }
  };
}
