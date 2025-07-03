/**
 * @fileoverview SQLite-Vec memory schema with FTS5 text search
 *
 * Extends SQLite memory schema with FTS5 virtual table for native BM25 text search.
 * Provides hybrid vector + text search capabilities for local development.
 */

import { Database } from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';
import { initializeMemorySchema } from '../sqlite/schema-memory';

/**
 * Initialize memory schema with FTS5 support for SQLite-Vec
 */
export async function initializeMemorySchemaWithFTS5(
  db: Database
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'SQLiteVecMemorySchema',
    'Initializing memory schema with FTS5'
  );

  try {
    // Initialize base memory schema first
    await initializeMemorySchema(db);

    // Add FTS5 virtual table for native BM25 text search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        content=memories,
        content_rowid=id
      );
    `);

    // Populate FTS5 table with existing memories
    db.exec(`
      INSERT OR IGNORE INTO memories_fts(rowid, content) 
      SELECT id, content FROM memories;
    `);

    // Create triggers to keep FTS5 in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_fts_insert 
      AFTER INSERT ON memories 
      BEGIN
        INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_fts_delete 
      AFTER DELETE ON memories 
      BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content) 
        VALUES('delete', old.id, old.content);
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_fts_update 
      AFTER UPDATE ON memories 
      BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content) 
        VALUES('delete', old.id, old.content);
        INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
      END;
    `);

    logger.info(
      LogCategory.STORAGE,
      'SQLiteVecMemorySchema',
      'Memory schema with FTS5 initialized successfully'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVecMemorySchema',
      'Failed to initialize memory schema with FTS5',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Rebuild FTS5 index from existing memories
 */
export function rebuildFTS5Index(db: Database): void {
  try {
    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVecMemorySchema',
      'Rebuilding FTS5 index'
    );

    // Clear and rebuild FTS5 index
    db.exec(`
      INSERT INTO memories_fts(memories_fts) VALUES('delete-all');
      INSERT INTO memories_fts(rowid, content) 
      SELECT id, content FROM memories;
    `);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVecMemorySchema',
      'FTS5 index rebuilt successfully'
    );
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SQLiteVecMemorySchema',
      'FTS5 index rebuild failed',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}
