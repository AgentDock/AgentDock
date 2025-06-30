/**
 * @fileoverview SQLite-vec vector operations using vec0 virtual tables
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { VectorSearchResult, VectorInsertOptions, VectorSearchOptions } from '../types';

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
    // Convert vector to JSON string format for sqlite-vec
    const vectorJson = JSON.stringify(vector);
    
    // Insert into the vec0 virtual table
    const stmt = db.prepare(`INSERT INTO ${collection}(rowid, embedding) VALUES (?, ?)`);
    stmt.run(id, vectorJson);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Inserted vector for id ${id} into collection ${collection}`,
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
    // Convert query vector to JSON string
    const queryVectorJson = JSON.stringify(queryVector);
    
    // Build the search query using sqlite-vec's MATCH syntax
    let sql = `
      SELECT 
        rowid as id,
        distance
      FROM ${collection}
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
        FROM ${collection}
        WHERE embedding MATCH ? AND distance <= ?
        ORDER BY distance ASC
        LIMIT ?
      `;
      params.splice(1, 0, threshold); // Insert threshold as second parameter
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{ id: string; distance: number }>;

    const results: VectorSearchResult[] = rows.map(row => ({
      id: row.id,
      distance: row.distance,
      score: 1 / (1 + row.distance) // Convert distance to similarity score
    }));

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Vector search completed`,
      { 
        collection,
        queryDimensions: queryVector.length,
        resultsCount: results.length,
        limit,
        threshold
      }
    );

    return results;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Vector search failed',
      { 
        collection,
        queryDimensions: queryVector.length,
        error: error instanceof Error ? error.message : String(error) 
      }
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
    const vectorJson = JSON.stringify(vector);
    
    // Update the vector using rowid
    const stmt = db.prepare(`UPDATE ${collection} SET embedding = ? WHERE rowid = ?`);
    const result = stmt.run(vectorJson, id);
    
    if (result.changes === 0) {
      throw new Error(`Vector with id ${id} not found in collection ${collection}`);
    }

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Updated vector for id ${id} in collection ${collection}`,
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
    const stmt = db.prepare(`DELETE FROM ${collection} WHERE rowid = ?`);
    const result = stmt.run(id);
    
    const success = result.changes > 0;
    
    if (success) {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Deleted vector for id ${id} from collection ${collection}`
      );
    } else {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Vector with id ${id} not found in collection ${collection}`
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
    const stmt = db.prepare(`SELECT embedding FROM ${collection} WHERE rowid = ?`);
    const row = stmt.get(id) as { embedding: string } | undefined;
    
    if (!row) {
      return null;
    }
    
    // Parse the JSON vector
    const vector = JSON.parse(row.embedding) as number[];
    
    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Retrieved vector for id ${id} from collection ${collection}`,
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
    // Get count of vectors in collection
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM ${collection}`);
    const countResult = countStmt.get() as { count: number };
    
    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Collection stats for ${collection}`,
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
