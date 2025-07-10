/**
 * @fileoverview SQLite-vec vector operations
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { parseSqlIdentifier } from '../../../utils/sql-utils';
import { VectorData, VectorSearchOptions, VectorSearchResult } from '../types';

/**
 * Insert vector into collection using sqlite-vec vec0 virtual table
 */
export async function insertVector(
  db: Database.Database,
  collection: string,
  id: string,
  vector: number[],
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Validate the collection name using simple validation
    const validatedCollection = parseSqlIdentifier(
      collection,
      'collection name'
    );

    // Convert vector to binary format for vec0
    const vectorData = new Float32Array(vector);

    // Insert into vec0 virtual table
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${validatedCollection}(rowid, embedding) VALUES (?, ?)`
    );

    stmt.run(id, vectorData);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Inserted vector with ID: ${id} into collection: ${collection}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to insert vector: ${id} into collection: ${collection}`,
      { error }
    );
    throw error;
  }
}

/**
 * Update vector in collection
 */
export async function updateVector(
  db: Database.Database,
  collection: string,
  id: string,
  vector: number[]
): Promise<void> {
  try {
    // Validate the collection name
    const validatedCollection = parseSqlIdentifier(
      collection,
      'collection name'
    );

    // Convert vector to binary format for vec0
    const vectorData = new Float32Array(vector);

    // Update in vec0 virtual table
    const stmt = db.prepare(
      `UPDATE ${validatedCollection} SET embedding = ? WHERE rowid = ?`
    );

    const result = stmt.run(vectorData, id);

    if (result.changes === 0) {
      throw new Error(
        `Vector with ID ${id} not found in collection ${collection}`
      );
    }

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Updated vector with ID: ${id} in collection: ${collection}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to update vector: ${id} in collection: ${collection}`,
      { error }
    );
    throw error;
  }
}

/**
 * Delete vector from collection
 */
export async function deleteVector(
  db: Database.Database,
  collection: string,
  id: string
): Promise<void> {
  try {
    // Validate the collection name
    const validatedCollection = parseSqlIdentifier(
      collection,
      'collection name'
    );

    // Delete from vec0 virtual table
    const stmt = db.prepare(
      `DELETE FROM ${validatedCollection} WHERE rowid = ?`
    );
    const result = stmt.run(id);

    if (result.changes === 0) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Vector with ID ${id} not found in collection ${collection}`
      );
    } else {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Deleted vector with ID: ${id} from collection: ${collection}`
      );
    }
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to delete vector: ${id} from collection: ${collection}`,
      { error }
    );
    throw error;
  }
}

/**
 * Search vectors using sqlite-vec similarity search
 */
export async function searchVectors(
  db: Database.Database,
  collection: string,
  queryVector: number[],
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  try {
    // Validate the collection name
    const validatedCollection = parseSqlIdentifier(
      collection,
      'collection name'
    );

    const { limit = 10, threshold } = options;

    // Convert query vector to binary format
    const queryData = new Float32Array(queryVector);

    // Build the search query
    let sql = `
      SELECT 
        rowid as id,
        distance,
        embedding
      FROM ${validatedCollection}
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `;

    const params: any[] = [queryData, limit];

    // Add threshold filter if provided
    if (threshold !== undefined) {
      sql = sql.replace(
        'ORDER BY distance',
        'AND distance <= ? ORDER BY distance'
      );
      params.splice(-1, 0, threshold);
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      distance: number;
      embedding: Float32Array;
    }>;

    const results: VectorSearchResult[] = rows.map((row) => ({
      id: row.id,
      score: 1 - row.distance, // Convert distance to similarity score
      metadata: {},
      vector: Array.from(row.embedding)
    }));

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Found ${results.length} vectors in collection: ${collection}`
    );

    return results;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to search vectors in collection: ${collection}`,
      { error }
    );
    throw error;
  }
}

/**
 * Get a specific vector by ID
 */
export async function getVector(
  db: Database.Database,
  collection: string,
  id: string
): Promise<VectorData | null> {
  try {
    // Validate the collection name
    const validatedCollection = parseSqlIdentifier(
      collection,
      'collection name'
    );

    const stmt = db.prepare(
      `SELECT rowid as id, embedding FROM ${validatedCollection} WHERE rowid = ?`
    );

    const row = stmt.get(id) as
      | { id: string; embedding: Float32Array }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      vector: Array.from(row.embedding),
      metadata: {}
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to get vector: ${id} from collection: ${collection}`,
      { error }
    );
    throw error;
  }
}
