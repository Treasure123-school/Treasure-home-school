/** exams-management.routes.ts — aggregator; split into focused route files. */
import type { Express } from 'express';
import { registerExamResultsRoutes } from './exam-results.routes';
import { registerExamCrudRoutes } from './exam-crud.routes';
import { registerExamSubmissionRoutes } from './exam-submission.routes';

export async function registerExamsManagementRoutes(app: Express) {
  registerExamResultsRoutes(app);
  registerExamCrudRoutes(app);
  registerExamSubmissionRoutes(app);
}
