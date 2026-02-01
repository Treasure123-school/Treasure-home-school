import { Router } from "express";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { asyncHandler, sendSuccess } from "../utils/response-helpers";
import { performanceCache } from "../performance-cache";
import { enhancedCache } from "../enhanced-cache";

const router = Router();

router.get('/', asyncHandler('health.check', async (_req, res) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
}));

router.get('/performance/report', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), 
  asyncHandler('health.performanceReport', async (_req, res) => {
    sendSuccess(res, {
      cache: performanceCache.getStats?.() || {},
      enhancedCache: enhancedCache.getStats?.() || {},
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  })
);

router.get('/performance/cache-stats', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), 
  asyncHandler('health.cacheStats', async (_req, res) => {
    sendSuccess(res, enhancedCache.getStats?.() || {});
  })
);

export default router;
