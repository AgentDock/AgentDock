/**
 * @fileoverview Schema initialization for Cloudflare D1 storage
 */

import { LogCategory, logger } from '../../../logging';
import { D1Database } from './types';

/**
 * Initialize D1 database schema
 */
export async function initializeSchema(
  db: D1Database,
  kvTableName: string,
  listTableName: string
): Promise<void> {
  try {
    // Create KV table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${kvTableName} (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(namespace, key)
      );
    `);

    // Create indexes for KV table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${kvTableName}_namespace_key 
      ON ${kvTableName}(namespace, key);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${kvTableName}_expires_at 
      ON ${kvTableName}(expires_at) 
      WHERE expires_at IS NOT NULL;
    `);

    // Create list table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${listTableName} (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        position INTEGER NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        UNIQUE(namespace, key, position)
      );
    `);

    // Create indexes for list table
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${listTableName}_namespace_key 
      ON ${listTableName}(namespace, key);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${listTableName}_position 
      ON ${listTableName}(namespace, key, position);
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${listTableName}_expires_at 
      ON ${listTableName}(expires_at) 
      WHERE expires_at IS NOT NULL;
    `);

    logger.info(LogCategory.STORAGE, 'CloudflareD1', 'Schema initialized', {
      kvTable: kvTableName,
      listTable: listTableName
    });
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'CloudflareD1',
      'Failed to initialize schema',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Clean up expired entries
 */
export async function cleanupExpired(
  db: D1Database,
  kvTableName: string,
  listTableName: string
): Promise<number> {
  try {
    const now = Date.now();
    let deletedCount = 0;

    // Clean KV table
    const kvResult = await db
      .prepare(
        `
      DELETE FROM ${kvTableName} 
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `
      )
      .bind(now)
      .run();

    if (kvResult.meta && typeof kvResult.meta.changes === 'number') {
      deletedCount += kvResult.meta.changes;
    }

    // Clean list table
    const listResult = await db
      .prepare(
        `
      DELETE FROM ${listTableName} 
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `
      )
      .bind(now)
      .run();

    if (listResult.meta && typeof listResult.meta.changes === 'number') {
      deletedCount += listResult.meta.changes;
    }

    if (deletedCount > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Cleaned up expired entries',
        {
          count: deletedCount,
          kvTable: kvTableName,
          listTable: listTableName
        }
      );
    }

    return deletedCount;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'CloudflareD1',
      'Failed to cleanup expired entries',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    return 0;
  }
}
