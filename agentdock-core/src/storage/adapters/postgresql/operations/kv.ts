/**
 * @fileoverview PostgreSQL key-value operations
 */

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { KVRow, PostgreSQLConnection } from '../types';

export class KVOperations {
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
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT value FROM ${this.connection.schema}.kv_store 
        WHERE key = $1 
        AND (expires_at IS NULL OR expires_at > $2)
      `,
        [fullKey, Date.now()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Parse JSON since we store values as JSON strings
      return JSON.parse(result.rows[0].value) as T;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'Get failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const expiresAt = options?.ttlSeconds
      ? Date.now() + options.ttlSeconds * 1000
      : null;

    const client = await this.connection.pool.connect();
    try {
      await client.query(
        `
        INSERT INTO ${this.connection.schema}.kv_store 
        (key, value, expires_at, namespace, metadata, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          expires_at = EXCLUDED.expires_at,
          namespace = EXCLUDED.namespace,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
      `,
        [
          fullKey,
          JSON.stringify(value),
          expiresAt,
          namespace || null,
          options?.metadata ? JSON.stringify(options.metadata) : null
        ]
      );
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'Set failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM ${this.connection.schema}.kv_store WHERE key = $1`,
        [fullKey]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'Delete failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 1 FROM ${this.connection.schema}.kv_store 
        WHERE key = $1 
        AND (expires_at IS NULL OR expires_at > $2)
        LIMIT 1
      `,
        [fullKey, Date.now()]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'Exists check failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullPrefix = this.getFullKey(prefix, namespace);

    const client = await this.connection.pool.connect();
    try {
      let query = `
        SELECT key FROM ${this.connection.schema}.kv_store 
        WHERE key LIKE $1
        AND (expires_at IS NULL OR expires_at > $2)
      `;

      const params: any[] = [`${fullPrefix}%`, Date.now()];

      if (namespace) {
        query += ' AND namespace = $3';
        params.push(namespace);
      }

      query += ' ORDER BY key';

      if (options?.limit) {
        query += ` LIMIT ${options.limit}`;
      }

      const result = await client.query(query, params);

      return result.rows.map((row) =>
        this.removeNamespacePrefix(row.key, namespace)
      );
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'List failed', {
        prefix: fullPrefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear all data or data with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    const client = await this.connection.pool.connect();
    try {
      await client.query('BEGIN');

      if (prefix) {
        const fullPrefix = this.getFullKey(
          prefix,
          this.connection.defaultNamespace
        );

        await client.query(
          `DELETE FROM ${this.connection.schema}.kv_store WHERE key LIKE $1`,
          [`${fullPrefix}%`]
        );
      } else if (this.connection.defaultNamespace) {
        // Clear only items in the default namespace
        await client.query(
          `DELETE FROM ${this.connection.schema}.kv_store WHERE namespace = $1`,
          [this.connection.defaultNamespace]
        );
      } else {
        // Clear everything
        await client.query(`TRUNCATE TABLE ${this.connection.schema}.kv_store`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(LogCategory.STORAGE, 'PostgreSQLKV', 'Clear failed', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
