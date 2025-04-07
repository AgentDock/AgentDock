/**
 * @fileoverview Redis storage provider implementation using @upstash/redis.
 * 
 * Uses @upstash/redis client, compatible with Vercel Edge Runtime and Upstash/Vercel KV.
 */

import { Redis } from '@upstash/redis';
import { 
  StorageProvider, 
  StorageOptions
} from '../types'; 
import { logger, LogCategory } from '../../logging';

// Configuration for the Upstash Redis client
export interface UpstashRedisStorageProviderConfig {
  url: string;       // UPSTASH_REDIS_REST_URL or local redis://localhost:6379
  token: string;     // UPSTASH_REDIS_REST_TOKEN or a placeholder if local/unauthenticated
  namespace?: string; // Optional namespace for key prefixing
  // Other @upstash/redis options can be added if needed, e.g., retries
}

export class RedisStorageProvider implements StorageProvider {
  private client: Redis;
  private namespace: string;
  private providerType = 'redis'; // Keep type name consistent

  constructor(config: UpstashRedisStorageProviderConfig) {
    const { namespace = 'agentdock', url, token, ...redisOptions } = config;
    this.namespace = namespace;

    if (!url || !token) {
        const errMsg = 'Upstash Redis provider requires URL and Token.';
        logger.error(LogCategory.STORAGE, this.providerType, errMsg, { hasUrl: !!url, hasToken: !!token });
        throw new Error(errMsg);
    }

    try {
      this.client = new Redis({
        url: url,
        token: token,
        ...redisOptions // Pass any other compatible options
      });
      logger.info(LogCategory.STORAGE, this.providerType, `Initialized Upstash Redis client for URL: ${url.split('@').pop()}`); // Avoid logging token/password

    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Failed to initialize Upstash Redis client', {
        error: error instanceof Error ? error.message : String(error),
        urlUsed: url.split('@').pop() // Log URL safely
      });
      throw new Error(`Failed to initialize RedisStorageProvider (Upstash): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getKey(key: string): string {
    // Upstash client doesn't automatically namespace, so we prepend it.
    return `${this.namespace}:${key}`;
  }

  // --- Basic Methods --- 

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.getKey(key);
    try {
      // DEBUG: Log key being fetched
      logger.debug(LogCategory.STORAGE, this.providerType, '[GET] Fetching key', { fullKey });
      
      const value = await this.client.get<T>(fullKey);
      
      // DEBUG: Log the raw value received
      logger.debug(LogCategory.STORAGE, this.providerType, '[GET] Value received', { 
        fullKey, 
        value: JSON.stringify(value) // Stringify to see the structure
      }); 
      
      return value; // Returns parsed value or null
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error getting value', { 
        key: fullKey, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null; 
    }
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.getKey(key);
    try {
      const ttlSeconds = options?.ttlSeconds;
      
      // DEBUG: Log value being set
      logger.debug(LogCategory.STORAGE, this.providerType, '[SET] Value being set', { 
        fullKey, 
        value: JSON.stringify(value), // Stringify to log structure
        ttlSeconds 
      });
      
      if (ttlSeconds) {
        // Use 'ex' for seconds with @upstash/redis
        await this.client.set(fullKey, value, { ex: ttlSeconds });
      } else {
        await this.client.set(fullKey, value);
      }
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error setting value', { 
        key: fullKey, 
        hasTTL: !!options?.ttlSeconds,
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getKey(key);
    try {
      const result = await this.client.del(fullKey);
      return result > 0; // del returns number of keys deleted
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error deleting value', { 
        key: fullKey, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false; 
    }
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getKey(key);
    try {
      const result = await this.client.exists(fullKey);
      return result > 0; // exists returns number of keys found (0 or 1 here)
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error checking existence', { 
        key: fullKey, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false; 
    }
  }

  // --- List/Clear Methods --- 

  async list(prefix: string = '', options?: StorageOptions): Promise<string[]> {
      const searchPrefix = prefix ? `${this.namespace}:${prefix}` : `${this.namespace}:`;
      const pattern = `${searchPrefix}*`;
      try {
          let cursor: string | number = 0; // Initialize cursor for scan
          const keys: string[] = [];
          do {
              // Scan returns [stringCursor, keys[]]
              const [nextCursorStr, foundKeys] = await this.client.scan(cursor as number, { match: pattern, count: 100 });
              keys.push(...foundKeys);
              cursor = nextCursorStr; // Store string cursor for next iteration
          } while (cursor !== '0'); // Compare with string '0' as returned by upstash/redis scan
          
          // Remove namespace prefix
          const namespacePrefixLength = this.namespace.length + 1;
          return keys.map(k => k.substring(namespacePrefixLength));
      } catch (error) {
          logger.error(LogCategory.STORAGE, this.providerType, 'Error listing keys', { pattern, error: error instanceof Error ? error.message : String(error) });
          return [];
      }
  }

  async clear(prefix?: string, options?: StorageOptions): Promise<void> {
       const pattern = prefix ? `${this.namespace}:${prefix}*` : `${this.namespace}:*`;
       const description = prefix ? `keys matching "${pattern}"` : `all keys in namespace "${this.namespace}"`;
       logger.warn(LogCategory.STORAGE, this.providerType, `Clearing ${description}`);
       try {
           let cursor: string | number = 0; // Initialize cursor
           let deletedCount = 0;
           do {
               // Scan returns [stringCursor, keys[]]
               const [nextCursorStr, keysToDelete] = await this.client.scan(cursor as number, { match: pattern, count: 100 });
               if (keysToDelete.length > 0) {
                   deletedCount += await this.client.del(...keysToDelete);
               }
               cursor = nextCursorStr; // Store string cursor
           } while (cursor !== '0'); // Compare with string '0'

           logger.info(LogCategory.STORAGE, this.providerType, `Cleared ${deletedCount} keys matching pattern "${pattern}"`);
       } catch (error) {
           logger.error(LogCategory.STORAGE, this.providerType, 'Error clearing keys', { 
               pattern,
               namespace: this.namespace, 
               error: error instanceof Error ? error.message : String(error) 
           });
       }
       return; // Return void
  }

  // --- Batch Methods --- 

  async getMany<T>(keys: string[], options?: StorageOptions): Promise<Record<string, T | null>> {
      const results: Record<string, T | null> = {};
      if (keys.length === 0) return results;

      const fullKeys = keys.map(this.getKey.bind(this));
      try {
          // @upstash/redis mget returns parsed results or null
          const values = await this.client.mget<T[]>(...fullKeys);
          keys.forEach((originalKey, index) => {
              // Result array corresponds to the order of keys requested
              results[originalKey] = values[index] ?? null;
          });
          return results;
      } catch (error) {
          logger.error(LogCategory.STORAGE, this.providerType, 'Error getting multiple values', {
              keys: fullKeys,
              error: error instanceof Error ? error.message : String(error)
          });
          keys.forEach(key => { results[key] = null; });
          return results;
      }
  }

  async setMany<T>(items: Record<string, T>, options?: StorageOptions): Promise<void> {
      const keys = Object.keys(items);
      if (keys.length === 0) return;

      try {
        // Use mset for batch setting
        const pipeline = this.client.pipeline();
        const ttlSeconds = options?.ttlSeconds;

        for (const key of keys) {
            const fullKey = this.getKey(key);
            // mset expects [key1, value1, key2, value2...]
            // Upstash client handles serialization for common types
            pipeline.set(fullKey, items[key], ttlSeconds ? { ex: ttlSeconds } : undefined);
        }
        await pipeline.exec();

      } catch (error) {
          logger.error(LogCategory.STORAGE, this.providerType, 'Error setting multiple values', {
              keys: keys.map(this.getKey.bind(this)),
              hasTTL: !!options?.ttlSeconds,
              error: error instanceof Error ? error.message : String(error)
          });
      }
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
      if (keys.length === 0) return 0;
      const fullKeys = keys.map(this.getKey.bind(this));
      try {
          // del returns the number of keys deleted
          const result = await this.client.del(...fullKeys); 
          return result;
      } catch (error) {
          logger.error(LogCategory.STORAGE, this.providerType, 'Error deleting multiple values', {
              keys: fullKeys,
              error: error instanceof Error ? error.message : String(error)
          });
          return 0; 
      }
  }

  // --- NEW LIST METHODS ---
  async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const fullKey = this.getKey(key);
    try {
      // LRANGE uses 0-based indices, end is inclusive. -1 means end of list.
      const values = await this.client.lrange<T>(fullKey, start, end);
      logger.debug(LogCategory.STORAGE, this.providerType, '[GET_LIST]', { 
        fullKey, 
        count: values?.length ?? 0 
      });
      // Unlike KV, Upstash LRANGE on a non-existent key returns [], not null.
      // Check existence first if null is desired for non-existent keys.
      // For simplicity here, we return what LRANGE gives.
      return values; 
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error getting list', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      return null; // Return null on error to align with KV/Memory expectation
    }
  }

  async saveList<T>(key: string, values: T[], options?: StorageOptions): Promise<void> {
    const fullKey = this.getKey(key);
    try {
      const pipeline = this.client.pipeline();
      pipeline.del(fullKey); // Clear existing list
      if (values.length > 0) {
        // LPUSH adds elements to the head of the list
        pipeline.lpush(fullKey, ...values);
      }
      const ttlSeconds = options?.ttlSeconds;
      if (ttlSeconds) {
        pipeline.expire(fullKey, ttlSeconds);
      }
      await pipeline.exec();
      logger.debug(LogCategory.STORAGE, this.providerType, '[SAVE_LIST]', { 
        fullKey, 
        count: values.length, 
        ttl: ttlSeconds 
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, this.providerType, 'Error saving list', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      // Decide if error should be thrown or handled silently
      // throw error;
    }
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    // Use the existing delete method
    return this.delete(key, options);
  }
  // --- END NEW LIST METHODS ---

  /**
   * @upstash/redis client doesn't have an explicit destroy/quit method like ioredis.
   * Connections are typically managed automatically.
   * We provide a no-op implementation for interface compatibility.
   */
  async destroy(): Promise<void> {
    logger.debug(LogCategory.STORAGE, this.providerType, 'Destroy called (no-op for Upstash Redis client)');
    return Promise.resolve();
  }
} 