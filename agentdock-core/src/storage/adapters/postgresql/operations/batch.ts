/**
 * @fileoverview PostgreSQL batch operations
 */

import { PoolClient } from 'pg';

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { KVRow, PostgreSQLConnection } from '../types';

export class BatchOperations {
  constructor(private connection: PostgreSQLConnection) {}

  /**
   * Get full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Remove namespace prefix from key
   */
  private removeNamespacePrefix(fullKey: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    if (ns && fullKey.startsWith(`${ns}:`)) {
      return fullKey.substring(ns.length + 1);
    }
    return fullKey;
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKeys = keys.map((key) => this.getFullKey(key, namespace));

    if (fullKeys.length === 0) {
      return {};
    }

    const client = await this.connection.pool.connect();
    try {
      const placeholders = fullKeys.map((_, i) => `$${i + 2}`).join(',');
      const result = await client.query(
        `
        SELECT key, value FROM ${this.connection.schema}.kv_store 
        WHERE key IN (${placeholders})
        AND (expires_at IS NULL OR expires_at > $1)
      `,
        [Date.now(), ...fullKeys]
      );

      const resultMap: Record<string, T | null> = {};

      // Initialize all keys to null
      for (const key of keys) {
        resultMap[key] = null;
      }

      // Fill in found values
      for (const row of result.rows) {
        const originalKey = this.removeNamespacePrefix(row.key, namespace);
        resultMap[originalKey] = row.value as T;
      }

      return resultMap;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLBatch', 'GetMany failed', {
        count: keys.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Set multiple values at once (using transaction)
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const entries = Object.entries(items);

    if (entries.length === 0) {
      return;
    }

    const expiresAt = options?.ttlSeconds
      ? Date.now() + options.ttlSeconds * 1000
      : null;

    const metadata = options?.metadata
      ? JSON.stringify(options.metadata)
      : null;

    const client = await this.connection.pool.connect();
    try {
      await client.query('BEGIN');

      // Build multi-row INSERT for massive performance improvement (5-10x faster)
      const valuesClause: string[] = [];
      const parameters: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of entries) {
        const fullKey = this.getFullKey(key, namespace);

        valuesClause.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, CURRENT_TIMESTAMP)`
        );

        parameters.push(
          fullKey,
          JSON.stringify(value),
          expiresAt,
          namespace || null,
          metadata
        );

        paramIndex += 5;
      }

      const multiRowInsertSQL = `
        INSERT INTO ${this.connection.schema}.kv_store 
        (key, value, expires_at, namespace, metadata, updated_at)
        VALUES ${valuesClause.join(', ')}
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          expires_at = EXCLUDED.expires_at,
          namespace = EXCLUDED.namespace,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
      `;

      // Single query instead of N queries - MASSIVE performance improvement
      await client.query(multiRowInsertSQL, parameters);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(LogCategory.STORAGE, 'PostgreSQLBatch', 'SetMany failed', {
        count: entries.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete multiple values at once
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKeys = keys.map((key) => this.getFullKey(key, namespace));

    if (fullKeys.length === 0) {
      return 0;
    }

    const client = await this.connection.pool.connect();
    try {
      const placeholders = fullKeys.map((_, i) => `$${i + 1}`).join(',');
      const result = await client.query(
        `
        DELETE FROM ${this.connection.schema}.kv_store 
        WHERE key IN (${placeholders})
      `,
        fullKeys
      );

      return result.rowCount ?? 0;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PostgreSQLBatch',
        'DeleteMany failed',
        {
          count: keys.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
