/**
 * Enhanced Caching Layer for High-Performance School Portal
 * 
 * Features:
 * - Multi-tier caching (L1: hot data, L2: warm data)
 * - Request coalescing to prevent thundering herd
 * - Cache warming for critical data
 * - Real-time cache invalidation
 * - LRU eviction policy
 * - Cache statistics and monitoring
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
  size: number;
  tier: 'L1' | 'L2';
  createdAt: number;
}

interface CacheConfig {
  maxL1Size: number;
  maxL2Size: number;
  defaultTTL: number;
  enableStats: boolean;
}

interface CacheStats {
  l1Hits: number;
  l2Hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  l1Size: number;
  l2Size: number;
  avgResponseTime: number;
  evictions: number;
}

type CacheEventType = 'hit' | 'miss' | 'set' | 'invalidate' | 'evict';

class EnhancedCache {
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private l2Cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  private l1Hits = 0;
  private l2Hits = 0;
  private misses = 0;
  private evictions = 0;
  private responseTimes: number[] = [];
  
  private config: CacheConfig = {
    maxL1Size: 100,
    maxL2Size: 500,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    enableStats: true
  };
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<CacheEventType, Set<Function>> = new Map();

  // TTL Presets (in milliseconds)
  static readonly TTL = {
    INSTANT: 10 * 1000,         // 10 seconds - for rapidly changing data
    SHORT: 30 * 1000,           // 30 seconds - for dynamic data
    MEDIUM: 5 * 60 * 1000,      // 5 minutes - for semi-static data
    LONG: 30 * 60 * 1000,       // 30 minutes - for static data
    HOUR: 60 * 60 * 1000,       // 1 hour
    DAY: 24 * 60 * 60 * 1000,   // 24 hours
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.startCleanup();
  }

  /**
   * Get or set with request coalescing (prevents thundering herd)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = this.config.defaultTTL,
    tier: 'L1' | 'L2' = 'L2'
  ): Promise<T> {
    const startTime = Date.now();
    
    // Check L1 cache first (hot data)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > Date.now()) {
      this.l1Hits++;
      l1Entry.hits++;
      this.recordResponseTime(startTime);
      this.emit('hit', { key, tier: 'L1' });
      return l1Entry.data as T;
    }

    // Check L2 cache (warm data)
    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && l2Entry.expiresAt > Date.now()) {
      this.l2Hits++;
      l2Entry.hits++;
      
      // Promote to L1 if frequently accessed
      if (l2Entry.hits >= 3) {
        this.promoteToL1(key, l2Entry);
      }
      
      this.recordResponseTime(startTime);
      this.emit('hit', { key, tier: 'L2' });
      return l2Entry.data as T;
    }

    // Request coalescing: wait for pending request if exists
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.l1Hits++; // Count as soft hit
      return pending as Promise<T>;
    }

    // Cache miss - fetch and store
    this.misses++;
    this.emit('miss', { key });

    const fetchPromise = fetchFn()
      .then(data => {
        this.set(key, data, ttlMs, tier);
        this.pendingRequests.delete(key);
        this.recordResponseTime(startTime);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Direct set with tier specification
   */
  set<T>(
    key: string,
    data: T,
    ttlMs: number = this.config.defaultTTL,
    tier: 'L1' | 'L2' = 'L2'
  ): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
      hits: 0,
      size: this.estimateSize(data),
      tier,
      createdAt: Date.now()
    };

    if (tier === 'L1') {
      this.ensureL1Capacity();
      this.l1Cache.set(key, entry);
    } else {
      this.ensureL2Capacity();
      this.l2Cache.set(key, entry);
    }

    this.emit('set', { key, tier });
  }

  /**
   * Get without fetching
   */
  get<T>(key: string): T | null {
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiresAt > Date.now()) {
      this.l1Hits++;
      l1Entry.hits++;
      return l1Entry.data as T;
    }

    const l2Entry = this.l2Cache.get(key);
    if (l2Entry && l2Entry.expiresAt > Date.now()) {
      this.l2Hits++;
      l2Entry.hits++;
      return l2Entry.data as T;
    }

    this.misses++;
    return null;
  }

  /**
   * Invalidate by key or pattern
   */
  invalidate(keyOrPattern: string | RegExp): number {
    let count = 0;

    const invalidateFromMap = (cache: Map<string, any>) => {
      if (typeof keyOrPattern === 'string') {
        if (cache.delete(keyOrPattern)) count++;
      } else {
        for (const key of cache.keys()) {
          if (keyOrPattern.test(key)) {
            cache.delete(key);
            count++;
          }
        }
      }
    };

    invalidateFromMap(this.l1Cache);
    invalidateFromMap(this.l2Cache);

    if (count > 0) {
      this.emit('invalidate', { pattern: keyOrPattern.toString(), count });
    }

    return count;
  }

  /**
   * Invalidate all cache entries for a table
   */
  invalidateTable(tableName: string): number {
    return this.invalidate(new RegExp(`^${tableName}:`));
  }

  /**
   * Pre-warm cache with critical data
   */
  async warmCache(warmers: Array<{ key: string; fetchFn: () => Promise<any>; ttl?: number; tier?: 'L1' | 'L2' }>): Promise<void> {
    const promises = warmers.map(async ({ key, fetchFn, ttl, tier }) => {
      try {
        const data = await fetchFn();
        this.set(key, data, ttl || this.config.defaultTTL, tier || 'L2');
        return { key, success: true };
      } catch (error) {
        console.warn(`Cache warm failed for ${key}:`, error);
        return { key, success: false };
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Cache warmed: ${successful}/${warmers.length} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.l1Hits + this.l2Hits + this.misses;
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return {
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      misses: this.misses,
      totalRequests,
      hitRate: totalRequests > 0 ? ((this.l1Hits + this.l2Hits) / totalRequests) * 100 : 0,
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      evictions: this.evictions
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Shutdown gracefully
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  // ==================== CACHE KEY GENERATORS ====================
  
  static keys = {
    // System data (long TTL)
    systemSettings: () => 'system:settings',
    roles: () => 'system:roles',
    gradingConfig: () => 'system:grading',
    
    // Reference data (medium TTL)
    classes: () => 'ref:classes',
    subjects: () => 'ref:subjects',
    academicTerms: () => 'ref:terms',
    currentTerm: () => 'ref:currentTerm',
    
    // Homepage & public content (medium TTL)
    homepageContent: () => 'homepage:content',
    announcements: () => 'announcements:all',
    announcementsByRole: (role: string) => `announcements:role:${role}`,
    
    // User data (short TTL)
    user: (id: string) => `user:${id}`,
    userProfile: (id: string) => `user:profile:${id}`,
    student: (id: string) => `student:${id}`,
    
    // Teacher data (short TTL)
    teacherAssignments: (teacherId: string) => `teacher:assignments:${teacherId}`,
    teacherDashboard: (teacherId: string) => `teacher:dashboard:${teacherId}`,
    teacherClasses: (teacherId: string) => `teacher:classes:${teacherId}`,
    
    // Exam data (short TTL due to real-time nature)
    exam: (id: number) => `exam:${id}`,
    examQuestions: (examId: number) => `exam:questions:${examId}`,
    examsByClass: (classId: number) => `exams:class:${classId}`,
    examsByTeacher: (teacherId: string) => `exams:teacher:${teacherId}`,
    visibleExams: (userId: string, roleId: number) => `exams:visible:${userId}:${roleId}`,
    
    // Report cards (medium TTL)
    reportCard: (id: number) => `reportcard:${id}`,
    reportCardsByStudent: (studentId: string) => `reportcards:student:${studentId}`,
    reportCardsByClass: (classId: number, termId: number) => `reportcards:class:${classId}:term:${termId}`,
    
    // Notifications (instant TTL due to real-time)
    userNotifications: (userId: string) => `notifications:user:${userId}`,
    unreadCount: (userId: string) => `notifications:unread:${userId}`,
  };

  // ==================== PRIVATE METHODS ====================

  private promoteToL1(key: string, entry: CacheEntry<any>): void {
    this.ensureL1Capacity();
    entry.tier = 'L1';
    this.l1Cache.set(key, entry);
    this.l2Cache.delete(key);
  }

  private ensureL1Capacity(): void {
    while (this.l1Cache.size >= this.config.maxL1Size) {
      const oldestKey = this.findLRUKey(this.l1Cache);
      if (oldestKey) {
        const entry = this.l1Cache.get(oldestKey);
        this.l1Cache.delete(oldestKey);
        
        // Demote to L2 instead of deleting
        if (entry && entry.expiresAt > Date.now()) {
          entry.tier = 'L2';
          this.l2Cache.set(oldestKey, entry);
        }
        
        this.evictions++;
        this.emit('evict', { key: oldestKey, tier: 'L1' });
      }
    }
  }

  private ensureL2Capacity(): void {
    while (this.l2Cache.size >= this.config.maxL2Size) {
      const oldestKey = this.findLRUKey(this.l2Cache);
      if (oldestKey) {
        this.l2Cache.delete(oldestKey);
        this.evictions++;
        this.emit('evict', { key: oldestKey, tier: 'L2' });
      }
    }
  }

  private findLRUKey(cache: Map<string, CacheEntry<any>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private recordResponseTime(startTime: number): void {
    if (!this.config.enableStats) return;
    
    const duration = Date.now() - startTime;
    this.responseTimes.push(duration);
    
    // Keep only last 1000 measurements
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [key, entry] of this.l1Cache.entries()) {
        if (entry.expiresAt < now) {
          this.l1Cache.delete(key);
        }
      }
      
      for (const [key, entry] of this.l2Cache.entries()) {
        if (entry.expiresAt < now) {
          this.l2Cache.delete(key);
        }
      }
    }, 60 * 1000); // Every minute
  }

  private emit(event: CacheEventType, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (e) {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Subscribe to cache events
   */
  on(event: CacheEventType, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unsubscribe from cache events
   */
  off(event: CacheEventType, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

// Singleton instance
export const enhancedCache = new EnhancedCache({
  maxL1Size: 150,
  maxL2Size: 800,
  defaultTTL: 5 * 60 * 1000,
  enableStats: true
});

// Export class for testing
export { EnhancedCache };
