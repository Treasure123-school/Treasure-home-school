/** maintenance.routes.ts — aggregator; split into focused route files. */
import { Router } from 'express';
import { MAINTENANCE_TIMEOUT_MS } from './maintenance-shared';
import maintenanceRepairRouter from './maintenance-repair.routes';
import maintenanceSyncRouter from './maintenance-sync.routes';
import maintenanceRecalculateRouter from './maintenance-recalculate.routes';

const router = Router();

// Extended timeout for every route in this module (bulk operations)
router.use((_req, res, next) => {
  _req.setTimeout(MAINTENANCE_TIMEOUT_MS);
  res.setTimeout(MAINTENANCE_TIMEOUT_MS);
  next();
});
router.use(maintenanceRepairRouter);
router.use(maintenanceSyncRouter);
router.use(maintenanceRecalculateRouter);

export default router;
