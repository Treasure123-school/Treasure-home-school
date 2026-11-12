/** Auto-split from routes.ts — health (orig lines 1175-1297). See git history. */
import * as schema from '@shared/schema.pg';
import type { Express } from 'express';
import { performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { students, users } from '@shared/schema.pg';

export async function registerHealthRoutes(app: Express) {
  const { performanceMonitor } = await import('../performance-monitor');
  const { databaseOptimizer } = await import('../database-optimization');
  const { enhancedCache } = await import('../enhanced-cache');
  const { socketOptimizer } = await import('../socket-optimizer');
  const { getPoolStats } = await import('../query-optimizer');
  // ==================== HEALTH & PERFORMANCE ENDPOINTS ====================

  // Basic health check (public)
  app.get('/api/health', async (_req, res) => {
    try {
      const poolStats = await getPoolStats();
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      const status = poolStats.waitingClients === 0 && (heapUsedMB / heapTotalMB) < 0.9
        ? 'healthy'
        : 'degraded';

      res.json({
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        database: {
          connections: poolStats.totalConnections,
          idle: poolStats.idleConnections,
          waiting: poolStats.waitingClients
        },
        memory: { heapUsedMB, heapTotalMB }
      });
    } catch (error: any) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });

  // Detailed performance report (admin/super admin only)
  app.get('/api/performance/report', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
    try {
      const report = await performanceMonitor.generateReport();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cache statistics (admin/super admin only)
  app.get('/api/performance/cache-stats', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), (_req, res) => {
    const enhanced = enhancedCache.getStats();
    const basic = performanceCache.getStats();
    res.json({ enhanced, basic });
  });

  // Database statistics (admin/super admin only)
  app.get('/api/performance/database-stats', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
    try {
      const metrics = await databaseOptimizer.getPerformanceMetrics();
      const slowQueries = databaseOptimizer.getTopSlowQueries(10);
      res.json({ metrics, slowQueries });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // WebSocket statistics (admin/super admin only)
  app.get('/api/performance/socket-stats', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), (_req, res) => {
    const stats = socketOptimizer.getStats();
    const roomCounts = Object.fromEntries(stats.roomCounts);
    res.json({ ...stats, roomCounts });
  });

  // ==================== USER ACTIVITY HEARTBEAT ====================
  // Lightweight endpoint every authenticated user calls periodically.
  // The authenticateUser middleware already calls touchUserActivity, so this
  // route body is intentionally empty — the middleware does the work.
  app.post('/api/user/heartbeat', authenticateUser, (_req, res) => {
    res.json({ ok: true });
  });

  // ==================== ONLINE USERS (ADMIN ONLY) ====================
  app.get('/api/admin/online-users', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
    try {
      const rawOnline = realtimeService.getOnlineUsers();
      // Enrich with user details from DB in parallel
      const enriched = await Promise.all(
        rawOnline.map(async (entry) => {
          try {
            const user = await storage.getUser(entry.userId);
            const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : entry.userId;
            const base = {
              ...entry,
              displayName,
              username: user?.username || entry.userId,
              email: user?.email,
              roleId: user?.roleId,
              loginAt: user?.lastLoginAt ? user.lastLoginAt.toISOString() : entry.firstConnectedAt,
            };
            // For students, fetch their class
            const roleStr = entry.role.toLowerCase().replace(/\s+/g, '_');
            if ((roleStr === 'student' || roleStr === 'stu') && !entry.className) {
              try {
                const student = await storage.getStudentByUserId(entry.userId);
                if (student?.classId) {
                  const cls = await storage.getClass(student.classId);
                  return { ...base, classId: student.classId, className: cls?.name };
                }
              } catch { /* ignore */ }
            }
            return base;
          } catch {
            return { ...entry, displayName: entry.userId, username: entry.userId, loginAt: entry.firstConnectedAt };
          }
        })
      );
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch online users' });
    }
  });

  // ==================== ACTIVITY FEED (ADMIN ONLY) ====================
  app.get('/api/admin/activity-feed', authenticateUser, authorizeRoles(ROLES.ADMIN), (_req, res) => {
    try {
      res.json(realtimeService.getActivityFeed());
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch activity feed' });
    }
  });

}
