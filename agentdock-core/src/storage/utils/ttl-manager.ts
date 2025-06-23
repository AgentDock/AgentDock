/**
 * TTL (Time-To-Live) management utilities
 */

import { TTLOptions } from './types';

export interface TTLRecord {
  key: string;
  expiresAt: number;
  namespace?: string;
}

/**
 * TTL Manager for handling key expiration
 */
export class TTLManager {
  private expirationMap = new Map<string, number>();
  private cleanupTimer?: NodeJS.Timeout;
  private options: Required<TTLOptions>;

  constructor(options: TTLOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 0,
      cleanupInterval: options.cleanupInterval ?? 60000, // 1 minute
      maxTTL: options.maxTTL ?? 86400000, // 24 hours
      minTTL: options.minTTL ?? 1000 // 1 second
    };

    if (this.options.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Set TTL for a key
   */
  setTTL(key: string, ttlMs?: number): number | undefined {
    // Use nullish coalescing to properly handle 0 as a valid TTL value
    if (ttlMs === undefined && this.options.defaultTTL === 0) {
      return undefined;
    }

    const effectiveTTL = ttlMs ?? this.options.defaultTTL;

    // Validate TTL bounds (allow 0 for immediate expiration)
    if (effectiveTTL !== 0 && effectiveTTL < this.options.minTTL) {
      throw new Error(`TTL must be at least ${this.options.minTTL}ms`);
    }
    if (effectiveTTL > this.options.maxTTL) {
      throw new Error(`TTL cannot exceed ${this.options.maxTTL}ms`);
    }

    const expiresAt = Date.now() + effectiveTTL;
    this.expirationMap.set(key, expiresAt);

    return expiresAt;
  }

  /**
   * Get TTL for a key
   */
  getTTL(key: string): number | undefined {
    const expiresAt = this.expirationMap.get(key);
    if (!expiresAt) return undefined;

    const remaining = expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Check if a key has expired
   */
  isExpired(key: string): boolean {
    const expiresAt = this.expirationMap.get(key);
    if (!expiresAt) return false;

    return Date.now() >= expiresAt;
  }

  /**
   * Remove TTL for a key
   */
  removeTTL(key: string): void {
    this.expirationMap.delete(key);
  }

  /**
   * Get all expired keys
   */
  getExpiredKeys(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, expiresAt] of this.expirationMap) {
      if (now >= expiresAt) {
        expired.push(key);
      }
    }

    return expired;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): string[] {
    const expired = this.getExpiredKeys();
    expired.forEach((key) => this.expirationMap.delete(key));
    return expired;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Get all TTL records
   */
  getAllRecords(): TTLRecord[] {
    const records: TTLRecord[] = [];

    for (const [key, expiresAt] of this.expirationMap) {
      records.push({ key, expiresAt });
    }

    return records;
  }

  /**
   * Clear all TTL records
   */
  clear(): void {
    this.expirationMap.clear();
  }

  /**
   * Calculate expiration timestamp from TTL
   */
  static calculateExpiration(ttlMs: number): number {
    return Date.now() + ttlMs;
  }

  /**
   * Convert various TTL formats to milliseconds
   */
  static toMilliseconds(ttl: number | string): number {
    if (typeof ttl === 'number') {
      return ttl;
    }

    // Parse string formats: "1h", "30m", "60s", etc.
    const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid TTL format: ${ttl}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown TTL unit: ${unit}`);
    }
  }
}

/**
 * Create a TTL-aware wrapper for storage operations
 */
export function withTTL<
  T extends {
    get: (key: string, ...args: any[]) => any | Promise<any>;
    delete: (key: string, ...args: any[]) => any | Promise<any>;
  }
>(storage: T, ttlManager: TTLManager): T {
  return new Proxy(storage, {
    get(target, prop) {
      if (prop === 'get') {
        return async (key: string, ...args: any[]) => {
          if (ttlManager.isExpired(key)) {
            ttlManager.removeTTL(key);
            await target.delete(key);
            return null;
          }
          return target.get(key, ...args);
        };
      }

      return target[prop as keyof T];
    }
  });
}
