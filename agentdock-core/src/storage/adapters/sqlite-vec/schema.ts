/**
 * @fileoverview SQLite-vec schema operations
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';
import { VectorCollectionConfig, VectorMetric } from './types';

/**
 * Initialize sqlite-vec extension
 */
export async function initializeSqliteVec(
  db: Database.Database,
  extensionPath?: string
): Promise<void> {
  try {
    // Load sqlite-vec extension (vec0)
    // Default paths for common platforms
    const paths = extensionPath
      ? [extensionPath]
      : [
          './vec0.so', // Linux
          './vec0.dylib', // macOS
          './vec0.dll', // Windows
          'vec0' // Let SQLite find it
        ];

    let loaded = false;
    for (const path of paths) {
      try {
        db.loadExtension(path);
        loaded = true;
        logger.info(
          LogCategory.STORAGE,
          'SQLiteVec',
          `Loaded sqlite-vec extension from ${path}`
        );
        break;
      } catch (err) {
        // Try next path
      }
    }

    if (!loaded) {
      throw new Error(
        'Failed to load sqlite-vec extension. Please ensure vec0 is installed.'
      );
    }

    // Verify extension is loaded by trying to create a test table
    try {
      db.prepare(
        'CREATE VIRTUAL TABLE IF NOT EXISTS _vec_test USING vec0(test_embedding float[3])'
      ).run();
      db.prepare('DROP TABLE _vec_test').run();
      logger.info(
        LogCategory.STORAGE,
        'SQLiteVec',
        'sqlite-vec extension verified successfully'
      );
    } catch (error) {
      throw new Error(
        'sqlite-vec extension loaded but vec0 virtual table module not available'
      );
    }
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'SQLiteVec', 'Failed to initialize', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Create vector collections table (metadata tracking)
 */
export async function createVectorTables(db: Database.Database): Promise<void> {
  // Collections metadata table for tracking our virtual tables
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS vec_collections (
      name TEXT PRIMARY KEY,
      dimension INTEGER NOT NULL,
      metric TEXT NOT NULL DEFAULT 'cosine',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `
  ).run();

  logger.info(
    LogCategory.STORAGE,
    'SQLiteVec',
    'Vector metadata tables created'
  );
}

/**
 * Create a vector collection using sqlite-vec virtual table
 */
export async function createVectorCollection(
  db: Database.Database,
  config: VectorCollectionConfig
): Promise<void> {
  const { name, dimension, metric = VectorMetric.COSINE } = config;

  // Create the vec0 virtual table
  const createTableSQL = `CREATE VIRTUAL TABLE IF NOT EXISTS ${name} USING vec0(embedding float[${dimension}])`;

  try {
    db.prepare(createTableSQL).run();

    // Track the collection in our metadata table
    const insertMetadata = db.prepare(
      `INSERT OR REPLACE INTO vec_collections (name, dimension, metric) VALUES (?, ?, ?)`
    );
    insertMetadata.run(name, dimension, metric);

    logger.info(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Created vector collection: ${name} with ${dimension} dimensions`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to create vector collection: ${name}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Drop a vector collection
 */
export async function dropVectorCollection(
  db: Database.Database,
  name: string
): Promise<void> {
  try {
    // Drop the virtual table
    db.prepare(`DROP TABLE IF EXISTS ${name}`).run();

    // Remove from metadata
    db.prepare('DELETE FROM vec_collections WHERE name = ?').run(name);

    logger.info(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Dropped collection: ${name}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to drop collection: ${name}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Check if collection exists
 */
export async function checkCollectionExists(
  db: Database.Database,
  name: string
): Promise<boolean> {
  try {
    const stmt = db.prepare(
      'SELECT 1 FROM vec_collections WHERE name = ? LIMIT 1'
    );
    const result = stmt.get(name);
    return !!result;
  } catch (error) {
    return false;
  }
}

/**
 * List all vector collections
 */
export async function listVectorCollections(
  db: Database.Database
): Promise<string[]> {
  try {
    const stmt = db.prepare('SELECT name FROM vec_collections ORDER BY name');
    const rows = stmt.all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Failed to list collections',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return [];
  }
}

/**
 * Get collection metadata
 */
export async function getCollectionMetadata(
  db: Database.Database,
  name: string
): Promise<VectorCollectionConfig | null> {
  try {
    const stmt = db.prepare(
      'SELECT name, dimension, metric FROM vec_collections WHERE name = ?'
    );
    const row = stmt.get(name) as
      | {
          name: string;
          dimension: number;
          metric: string;
        }
      | undefined;

    if (!row) return null;

    return {
      name: row.name,
      dimension: row.dimension,
      metric: row.metric as VectorMetric
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to get metadata for collection: ${name}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
}
