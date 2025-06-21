/**
 * @fileoverview SQLite schema creation and management
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';

/**
 * Initialize database tables and indexes
 */
export function initializeSchema(db: Database.Database): void {
  logger.debug(
    LogCategory.STORAGE,
    'SQLiteSchema',
    'Initializing database schema'
  );

  // Key-value table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER,
      namespace TEXT,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_namespace ON kv_store(namespace);
    CREATE INDEX IF NOT EXISTS idx_expires_at ON kv_store(expires_at);
  `);

  // List table
  db.exec(`
    CREATE TABLE IF NOT EXISTS list_store (
      key TEXT NOT NULL,
      position INTEGER NOT NULL,
      value TEXT NOT NULL,
      namespace TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (key, position)
    );
    
    CREATE INDEX IF NOT EXISTS idx_list_namespace ON list_store(namespace);
  `);

  logger.debug(
    LogCategory.STORAGE,
    'SQLiteSchema',
    'Schema initialization complete'
  );
}

/**
 * Clean up expired items from the database
 */
export function cleanupExpired(db: Database.Database): number {
  try {
    const stmt = db.prepare(`
      DELETE FROM kv_store 
      WHERE expires_at IS NOT NULL 
      AND expires_at < ?
    `);

    const result = stmt.run(Date.now());

    if (result.changes > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteSchema',
        'Cleaned up expired items',
        {
          count: result.changes
        }
      );
    }

    return result.changes;
  } catch (error) {
    logger.warn(LogCategory.STORAGE, 'SQLiteSchema', 'Cleanup failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}
