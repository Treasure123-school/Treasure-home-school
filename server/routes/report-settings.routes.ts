/** Grading config + positioning method settings endpoints — split from report-cards.routes.ts. */
/** Auto-split from routes.ts — report-cards (orig lines 10780-12108). See git history. */
import * as schema from '@shared/schema.pg';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { resolveDesignatedPrincipal } from '../routes/report-helpers';
import { db, storage } from '../storage';
import { students } from '@shared/schema.pg';
import { and, eq, inArray } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerReportSettingsRoutes(app: Express) {
  // Get grading configuration (uses active DB scale when available, falls back to hardcoded)
  app.get('/api/grading-config', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { GRADING_SCALES } = await import('../grading-config');
      const { getActiveGradingConfig } = await import('../grade-scale-service');

      const systemSettings = await storage.getSystemSettings();
      const dbTestWeight = systemSettings?.testWeight ?? 40;
      const dbExamWeight = systemSettings?.examWeight ?? 60;

      // Use the active DB scale if one exists, otherwise fall back to hardcoded scale by name
      const activeConfig = await getActiveGradingConfig();

      // Return DB scale names (not hardcoded)
      const { db: dbRef } = await import('../db');
      const { gradeScales: gradeScalesTable } = await import('@shared/schema.pg');
      const scales = await dbRef.select({ name: gradeScalesTable.name }).from(gradeScalesTable);

      res.json({
        currentConfig: {
          ...activeConfig,
          testWeight: dbTestWeight,
          examWeight: dbExamWeight,
        },
        availableScales: scales.map(s => s.name),
        dbSettings: {
          testWeight: dbTestWeight,
          examWeight: dbExamWeight,
          defaultGradingScale: activeConfig.name,
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get grading configuration' });
    }
  });

  // Update grading settings (Admin only)
  app.put('/api/grading-settings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { testWeight, examWeight, defaultGradingScale } = req.body;

      if (testWeight !== undefined && examWeight !== undefined) {
        if (testWeight + examWeight !== 100) {
          return res.status(400).json({
            message: 'Test weight and exam weight must sum to 100%'
          });
        }
        if (testWeight < 0 || testWeight > 100 || examWeight < 0 || examWeight > 100) {
          return res.status(400).json({
            message: 'Weights must be between 0 and 100'
          });
        }
      }

      const updateData: any = { updatedBy: req.user!.id };
      if (testWeight !== undefined) updateData.testWeight = testWeight;
      if (examWeight !== undefined) updateData.examWeight = examWeight;
      if (defaultGradingScale !== undefined) updateData.defaultGradingScale = defaultGradingScale;

      const settings = await storage.updateSystemSettings(updateData);

      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'grading_settings_updated',
        entityType: 'system_settings',
        entityId: String(settings.id),
        reason: `Grading settings updated: Test ${settings.testWeight}%, Exam ${settings.examWeight}%`,
      });

      const { realtimeService } = await import('../realtime-service');
      realtimeService.emitGradingSettingsEvent('updated', {
        testWeight: settings.testWeight,
        examWeight: settings.examWeight,
        gradingScale: settings.defaultGradingScale,
      }, req.user!.id);

      res.json({
        message: 'Grading settings updated successfully',
        settings: {
          testWeight: settings.testWeight,
          examWeight: settings.examWeight,
          defaultGradingScale: settings.defaultGradingScale
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update grading settings' });
    }
  });

  // Get class positioning method setting (Admin only)
  app.get('/api/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({
        positioningMethod: settings?.positioningMethod || 'average'
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get positioning method setting' });
    }
  });

  // Update class positioning method setting (Admin only)
  app.patch('/api/settings/positioning-method', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { positioningMethod } = req.body;

      if (!positioningMethod || !['average', 'total'].includes(positioningMethod)) {
        return res.status(400).json({
          message: 'Invalid positioning method. Must be "average" or "total".'
        });
      }

      const settings = await storage.updateSystemSettings({
        positioningMethod,
        updatedBy: req.user!.id
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'positioning_method_updated',
        entityType: 'system_settings',
        entityId: String(settings.id),
        reason: `Class position calculation method changed to: ${positioningMethod}`,
      });

      res.json({
        message: 'Positioning method updated successfully',
        positioningMethod: settings.positioningMethod
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update positioning method setting' });
    }
  });
}
