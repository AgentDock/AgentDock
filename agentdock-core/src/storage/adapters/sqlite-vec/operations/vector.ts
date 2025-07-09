/**
 * @fileoverview SQLite-vec vector operations using vec0 virtual tables
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import {
  VectorInsertOptions,
  VectorSearchOptions,
  VectorSearchResult
} from '../types';

/**
 * Validate SQL identifier to prevent injection attacks.
 * Only allows alphanumeric characters and underscores.
 */
function validateSQLIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('SQL identifier must be a non-empty string');
  }

  // Remove any whitespace
  const trimmed = identifier.trim();

  // Check for valid identifier pattern (letters, numbers, underscores only)
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!validPattern.test(trimmed)) {
    throw new Error(
      `Invalid SQL identifier: "${identifier}". Only alphanumeric characters and underscores are allowed.`
    );
  }

  // Check length constraints
  if (trimmed.length > 63) {
    throw new Error(
      `SQL identifier too long: "${identifier}". Maximum 63 characters allowed.`
    );
  }

  // Check against reserved words (basic SQLite reserved words)
  const reservedWords = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TABLE',
    'INDEX',
    'VIEW',
    'TRIGGER',
    'DATABASE',
    'AND',
    'OR',
    'NOT',
    'NULL',
    'TRUE',
    'FALSE',
    'WHERE',
    'FROM',
    'VALUES',
    'ORDER',
    'BY',
    'LIMIT',
    'GROUP',
    'HAVING',
    'UNION',
    'JOIN',
    'INNER',
    'LEFT',
    'RIGHT'
  ];

  if (reservedWords.includes(trimmed.toUpperCase())) {
    throw new Error(`Cannot use reserved word as identifier: "${identifier}"`);
  }

  return trimmed;
}

/**
 * Escape SQL identifier by wrapping in double quotes.
 * This prevents injection while allowing the identifier to be used safely.
 */
function escapeIdentifier(identifier: string): string {
  // Double any existing double quotes to escape them
  const escaped = identifier.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Insert vector into collection using sqlite-vec vec0 virtual table
 */
export async function insertVector(
  db: Database.Database,
  collection: string,
  id: string,
  vector: number[],
  options: VectorInsertOptions = {}
): Promise<void> {
  try {
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    // Convert vector to JSON string format for sqlite-vec
    const vectorJson = JSON.stringify(vector);

    // Insert into the vec0 virtual table with escaped collection name
    const stmt = db.prepare(
      `INSERT INTO ${escapedCollection}(rowid, embedding) VALUES (?, ?)`
    );
    stmt.run(id, vectorJson);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Inserted vector for id ${id} into collection ${validatedCollection}`,
      { dimensions: vector.length }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to insert vector for id ${id}`,
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Search vectors using sqlite-vec KNN with MATCH operator
 */
export async function searchVectors(
  db: Database.Database,
  collection: string,
  queryVector: number[],
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const { limit = 10, threshold } = options;

  try {
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    // Convert query vector to JSON string
    const queryVectorJson = JSON.stringify(queryVector);

    // Build the search query using sqlite-vec's MATCH syntax with escaped collection name
    let sql = `
      SELECT 
        rowid as id,
        distance
      FROM ${escapedCollection}
      WHERE embedding MATCH ?
      ORDER BY distance ASC
      LIMIT ?
    `;

    const params = [queryVectorJson, limit];

    // Add distance threshold if specified
    if (threshold !== undefined) {
      sql = `
        SELECT 
          rowid as id,
          distance
        FROM ${escapedCollection}
        WHERE embedding MATCH ? AND distance <= ?
        ORDER BY distance ASC
        LIMIT ?
      `;
      params.splice(1, 0, threshold); // Insert threshold as second parameter
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{ id: string; distance: number }>;

    const results: VectorSearchResult[] = rows.map((row) => ({
      id: row.id,
      distance: row.distance,
      score: 1 / (1 + row.distance) // Convert distance to similarity score
    }));

    logger.debug(LogCategory.STORAGE, 'SQLiteVec', `Vector search completed`, {
      collection: validatedCollection,
      queryDimensions: queryVector.length,
      resultsCount: results.length,
      limit,
      threshold
    });

    return results;
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'SQLiteVec', 'Vector search failed', {
      collection,
      queryDimensions: queryVector.length,
      error: error instanceof Error ? error.message : String(error)
    });
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
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    const vectorJson = JSON.stringify(vector);

    // Update the vector using rowid with escaped collection name
    const stmt = db.prepare(
      `UPDATE ${escapedCollection} SET embedding = ? WHERE rowid = ?`
    );
    const result = stmt.run(vectorJson, id);

    if (result.changes === 0) {
      throw new Error(
        `Vector with id ${id} not found in collection ${validatedCollection}`
      );
    }

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Updated vector for id ${id} in collection ${validatedCollection}`,
      { dimensions: vector.length }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to update vector for id ${id}`,
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
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
): Promise<boolean> {
  try {
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    const stmt = db.prepare(`DELETE FROM ${escapedCollection} WHERE rowid = ?`);
    const result = stmt.run(id);

    const success = result.changes > 0;

    if (success) {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Deleted vector for id ${id} from collection ${validatedCollection}`
      );
    } else {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Vector with id ${id} not found in collection ${validatedCollection}`
      );
    }

    return success;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to delete vector for id ${id}`,
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Get vector by id from collection
 */
export async function getVector(
  db: Database.Database,
  collection: string,
  id: string
): Promise<number[] | null> {
  try {
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    const stmt = db.prepare(
      `SELECT embedding FROM ${escapedCollection} WHERE rowid = ?`
    );
    const row = stmt.get(id) as { embedding: string } | undefined;

    if (!row) {
      return null;
    }

    // Parse the JSON vector
    const vector = JSON.parse(row.embedding) as number[];

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Retrieved vector for id ${id} from collection ${validatedCollection}`,
      { dimensions: vector.length }
    );

    return vector;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to get vector for id ${id}`,
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(
  db: Database.Database,
  collection: string
): Promise<{ count: number; avgDistance?: number }> {
  try {
    // SECURITY FIX: Validate and escape collection name to prevent SQL injection
    const validatedCollection = validateSQLIdentifier(collection);
    const escapedCollection = escapeIdentifier(validatedCollection);

    // Get count of vectors in collection with escaped collection name
    const countStmt = db.prepare(
      `SELECT COUNT(*) as count FROM ${escapedCollection}`
    );
    const countResult = countStmt.get() as { count: number };

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Collection stats for ${validatedCollection}`,
      { count: countResult.count }
    );

    return {
      count: countResult.count
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to get stats for collection ${collection}`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}
