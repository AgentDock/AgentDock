/**
 * @fileoverview SQLite-vec vector operations
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { getCollectionMetadata } from '../schema';
import {
  VectorData,
  VectorMetric,
  VectorRow,
  VectorSearchOptions,
  VectorSearchResult
} from '../types';

/**
 * Convert number array to Float32Array buffer for storage
 */
function vectorToBuffer(vector: number[]): Buffer {
  const float32Array = new Float32Array(vector);
  return Buffer.from(float32Array.buffer);
}

/**
 * Convert buffer back to number array
 */
function bufferToVector(buffer: Buffer): number[] {
  const float32Array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32Array);
}

/**
 * Get distance function based on metric
 */
function getDistanceFunction(metric: VectorMetric): string {
  switch (metric) {
    case VectorMetric.EUCLIDEAN:
      return 'vec_distance_L2';
    case VectorMetric.COSINE:
      return 'vec_distance_cosine';
    case VectorMetric.DOT_PRODUCT:
      return 'vec_distance_dot';
    default:
      return 'vec_distance_cosine';
  }
}

/**
 * Insert vectors into collection
 */
export async function insertVectors(
  db: Database.Database,
  collection: string,
  vectors: VectorData[]
): Promise<void> {
  const collectionMeta = await getCollectionMetadata(db, collection);
  if (!collectionMeta) {
    throw new Error(`Collection ${collection} does not exist`);
  }

  const stmt = db.prepare(
    `
    INSERT INTO vec_vectors (id, collection, vector_data, metadata)
    VALUES (?, ?, ?, ?)
  `
  );

  const insertMany = db.transaction((vectors: VectorData[]) => {
    for (const vector of vectors) {
      if (vector.vector.length !== collectionMeta.dimension) {
        throw new Error(
          `Vector dimension mismatch. Expected ${collectionMeta.dimension}, got ${vector.vector.length}`
        );
      }

      stmt.run(
        vector.id,
        collection,
        vectorToBuffer(vector.vector),
        vector.metadata ? JSON.stringify(vector.metadata) : null
      );
    }
  });

  insertMany(vectors);

  logger.debug(
    LogCategory.STORAGE,
    'SQLiteVec',
    `Inserted ${vectors.length} vectors into ${collection}`
  );
}

/**
 * Update vectors in collection
 */
export async function updateVectors(
  db: Database.Database,
  collection: string,
  vectors: VectorData[]
): Promise<void> {
  const collectionMeta = await getCollectionMetadata(db, collection);
  if (!collectionMeta) {
    throw new Error(`Collection ${collection} does not exist`);
  }

  const stmt = db.prepare(
    `
    UPDATE vec_vectors
    SET vector_data = ?, metadata = ?, updated_at = unixepoch()
    WHERE collection = ? AND id = ?
  `
  );

  const updateMany = db.transaction((vectors: VectorData[]) => {
    for (const vector of vectors) {
      if (vector.vector.length !== collectionMeta.dimension) {
        throw new Error(
          `Vector dimension mismatch. Expected ${collectionMeta.dimension}, got ${vector.vector.length}`
        );
      }

      stmt.run(
        vectorToBuffer(vector.vector),
        vector.metadata ? JSON.stringify(vector.metadata) : null,
        collection,
        vector.id
      );
    }
  });

  updateMany(vectors);

  logger.debug(
    LogCategory.STORAGE,
    'SQLiteVec',
    `Updated ${vectors.length} vectors in ${collection}`
  );
}

/**
 * Delete vectors from collection
 */
export async function deleteVectors(
  db: Database.Database,
  collection: string,
  ids: string[]
): Promise<void> {
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(
    `DELETE FROM vec_vectors WHERE collection = ? AND id IN (${placeholders})`
  );

  stmt.run(collection, ...ids);

  logger.debug(
    LogCategory.STORAGE,
    'SQLiteVec',
    `Deleted ${ids.length} vectors from ${collection}`
  );
}

/**
 * Get vector by ID
 */
export async function getVectorById(
  db: Database.Database,
  collection: string,
  id: string
): Promise<VectorData | null> {
  const stmt = db.prepare(
    `
    SELECT id, vector_data, metadata
    FROM vec_vectors
    WHERE collection = ? AND id = ?
  `
  );

  const row = stmt.get(collection, id) as VectorRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    vector: bufferToVector(row.vector_data),
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  };
}

/**
 * Search for similar vectors
 */
export async function searchVectors(
  db: Database.Database,
  collection: string,
  queryVector: number[],
  options?: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const collectionMeta = await getCollectionMetadata(db, collection);
  if (!collectionMeta) {
    throw new Error(`Collection ${collection} does not exist`);
  }

  if (queryVector.length !== collectionMeta.dimension) {
    throw new Error(
      `Query vector dimension mismatch. Expected ${collectionMeta.dimension}, got ${queryVector.length}`
    );
  }

  const k = options?.k || 10;
  const distanceFunction = getDistanceFunction(collectionMeta.metric!);
  const queryBuffer = vectorToBuffer(queryVector);

  // Build filter conditions
  const filters: string[] = ['collection = ?'];
  const params: any[] = [collection];

  if (options?.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      filters.push(`json_extract(metadata, '$.${key}') = ?`);
      params.push(value);
    }
  }

  // Build query
  let query = `
    SELECT 
      id,
      ${distanceFunction}(vector_data, ?) as distance,
      ${options?.includeVector ? 'vector_data,' : ''}
      metadata
    FROM vec_vectors
    WHERE ${filters.join(' AND ')}
  `;

  // Add threshold filter if specified
  if (options?.threshold !== undefined) {
    // For cosine similarity, smaller distance = more similar
    // Threshold is in similarity space (0-1), so convert to distance
    if (collectionMeta.metric === VectorMetric.COSINE) {
      query += ` AND ${distanceFunction}(vector_data, ?) <= ?`;
      params.push(queryBuffer, 1 - options.threshold);
    } else {
      query += ` AND ${distanceFunction}(vector_data, ?) <= ?`;
      params.push(queryBuffer, options.threshold);
    }
  }

  query += ` ORDER BY distance ASC LIMIT ?`;

  // Add query vector and limit
  const stmt = db.prepare(query);
  const rows = stmt.all(queryBuffer, ...params, k) as Array<{
    id: string;
    distance: number;
    vector_data?: Buffer;
    metadata?: string | null;
  }>;

  return rows.map((row) => {
    const result: VectorSearchResult = {
      id: row.id,
      score: row.distance,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };

    if (options?.includeVector && row.vector_data) {
      result.vector = bufferToVector(row.vector_data);
    }

    // Convert distance to similarity score for cosine metric
    if (
      collectionMeta.metric === VectorMetric.COSINE &&
      options?.includeScore !== false
    ) {
      result.score = 1 - row.distance; // Convert distance to similarity
    }

    return result;
  });
}
