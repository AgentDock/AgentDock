/**
 * @fileoverview Key-value operations for Cloudflare KV
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { CloudflareKVConnection, CloudflareKVMetadata } from '../types';

/**
 * Handles key-value operations for Cloudflare KV
 */
export class KVOperations {
  constructor(private connection: CloudflareKVConnection) {}

  /**
   * Get the full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Detect the type of a value
   */
  private detectType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.getFullKey(key, options?.namespace);

    try {
      if (this.connection.storeTypeMetadata) {
        const result =
          await this.connection.kv.getWithMetadata<CloudflareKVMetadata>(
            fullKey,
            { type: 'json' }
          );

        if (!result.value) return null;

        // Handle different types based on metadata
        if (
          result.metadata?.type === 'string' &&
          typeof result.value === 'object' &&
          result.value !== null &&
          '_type' in result.value &&
          result.value._type === 'string'
        ) {
          return result.value.value as T;
        }

        return result.value as T;
      } else {
        const value = await this.connection.kv.get(fullKey, { type: 'json' });
        return value as T;
      }
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Failed to get value', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.getFullKey(key, options?.namespace);

    try {
      const putOptions: any = {};

      // Handle TTL
      if (options?.ttlSeconds) {
        putOptions.expirationTtl = options.ttlSeconds;
      } else if (this.connection.defaultTtl) {
        putOptions.expirationTtl = this.connection.defaultTtl;
      }

      // Handle metadata
      if (this.connection.storeTypeMetadata || options?.metadata) {
        const metadata: CloudflareKVMetadata = {
          namespace: options?.namespace || this.connection.defaultNamespace,
          type: this.detectType(value) as any,
          createdAt: Date.now(),
          custom: options?.metadata
        };
        putOptions.metadata = metadata;
      }

      // Store the value
      // For strings, we need to wrap them to preserve type
      let storedValue: any = value;
      if (typeof value === 'string' && this.connection.storeTypeMetadata) {
        storedValue = { value, _type: 'string' };
      }

      await this.connection.kv.put(
        fullKey,
        JSON.stringify(storedValue),
        putOptions
      );

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Value set', {
        key: fullKey,
        ttl: putOptions.expirationTtl,
        hasMetadata: !!putOptions.metadata
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Failed to set value', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getFullKey(key, options?.namespace);

    try {
      // Check if exists first
      const exists = await this.exists(key, options);
      if (!exists) return false;

      await this.connection.kv.delete(fullKey);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Value deleted', {
        key: fullKey
      });

      return true;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Failed to delete value',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.getFullKey(key, options?.namespace);

    try {
      const value = await this.connection.kv.get(fullKey, { type: 'text' });
      return value !== null;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Failed to check existence',
        {
          key: fullKey,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }

  /**
   * Clear all keys or keys with prefix
   */
  async clear(prefix?: string): Promise<void> {
    try {
      let cursor: string | undefined;
      const namespace = this.connection.defaultNamespace;
      const searchPrefix = prefix
        ? this.getFullKey(prefix)
        : namespace
          ? `${namespace}:`
          : '';

      do {
        const result = await this.connection.kv.list({
          prefix: searchPrefix,
          limit: 1000,
          cursor
        });

        // Delete all keys in this batch
        await Promise.all(
          result.keys.map((key) => this.connection.kv.delete(key.name))
        );

        cursor = result.cursor;
      } while (cursor);

      logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Cleared keys', {
        prefix: searchPrefix || 'all'
      });
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareKV',
        'Failed to clear keys',
        {
          prefix,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
