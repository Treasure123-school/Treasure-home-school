/**
 * Promotions Controller
 * HTTP handlers for Student Promotion & Academic Year Rollover
 */
import { Request, Response } from 'express';
import {
  PromotionsService,
  previewSchema,
  mappingsUpdateSchema,
  executeSchema,
  rolloverSchema,
  correctRecordSchema,
  reverseBatchSchema,
} from './promotions.service';

export class PromotionsController {
  private service: PromotionsService;

  constructor() {
    this.service = new PromotionsService();
  }

  // GET /api/admin/promotions/preview?destinationSessionId=&sourceSessionId=
  getPreview = async (req: Request, res: Response) => {
    try {
      const parsed = previewSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid query', details: parsed.error.errors });
      }
      res.json(await this.service.getPreview(parsed.data));
    } catch (error: any) {
      console.error('[PROMOTIONS] Preview error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to load promotion preview' });
    }
  };

  // GET /api/admin/promotions/mappings
  getMappings = async (_req: Request, res: Response) => {
    try {
      res.json(await this.service.getMappings());
    } catch (error: any) {
      console.error('[PROMOTIONS] Mappings error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to load class mappings' });
    }
  };

  // PUT /api/admin/promotions/mappings
  updateMappings = async (req: Request, res: Response) => {
    try {
      const parsed = mappingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid mappings payload', details: parsed.error.errors });
      }
      res.json(await this.service.updateMappings(parsed.data, req.user!.id));
    } catch (error: any) {
      console.error('[PROMOTIONS] Update mappings error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to update class mappings' });
    }
  };

  // POST /api/admin/promotions/execute
  execute = async (req: Request, res: Response) => {
    try {
      const parsed = executeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid promotion payload', details: parsed.error.errors });
      }
      res.json(await this.service.execute(parsed.data, req.user!.id));
    } catch (error: any) {
      console.error('[PROMOTIONS] Execute error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Promotion execution failed' });
    }
  };

  // GET /api/admin/promotions/history
  getHistory = async (_req: Request, res: Response) => {
    try {
      res.json(await this.service.getHistory());
    } catch (error: any) {
      console.error('[PROMOTIONS] History error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to load promotion history' });
    }
  };

  // GET /api/admin/promotions/history/:batchId
  getBatchDetail = async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId, 10);
      if (!Number.isInteger(batchId) || batchId <= 0) {
        return res.status(400).json({ message: 'Invalid batch id' });
      }
      res.json(await this.service.getBatchDetail(batchId));
    } catch (error: any) {
      console.error('[PROMOTIONS] Batch detail error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to load promotion batch' });
    }
  };

  // PATCH /api/admin/promotions/records/:recordId
  correctRecord = async (req: Request, res: Response) => {
    try {
      const recordId = parseInt(req.params.recordId, 10);
      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({ message: 'Invalid record id' });
      }
      const parsed = correctRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid correction payload', details: parsed.error.errors });
      }
      res.json(await this.service.correctRecord(recordId, parsed.data, req.user!.id));
    } catch (error: any) {
      console.error('[PROMOTIONS] Correct record error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to correct promotion record' });
    }
  };

  // POST /api/admin/promotions/rollover-activate
  rolloverActivate = async (req: Request, res: Response) => {
    try {
      const parsed = rolloverSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid rollover payload', details: parsed.error.errors });
      }
      res.json(await this.service.rolloverActivate(parsed.data, req.user!.id));
    } catch (error: any) {
      console.error('[PROMOTIONS] Rollover error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Rollover activation failed' });
    }
  };

  // GET /api/admin/promotions/batches/:batchId/reversal-preview
  getReversalPreview = async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId, 10);
      if (!Number.isInteger(batchId) || batchId <= 0) {
        return res.status(400).json({ message: 'Invalid batch id' });
      }
      res.json(await this.service.analyzeReversal(batchId));
    } catch (error: any) {
      console.error('[PROMOTIONS] Reversal preview error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to analyze reversal' });
    }
  };

  // POST /api/admin/promotions/batches/:batchId/reverse
  reverseBatch = async (req: Request, res: Response) => {
    try {
      const batchId = parseInt(req.params.batchId, 10);
      if (!Number.isInteger(batchId) || batchId <= 0) {
        return res.status(400).json({ message: 'Invalid batch id' });
      }
      const parsed = reverseBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid reversal payload', details: parsed.error.errors });
      }
      res.json(await this.service.reverseBatch(batchId, parsed.data.reason, req.user!.id));
    } catch (error: any) {
      console.error('[PROMOTIONS] Reverse batch error:', error?.message || error);
      res.status(error?.statusCode || 500).json({ message: error?.message || 'Failed to reverse promotion batch' });
    }
  };
}
