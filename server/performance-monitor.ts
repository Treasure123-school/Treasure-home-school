/**
 * Performance Monitoring System for School Portal
 * 
 * Comprehensive monitoring for tracking:
 * - API endpoint response times
 * - Database query performance
 * - WebSocket connection metrics
 * - Memory and CPU usage
 * - Cache hit rates
 * - Error rates and types
 */

import { EventEmitter } from 'events';
import { performanceCache } from './performance-cache';
import { enhancedCache } from './enhanced-cache';
import { databaseOptimizer } from './database-optimization';
import { socketOptimizer } from './socket-optimizer';
import { getPgPool } from './storage';

interface EndpointMetrics {
  path: string;
  method: string;
  totalCalls: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p95DurationMs: number;
  errorCount: number;
  lastCalled: Date;
  responseTimes: number[];
}

interface SystemMetrics {
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  uptime: number;
  activeConnections: number;
  requestsPerSecond: number;
}

interface PerformanceReport {
  generatedAt: Date;
  uptime: number;
  summary: {
    totalRequests: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    requestsPerSecond: number;
  };
  database: {
    avgQueryTime: number;
    slowQueryCount: number;
    connectionPoolStats: {
      total: number;
      idle: number;
      waiting: number;
    };
    topSlowQueries: Array<{ query: string; avgMs: number; calls: number }>;
  };
  cache: {
    l1HitRate: number;
    l2HitRate: number;
    totalHitRate: number;
    size: number;
    evictions: number;
  };
  websocket: {
    activeConnections: number;
    peakConnections: number;
    messagesSent: number;
    avgLatency: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  topEndpoints: EndpointMetrics[];
  slowestEndpoints: EndpointMetrics[];
  errorsByEndpoint: Array<{ path: string; errorCount: number; errorRate: number }>;
  recommendations: string[];
}

class PerformanceMonitor extends EventEmitter {
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private startTime: Date;
  private totalRequests = 0;
  private totalErrors = 0;
  private allResponseTimes: number[] = [];
  private requestTimestamps: number[] = [];
  private isRunning = false;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startTime = new Date();
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    console.log('✅ Performance Monitor started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.isRunning = false;
  }

  /**
   * Record an API request
   */
  recordRequest(method: string, path: string, durationMs: number, statusCode: number): void {
    const key = `${method}:${path}`;
    const isError = statusCode >= 400;

    this.totalRequests++;
    if (isError) this.totalErrors++;
    this.allResponseTimes.push(durationMs);
    this.requestTimestamps.push(Date.now());

    // Keep only last 10000 response times for percentile calculations
    if (this.allResponseTimes.length > 10000) {
      this.allResponseTimes.shift();
    }

    // Keep request timestamps for last minute only (for RPS calculation)
    const oneMinuteAgo = Date.now() - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinuteAgo) {
      this.requestTimestamps.shift();
    }

    let metrics = this.endpointMetrics.get(key);
    if (!metrics) {
      metrics = {
        path,
        method,
        totalCalls: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        minDurationMs: Infinity,
        maxDurationMs: 0,
        p95DurationMs: 0,
        errorCount: 0,
        lastCalled: new Date(),
        responseTimes: []
      };
      this.endpointMetrics.set(key, metrics);
    }

    metrics.totalCalls++;
    metrics.totalDurationMs += durationMs;
    metrics.avgDurationMs = metrics.totalDurationMs / metrics.totalCalls;
    metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
    metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
    metrics.lastCalled = new Date();
    
    if (isError) {
      metrics.errorCount++;
    }

    // Keep last 1000 response times per endpoint for percentile
    metrics.responseTimes.push(durationMs);
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    // Update P95
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    metrics.p95DurationMs = this.percentile(sorted, 95);

    // Emit event for slow requests
    if (durationMs > 500) {
      this.emit('slowRequest', { method, path, durationMs, statusCode });
    }

    // Emit event for errors (use 'requestError' instead of 'error' to avoid unhandled crash)
    if (isError) {
      this.emit('requestError', { method, path, statusCode, durationMs });
    }
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate CPU percentage (rough estimate)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage,
      cpuUsage: cpuPercent,
      uptime: process.uptime(),
      activeConnections: socketOptimizer.getStats().totalConnections,
      requestsPerSecond: this.requestTimestamps.length / 60
    };

    this.systemMetrics.push(metrics);

    // Keep only last 100 system metrics (50 minutes of data)
    if (this.systemMetrics.length > 100) {
      this.systemMetrics.shift();
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(): Promise<PerformanceReport> {
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    
    // Calculate response time percentiles
    const sortedResponseTimes = [...this.allResponseTimes].sort((a, b) => a - b);
    const p50 = this.percentile(sortedResponseTimes, 50);
    const p95 = this.percentile(sortedResponseTimes, 95);
    const p99 = this.percentile(sortedResponseTimes, 99);
    const avgResponseTime = this.allResponseTimes.length > 0
      ? this.allResponseTimes.reduce((a, b) => a + b, 0) / this.allResponseTimes.length
      : 0;

    // Get database metrics
    const dbMetrics = await databaseOptimizer.getPerformanceMetrics();
    const slowQueries = databaseOptimizer.getTopSlowQueries(10);

    // Get cache metrics
    const cacheStats = enhancedCache.getStats();

    // Get WebSocket metrics
    const socketStats = socketOptimizer.getStats();

    // Get memory usage
    const memoryUsage = process.memoryUsage();

    // Get pool stats
    const pool = getPgPool();
    const poolStats = {
      total: pool?.totalCount || 0,
      idle: pool?.idleCount || 0,
      waiting: pool?.waitingCount || 0
    };

    // Get top and slowest endpoints
    const allEndpoints = Array.from(this.endpointMetrics.values());
    const topEndpoints = [...allEndpoints]
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 10);
    const slowestEndpoints = [...allEndpoints]
      .sort((a, b) => b.p95DurationMs - a.p95DurationMs)
      .slice(0, 10);

    // Get error stats
    const errorsByEndpoint = allEndpoints
      .filter(e => e.errorCount > 0)
      .map(e => ({
        path: `${e.method} ${e.path}`,
        errorCount: e.errorCount,
        errorRate: (e.errorCount / e.totalCalls) * 100
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      avgResponseTime,
      p95,
      errorRate: this.totalRequests > 0 ? (this.totalErrors / this.totalRequests) * 100 : 0,
      cacheHitRate: cacheStats.hitRate,
      slowestEndpoints,
      poolStats,
      memoryUsage
    });

    return {
      generatedAt: new Date(),
      uptime,
      summary: {
        totalRequests: this.totalRequests,
        avgResponseTime: Math.round(avgResponseTime),
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        errorRate: this.totalRequests > 0 ? (this.totalErrors / this.totalRequests) * 100 : 0,
        requestsPerSecond: this.requestTimestamps.length / 60
      },
      database: {
        avgQueryTime: dbMetrics.avgQueryTime,
        slowQueryCount: dbMetrics.slowQueries,
        connectionPoolStats: poolStats,
        topSlowQueries: slowQueries.map(q => ({
          query: q.query.substring(0, 100),
          avgMs: Math.round(q.avgDurationMs),
          calls: q.totalCalls
        }))
      },
      cache: {
        l1HitRate: cacheStats.l1Size > 0 ? (cacheStats.l1Hits / (cacheStats.l1Hits + cacheStats.l2Hits + cacheStats.misses)) * 100 : 0,
        l2HitRate: cacheStats.l2Size > 0 ? (cacheStats.l2Hits / (cacheStats.l1Hits + cacheStats.l2Hits + cacheStats.misses)) * 100 : 0,
        totalHitRate: cacheStats.hitRate,
        size: cacheStats.l1Size + cacheStats.l2Size,
        evictions: cacheStats.evictions
      },
      websocket: {
        activeConnections: socketStats.totalConnections,
        peakConnections: socketStats.peakConnections,
        messagesSent: socketStats.messagesSent,
        avgLatency: Math.round(socketStats.averageLatency)
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      topEndpoints,
      slowestEndpoints,
      errorsByEndpoint,
      recommendations
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(data: {
    avgResponseTime: number;
    p95: number;
    errorRate: number;
    cacheHitRate: number;
    slowestEndpoints: EndpointMetrics[];
    poolStats: { total: number; idle: number; waiting: number };
    memoryUsage: NodeJS.MemoryUsage;
  }): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (data.p95 > 500) {
      recommendations.push(`P95 response time (${data.p95}ms) exceeds 500ms target. Consider optimizing slow endpoints or adding caching.`);
    }

    if (data.avgResponseTime > 200) {
      recommendations.push(`Average response time (${Math.round(data.avgResponseTime)}ms) is high. Review database queries and caching strategy.`);
    }

    // Error rate recommendations
    if (data.errorRate > 1) {
      recommendations.push(`Error rate (${data.errorRate.toFixed(2)}%) exceeds 1% target. Review error logs and fix root causes.`);
    }

    // Cache recommendations
    if (data.cacheHitRate < 50) {
      recommendations.push(`Cache hit rate (${data.cacheHitRate.toFixed(1)}%) is below 50%. Consider caching more frequently accessed data.`);
    }

    // Connection pool recommendations
    if (data.poolStats.waiting > 0) {
      recommendations.push(`Database connections are waiting (${data.poolStats.waiting}). Consider increasing pool size.`);
    }

    if (data.poolStats.idle === 0 && data.poolStats.total > 0) {
      recommendations.push('No idle database connections. Pool may be under-provisioned for current load.');
    }

    // Memory recommendations
    const heapUsedMB = data.memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = data.memoryUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    if (heapUsagePercent > 85) {
      recommendations.push(`Memory usage (${heapUsagePercent.toFixed(1)}%) is high. Consider memory optimization or increasing heap size.`);
    }

    // Slow endpoint recommendations
    const criticallySlowEndpoints = data.slowestEndpoints.filter(e => e.p95DurationMs > 1000);
    if (criticallySlowEndpoints.length > 0) {
      recommendations.push(`${criticallySlowEndpoints.length} endpoints have P95 > 1000ms. Priority optimization needed.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable parameters. Continue monitoring.');
    }

    return recommendations;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Print formatted report to console
   */
  async printReport(): Promise<void> {
    const report = await this.generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('              PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(60));
    console.log(`Generated: ${report.generatedAt.toISOString()}`);
    console.log(`Uptime: ${Math.round(report.uptime)}s`);
    
    console.log('\n📈 REQUEST SUMMARY');
    console.log('─'.repeat(40));
    console.log(`  Total Requests:    ${report.summary.totalRequests}`);
    console.log(`  Requests/sec:      ${report.summary.requestsPerSecond.toFixed(2)}`);
    console.log(`  Error Rate:        ${report.summary.errorRate.toFixed(2)}%`);
    console.log(`  Avg Response:      ${report.summary.avgResponseTime}ms`);
    console.log(`  P50:               ${report.summary.p50ResponseTime}ms`);
    console.log(`  P95:               ${report.summary.p95ResponseTime}ms`);
    console.log(`  P99:               ${report.summary.p99ResponseTime}ms`);

    console.log('\n💾 DATABASE');
    console.log('─'.repeat(40));
    console.log(`  Avg Query Time:    ${report.database.avgQueryTime}ms`);
    console.log(`  Slow Queries:      ${report.database.slowQueryCount}`);
    console.log(`  Pool - Total:      ${report.database.connectionPoolStats.total}`);
    console.log(`  Pool - Idle:       ${report.database.connectionPoolStats.idle}`);
    console.log(`  Pool - Waiting:    ${report.database.connectionPoolStats.waiting}`);

    console.log('\n🗃️  CACHE');
    console.log('─'.repeat(40));
    console.log(`  Hit Rate:          ${report.cache.totalHitRate.toFixed(1)}%`);
    console.log(`  Cache Size:        ${report.cache.size} entries`);
    console.log(`  Evictions:         ${report.cache.evictions}`);

    console.log('\n🔌 WEBSOCKET');
    console.log('─'.repeat(40));
    console.log(`  Active:            ${report.websocket.activeConnections}`);
    console.log(`  Peak:              ${report.websocket.peakConnections}`);
    console.log(`  Messages Sent:     ${report.websocket.messagesSent}`);
    console.log(`  Avg Latency:       ${report.websocket.avgLatency}ms`);

    console.log('\n💻 MEMORY (MB)');
    console.log('─'.repeat(40));
    console.log(`  Heap Used:         ${report.memory.heapUsed}MB`);
    console.log(`  Heap Total:        ${report.memory.heapTotal}MB`);
    console.log(`  RSS:               ${report.memory.rss}MB`);

    if (report.slowestEndpoints.length > 0) {
      console.log('\n🐢 TOP 5 SLOWEST ENDPOINTS');
      console.log('─'.repeat(40));
      for (const endpoint of report.slowestEndpoints.slice(0, 5)) {
        console.log(`  ${endpoint.method} ${endpoint.path}`);
        console.log(`    Calls: ${endpoint.totalCalls} | Avg: ${Math.round(endpoint.avgDurationMs)}ms | P95: ${endpoint.p95DurationMs}ms`);
      }
    }

    console.log('\n💡 RECOMMENDATIONS');
    console.log('─'.repeat(40));
    for (const rec of report.recommendations) {
      console.log(`  • ${rec}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.endpointMetrics.clear();
    this.systemMetrics = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.allResponseTimes = [];
    this.requestTimestamps = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware for automatic request tracking
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      performanceMonitor.recordRequest(
        req.method,
        req.route?.path || req.path,
        duration,
        res.statusCode
      );
    });
    
    next();
  };
}

// Export class for testing
export { PerformanceMonitor, PerformanceReport };
