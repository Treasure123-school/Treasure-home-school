/** invites.routes.ts — aggregator; split into focused route files (preserves
 *  registration order; the two PUT /api/users/:id handlers rely on it). */
import type { Express } from 'express';
import { registerInvitesOnlyRoutes } from './invites-core.routes';
import { registerMiscRoutes } from './misc.routes';
import { registerUserListRoutes } from './users-list.routes';
import { registerUserVerificationRoutes } from './users-verification.routes';
import { registerUserCrudRoutes } from './users-crud.routes';
import { registerUserDeletionRoutes } from './users-deletion.routes';
import { registerUserAdminRoutes } from './users-admin.routes';
import { registerUserCsvRoutes } from './users-csv.routes';

export async function registerInvitesRoutes(app: Express) {
  registerInvitesOnlyRoutes(app);
  registerMiscRoutes(app);
  registerUserListRoutes(app);
  registerUserVerificationRoutes(app);
  registerUserCrudRoutes(app);
  registerUserDeletionRoutes(app);
  registerUserAdminRoutes(app);
  registerUserCsvRoutes(app);
}
