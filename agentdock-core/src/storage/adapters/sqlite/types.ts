/**
 * @fileoverview SQLite-specific types and interfaces
 */

import Database from 'better-sqlite3';

/**
 * Configuration options for SQLite adapter
 */
export interface SQLiteAdapterOptions {
  /**
   * Path to SQLite database file
   * Use ':memory:' for in-memory database
   * Default: './agentdock.db'
   */
  path?: string;

  /**
   * Default namespace for this adapter instance
   */
  namespace?: string;

  /**
   * Enable verbose logging for debugging
   */
  verbose?: boolean;

  /**
   * Enable WAL mode for better performance
   * Default: true
   */
  walMode?: boolean;
}

/**
 * Internal connection wrapper for SQLite
 */
export interface SQLiteConnection {
  db: Database.Database;
  defaultNamespace?: string;
  cleanupInterval?: NodeJS.Timeout;
}

/**
 * Row type for key-value store
 */
export interface KVRow {
  key: string;
  value: string;
  expires_at?: number | null;
  namespace?: string | null;
  metadata?: string | null;
  created_at?: number;
  updated_at?: number;
}

/**
 * Row type for list store
 */
export interface ListRow {
  key: string;
  position: number;
  value: string;
  namespace?: string | null;
  created_at?: number;
}
