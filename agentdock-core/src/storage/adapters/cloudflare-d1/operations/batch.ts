/**
 * @fileoverview Batch operations for Cloudflare D1
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { nanoid } from '../../../utils/id';
import { CloudflareD1Connection, D1KVRow } from '../types';
import { KVOperations } from './kv';

/**
 * Handles batch operations for Cloudflare D1
 */
export class BatchOperations {
  private kvOps: KVOperations;

  constructor(private connection: CloudflareD1Connection) {
    this.kvOps = new KVOperations(connection);
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
   * Escape SQL wildcard characters in a string
   */
  private escapeSqlWildcards(str: string): string {
    // First escape backslashes, then escape wildcards
    return str
      .replace(/\\/g, '\\\\') // Escape backslashes first
      .replace(/[_%]/g, '\\$&'); // Then escape wildcards
  }

  /**
   * Get multiple values from storage
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    const namespace = this.getNamespace(options);
    const now = Date.now();

    try {
      // Create placeholders for SQL IN clause
      const placeholders = keys.map(() => '?').join(',');

      const result = await this.connection.db
        .prepare(
          `
        SELECT key, value, expires_at
        FROM ${this.connection.kvTableName} 
        WHERE namespace = ? 
          AND key IN (${placeholders})
      `
        )
        .bind(namespace, ...keys)
        .all<D1KVRow>();

      // Build result map
      const resultMap: Record<string, T | null> = {};

      // Initialize all keys to null
      for (const key of keys) {
        resultMap[key] = null;
      }

      // Fill in found values
      if (result.results) {
        for (const row of result.results) {
          // Check expiration
          if (!row.expires_at || row.expires_at > now) {
            try {
              resultMap[row.key] = JSON.parse(row.value) as T;
            } catch (error) {
              logger.warn(
                LogCategory.STORAGE,
                'CloudflareD1',
                'Failed to parse value',
                {
                  key: row.key,
                  namespace,
                  error: error instanceof Error ? error.message : String(error)
                }
              );
              // Keep the value as null for corrupted data
            }
          }
        }
      }

      logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Batch get completed', {
        requested: keys.length,
        found: Object.values(resultMap).filter((v) => v !== null).length,
        namespace
      });

      return resultMap;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Batch get failed', {
        keys,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set multiple values in storage
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    const namespace = this.getNamespace(options);
    const now = Date.now();
    const expiresAt = this.getExpiresAt(options);
    const metadata = options?.metadata
      ? JSON.stringify(options.metadata)
      : null;

    try {
      const statements = [];

      for (const [key, value] of Object.entries(items)) {
        const id = nanoid();
        const serializedValue = JSON.stringify(value);

        statements.push(
          this.connection.db
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
        );
      }

      // Execute batch
      await this.connection.db.batch(statements);

      logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Batch set completed', {
        count: Object.keys(items).length,
        namespace,
        hasExpiration: !!expiresAt
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Batch set failed', {
        count: Object.keys(items).length,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete multiple values from storage
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    const namespace = this.getNamespace(options);

    try {
      const statements = [];

      for (const key of keys) {
        statements.push(
          this.connection.db
            .prepare(
              `
            DELETE FROM ${this.connection.kvTableName} 
            WHERE namespace = ? AND key = ?
          `
            )
            .bind(namespace, key)
        );
      }

      // Execute batch
      const results = await this.connection.db.batch(statements);

      // Count successful deletions
      let deleted = 0;
      for (const result of results) {
        if (result.meta && typeof result.meta.changes === 'number') {
          deleted += result.meta.changes;
        }
      }

      logger.debug(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Batch delete completed',
        {
          requested: keys.length,
          deleted,
          namespace
        }
      );

      return deleted;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Batch delete failed', {
        keys,
        namespace,
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
    const namespace = this.getNamespace(options);
    const now = Date.now();
    const escapedPrefix = this.escapeSqlWildcards(prefix);

    try {
      const result = await this.connection.db
        .prepare(
          `
        SELECT key, value
        FROM ${this.connection.kvTableName} 
        WHERE namespace = ? 
          AND key LIKE ?
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY key
      `
        )
        .bind(namespace, `${escapedPrefix}%`, now)
        .all<D1KVRow>();

      const resultMap: Record<string, T> = {};

      if (result.results) {
        for (const row of result.results) {
          try {
            resultMap[row.key] = JSON.parse(row.value) as T;
          } catch (error) {
            logger.warn(
              LogCategory.STORAGE,
              'CloudflareD1',
              'Failed to parse value',
              {
                key: row.key,
                namespace,
                error: error instanceof Error ? error.message : String(error)
              }
            );
            // Skip corrupted values
          }
        }
      }

      logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Got all with prefix', {
        prefix,
        namespace,
        count: Object.keys(resultMap).length
      });

      return resultMap;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to get all with prefix',
        {
          prefix,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }
}
