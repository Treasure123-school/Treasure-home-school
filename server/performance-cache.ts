/**
 * Performance Caching Layer for School Portal
 * 
 * Implements in-memory caching with TTL for hot endpoints:
 * - Homepage content
 * - Announcements
 * - Classes/Subjects lists
 * - System settings
 * - Frequently accessed user data
 * 
 * This reduces database load and improves response times for read-heavy operations.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class PerformanceCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map(); // Request coalescing
  private hits: number = 0;
  private misses: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Default TTL values in milliseconds
  private static readonly TTL_SHORT = 30 * 1000;       // 30 seconds - for dynamic data
  private static readonly TTL_MEDIUM = 5 * 60 * 1000;  // 5 minutes - for semi-static data
  private static readonly TTL_LONG = 30 * 60 * 1000;   // 30 minutes - for static data

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached data or fetch from source with request coalescing
   * Request coalescing prevents thundering herd by sharing in-flight requests
   */
  async getOrSet<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttlMs: number = PerformanceCache.TTL_MEDIUM
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
      this.hits++;
      cached.hits++;
      return cached.data as T;
    }

    // Request coalescing: if a request is already in flight, wait for it
    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.hits++; // Count as a "soft hit" since we're sharing the request
      return pending as Promise<T>;
    }

    this.misses++;
    
    // Create and store the promise to coalesce requests
    const fetchPromise = fetchFn().then(data => {
      this.cache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs,
        hits: 0,
      });
      this.pendingRequests.delete(key);
      return data;
    }).catch(error => {
      this.pendingRequests.delete(key);
      throw error;
    });
    
    this.pendingRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Get cached data without fetching
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
      this.hits++;
      cached.hits++;
      return cached.data as T;
    }

    this.misses++;
    return null;
  }

  /**
   * Set cache data directly
   */
  set<T>(key: string, data: T, ttlMs: number = PerformanceCache.TTL_MEDIUM): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      hits: 0,
    });
  }

  /**
   * Invalidate cache by key or pattern
   */
  invalidate(keyOrPattern: string | RegExp): number {
    let invalidatedCount = 0;
    
    if (typeof keyOrPattern === 'string') {
      if (this.cache.delete(keyOrPattern)) {
        invalidatedCount++;
      }
    } else {
      for (const key of this.cache.keys()) {
        if (keyOrPattern.test(key)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
    }
    
    return invalidatedCount;
  }

  /**
   * Invalidate all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: this.hits + this.misses > 0 
        ? (this.hits / (this.hits + this.misses)) * 100 
        : 0,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  // ==================== CACHE KEY GENERATORS ====================
  
  static keys = {
    homepageContent: () => 'homepage:content',
    homepageContentByType: (type: string) => `homepage:content:${type}`,
    announcements: () => 'announcements:all',
    announcementsByRole: (role: string) => `announcements:role:${role}`,
    classes: () => 'classes:all',
    activeClasses: () => 'classes:active',
    subjects: () => 'subjects:all',
    activeSubjects: () => 'subjects:active',
    academicTerms: () => 'terms:all',
    currentTerm: () => 'terms:current',
    systemSettings: () => 'settings:system',
    roles: () => 'roles:all',
    userById: (id: string) => `user:${id}`,
    studentById: (id: string) => `student:${id}`,
    teacherDashboard: (teacherId: string) => `teacher:dashboard:${teacherId}`,
    examsByClass: (classId: number) => `exams:class:${classId}`,
    examQuestions: (examId: number) => `exam:questions:${examId}`,
    examQuestionCounts: (examIds: string) => `exam:questionCounts:${examIds}`,
    reportCardsByStudent: (studentId: string) => `reports:student:${studentId}`,
    reportCardsByClass: (classId: number, termId: number) => `reports:class:${classId}:term:${termId}`,
  };

  // ==================== TTL CONSTANTS FOR EXTERNAL USE ====================
  
  static readonly TTL = {
    SHORT: PerformanceCache.TTL_SHORT,
    MEDIUM: PerformanceCache.TTL_MEDIUM,
    LONG: PerformanceCache.TTL_LONG,
  };
}

// Singleton instance
export const performanceCache = new PerformanceCache();

// Export class for testing
export { PerformanceCache };
