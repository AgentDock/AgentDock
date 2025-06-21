/**
 * @fileoverview Vector operations for PostgreSQL with pgvector
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../../logging';
import { getDistanceFunction } from '../schema';
import {
  VectorData,
  VectorMetric,
  VectorSearchOptions,
  VectorSearchResult
} from '../types';

/**
 * Insert vectors into collection
 */
export async function insertVectors(
  pool: Pool,
  collection: string,
  vectors: VectorData[],
  schema?: string
): Promise<void> {
  if (!vectors.length) return;

  const tableName = schema ? `"${schema}"."${collection}"` : `"${collection}"`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Prepare bulk insert
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const vector of vectors) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}::vector, $${paramIndex + 2}::jsonb)`
      );
      values.push(
        vector.id,
        `[${vector.vector.join(',')}]`,
        JSON.stringify(vector.metadata || {})
      );
      paramIndex += 3;
    }

    const query = `
      INSERT INTO ${tableName} (id, embedding, metadata)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id) DO NOTHING
    `;

    await client.query(query, values);
    await client.query('COMMIT');

    logger.debug(LogCategory.STORAGE, 'PostgreSQLVector', 'Vectors inserted', {
      collection,
      count: vectors.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      'Failed to insert vectors',
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update vectors in collection
 */
export async function updateVectors(
  pool: Pool,
  collection: string,
  vectors: VectorData[],
  schema?: string
): Promise<void> {
  if (!vectors.length) return;

  const tableName = schema ? `"${schema}"."${collection}"` : `"${collection}"`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update each vector individually
    for (const vector of vectors) {
      const query = `
        UPDATE ${tableName}
        SET embedding = $2::vector,
            metadata = $3::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [
        vector.id,
        `[${vector.vector.join(',')}]`,
        JSON.stringify(vector.metadata || {})
      ]);
    }

    await client.query('COMMIT');

    logger.debug(LogCategory.STORAGE, 'PostgreSQLVector', 'Vectors updated', {
      collection,
      count: vectors.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      'Failed to update vectors',
      {
        collection,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete vectors from collection
 */
export async function deleteVectors(
  pool: Pool,
  collection: string,
  ids: string[],
  schema?: string
): Promise<void> {
  if (!ids.length) return;

  const tableName = schema ? `"${schema}"."${collection}"` : `"${collection}"`;

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const query = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;

  await pool.query(query, ids);

  logger.debug(LogCategory.STORAGE, 'PostgreSQLVector', 'Vectors deleted', {
    collection,
    count: ids.length
  });
}

/**
 * Search for similar vectors
 */
export async function searchVectors(
  pool: Pool,
  collection: string,
  queryVector: number[],
  metric: VectorMetric,
  options: VectorSearchOptions = {},
  schema?: string
): Promise<VectorSearchResult[]> {
  const tableName = schema ? `"${schema}"."${collection}"` : `"${collection}"`;
  const k = options.k || 10;
  const distanceOp = getDistanceFunction(metric);

  // Build query parts
  const selectFields = ['id', 'metadata'];
  const orderByClause = `embedding ${distanceOp} $1::vector`;

  if (options.includeScore !== false) {
    selectFields.push(`embedding ${distanceOp} $1::vector AS score`);
  }

  if (options.includeVector) {
    selectFields.push('embedding');
  }

  // Build WHERE clause for metadata filtering
  let whereClause = '';
  const values: any[] = [`[${queryVector.join(',')}]`];
  let paramIndex = 2;

  if (options.filter && Object.keys(options.filter).length > 0) {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(options.filter)) {
      conditions.push(`metadata->>'${key}' = $${paramIndex}`);
      values.push(String(value));
      paramIndex++;
    }

    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  // Add threshold filter if specified
  if (options.threshold !== undefined) {
    const thresholdCondition = `embedding ${distanceOp} $1::vector < $${paramIndex}`;
    if (whereClause) {
      whereClause += ` AND ${thresholdCondition}`;
    } else {
      whereClause = `WHERE ${thresholdCondition}`;
    }
    values.push(options.threshold);
  }

  const query = `
    SELECT ${selectFields.join(', ')}
    FROM ${tableName}
    ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT ${k}
  `;

  const result = await pool.query(query, values);

  return result.rows.map((row) => {
    const searchResult: VectorSearchResult = {
      id: row.id,
      score: row.score || 0,
      metadata: row.metadata
    };

    if (options.includeVector && row.embedding) {
      // Parse vector from PostgreSQL format
      const vectorStr = row.embedding.slice(1, -1); // Remove [ and ]
      searchResult.vector = vectorStr.split(',').map(Number);
    }

    return searchResult;
  });
}

/**
 * Get vector by ID
 */
export async function getVectorById(
  pool: Pool,
  collection: string,
  id: string,
  schema?: string
): Promise<VectorData | null> {
  const tableName = schema ? `"${schema}"."${collection}"` : `"${collection}"`;

  const query = `
    SELECT id, embedding, metadata
    FROM ${tableName}
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Parse vector from PostgreSQL format
  const vectorStr = row.embedding.slice(1, -1); // Remove [ and ]
  const vector = vectorStr.split(',').map(Number);

  return {
    id: row.id,
    vector,
    metadata: row.metadata
  };
}
