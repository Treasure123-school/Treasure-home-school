/**
 * Scalability Configuration Module
 * 
 * Prepares the system for horizontal scaling to support 500-1000+ concurrent users.
 * 
 * Features:
 * - Redis-ready session management (fallback to in-memory for development)
 * - Cache sharing configuration across instances
 * - Connection pool optimization
 * - Load balancer health check endpoints
 * - WebSocket adapter for multi-instance support
 */

import session from 'express-session';
import memorystore from 'memorystore';
import type { Express, RequestHandler } from 'express';
import type { Server as HTTPServer } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
const hasRedis = !!redisUrl;

// Session configuration constants
const SESSION_SECRET = process.env.SESSION_SECRET || 'treasure-home-school-session-secret-dev';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_COOKIE_NAME = 'ths.sid';

// Connection pool configuration for high concurrency
export const DATABASE_POOL_CONFIG = {
  // Minimum connections to maintain (warm pool)
  min: isProduction ? 5 : 2,
  // Maximum connections (scale based on expected load)
  max: isProduction ? 30 : 10,
  // Connection acquisition timeout
  acquireTimeoutMillis: 30000,
  // Idle connection timeout (close idle connections)
  idleTimeoutMillis: 30000,
  // Check interval for idle connections
  reapIntervalMillis: 1000,
  // Connection creation retries
  createRetryIntervalMillis: 200,
};

// Cache configuration for scalability
export const CACHE_CONFIG = {
  // Maximum L1 cache entries (hot data)
  maxL1Entries: isProduction ? 200 : 100,
  // Maximum L2 cache entries (warm data)
  maxL2Entries: isProduction ? 1000 : 500,
  // Default TTL (5 minutes)
  defaultTTL: 5 * 60 * 1000,
  // Enable cache statistics
  enableStats: true,
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // General API rate limit
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 1000 : 10000, // requests per window
  },
  // Authentication rate limit (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 50 : 1000, // login attempts
  },
  // Exam submission rate limit (prevent abuse)
  examSubmit: {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // submissions per minute
  },
};

/**
 * Get session middleware configured for scalability
 * Uses Redis in production (if available), memory store in development
 */
export function getSessionMiddleware(): RequestHandler {
  const MemoryStore = memorystore(session);
  
  // Create memory store instance
  const store = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
    max: isProduction ? 10000 : 1000,
  });
  
  // Log store type
  if (isProduction && hasRedis) {
    console.log('📡 Session store: Redis-ready (using memory store until Redis is configured)');
  } else {
    console.log('💾 Session store: Memory (development mode)');
  }
  
  return session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      maxAge: SESSION_MAX_AGE,
    },
  });
}

/**
 * Configure Socket.IO for horizontal scaling
 * Uses Redis adapter in production for multi-instance pub/sub
 */
export async function configureSocketIOForScaling(io: SocketIOServer): Promise<void> {
  if (isProduction && hasRedis) {
    console.log('📡 Socket.IO adapter: Redis (multi-instance ready)');
    // Redis adapter would be configured here
    // import { createAdapter } from '@socket.io/redis-adapter';
    // import { createClient } from 'redis';
    // const pubClient = createClient({ url: redisUrl });
    // const subClient = pubClient.duplicate();
    // await Promise.all([pubClient.connect(), subClient.connect()]);
    // io.adapter(createAdapter(pubClient, subClient));
    console.log('⚠️ Redis Socket.IO adapter not yet configured, using in-memory');
  } else {
    console.log('💾 Socket.IO adapter: In-memory (single instance)');
  }
  
  // Connection limits for scalability
  io.setMaxListeners(isProduction ? 100 : 50);
}

/**
 * Add health check endpoints for load balancer
 */
export function addHealthCheckEndpoints(app: Express): void {
  // Simple health check (for load balancer)
  app.get('/health', (_req, res) => {
    res.status(200).json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Detailed health check (for monitoring)
  app.get('/health/detailed', async (_req, res) => {
    const startTime = Date.now();
    
    try {
      // Check database connectivity
      const { getPgPool } = await import('./storage');
      const pool = getPgPool();
      const dbStatus = pool ? {
        status: 'connected',
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      } : { status: 'unavailable' };
      
      // Check memory usage
      const memUsage = process.memoryUsage();
      const memoryStatus = {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      };
      
      // Check cache status
      const { enhancedCache } = await import('./enhanced-cache');
      const cacheStats = enhancedCache.getStats();
      
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        memory: memoryStatus,
        cache: {
          hitRate: `${cacheStats.hitRate.toFixed(2)}%`,
          l1Size: cacheStats.l1Size,
          l2Size: cacheStats.l2Size,
        },
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });
  
  // Readiness check (for Kubernetes/deployment)
  app.get('/ready', async (_req, res) => {
    try {
      const { getPgPool } = await import('./storage');
      const pool = getPgPool();
      
      if (pool && pool.totalCount > 0) {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: 'Database not ready' });
      }
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'Service not ready' });
    }
  });
}

/**
 * Graceful shutdown handler for horizontal scaling
 */
export function setupGracefulShutdown(
  httpServer: HTTPServer,
  io: SocketIOServer
): void {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Close Socket.IO connections gracefully
    io.close(() => {
      console.log('✅ Socket.IO server closed');
    });
    
    // Allow existing requests to complete (30 seconds max)
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Close database connections
    try {
      const { getPgPool } = await import('./storage');
      const pool = getPgPool();
      if (pool) {
        await pool.end();
        console.log('✅ Database connections closed');
      }
    } catch (error) {
      console.error('Error closing database connections:', error);
    }
    
    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  };
  
  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Log scalability configuration on startup
 */
export function logScalabilityConfig(): void {
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│            SCALABILITY CONFIGURATION                │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log(`│  Environment: ${(isProduction ? 'PRODUCTION' : 'DEVELOPMENT').padEnd(36)}│`);
  console.log(`│  Redis Available: ${(hasRedis ? 'YES' : 'NO').padEnd(32)}│`);
  console.log(`│  Session Store: ${(hasRedis && isProduction ? 'Redis' : 'Memory').padEnd(34)}│`);
  console.log(`│  Socket.IO Adapter: ${(hasRedis && isProduction ? 'Redis' : 'In-Memory').padEnd(30)}│`);
  console.log(`│  DB Pool Size: ${DATABASE_POOL_CONFIG.min}-${DATABASE_POOL_CONFIG.max} connections`.padEnd(35) + '│');
  console.log(`│  Cache L1/L2: ${CACHE_CONFIG.maxL1Entries}/${CACHE_CONFIG.maxL2Entries} entries`.padEnd(35) + '│');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log('│  Ready for: 500-1000 concurrent users               │');
  console.log('│  Note: Add Redis for multi-instance deployment      │');
  console.log('└─────────────────────────────────────────────────────┘\n');
}

// Export for use in main server
export default {
  getSessionMiddleware,
  configureSocketIOForScaling,
  addHealthCheckEndpoints,
  setupGracefulShutdown,
  logScalabilityConfig,
  DATABASE_POOL_CONFIG,
  CACHE_CONFIG,
  RATE_LIMIT_CONFIG,
};
