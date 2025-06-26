/**
 * @fileoverview List operations for Cloudflare KV
 */

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { CloudflareKVConnection } from '../types';

/**
 * Handles list operations for Cloudflare KV
 */
export class ListOperations {
  constructor(private connection: CloudflareKVConnection) {}

  /**
   * Get the full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Get list key for a given base key
   */
  private getListKey(key: string): string {
    return `__list:${key}`;
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    try {
      const namespace = options?.namespace || this.connection.defaultNamespace;
      const fullPrefix = this.getFullKey(prefix, namespace);
      const keys: string[] = [];
      let cursor: string | undefined;

      const limit = options?.limit;
      const offset = options?.offset || 0;
      let collected = 0;
      let skipped = 0;

      do {
        const result = await this.connection.kv.list({
          prefix: fullPrefix,
          limit: 1000,
          cursor
        });

        for (const key of result.keys) {
          // Skip list keys - check if the key starts with namespace:__list: or just __list:
          const keyWithoutNamespace = namespace
            ? key.name.substring(`${namespace}:`.length)
            : key.name;
          if (keyWithoutNamespace.startsWith('__list:')) continue;

          // Handle offset
          if (skipped < offset) {
            skipped++;
            continue;
          }

          // Remove namespace prefix from key
          const originalKey = namespace
            ? key.name.substring(`${namespace}:`.length)
            : key.name;

          keys.push(originalKey);
          collected++;

          // Stop if we've reached the limit
          if (limit && collected >= limit) {
            return keys;
          }
        }

        cursor = result.cursor;
      } while (cursor);

      return keys;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Failed to list keys', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get a list from storage
   */
  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const listKey = this.getListKey(key);
    const fullKey = this.getFullKey(listKey, options?.namespace);

    try {
      const data = await this.connection.kv.get(fullKey, { type: 'json' });
      if (!data) return null;

      if (!Array.isArray(data)) {
        logger.error(
          LogCategory.STORAGE,
          'CloudflareKV',
          'Invalid list data format',
          {
            key: fullKey,
            dataType: typeof data
          }
        );
        return null;
      }

      // Handle range
      if (start !== undefined || end !== undefined) {
        const startIdx = start ?? 0;
        const endIdx = end === -1 ? data.length : (end ?? data.length);
        return data.slice(startIdx, endIdx);
      }

      return data;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Failed to get list', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Save a list to storage
   */
  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    const listKey = this.getListKey(key);
    const fullKey = this.getFullKey(listKey, options?.namespace);

    try {
      interface PutOptions {
        expirationTtl?: number;
        metadata?: {
          type: string;
          length: number;
          namespace?: string;
          createdAt: number;
        };
      }

      const putOptions: PutOptions = {};

      // Handle TTL
      if (options?.ttlSeconds) {
        putOptions.expirationTtl = options.ttlSeconds;
      } else if (this.connection.defaultTtl) {
        putOptions.expirationTtl = this.connection.defaultTtl;
      }

      // Store metadata if enabled
      if (this.connection.storeTypeMetadata) {
        putOptions.metadata = {
          type: 'list',
          length: values.length,
          namespace: options?.namespace || this.connection.defaultNamespace,
          createdAt: Date.now()
        };
      }

      await this.connection.kv.put(fullKey, JSON.stringify(values), putOptions);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'List saved', {
        key: fullKey,
        length: values.length,
        ttl: putOptions.expirationTtl
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Failed to save list', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a list from storage
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    const listKey = this.getListKey(key);
    const fullKey = this.getFullKey(listKey, options?.namespace);

    try {
      // Check if exists
      const exists = await this.connection.kv.get(fullKey);
      if (!exists) return false;

      await this.connection.kv.delete(fullKey);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'List deleted', {
        key: fullKey
      });

      return true;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Failed to delete list',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }
}
