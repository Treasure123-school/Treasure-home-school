const isDevelopment = process.env.NODE_ENV !== "production";

export const RATE_LIMIT_CONFIG = {
  MAX_LOGIN_ATTEMPTS: isDevelopment ? 100 : 5,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_VIOLATION_WINDOW: 60 * 60 * 1000, // 1 hour
  MAX_RATE_LIMIT_VIOLATIONS: isDevelopment ? 50 : 3,
  TEST_ACCOUNTS: ["student", "teacher", "admin", "parent", "superadmin"],
} as const;

interface AttemptData {
  count: number;
  lastAttempt: number;
}

interface ViolationData {
  count: number;
  timestamps: number[];
}

class RateLimiter {
  private loginAttempts = new Map<string, AttemptData>();
  private lockoutViolations = new Map<string, ViolationData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean every minute
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [key, data] of this.loginAttempts.entries()) {
      if (now - data.lastAttempt > RATE_LIMIT_CONFIG.RATE_LIMIT_WINDOW) {
        this.loginAttempts.delete(key);
      }
    }

    for (const [key, data] of this.lockoutViolations.entries()) {
      const validTimestamps = data.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_CONFIG.LOCKOUT_VIOLATION_WINDOW
      );
      if (validTimestamps.length === 0) {
        this.lockoutViolations.delete(key);
      } else {
        this.lockoutViolations.set(key, { count: validTimestamps.length, timestamps: validTimestamps });
      }
    }
  }

  getAttemptKey(ip: string, identifier: string): string {
    return `${ip}:${identifier || "no-identifier"}`;
  }

  getAttempts(key: string): AttemptData {
    return this.loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  }

  incrementAttempts(key: string): void {
    const now = Date.now();
    const current = this.getAttempts(key);
    this.loginAttempts.set(key, { count: current.count + 1, lastAttempt: now });
  }

  clearAttempts(key: string): void {
    this.loginAttempts.delete(key);
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const attempts = this.getAttempts(key);
    return (
      attempts.count >= RATE_LIMIT_CONFIG.MAX_LOGIN_ATTEMPTS &&
      now - attempts.lastAttempt < RATE_LIMIT_CONFIG.RATE_LIMIT_WINDOW
    );
  }

  addViolation(identifier: string): number {
    const now = Date.now();
    const data = this.lockoutViolations.get(identifier) || { count: 0, timestamps: [] };
    const validTimestamps = data.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_CONFIG.LOCKOUT_VIOLATION_WINDOW
    );
    validTimestamps.push(now);
    this.lockoutViolations.set(identifier, { count: validTimestamps.length, timestamps: validTimestamps });
    return validTimestamps.length;
  }

  getViolationCount(identifier: string): number {
    const data = this.lockoutViolations.get(identifier);
    return data?.count || 0;
  }

  clearViolations(identifier: string): void {
    this.lockoutViolations.delete(identifier);
  }

  shouldSuspend(identifier: string): boolean {
    return this.getViolationCount(identifier) >= RATE_LIMIT_CONFIG.MAX_RATE_LIMIT_VIOLATIONS;
  }

  isTestAccount(identifier: string): boolean {
    return (RATE_LIMIT_CONFIG.TEST_ACCOUNTS as readonly string[]).includes(identifier.toLowerCase());
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimiter = new RateLimiter();
