/**
 * @fileoverview PostgreSQL list operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { ListRow, PostgreSQLConnection } from '../types';

export class ListOperations {
  constructor(private connection: PostgreSQLConnection) {}

  /**
   * Get full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Get a range of elements from a list
   */
  async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      // First check if the list exists
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM ${this.connection.schema}.list_store WHERE key = $1`,
        [fullKey]
      );

      const count = parseInt(countResult.rows[0].count);
      if (count === 0) {
        return null;
      }

      // Calculate actual end position
      const actualEnd = end === -1 ? count - 1 : end;

      // Get the range
      const result = await client.query(
        `
        SELECT value FROM ${this.connection.schema}.list_store 
        WHERE key = $1 
        AND position >= $2 
        AND position <= $3
        ORDER BY position
      `,
        [fullKey, start, actualEnd]
      );

      return result.rows.map((row) => row.value as T);
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLList', 'GetList failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save an entire list
   */
  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing list
      await client.query(
        `DELETE FROM ${this.connection.schema}.list_store WHERE key = $1`,
        [fullKey]
      );

      // Insert new values
      if (values.length > 0) {
        const insertQuery = `
          INSERT INTO ${this.connection.schema}.list_store (key, position, value, namespace)
          VALUES ($1, $2, $3, $4)
        `;

        for (let i = 0; i < values.length; i++) {
          await client.query(insertQuery, [
            fullKey,
            i,
            JSON.stringify(values[i]),
            namespace || null
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(LogCategory.STORAGE, 'PostgreSQLList', 'SaveList failed', {
        key: fullKey,
        count: values.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    const client = await this.connection.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM ${this.connection.schema}.list_store WHERE key = $1`,
        [fullKey]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PostgreSQLList', 'DeleteList failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear lists with a prefix
   */
  async clearLists(prefix?: string): Promise<void> {
    const client = await this.connection.pool.connect();
    try {
      await client.query('BEGIN');

      if (prefix) {
        const fullPrefix = this.getFullKey(
          prefix,
          this.connection.defaultNamespace
        );

        await client.query(
          `DELETE FROM ${this.connection.schema}.list_store WHERE key LIKE $1`,
          [`${fullPrefix}%`]
        );
      } else if (this.connection.defaultNamespace) {
        // Clear only lists in the default namespace
        await client.query(
          `DELETE FROM ${this.connection.schema}.list_store WHERE namespace = $1`,
          [this.connection.defaultNamespace]
        );
      } else {
        // Clear all lists
        await client.query(
          `TRUNCATE TABLE ${this.connection.schema}.list_store`
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(LogCategory.STORAGE, 'PostgreSQLList', 'ClearLists failed', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      client.release();
    }
  }
}
