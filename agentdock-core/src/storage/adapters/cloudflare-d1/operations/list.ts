/**
 * @fileoverview List operations for Cloudflare D1
 */

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { nanoid } from '../../../utils/id';
import { CloudflareD1Connection, D1KVRow, D1ListRow } from '../types';

/**
 * Handles list operations for Cloudflare D1
 */
export class ListOperations {
  constructor(private connection: CloudflareD1Connection) {}

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
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    const namespace = this.getNamespace(options);
    const limit = options?.limit || 1000;
    const offset = options?.offset || 0;

    try {
      const now = Date.now();
      const result = await this.connection.db
        .prepare(
          `
        SELECT key 
        FROM ${this.connection.kvTableName} 
        WHERE namespace = ? 
          AND key LIKE ?
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY key
        LIMIT ? OFFSET ?
      `
        )
        .bind(namespace, `${prefix}%`, now, limit, offset)
        .all<{ key: string }>();

      return result.results?.map((row) => row.key) || [];
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Failed to list keys', {
        prefix,
        namespace,
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
    const namespace = this.getNamespace(options);

    try {
      const now = Date.now();
      let query = `
        SELECT value, position
        FROM ${this.connection.listTableName} 
        WHERE namespace = ? 
          AND key = ?
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY position
      `;

      const bindings: any[] = [namespace, key, now];

      // Handle range queries
      if (start !== undefined && end !== undefined) {
        if (end === -1) {
          query += ` LIMIT -1 OFFSET ?`;
          bindings.push(start);
        } else {
          const limit = end - start;
          query += ` LIMIT ? OFFSET ?`;
          bindings.push(limit, start);
        }
      }

      const result = await this.connection.db
        .prepare(query)
        .bind(...bindings)
        .all<D1ListRow>();

      if (!result.results || result.results.length === 0) {
        return null;
      }

      return result.results.map((row) => JSON.parse(row.value) as T);
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Failed to get list', {
        key,
        namespace,
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
    const namespace = this.getNamespace(options);
    const expiresAt = this.getExpiresAt(options);
    const now = Date.now();

    try {
      // Start a batch operation
      const statements = [];

      // Delete existing list
      statements.push(
        this.connection.db
          .prepare(
            `
          DELETE FROM ${this.connection.listTableName} 
          WHERE namespace = ? AND key = ?
        `
          )
          .bind(namespace, key)
      );

      // Insert new values
      for (let i = 0; i < values.length; i++) {
        const id = nanoid();
        const serializedValue = JSON.stringify(values[i]);

        statements.push(
          this.connection.db
            .prepare(
              `
            INSERT INTO ${this.connection.listTableName} 
            (id, namespace, key, position, value, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
            )
            .bind(id, namespace, key, i, serializedValue, expiresAt, now)
        );
      }

      // Execute batch
      await this.connection.db.batch(statements);

      logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'List saved', {
        key,
        namespace,
        length: values.length,
        hasExpiration: !!expiresAt
      });
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Failed to save list', {
        key,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a list from storage
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = this.getNamespace(options);

    try {
      const result = await this.connection.db
        .prepare(
          `
        DELETE FROM ${this.connection.listTableName} 
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
        logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'List deleted', {
          key,
          namespace
        });
      }

      return deleted;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to delete list',
        {
          key,
          namespace,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }
}
