/** enhanced-report-cards.routes.ts — aggregator; split into focused route files. */
import type { Express } from 'express';
import { registerReportTeacherCardsRoutes } from './report-teacher-cards.routes';
import { registerReportFullRoutes } from './report-full.routes';
import { registerReportMutationsRoutes } from './report-mutations.routes';
import { registerReportCommentsRoutes } from './report-comments.routes';

export async function registerEnhancedReportCardsRoutes(app: Express) {
  registerReportTeacherCardsRoutes(app);
  registerReportFullRoutes(app);
  registerReportMutationsRoutes(app);
  registerReportCommentsRoutes(app);
}
