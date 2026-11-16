/** Student profile routes — aggregator; split into:
 *  student-crud.routes.ts (list + create), student-views.routes.ts
 *  (me / :id / :id/classes / delete), student-onboarding.routes.ts
 *  (profile status, setup, skip). Registration order preserved (/me before /:id). */
import { type Express } from 'express';
import { registerStudentCrudRoutes } from './student-crud.routes';
import { registerStudentViewRoutes } from './student-views.routes';
import { registerStudentOnboardingRoutes } from './student-onboarding.routes';

export async function registerStudentProfileRoutes(app: Express) {
  registerStudentCrudRoutes(app);
  registerStudentViewRoutes(app);
  registerStudentOnboardingRoutes(app);
}
