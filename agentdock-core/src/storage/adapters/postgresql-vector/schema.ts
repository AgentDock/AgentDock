/**
 * @fileoverview Schema management for PostgreSQL Vector collections
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import {
  parseSqlIdentifier,
  quotePgIdentifier,
  TABLE_NAMES
} from '../../utils/sql-utils';
import { VectorCollectionConfig, VectorIndexType, VectorMetric } from './types';

/**
 * SQL templates for vector operations
 */
export const VectorSQL = {
  /**
   * Create pgvector extension
   */
  CREATE_EXTENSION: `CREATE EXTENSION IF NOT EXISTS vector`,

  /**
   * Check if extension exists
   */
  CHECK_EXTENSION: `
    SELECT EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) as exists
  `,

  /**
   * Create vector collections metadata table
   */
  CREATE_COLLECTIONS_TABLE: (schema: string) => `
    CREATE TABLE IF NOT EXISTS ${quotePgIdentifier(schema)}.vector_collections (
      name TEXT PRIMARY KEY,
      dimension INTEGER NOT NULL,
      metric TEXT NOT NULL DEFAULT 'cosine',
      index_type TEXT DEFAULT 'ivfflat',
      index_options JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,

  /**
   * Create a vector collection table
   */
  CREATE_COLLECTION_TABLE: (
    schema: string,
    tableName: string,
    dimension: number
  ) => `
    CREATE TABLE IF NOT EXISTS ${quotePgIdentifier(schema)}.${quotePgIdentifier(tableName)} (
      id TEXT PRIMARY KEY,
      vector vector(${dimension}) NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `,

  /**
   * Create vector index
   */
  CREATE_VECTOR_INDEX: (
    schema: string,
    tableName: string,
    indexType: string,
    metric: string
  ) => {
    const quotedSchema = quotePgIdentifier(schema);
    const quotedTable = quotePgIdentifier(tableName);
    const indexName = quotePgIdentifier(`idx_${tableName}_vector_${indexType}`);

    if (indexType === 'ivfflat') {
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${quotedSchema}.${quotedTable} USING ivfflat (vector vector_${metric}_ops) WITH (lists = 100)`;
    } else if (indexType === 'hnsw') {
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${quotedSchema}.${quotedTable} USING hnsw (vector vector_${metric}_ops)`;
    }

    throw new Error(`Unsupported index type: ${indexType}`);
  }
};

/**
 * Initialize pgvector extension and schema
 */
export async function initializeVectorSchema(
  pool: Pool,
  schema: string = 'public'
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'PostgreSQLVectorSchema',
    'Initializing vector schema',
    { schema }
  );

  // Validate schema name
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');

  const client = await pool.connect();
  try {
    // Create pgvector extension
    await client.query(VectorSQL.CREATE_EXTENSION);

    // Create schema if needed
    if (schema !== 'public') {
      await client.query(
        `CREATE SCHEMA IF NOT EXISTS ${quotePgIdentifier(validatedSchema)}`
      );
    }

    // Create collections metadata table
    await client.query(VectorSQL.CREATE_COLLECTIONS_TABLE(validatedSchema));

    // Create default collections
    await createDefaultCollections(client, validatedSchema);

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      'Vector schema initialized successfully',
      { schema: validatedSchema }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      'Failed to initialize vector schema',
      { schema: validatedSchema, error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create default vector collections
 */
async function createDefaultCollections(
  client: any,
  schema: string
): Promise<void> {
  const defaultDimension = 1536; // text-embedding-3-small

  const collections = [
    { name: TABLE_NAMES.MEMORY_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.DOCUMENT_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.USER_EMBEDDINGS, dimension: defaultDimension },
    { name: TABLE_NAMES.AGENT_MEMORIES, dimension: defaultDimension }
  ];

  for (const collection of collections) {
    await createVectorCollection(client, schema, {
      name: collection.name,
      dimension: collection.dimension,
      metric: 'cosine',
      index: { type: 'ivfflat' }
    });
  }
}

/**
 * Create a vector collection
 */
export async function createVectorCollection(
  client: any,
  schema: string,
  config: VectorCollectionConfig
): Promise<void> {
  const { name, dimension, metric = 'cosine', index } = config;

  try {
    // Validate collection name
    const validatedName = parseSqlIdentifier(name, 'collection name');

    // Create the collection table
    await client.query(
      VectorSQL.CREATE_COLLECTION_TABLE(schema, validatedName, dimension)
    );

    // Create vector index if specified
    if (index?.type) {
      const indexType = index.type as VectorIndexType;
      if (indexType === 'ivfflat' || indexType === 'hnsw') {
        await client.query(
          VectorSQL.CREATE_VECTOR_INDEX(
            schema,
            validatedName,
            indexType,
            metric
          )
        );
      }
    }

    // Register collection in metadata
    await client.query(
      `INSERT INTO ${quotePgIdentifier(schema)}.vector_collections (name, dimension, metric, index_type, index_options) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (name) DO UPDATE SET 
         dimension = EXCLUDED.dimension,
         metric = EXCLUDED.metric,
         index_type = EXCLUDED.index_type,
         index_options = EXCLUDED.index_options`,
      [
        name,
        dimension,
        metric,
        index?.type || 'ivfflat',
        JSON.stringify(index || {})
      ]
    );

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      `Created vector collection: ${name}`,
      { dimension, metric, indexType: index?.type }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
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
  pool: Pool,
  schema: string,
  collectionName: string
): Promise<void> {
  // Validate names
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const validatedCollection = parseSqlIdentifier(
    collectionName,
    'collection name'
  );

  const client = await pool.connect();
  try {
    // Drop the collection table
    await client.query(
      `DROP TABLE IF EXISTS ${quotePgIdentifier(validatedSchema)}.${quotePgIdentifier(validatedCollection)}`
    );

    // Remove from metadata
    await client.query(
      `DELETE FROM ${quotePgIdentifier(validatedSchema)}.vector_collections WHERE name = $1`,
      [collectionName]
    );

    logger.debug(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      `Dropped vector collection: ${collectionName}`,
      { schema: validatedSchema }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      `Failed to drop vector collection: ${collectionName}`,
      { schema: validatedSchema, error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List all vector collections
 */
export async function listVectorCollections(
  pool: Pool,
  schema: string
): Promise<VectorCollectionConfig[]> {
  // Validate schema name
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT name, dimension, metric, index_type, index_options 
       FROM ${quotePgIdentifier(validatedSchema)}.vector_collections 
       ORDER BY name`
    );

    return result.rows.map((row) => ({
      name: row.name,
      dimension: row.dimension,
      metric: row.metric as VectorMetric,
      index: {
        type: row.index_type as VectorIndexType,
        ...JSON.parse(row.index_options || '{}')
      }
    }));
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      'Failed to list vector collections',
      { schema: validatedSchema, error }
    );
    return [];
  } finally {
    client.release();
  }
}

/**
 * Check if a vector collection exists
 */
export async function collectionExists(
  pool: Pool,
  schema: string,
  collectionName: string
): Promise<boolean> {
  // Validate names
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT EXISTS(SELECT 1 FROM ${quotePgIdentifier(validatedSchema)}.vector_collections WHERE name = $1)`,
      [collectionName]
    );

    return result.rows[0]?.exists || false;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      'Failed to check collection existence',
      { schema: validatedSchema, collectionName, error }
    );
    return false;
  } finally {
    client.release();
  }
}

/**
 * Get collection metadata
 */
export async function getCollectionMetadata(
  pool: Pool,
  schema: string,
  collectionName: string
): Promise<VectorCollectionConfig | null> {
  // Validate names
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT name, dimension, metric, index_type, index_options 
       FROM ${quotePgIdentifier(validatedSchema)}.vector_collections 
       WHERE name = $1`,
      [collectionName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      name: row.name,
      dimension: row.dimension,
      metric: row.metric as VectorMetric,
      index: {
        type: row.index_type as VectorIndexType,
        ...JSON.parse(row.index_options || '{}')
      }
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLVectorSchema',
      'Failed to get collection metadata',
      { schema: validatedSchema, collectionName, error }
    );
    return null;
  } finally {
    client.release();
  }
}
