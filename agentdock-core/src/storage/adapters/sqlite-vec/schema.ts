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
    // Load sqlite-vec extension
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
        continue;
      }
    }

    if (!loaded) {
      throw new Error(
        'Failed to load sqlite-vec extension. Please ensure vec0 is installed.'
      );
    }

    // Verify extension is loaded by checking for vec_distance_cosine function
    const result = db
      .prepare(
        "SELECT name FROM pragma_function_list WHERE name = 'vec_distance_cosine'"
      )
      .get();

    if (!result) {
      throw new Error(
        'sqlite-vec extension loaded but functions not available'
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
 * Create vector collections table
 */
export async function createVectorTables(db: Database.Database): Promise<void> {
  // Collections metadata table
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

  // Vectors table - stores all vectors across collections
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS vec_vectors (
      id TEXT NOT NULL,
      collection TEXT NOT NULL,
      vector_data BLOB NOT NULL,
      metadata TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (collection, id),
      FOREIGN KEY (collection) REFERENCES vec_collections(name) ON DELETE CASCADE
    )
  `
  ).run();

  // Create indexes
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_vec_vectors_collection ON vec_vectors(collection)'
  ).run();

  logger.info(LogCategory.STORAGE, 'SQLiteVec', 'Vector tables created');
}

/**
 * Create a vector collection
 */
export async function createVectorCollection(
  db: Database.Database,
  config: VectorCollectionConfig
): Promise<void> {
  const stmt = db.prepare(
    `
    INSERT INTO vec_collections (name, dimension, metric)
    VALUES (?, ?, ?)
  `
  );

  stmt.run(config.name, config.dimension, config.metric || VectorMetric.COSINE);

  logger.info(
    LogCategory.STORAGE,
    'SQLiteVec',
    `Created collection: ${config.name}`
  );
}

/**
 * Drop a vector collection
 */
export async function dropVectorCollection(
  db: Database.Database,
  name: string
): Promise<void> {
  // Delete from collections table (cascade will delete vectors)
  const stmt = db.prepare('DELETE FROM vec_collections WHERE name = ?');
  stmt.run(name);

  logger.info(LogCategory.STORAGE, 'SQLiteVec', `Dropped collection: ${name}`);
}

/**
 * Check if collection exists
 */
export async function checkCollectionExists(
  db: Database.Database,
  name: string
): Promise<boolean> {
  const stmt = db.prepare(
    'SELECT 1 FROM vec_collections WHERE name = ? LIMIT 1'
  );
  const result = stmt.get(name);
  return !!result;
}

/**
 * List all vector collections
 */
export async function listVectorCollections(
  db: Database.Database
): Promise<string[]> {
  const stmt = db.prepare('SELECT name FROM vec_collections ORDER BY name');
  const rows = stmt.all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

/**
 * Get collection metadata
 */
export async function getCollectionMetadata(
  db: Database.Database,
  name: string
): Promise<VectorCollectionConfig | null> {
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
}
