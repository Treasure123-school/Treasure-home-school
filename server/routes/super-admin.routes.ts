/** Super admin routes — aggregator; split into:
 *  super-admin.crud.routes.ts (stats + admins), super-admin.settings.routes.ts
 *  (public/settings, logs, settings, branding), super-admin.principal.routes.ts
 *  (principal/leadership), super-admin.recovery.routes.ts (soft-delete recovery). */
import { type Express } from 'express';
import { registerSuperAdminCrudRoutes } from './super-admin.crud.routes';
import { registerSuperAdminSettingsRoutes } from './super-admin.settings.routes';
import { registerSuperAdminPrincipalRoutes } from './super-admin.principal.routes';
import { registerSuperAdminRecoveryRoutes } from './super-admin.recovery.routes';

export async function registerSuperAdminRoutes(app: Express) {
  registerSuperAdminCrudRoutes(app);
  registerSuperAdminSettingsRoutes(app);
  registerSuperAdminPrincipalRoutes(app);
  registerSuperAdminRecoveryRoutes(app);
}
