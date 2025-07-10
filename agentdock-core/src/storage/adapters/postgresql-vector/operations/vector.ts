/**
 * @fileoverview PostgreSQL Vector operations for vector search
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../../logging';
import {
  VectorData,
  VectorSearchOptions,
  VectorSearchResult
} from '../../../base-types';
import {
  parseSqlIdentifier,
  quotePgIdentifier
} from '../../../utils/sql-utils';

/**
 * Get distance operator for vector operations
 */
function getDistanceOperator(metric: string): string {
  switch (metric) {
    case 'euclidean':
      return '<->';
    case 'cosine':
      return '<=>';
    case 'ip':
    case 'dot_product':
      return '<#>';
    default:
      return '<->';
  }
}

/**
 * Insert vectors into a collection
 */
export async function insertVectors(
  pool: Pool,
  schema: string,
  collection: string,
  vectors: VectorData[]
): Promise<void> {
  // Validate identifiers
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const validatedCollection = parseSqlIdentifier(collection, 'collection name');

  const quotedSchema = quotePgIdentifier(validatedSchema);
  const quotedCollection = quotePgIdentifier(validatedCollection);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const vector of vectors) {
      await client.query(
        `INSERT INTO ${quotedSchema}.${quotedCollection} (id, vector, metadata) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (id) DO UPDATE SET 
           vector = EXCLUDED.vector, 
           metadata = EXCLUDED.metadata`,
        [
          vector.id,
          JSON.stringify(vector.vector),
          JSON.stringify(vector.metadata || {})
        ]
      );
    }

    await client.query('COMMIT');

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Inserted ${vectors.length} vectors into collection: ${collection}`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Failed to insert vectors into collection: ${collection}`,
      { error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Search vectors in a collection
 */
export async function searchVectors(
  pool: Pool,
  schema: string,
  collection: string,
  queryVector: number[],
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  // Validate identifiers
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const validatedCollection = parseSqlIdentifier(collection, 'collection name');

  const quotedSchema = quotePgIdentifier(validatedSchema);
  const quotedCollection = quotePgIdentifier(validatedCollection);

  const { limit = 10, threshold, filter } = options;
  const distanceOp = getDistanceOperator('cosine'); // Default to cosine

  const client = await pool.connect();
  try {
    let sql = `
      SELECT 
        id,
        vector,
        metadata,
        (vector ${distanceOp} $1) as distance
      FROM ${quotedSchema}.${quotedCollection}
    `;

    const params: any[] = [JSON.stringify(queryVector)];
    let paramIndex = 2;

    // Add metadata filters
    if (filter && Object.keys(filter).length > 0) {
      const filterConditions = Object.entries(filter).map(([key, value]) => {
        const condition = `metadata->>'${key}' = $${paramIndex}`;
        params.push(value);
        paramIndex++;
        return condition;
      });
      sql += ` WHERE ${filterConditions.join(' AND ')}`;
    }

    // Add distance threshold
    if (threshold !== undefined) {
      const whereClause = sql.includes('WHERE') ? ' AND' : ' WHERE';
      sql += `${whereClause} (vector ${distanceOp} $1) <= $${paramIndex}`;
      params.push(threshold);
      paramIndex++;
    }

    sql += ` ORDER BY distance ASC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await client.query(sql, params);

    const results: VectorSearchResult[] = result.rows.map((row) => ({
      id: row.id,
      score: 1 - row.distance, // Convert distance to similarity score
      vector: JSON.parse(row.vector),
      metadata: JSON.parse(row.metadata || '{}')
    }));

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Found ${results.length} vectors in collection: ${collection}`
    );

    return results;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Failed to search vectors in collection: ${collection}`,
      { error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete vectors from a collection
 */
export async function deleteVectors(
  pool: Pool,
  schema: string,
  collection: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;

  // Validate identifiers
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const validatedCollection = parseSqlIdentifier(collection, 'collection name');

  const quotedSchema = quotePgIdentifier(validatedSchema);
  const quotedCollection = quotePgIdentifier(validatedCollection);

  const client = await pool.connect();
  try {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');

    await client.query(
      `DELETE FROM ${quotedSchema}.${quotedCollection} WHERE id IN (${placeholders})`,
      ids
    );

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Deleted ${ids.length} vectors from collection: ${collection}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Failed to delete vectors from collection: ${collection}`,
      { error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a specific vector by ID
 */
export async function getVector(
  pool: Pool,
  schema: string,
  collection: string,
  id: string
): Promise<VectorData | null> {
  // Validate identifiers
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const validatedCollection = parseSqlIdentifier(collection, 'collection name');

  const quotedSchema = quotePgIdentifier(validatedSchema);
  const quotedCollection = quotePgIdentifier(validatedCollection);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, vector, metadata FROM ${quotedSchema}.${quotedCollection} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      vector: JSON.parse(row.vector),
      metadata: JSON.parse(row.metadata || '{}')
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      `Failed to get vector: ${id} from collection: ${collection}`,
      { error }
    );
    throw error;
  } finally {
    client.release();
  }
}
