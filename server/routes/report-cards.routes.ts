/** report-cards.routes.ts — aggregator; split into focused route files. */
import type { Express } from 'express';
import { registerReportSettingsRoutes } from './report-settings.routes';
import { registerReportStudentRoutes } from './report-student.routes';
import { registerReportClassRoutes } from './report-class.routes';
import { registerReportOperationsRoutes } from './report-operations.routes';

export async function registerReportCardsRoutes(app: Express) {
  registerReportSettingsRoutes(app);
  registerReportStudentRoutes(app);
  registerReportClassRoutes(app);
  registerReportOperationsRoutes(app);
}
