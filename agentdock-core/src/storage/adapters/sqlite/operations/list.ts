/**
 * @fileoverview SQLite list operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { ListRow, SQLiteConnection } from '../types';

export class ListOperations {
  constructor(private connection: SQLiteConnection) {}

  /**
   * Get full key with namespace prefix
   */
  private getFullKey(key: string, namespace?: string): string {
    const ns = namespace || this.connection.defaultNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Serialize value to string
   */
  private serializeValue<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize value from string
   * Throws error if JSON parsing fails instead of dangerous type casting
   */
  private deserializeValue<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteList', 'Invalid JSON data', {
        value: value.substring(0, 100), // Log first 100 chars
        error: error instanceof Error ? error.message : String(error)
      });

      // THROW ERROR instead of dangerous cast
      throw new Error(
        `Failed to deserialize storage value: ${error instanceof Error ? error.message : 'Invalid JSON'}`
      );
    }
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

    try {
      // First check if the list exists
      const countStmt = this.connection.db.prepare(
        'SELECT COUNT(*) as count FROM list_store WHERE key = ?'
      );
      const countRow = countStmt.get(fullKey) as { count: number };

      if (countRow.count === 0) {
        return null;
      }

      // Calculate actual end position
      const actualEnd = end === -1 ? countRow.count - 1 : end;

      // Get the range
      const stmt = this.connection.db.prepare(`
        SELECT value FROM list_store 
        WHERE key = ? 
        AND position >= ? 
        AND position <= ?
        ORDER BY position
      `);

      const rows = stmt.all(fullKey, start, actualEnd) as ListRow[];

      return rows.map((row) => this.deserializeValue<T>(row.value));
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteList', 'GetList failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
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

    try {
      const transaction = this.connection.db.transaction(() => {
        // Delete existing list
        const deleteStmt = this.connection.db.prepare(
          'DELETE FROM list_store WHERE key = ?'
        );
        deleteStmt.run(fullKey);

        // Insert new values
        if (values.length > 0) {
          const insertStmt = this.connection.db.prepare(`
            INSERT INTO list_store (key, position, value, namespace)
            VALUES (?, ?, ?, ?)
          `);

          for (let i = 0; i < values.length; i++) {
            const serialized = this.serializeValue(values[i]);
            insertStmt.run(fullKey, i, serialized, namespace || null);
          }
        }
      });

      transaction();
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteList', 'SaveList failed', {
        key: fullKey,
        count: values.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    try {
      const stmt = this.connection.db.prepare(
        'DELETE FROM list_store WHERE key = ?'
      );
      const result = stmt.run(fullKey);

      return result.changes > 0;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteList', 'DeleteList failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clear lists with a prefix
   */
  async clearLists(prefix?: string): Promise<void> {
    try {
      if (prefix) {
        const fullPrefix = this.getFullKey(
          prefix,
          this.connection.defaultNamespace
        );
        const stmt = this.connection.db.prepare(
          'DELETE FROM list_store WHERE key LIKE ?'
        );
        stmt.run(`${fullPrefix}%`);
      } else if (this.connection.defaultNamespace) {
        // Clear only lists in the default namespace
        const stmt = this.connection.db.prepare(
          'DELETE FROM list_store WHERE namespace = ?'
        );
        stmt.run(this.connection.defaultNamespace);
      } else {
        // Clear all lists
        this.connection.db.exec('DELETE FROM list_store');
      }
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteList', 'ClearLists failed', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
