/**
 * Query Optimization Utilities for School Portal
 * 
 * Provides optimized query patterns and database performance enhancements:
 * - Batch loading to prevent N+1 queries
 * - Efficient pagination
 * - Query result limiting
 * - Connection pooling utilities
 */

import { sql } from 'drizzle-orm';
import { db, getPgPool } from './storage';

/**
 * Batch loader to prevent N+1 queries
 * Caches results for the duration of a request
 */
export class BatchLoader<K, V> {
  private batch: K[] = [];
  private cache: Map<string, V> = new Map();
  private batchScheduled: boolean = false;
  private pendingPromises: Map<string, { resolve: (v: V | undefined) => void; reject: (e: Error) => void }[]> = new Map();
  
  constructor(
    private batchFn: (keys: K[]) => Promise<Map<K, V>>,
    private keyFn: (key: K) => string = (k) => String(k)
  ) {}

  async load(key: K): Promise<V | undefined> {
    const keyStr = this.keyFn(key);
    
    // Check cache first
    if (this.cache.has(keyStr)) {
      return this.cache.get(keyStr);
    }

    // Add to batch
    this.batch.push(key);
    
    // Return a promise that will be resolved when batch executes
    return new Promise((resolve, reject) => {
      const existing = this.pendingPromises.get(keyStr) || [];
      existing.push({ resolve, reject });
      this.pendingPromises.set(keyStr, existing);
      
      if (!this.batchScheduled) {
        this.batchScheduled = true;
        // Execute batch on next tick
        setImmediate(() => this.executeBatch());
      }
    });
  }

  private async executeBatch(): Promise<void> {
    const batch = [...this.batch];
    this.batch = [];
    this.batchScheduled = false;

    if (batch.length === 0) return;

    try {
      const results = await this.batchFn(batch);
      
      // Cache and resolve all pending promises
      for (const key of batch) {
        const keyStr = this.keyFn(key);
        const value = results.get(key);
        this.cache.set(keyStr, value as V);
        
        const pending = this.pendingPromises.get(keyStr) || [];
        for (const { resolve } of pending) {
          resolve(value);
        }
        this.pendingPromises.delete(keyStr);
      }
    } catch (error) {
      // Reject all pending promises
      for (const key of batch) {
        const keyStr = this.keyFn(key);
        const pending = this.pendingPromises.get(keyStr) || [];
        for (const { reject } of pending) {
          reject(error as Error);
        }
        this.pendingPromises.delete(keyStr);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.batch = [];
  }
}

/**
 * Pagination helper with cursor-based pagination support
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string | number;
  };
}

export function getPaginationParams(options: PaginationOptions): { offset: number; limit: number } {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20)); // Cap at 100
  const offset = (page - 1) * limit;
  
  return { offset, limit };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Connection pool statistics
 */
export async function getPoolStats(): Promise<{
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}> {
  const pool = getPgPool();
  if (!pool) {
    return { totalConnections: 0, idleConnections: 0, waitingClients: 0 };
  }

  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Query timing wrapper for performance monitoring
 */
export async function timedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  slowThresholdMs: number = 500
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await queryFn();
  const durationMs = Date.now() - start;
  
  if (durationMs > slowThresholdMs) {
    console.warn(`[SLOW QUERY] ${queryName}: ${durationMs}ms`);
  }
  
  return { result, durationMs };
}

/**
 * Optimized bulk insert with conflict handling
 */
export async function bulkInsertWithConflict<T extends Record<string, any>>(
  table: any,
  data: T[],
  conflictColumns: string[],
  updateColumns?: string[]
): Promise<number> {
  if (data.length === 0) return 0;
  
  // Insert in batches of 100 to avoid query size limits
  const BATCH_SIZE = 100;
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    
    // Use drizzle's onConflictDoNothing or onConflictDoUpdate
    const result = await (db as any).insert(table).values(batch).onConflictDoNothing();
    inserted += batch.length;
  }
  
  return inserted;
}

/**
 * Optimize query with field selection (projection)
 * Returns only specified fields to reduce data transfer
 */
export function selectFields<T extends Record<string, any>>(
  data: T[],
  fields: (keyof T)[]
): Partial<T>[] {
  return data.map(item => {
    const result: Partial<T> = {};
    for (const field of fields) {
      if (field in item) {
        result[field] = item[field];
      }
    }
    return result;
  });
}

/**
 * Rate limiter for expensive operations
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return true;
  }
  
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    
    return Math.max(0, this.maxRequests - timestamps.length);
  }
  
  reset(key: string): void {
    this.requests.delete(key);
  }
  
  clear(): void {
    this.requests.clear();
  }
}
