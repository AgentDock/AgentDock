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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
    }
  }

  async getMany<T>(keys: string[], options?: StorageOptions): Promise<Record<string, T | null>> {
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
      throw error;
    }
  }

  async setMany<T>(items: Record<string, T>, options?: StorageOptions): Promise<void> {
    const entries = Object.entries(items).map(([key, value]) => [
      this.getKey(key, options),
      value
    ]);

    try {
      if (options?.ttlSeconds !== undefined && options.ttlSeconds > 0) {
        const ttlInSeconds: number = options.ttlSeconds;
        await Promise.all(
          entries.map(([key, value]) => 
            this.client.set(key as string, value, { ex: ttlInSeconds })
          )
        );
      } else {
        const record: Record<string, unknown> = {};
        entries.forEach(([key, value]) => {
          record[key as string] = value;
        });
        await this.client.mset(record);
      }
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[SET_MANY]',
        { 
          keys: entries.map(([key]) => key),
          ttl: options?.ttlSeconds 
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
      throw error;
    }
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    const fullKeys = keys.map(key => this.getKey(key, options));
    try {
      const results = await Promise.all(
        fullKeys.map(key => this.client.del(key))
      );
      const deleted = results.filter((result: number) => result === 1).length;
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[DELETE_MANY]',
        { keys: fullKeys, deleted }
      );
      
      return deleted;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error deleting multiple values',
        {
          keys: fullKeys,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    const fullPrefix = this.getKey(prefix, options);
    try {
      const keys = await this.client.keys(`${fullPrefix}*`);
      const namespace = options?.namespace || this.namespace;
      const nsPrefix = `${namespace}:`;
      
      // Remove namespace prefix from keys
      return keys
        .map((key: string) => key.startsWith(nsPrefix) ? key.slice(nsPrefix.length) : key)
        .slice(options?.offset || 0, options?.limit);
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error listing keys',
        {
          prefix: fullPrefix,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  async clear(prefix?: string): Promise<void> {
    try {
      const searchPrefix = prefix 
        ? this.getKey(prefix)
        : `${this.namespace}:`;
        
      const keys = await this.client.keys(`${searchPrefix}*`);
      
      if (keys.length > 0) {
        await Promise.all(keys.map((key: string) => this.client.del(key)));
      }
      
      logger.debug(
        LogCategory.STORAGE,
        'VercelKVProvider',
        '[CLEAR]',
        { 
          prefix: searchPrefix,
          keysCleared: keys.length 
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'VercelKVProvider',
        'Error clearing keys',
        {
          prefix: prefix ? this.getKey(prefix) : this.namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  // --- NEW LIST METHODS ---
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
      throw error; // Re-throw to indicate failure
    }
  }

  async saveList<T>(key: string, values: T[], options?: StorageOptions): Promise<void> {
    const fullKey = this.getKey(key, options);
    try {
      const pipeline = this.client.pipeline();
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
      throw error; // Re-throw to indicate failure
    }
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    // Use the existing delete method, which works for lists too
    return this.delete(key, options);
  }
  // --- END NEW LIST METHODS ---

  async destroy(): Promise<void> {
    // Vercel KV client doesn't require explicit cleanup
    logger.debug(
      LogCategory.STORAGE,
      'VercelKVProvider',
      'Vercel KV provider destroyed'
    );
  }
} 