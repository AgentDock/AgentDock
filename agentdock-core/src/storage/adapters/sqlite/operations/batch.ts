/**
 * @fileoverview SQLite batch operations
 */

import { LogCategory, logger } from '../../../../logging';
import { StorageOptions } from '../../../types';
import { KVRow, SQLiteConnection } from '../types';

export class BatchOperations {
  constructor(private connection: SQLiteConnection) {}

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
   * Serialize value to string
   */
  private serializeValue<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize value from string
   * WARNING: If JSON parsing fails, returns the raw string cast to T
   * This may cause runtime errors if T expects an object but gets a string
   * Callers should validate the result type if needed
   */
  private deserializeValue<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch {
      // Log warning about potential type mismatch
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteBatch',
        `Failed to deserialize value, returning raw string: ${value}`
      );
      return value as T; // UNSAFE: May cause runtime errors if T expects object
    }
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

    try {
      const placeholders = fullKeys.map(() => '?').join(',');
      const stmt = this.connection.db.prepare(`
        SELECT key, value FROM kv_store 
        WHERE key IN (${placeholders})
        AND (expires_at IS NULL OR expires_at > ?)
      `);

      const rows = stmt.all(...fullKeys, Date.now()) as KVRow[];

      const result: Record<string, T | null> = {};

      // Initialize all keys to null
      for (const key of keys) {
        result[key] = null;
      }

      // Fill in found values
      for (const row of rows) {
        const originalKey = this.removeNamespacePrefix(row.key, namespace);
        result[originalKey] = this.deserializeValue<T>(row.value);
      }

      return result;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteBatch', 'GetMany failed', {
        count: keys.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set multiple values at once
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

    try {
      const stmt = this.connection.db.prepare(`
        INSERT OR REPLACE INTO kv_store 
        (key, value, expires_at, namespace, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.connection.db.transaction(() => {
        for (const [key, value] of entries) {
          const fullKey = this.getFullKey(key, namespace);
          const serialized = this.serializeValue(value);

          stmt.run(
            fullKey,
            serialized,
            expiresAt,
            namespace || null,
            metadata,
            Math.floor(Date.now() / 1000)
          );
        }
      });

      transaction();
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteBatch', 'SetMany failed', {
        count: entries.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
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

    try {
      const placeholders = fullKeys.map(() => '?').join(',');
      const stmt = this.connection.db.prepare(`
        DELETE FROM kv_store 
        WHERE key IN (${placeholders})
      `);

      const result = stmt.run(...fullKeys);

      return result.changes;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteBatch', 'DeleteMany failed', {
        count: keys.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
