/**
 * @fileoverview Batch operations for Cloudflare KV
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { CloudflareKVConnection } from '../types';
import { KVOperations } from './kv';

/**
 * Handles batch operations for Cloudflare KV
 */
export class BatchOperations {
  private kvOps: KVOperations;

  constructor(private connection: CloudflareKVConnection) {
    this.kvOps = new KVOperations(connection);
  }

  /**
   * Get the full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Get multiple values from storage
   * Note: Cloudflare KV doesn't have native batch get, so we use parallel requests
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    try {
      const results: Record<string, T | null> = {};

      // Execute gets in parallel
      const promises = keys.map(async (key) => {
        const value = await this.kvOps.get<T>(key, options);
        return { key, value };
      });

      const values = await Promise.all(promises);

      // Build result object
      for (const { key, value } of values) {
        results[key] = value;
      }

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Batch get completed', {
        requested: keys.length,
        found: Object.values(results).filter((v) => v !== null).length
      });

      return results;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Batch get failed', {
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set multiple values in storage
   * Note: Cloudflare KV doesn't have native batch set, so we use parallel requests
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    try {
      const entries = Object.entries(items);

      // Execute sets in parallel
      const promises = entries.map(([key, value]) =>
        this.kvOps.set(key, value, options)
      );

      await Promise.all(promises);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Batch set completed', {
        count: entries.length
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Batch set failed', {
        count: Object.keys(items).length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete multiple values from storage
   * Note: Cloudflare KV doesn't have native batch delete, so we use parallel requests
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    try {
      // Execute deletes in parallel
      const promises = keys.map((key) => this.kvOps.delete(key, options));
      const results = await Promise.all(promises);

      // Count successful deletions
      const deleted = results.filter((result) => result).length;

      logger.debug(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Batch delete completed',
        {
          requested: keys.length,
          deleted
        }
      );

      return deleted;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Batch delete failed', {
        keys,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all key-value pairs with a given prefix
   * Useful for backup/restore operations
   */
  async getAllWithPrefix<T>(
    prefix: string,
    options?: StorageOptions
  ): Promise<Record<string, T>> {
    try {
      const namespace = options?.namespace || this.connection.defaultNamespace;
      const fullPrefix = this.getFullKey(prefix, namespace);
      const results: Record<string, T> = {};
      let cursor: string | undefined;

      do {
        const listResult = await this.connection.kv.list({
          prefix: fullPrefix,
          limit: 1000,
          cursor
        });

        // Skip list keys
        const kvKeys = listResult.keys.filter(
          (k) => !k.name.includes('__list:')
        );

        // Get all values in parallel
        const promises = kvKeys.map(async (keyInfo) => {
          const value = await this.connection.kv.get(keyInfo.name, {
            type: 'json'
          });
          if (value !== null) {
            // Remove namespace prefix from key
            const originalKey = namespace
              ? keyInfo.name.substring(`${namespace}:`.length)
              : keyInfo.name;
            return { key: originalKey, value };
          }
          return null;
        });

        const values = await Promise.all(promises);

        // Add to results
        for (const item of values) {
          if (item) {
            results[item.key] = item.value;
          }
        }

        cursor = listResult.cursor;
      } while (cursor);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Got all with prefix', {
        prefix: fullPrefix,
        count: Object.keys(results).length
      });

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Failed to get all with prefix',
        {
          prefix,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
