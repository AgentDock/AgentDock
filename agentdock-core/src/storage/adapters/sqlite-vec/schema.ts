/**
 * @fileoverview SQLite-vec schema operations
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';
import { parseSqlIdentifier, TABLE_NAMES } from '../../utils/sql-utils';
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
          '/usr/local/lib/vec0.so',
          '/opt/homebrew/lib/vec0.dylib'
        ];

    let loaded = false;
    for (const path of paths) {
      try {
        db.loadExtension(path);
        loaded = true;
        logger.info(
          LogCategory.STORAGE,
          'SQLiteVec',
          `Loaded extension: ${path}`
        );
        break;
      } catch (error) {
        // Try next path
        continue;
      }
    }

    if (!loaded) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVec',
        'Failed to load sqlite-vec extension from default paths'
      );
    }
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Failed to initialize sqlite-vec extension',
      { error }
    );
    throw new Error(`SQLiteVec initialization failed: ${error}`);
  }
}

/**
 * Initialize schema tables for SQLite-vec operations
 */
export async function initializeSchema(db: Database.Database): Promise<void> {
  try {
    await createMetadataTable(db);
    await createDefaultCollections(db);

    logger.info(
      LogCategory.STORAGE,
      'SQLiteVec',
      'SQLite-vec schema initialized successfully'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Failed to initialize SQLite-vec schema',
      { error }
    );
    throw error;
  }
}

/**
 * Create vector collections table (metadata tracking)
 */
export async function createMetadataTable(
  db: Database.Database
): Promise<void> {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS vec_collections (
      name TEXT PRIMARY KEY,
      dimension INTEGER NOT NULL,
      metric TEXT NOT NULL DEFAULT 'cosine',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.exec(createSQL);
  logger.debug(
    LogCategory.STORAGE,
    'SQLiteVec',
    'Created vec_collections metadata table'
  );
}

/**
 * Create default vector collections that our system uses
 */
export async function createDefaultCollections(
  db: Database.Database
): Promise<void> {
  const defaultDimension = 1536; // text-embedding-3-small dimension

  const collections = [
    { name: TABLE_NAMES.MEMORY_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.DOCUMENT_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.USER_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.AGENT_MEMORIES, dimension: defaultDimension }
  ];

  for (const collection of collections) {
    await createVectorCollection(db, {
      name: collection.name,
      dimension: collection.dimension,
      metric: 'cosine'
    });
  }
}

/**
 * Create a vector collection using sqlite-vec virtual table
 */
export async function createVectorCollection(
  db: Database.Database,
  config: VectorCollectionConfig
): Promise<void> {
  const { name, dimension, metric = 'cosine' } = config;

  try {
    // Validate the collection name using simple validation
    const validatedName = parseSqlIdentifier(name, 'collection name');

    // Create the virtual table using validated name
    const createTableSQL = `CREATE VIRTUAL TABLE IF NOT EXISTS ${validatedName} USING vec0(embedding float[${dimension}])`;

    db.exec(createTableSQL);

    // Store metadata
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO vec_collections (name, dimension, metric) VALUES (?, ?, ?)`
    );
    stmt.run(name, dimension, metric);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Created vector collection: ${name} with ${dimension} dimensions`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to create vector collection: ${name}`,
      { error }
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
    // Validate the collection name
    const validatedName = parseSqlIdentifier(name, 'collection name');

    // Drop the virtual table
    db.prepare(`DROP TABLE IF EXISTS ${validatedName}`).run();

    // Remove metadata
    db.prepare('DELETE FROM vec_collections WHERE name = ?').run(name);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Dropped collection: ${name}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to drop collection: ${name}`,
      { error }
    );
    throw error;
  }
}

/**
 * Check if a vector collection exists
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
  const rows = stmt.all() as { name: string }[];
  return rows.map((row) => row.name);
}

/**
 * Get metadata for a vector collection
 */
export async function getCollectionMetadata(
  db: Database.Database,
  name: string
): Promise<VectorCollectionConfig | null> {
  try {
    const stmt = db.prepare(
      'SELECT name, dimension, metric FROM vec_collections WHERE name = ?'
    );
    const row = stmt.get(name) as {
      name: string;
      dimension: number;
      metric: string;
    } | null;

    if (!row) {
      return null;
    }

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
      { error }
    );
    throw error;
  }
}
