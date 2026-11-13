/**
 * Report Cards Module
 * 
 * Complete report card generation, management, and publishing system
 * 
 * Architecture:
 *   - report-cards.controller.ts: Core report card HTTP handlers
 *   - grading.controller.ts: Grading configuration
 *   - report-cards.service.ts: Business logic
 *   - report-cards.routes.ts: Route mounting
 */

export { default as reportCardsRouter } from './report-cards.routes';
export { ReportCardsController } from './report-cards.controller';
export { GradingController } from './grading.controller';
export { ReportCardsService } from './report-cards.service';
