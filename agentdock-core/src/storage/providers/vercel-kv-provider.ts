/**
 * @fileoverview Vercel KV storage provider implementation
 */

import { kv } from '@vercel/kv';
import { StorageProvider, StorageOptions, ListOptions } from '../types';
import { logger, LogCategory } from '../../logging';

export interface VercelKVConfig {
  namespace?: string;
}

/**
 * Storage provider implementation using Vercel KV
 */
export class VercelKVProvider implements StorageProvider {
  private namespace: string;
  private client: typeof kv;

  constructor(config: VercelKVConfig = {}) {
    this.namespace = config.namespace || 'default';
    this.client = kv;

    logger.debug(
      LogCategory.STORAGE,
      'VercelKVProvider',
      'Initialized Vercel KV provider',
      { namespace: this.namespace }
    );
  }

  private getKey(key: string, options?: StorageOptions): string {
    const ns = options?.namespace || this.namespace;
    return `${ns}:${key}`;
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.getKey(key, options);
    try {
      const value = await this.client.get<T>(fullKey);
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[GET]',
        { key: fullKey, found: value !== null }
      );
      
      return value;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error getting value',
        { 
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null; // Return null on error
    }
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.getKey(key, options);
    try {
      if (options?.ttlSeconds !== undefined && options.ttlSeconds > 0) {
        const ttlInSeconds: number = options.ttlSeconds;
        await this.client.set(fullKey, value, { ex: ttlInSeconds });
      } else {
        await this.client.set(fullKey, value);
      }
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[SET]',
        { key: fullKey, ttl: options?.ttlSeconds }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error setting value',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return; // Complete without throwing on error
    }
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getKey(key, options);
    try {
      const result = await this.client.del(fullKey);
      const deleted = result === 1;
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[DELETE]',
        { key: fullKey, deleted }
      );
      
      return deleted;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error deleting value',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false; // Return false on error
    }
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getKey(key, options);
    try {
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error checking existence',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false; // Return false on error
    }
  }

  async getMany<T>(keys: string[], options?: StorageOptions): Promise<Record<string, T | null>> {
    if (keys.length === 0) {
      return {};
    }
    const fullKeys = keys.map(key => this.getKey(key, options));
    try {
      const values = await this.client.mget(...fullKeys);
      return Object.fromEntries(
        keys.map((key, i) => [key, values[i] as T | null])
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error getting multiple values',
        {
          keys: fullKeys,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return {}; // Return empty object on error
    }
  }

  async setMany<T>(items: Record<string, T>, options?: StorageOptions): Promise<void> {
    const entries = Object.entries(items).map(([key, value]) => [
      this.getKey(key, options), // Apply namespace to key
      value
    ]);

    try {
      if (options?.ttlSeconds !== undefined && options.ttlSeconds > 0) {
        // For TTL with setMany, Vercel KV doesn't support it in mset.
        // We must use individual set operations.
        for (const [key, value] of entries) {
          try { // Add try-catch for individual set
            await this.client.set(key as string, value, { ex: options.ttlSeconds });
          } catch (loopError) {
            logger.error(
              LogCategory.STORAGE,
              'VercelKVProvider',
              'Error in setMany loop iteration',
              {
                key: key as string,
                error: loopError instanceof Error ? loopError.message : String(loopError)
              }
            );
            // Continue to next iteration
          }
        }
      } else {
        // No TTL, so we can use mset for efficiency if there are items.
        const namespacedRecord = Object.fromEntries(entries);
        if (Object.keys(namespacedRecord).length > 0) {
          await this.client.mset(namespacedRecord);
        } else {
          // Log using the standard format
          logger.debug(
            LogCategory.STORAGE,
            'VercelKVProvider',
            '[SET_MANY] Skipping mset for empty record',
            { namespace: this.namespace }
          );
        }
      }
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[SET_MANY]',
        {
          count: entries.length,
          keysSample: entries.slice(0, 3).map(([k]) => k),
          ttlProvided: !!(options?.ttlSeconds && options.ttlSeconds > 0)
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error setting multiple values',
        {
          keys: entries.map(([key]) => key),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return; // Complete without throwing on error
    }
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    const fullKeys = keys.map(key => this.getKey(key, options));
    try {
      // Use Promise.allSettled to ensure all operations are attempted
      const results = await Promise.allSettled(
        fullKeys.map(key => this.client.del(key))
      );
      
      let deletedCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value === 1) {
          deletedCount++;
        } else if (result.status === 'rejected') {
          logger.error(
            LogCategory.STORAGE,
            'VercelKVProvider',
            'Error in deleteMany individual operation',
            {
              key: fullKeys[index],
              error: result.reason instanceof Error ? result.reason.message : String(result.reason)
            }
          );
        }
      });
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[DELETE_MANY]',
        { keys: fullKeys, deleted: deletedCount } // Log the actual count of successful deletions
      );
      
      return deletedCount; // Return the count of successfully deleted keys
    } catch (error) {
      // This outer catch is for unexpected errors with Promise.allSettled itself or setup
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error deleting multiple values',
        {
          keys: fullKeys,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return 0; // Return 0 on a general error for the batch operation
    }
  }

  async list(prefix = '', options?: ListOptions): Promise<string[]> {
    const fullPrefixWithoutNamespace = prefix; // prefix is already without namespace here by convention
    const searchPattern = `${this.getKey(fullPrefixWithoutNamespace, options)}*`; // Apply namespace and add wildcard
    let cursor: number = 0;
    const allKeys: string[] = [];
    const namespacePrefix = `${options?.namespace || this.namespace}:`;
    
    try {
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, { match: searchPattern });
        keys.forEach((key: string) => {
          // Remove the namespace part for the returned key
          allKeys.push(key.startsWith(namespacePrefix) ? key.slice(namespacePrefix.length) : key);
        });
        cursor = nextCursor;
      } while (cursor !== 0);
      
      return allKeys.slice(options?.offset || 0, options?.limit);
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error listing keys',
        {
          prefix: searchPattern,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return []; // Return empty array on error
    }
  }

  async clear(prefix?: string, options?: StorageOptions): Promise<void> {
    try {
      // Use the list method logic (which uses scan) to find keys, then delete
      const keysToDelete = await this.list(prefix || '', { // Pass options to list for namespace consistency
        namespace: options?.namespace,
        // Do not pass limit/offset from clear's options directly to list here,
        // as clear intends to clear ALL matched by prefix.
      }); 
      if (keysToDelete.length > 0) {
        // Pass original options (which might contain namespace) to deleteMany
        await this.deleteMany(keysToDelete, options); 
      }
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[CLEAR]',
        { 
          prefix: prefix || '(all)',
          namespace: options?.namespace || this.namespace,
          keysClearedCount: keysToDelete.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error clearing keys',
        {
          prefix: prefix || '(all)',
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return; // Complete without throwing on error
    }
  }

  async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const fullKey = this.getKey(key, options);
    try {
      // KV LRANGE uses 0-based indices, end is inclusive. -1 means end of list.
      const values = await this.client.lrange<T>(fullKey, start, end);
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[GET_LIST]',
        { key: fullKey, count: values?.length ?? 0 }
      );
      
      // KV returns null if the key doesn't exist
      return values;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error getting list',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null; // Return null on error
    }
  }

  async saveList<T>(key: string, values: T[], options?: StorageOptions): Promise<void> {
    const fullKey = this.getKey(key, options);
    try {
      const pipeline = this.client.multi();
      pipeline.del(fullKey); // Clear existing list
      if (values.length > 0) {
        pipeline.lpush(fullKey, ...values); // Push new values
      }
      
      // Handle TTL if provided
      if (options?.ttlSeconds !== undefined && options.ttlSeconds > 0) {
         pipeline.expire(fullKey, options.ttlSeconds);
      }
      
      await pipeline.exec();
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[SAVE_LIST]',
        { key: fullKey, count: values.length, ttl: options?.ttlSeconds }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error saving list',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return; // Complete without throwing on error
    }
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    // Use the existing delete method, which works for lists too
    return this.delete(key, options);
  }

  async destroy(): Promise<void> {
    // Vercel KV client doesn't require explicit cleanup
    logger.debug(
      LogCategory.STORAGE,
      'VercelKVProvider',
      'Vercel KV provider destroyed'
    );
  }
} 