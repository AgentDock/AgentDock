/**
 * @fileoverview SQLite key-value operations
 */

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { KVRow, SQLiteConnection } from '../types';

export class KVOperations {
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
   */
  private deserializeValue<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    try {
      const stmt = this.connection.db.prepare(`
        SELECT value FROM kv_store 
        WHERE key = ? 
        AND (expires_at IS NULL OR expires_at > ?)
      `);

      const row = stmt.get(fullKey, Date.now()) as KVRow | undefined;

      if (!row) {
        return null;
      }

      return this.deserializeValue<T>(row.value);
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'Get failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);
    const serialized = this.serializeValue(value);

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

      stmt.run(
        fullKey,
        serialized,
        expiresAt,
        namespace || null,
        metadata,
        Math.floor(Date.now() / 1000)
      );
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'Set failed', {
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
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    try {
      const stmt = this.connection.db.prepare(
        'DELETE FROM kv_store WHERE key = ?'
      );
      const result = stmt.run(fullKey);

      return result.changes > 0;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'Delete failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullKey = this.getFullKey(key, namespace);

    try {
      const stmt = this.connection.db.prepare(`
        SELECT 1 FROM kv_store 
        WHERE key = ? 
        AND (expires_at IS NULL OR expires_at > ?)
        LIMIT 1
      `);

      const row = stmt.get(fullKey, Date.now());

      return row !== undefined;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'Exists check failed', {
        key: fullKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    const namespace = options?.namespace || this.connection.defaultNamespace;
    const fullPrefix = this.getFullKey(prefix, namespace);

    try {
      let query = `
        SELECT key FROM kv_store 
        WHERE key LIKE ?
        AND (expires_at IS NULL OR expires_at > ?)
      `;

      const params: any[] = [`${fullPrefix}%`, Date.now()];

      if (namespace) {
        query += ' AND namespace = ?';
        params.push(namespace);
      }

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      const stmt = this.connection.db.prepare(query);
      const rows = stmt.all(...params) as KVRow[];

      return rows.map((row) => this.removeNamespacePrefix(row.key, namespace));
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'List failed', {
        prefix: fullPrefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clear all data or data with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    try {
      if (prefix) {
        const fullPrefix = this.getFullKey(
          prefix,
          this.connection.defaultNamespace
        );

        const stmt = this.connection.db.prepare(
          'DELETE FROM kv_store WHERE key LIKE ?'
        );
        stmt.run(`${fullPrefix}%`);
      } else if (this.connection.defaultNamespace) {
        // Clear only items in the default namespace
        const stmt = this.connection.db.prepare(
          'DELETE FROM kv_store WHERE namespace = ?'
        );
        stmt.run(this.connection.defaultNamespace);
      } else {
        // Clear everything
        this.connection.db.exec('DELETE FROM kv_store');
      }
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteKV', 'Clear failed', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
