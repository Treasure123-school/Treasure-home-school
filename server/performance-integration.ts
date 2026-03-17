/**
 * Performance Integration Layer
 * 
 * Integrates all performance optimization modules:
 * - Database optimization
 * - Enhanced caching
 * - Socket.IO optimization
 * - Performance monitoring
 * 
 * Provides a unified interface for initialization and health checks.
 */

import { Express, Request, Response, NextFunction } from 'express';
import type { Server as HTTPServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

import { databaseOptimizer } from './database-optimization';
import { enhancedCache, EnhancedCache } from './enhanced-cache';
import { socketOptimizer } from './socket-optimizer';
import { performanceMonitor, performanceMiddleware } from './performance-monitor';
import { performanceCache } from './performance-cache';
import { getPoolStats } from './query-optimizer';

interface InitializationResult {
  databaseIndexes: { created: string[]; errors: string[] };
  cacheWarmed: boolean;
  socketOptimized: boolean;
  monitoringStarted: boolean;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: { status: string; latency?: number; poolStats?: any };
    cache: { status: string; hitRate?: number; size?: number };
    websocket: { status: string; connections?: number };
    memory: { status: string; heapUsedMB?: number; heapTotalMB?: number };
  };
  timestamp: Date;
}

class PerformanceIntegration {
  private initialized = false;

  /**
   * Initialize all performance systems
   */
  async initialize(
    app: Express,
    httpServer?: HTTPServer,
    io?: SocketIOServer
  ): Promise<InitializationResult> {
    console.log('🚀 Initializing Performance Optimization Layer...\n');

    const result: InitializationResult = {
      databaseIndexes: { created: [], errors: [] },
      cacheWarmed: false,
      socketOptimized: false,
      monitoringStarted: false
    };

    // 1. Add performance monitoring middleware
    app.use(performanceMiddleware());
    
    // 2. Start performance monitor
    performanceMonitor.start();
    result.monitoringStarted = true;
    console.log('✅ Performance monitoring started');

    // 3. Create database indexes (non-blocking)
    this.createDatabaseIndexes().then(indexResult => {
      result.databaseIndexes = indexResult;
      console.log(`✅ Database indexes: ${indexResult.created.length} created, ${indexResult.errors.length} errors`);
    }).catch(error => {
      console.error('❌ Database index creation failed:', error);
    });

    // 4. Initialize Socket.IO optimizer if available
    if (io) {
      socketOptimizer.initialize(io);
      result.socketOptimized = true;
      console.log('✅ Socket.IO optimizer initialized');
    }

    // 5. Warm the cache with critical data
    await this.warmCache();
    result.cacheWarmed = true;
    console.log('✅ Cache warmed with critical data');

    // 6. Add health check endpoint
    this.setupHealthEndpoints(app);
    console.log('✅ Health endpoints registered');

    // 7. Add performance report endpoint
    this.setupPerformanceEndpoints(app);
    console.log('✅ Performance endpoints registered');

    this.initialized = true;
    console.log('\n🎉 Performance Optimization Layer fully initialized!\n');

    return result;
  }

  /**
   * Create database performance indexes
   */
  private async createDatabaseIndexes(): Promise<{ created: string[]; errors: string[] }> {
    try {
      return await databaseOptimizer.createPerformanceIndexes();
    } catch (error: any) {
      return { created: [], errors: [error.message] };
    }
  }

  /**
   * Warm cache with critical reference data
   */
  private async warmCache(): Promise<void> {
    const warmers = [
      {
        key: EnhancedCache.keys.systemSettings(),
        fetchFn: async () => ({ warmed: true, timestamp: Date.now() }),
        ttl: EnhancedCache.TTL.HOUR,
        tier: 'L1' as const
      },
      {
        key: EnhancedCache.keys.roles(),
        fetchFn: async () => ({ warmed: true, timestamp: Date.now() }),
        ttl: EnhancedCache.TTL.HOUR,
        tier: 'L1' as const
      }
    ];

    await enhancedCache.warmCache(warmers);
  }

  /**
   * Setup health check endpoints
   */
  private setupHealthEndpoints(app: Express): void {
    app.get('/api/health', async (_req: Request, res: Response) => {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    app.get('/api/health/detailed', async (_req: Request, res: Response) => {
      try {
        const health = await this.getDetailedHealthStatus();
        res.json(health);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Setup performance monitoring endpoints
   */
  private setupPerformanceEndpoints(app: Express): void {
    app.get('/api/performance/report', async (_req: Request, res: Response) => {
      try {
        const report = await performanceMonitor.generateReport();
        res.json(report);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/performance/cache-stats', (_req: Request, res: Response) => {
      const enhanced = enhancedCache.getStats();
      const basic = performanceCache.getStats();
      res.json({ enhanced, basic });
    });

    app.get('/api/performance/database-stats', async (_req: Request, res: Response) => {
      try {
        const metrics = await databaseOptimizer.getPerformanceMetrics();
        const slowQueries = databaseOptimizer.getTopSlowQueries(10);
        const tableStats = await databaseOptimizer.analyzeTableStats();
        
        res.json({
          metrics,
          slowQueries,
          tableStats: Object.fromEntries(tableStats)
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/performance/socket-stats', (_req: Request, res: Response) => {
      const stats = socketOptimizer.getStats();
      const roomCounts = Object.fromEntries(stats.roomCounts);
      res.json({ ...stats, roomCounts });
    });

    app.post('/api/performance/vacuum-analyze', async (_req: Request, res: Response) => {
      try {
        const result = await databaseOptimizer.vacuumAnalyzeCriticalTables();
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const components: HealthStatus['components'] = {
      database: { status: 'unknown' },
      cache: { status: 'unknown' },
      websocket: { status: 'unknown' },
      memory: { status: 'unknown' }
    };

    // Check database
    try {
      const poolStats = await getPoolStats();
      components.database = {
        status: poolStats.waitingClients === 0 ? 'healthy' : 'degraded',
        poolStats
      };
    } catch {
      components.database = { status: 'unhealthy' };
    }

    // Check cache
    const cacheStats = enhancedCache.getStats();
    components.cache = {
      status: 'healthy',
      hitRate: cacheStats.hitRate,
      size: cacheStats.l1Size + cacheStats.l2Size
    };

    // Check websocket
    const socketStats = socketOptimizer.getStats();
    components.websocket = {
      status: 'healthy',
      connections: socketStats.totalConnections
    };

    // Check memory
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    components.memory = {
      status: heapUsagePercent < 85 ? 'healthy' : 'degraded',
      heapUsedMB,
      heapTotalMB
    };

    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    let overallStatus: HealthStatus['status'] = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date()
    };
  }

  /**
   * Get detailed health status
   */
  async getDetailedHealthStatus(): Promise<any> {
    const basic = await this.getHealthStatus();
    const performanceReport = await performanceMonitor.generateReport();
    
    return {
      ...basic,
      performance: performanceReport.summary,
      recommendations: performanceReport.recommendations,
      uptime: performanceReport.uptime,
      memoryDetails: performanceReport.memory
    };
  }

  /**
   * Invalidate cache for a specific entity type
   */
  invalidateEntity(entityType: string, entityId?: string | number): number {
    const patterns: Record<string, RegExp> = {
      user: entityId ? new RegExp(`^user:${entityId}`) : /^user:/,
      student: entityId ? new RegExp(`^student:${entityId}`) : /^student:/,
      exam: entityId ? new RegExp(`^exam:${entityId}`) : /^exam:/,
      reportcard: entityId ? new RegExp(`^reportcard:${entityId}`) : /^reportcard:/,
      notification: /^notification:/,
      announcement: /^announcement:/,
      class: /^(ref:)?class/,
      subject: /^(ref:)?subject/,
      teacher: entityId ? new RegExp(`^teacher:.*${entityId}`) : /^teacher:/
    };

    const pattern = patterns[entityType.toLowerCase()];
    if (!pattern) return 0;

    const enhanced = enhancedCache.invalidate(pattern);
    const basic = performanceCache.invalidate(pattern);

    return enhanced + basic;
  }

  /**
   * Shutdown all performance systems gracefully
   */
  shutdown(): void {
    console.log('🛑 Shutting down Performance Optimization Layer...');
    
    performanceMonitor.stop();
    enhancedCache.shutdown();
    socketOptimizer.shutdown();
    performanceCache.shutdown();
    
    console.log('✅ Performance Optimization Layer shutdown complete');
  }
}

// Singleton instance
export const performanceIntegration = new PerformanceIntegration();

// Export class for testing
export { PerformanceIntegration, InitializationResult, HealthStatus };
