/**
 * @fileoverview Key-value operations for Cloudflare D1
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { nanoid } from '../../../utils/id';
import { CloudflareD1Connection, D1KVRow } from '../types';

/**
 * Handles key-value operations for Cloudflare D1
 */
export class KVOperations {
  constructor(private connection: CloudflareD1Connection) {}

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return nanoid();
  }

  /**
   * Get namespace for operation
   */
  private getNamespace(options?: StorageOptions): string {
    return options?.namespace || this.connection.defaultNamespace || 'default';
  }

  /**
   * Calculate expiration timestamp
   */
  private getExpiresAt(options?: StorageOptions): number | null {
    if (options?.ttlSeconds) {
      return Date.now() + options.ttlSeconds * 1000;
    }
    return null;
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const namespace = this.getNamespace(options);

    try {
      const row = await this.connection.db
        .prepare(
          `
        SELECT value, expires_at 
        FROM ${this.connection.kvTableName} 
        WHERE namespace = ? AND key = ?
      `
        )
        .bind(namespace, key)
        .first<D1KVRow>();

      if (!row) return null;

      // Check expiration
      if (row.expires_at && row.expires_at < Date.now()) {
        // Delete expired entry
        await this.delete(key, options);
        return null;
      }

      return JSON.parse(row.value) as T;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Failed to get value', {
        key,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const namespace = this.getNamespace(options);
    const id = this.generateId();
    const now = Date.now();
    const expiresAt = this.getExpiresAt(options);

    try {
      const serializedValue = JSON.stringify(value);
      const metadata = options?.metadata
        ? JSON.stringify(options.metadata)
        : null;

      await this.connection.db
        .prepare(
          `
        INSERT INTO ${this.connection.kvTableName} 
        (id, namespace, key, value, expires_at, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(namespace, key) DO UPDATE SET
          value = excluded.value,
          expires_at = excluded.expires_at,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `
        )
        .bind(
          id,
          namespace,
          key,
          serializedValue,
          expiresAt,
          metadata,
          now,
          now
        )
        .run();

      logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Value set', {
        key,
        namespace,
        hasExpiration: !!expiresAt,
        hasMetadata: !!metadata
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Failed to set value', {
        key,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = this.getNamespace(options);

    try {
      const result = await this.connection.db
        .prepare(
          `
        DELETE FROM ${this.connection.kvTableName} 
        WHERE namespace = ? AND key = ?
      `
        )
        .bind(namespace, key)
        .run();

      const deleted =
        result.meta && typeof result.meta.changes === 'number'
          ? result.meta.changes > 0
          : false;

      if (deleted) {
        logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Value deleted', {
          key,
          namespace
        });
      }

      return deleted;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to delete value',
        {
          key,
          namespace,
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
    const namespace = this.getNamespace(options);

    try {
      const row = await this.connection.db
        .prepare(
          `
        SELECT 1, expires_at 
        FROM ${this.connection.kvTableName} 
        WHERE namespace = ? AND key = ?
      `
        )
        .bind(namespace, key)
        .first<{ expires_at?: number }>();

      if (!row) return false;

      // Check expiration
      if (row.expires_at && row.expires_at < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to check existence',
        {
          key,
          namespace,
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
    const namespace = this.connection.defaultNamespace || 'default';

    try {
      if (prefix) {
        await this.connection.db
          .prepare(
            `
          DELETE FROM ${this.connection.kvTableName} 
          WHERE namespace = ? AND key LIKE ?
        `
          )
          .bind(namespace, `${prefix}%`)
          .run();

        logger.debug(
          LogCategory.STORAGE,
          'CloudflareD1',
          'Cleared keys with prefix',
          {
            namespace,
            prefix
          }
        );
      } else {
        await this.connection.db
          .prepare(
            `
          DELETE FROM ${this.connection.kvTableName} 
          WHERE namespace = ?
        `
          )
          .bind(namespace)
          .run();

        logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Cleared all keys', {
          namespace
        });
      }
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to clear keys',
        {
          namespace,
          prefix,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
