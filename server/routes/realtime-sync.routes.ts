/** realtime-sync.routes.ts — aggregator; split into focused route files. */
import type { Express } from 'express';
import { registerSyncExamsRoutes } from './sync-exams.routes';
import { registerSyncStudentResultsRoutes } from './sync-student-results.routes';
import { registerSyncTeacherResultsRoutes } from './sync-teacher-results.routes';

export async function registerRealtimeSyncRoutes(app: Express) {
  registerSyncExamsRoutes(app);
  registerSyncStudentResultsRoutes(app);
  registerSyncTeacherResultsRoutes(app);
}
