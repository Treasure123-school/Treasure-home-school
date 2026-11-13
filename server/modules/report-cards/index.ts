/**
 * Report Cards Module
 * 
 * Complete report card generation, management, and publishing system
 * 
 * Features:
 * - Auto-generation from exam results
 * - Score override and editing
 * - Skills assessment (affective/psychomotor)
 * - Comment templates and auto-generation
 * - Status workflow (draft → finalized → published)
 * - Bulk operations (publish, recalculate)
 * - PDF export and printing
 * 
 * Endpoints:
 *   Core Report Cards:
 *     GET    /api/reports/student-report-card/:studentId
 *     GET    /api/reports/class/:classId
 *     POST   /api/reports/generate
 *     PUT    /api/reports/:reportCardId
 *     GET    /api/reports/:reportCardId
 *     GET    /api/reports/parent/:parentId
 *     POST   /api/reports/generate-class/:classId
 * 
 *   Enhanced (Teacher Portal):
 *     GET    /api/teacher/my-report-cards
 *     GET    /api/reports/class-term/:classId/:termId
 *     GET    /api/reports/:reportCardId/full
 *     POST   /api/reports/generate-enhanced/:classId
 *     POST   /api/reports/:reportCardId/auto-populate
 *     PATCH  /api/reports/items/:itemId/override
 *     PATCH  /api/reports/:reportCardId/status
 *     PATCH  /api/reports/:reportCardId/remarks
 *     GET    /api/reports/:reportCardId/default-comments
 *     POST   /api/reports/backfill-comments
 * 
 *   Skills:
 *     GET    /api/reports/:reportCardId/skills
 *     POST   /api/reports/:reportCardId/skills
 * 
 *   Comment Templates (Admin):
 *     GET    /api/admin/report-comment-templates
 *     GET    /api/admin/report-comment-templates/:id
 *     POST   /api/admin/report-comment-templates
 *     PATCH  /api/admin/report-comment-templates/:id
 *     DELETE /api/admin/report-comment-templates/:id
 *     GET    /api/admin/report-cards/finalized
 *     POST   /api/admin/report-cards/bulk-publish
 *     POST   /api/admin/report-cards/:id/reject
 *     POST   /api/admin/resync-exam-score
 *     POST   /api/admin/resync-report-card-subjects
 *     POST   /api/teacher/exams/:examId/sync-all-to-reportcards
 *     GET    /api/teacher/exams/:examId/sync-status
 * 
 *   Grading Config:
 *     GET    /api/grading-config
 *     PUT    /api/grading-settings
 *     GET    /api/settings/positioning-method
 *     PATCH  /api/settings/positioning-method
 * 
 * Architecture:
 *   - report-cards.controller.ts: Core report card HTTP handlers
 *   - enhanced.controller.ts: Teacher portal operations
 *   - skills.controller.ts: Skills assessment
 *   - comments.controller.ts: Comment templates & bulk ops
 *   - grading.controller.ts: Grading configuration
 *   - report-cards.service.ts: Business logic
 *   - report-cards.routes.ts: Route mounting
 *   - report-cards.validation.ts: Request validation schemas
 */

export { default as reportCardsRouter } from './report-cards.routes';
