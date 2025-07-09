/**
 * @fileoverview Schema management for PostgreSQL Vector collections
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { SQLIdentifierValidator } from '../shared/sql-identifier-validator';
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
   * Create vector collection table
   */
  CREATE_COLLECTION: (name: string, dimension: number, schema?: string) => {
    // Validate and escape identifiers to prevent SQL injection
    const validCollection =
      SQLIdentifierValidator.validateSQLiteCollection(name);
    const escapedCollection =
      SQLIdentifierValidator.escapePostgreSQL(validCollection);

    // Validate dimension parameter
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > 10000) {
      throw new Error(
        `Invalid dimension: ${dimension}. Must be integer between 1 and 10000`
      );
    }

    let tableName: string;
    if (schema) {
      const validSchema =
        SQLIdentifierValidator.validatePostgreSQLSchema(schema);
      const escapedSchema =
        SQLIdentifierValidator.escapePostgreSQL(validSchema);
      tableName = `${escapedSchema}.${escapedCollection}`;
    } else {
      tableName = escapedCollection;
    }

    return `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id VARCHAR(255) PRIMARY KEY,
        embedding vector(${dimension}) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
  },

  /**
   * Create metadata index
   */
  CREATE_METADATA_INDEX: (name: string, schema?: string) => {
    // Validate and escape identifiers to prevent SQL injection
    const validCollection =
      SQLIdentifierValidator.validateSQLiteCollection(name);
    const escapedCollection =
      SQLIdentifierValidator.escapePostgreSQL(validCollection);

    let tableName: string;
    if (schema) {
      const validSchema =
        SQLIdentifierValidator.validatePostgreSQLSchema(schema);
      const escapedSchema =
        SQLIdentifierValidator.escapePostgreSQL(validSchema);
      tableName = `${escapedSchema}.${escapedCollection}`;
    } else {
      tableName = escapedCollection;
    }

    return `
      CREATE INDEX IF NOT EXISTS idx_${validCollection}_metadata 
      ON ${tableName} USING GIN (metadata)
    `;
  },

  /**
   * Create vector index
   */
  CREATE_VECTOR_INDEX: (
    name: string,
    indexType: VectorIndexType,
    metric: VectorMetric,
    options: any = {},
    schema?: string
  ) => {
    // Validate and escape identifiers to prevent SQL injection
    const validCollection =
      SQLIdentifierValidator.validateSQLiteCollection(name);
    const escapedCollection =
      SQLIdentifierValidator.escapePostgreSQL(validCollection);

    let tableName: string;
    if (schema) {
      const validSchema =
        SQLIdentifierValidator.validatePostgreSQLSchema(schema);
      const escapedSchema =
        SQLIdentifierValidator.escapePostgreSQL(validSchema);
      tableName = `${escapedSchema}.${escapedCollection}`;
    } else {
      tableName = escapedCollection;
    }

    const distance = getDistanceOperator(metric);

    if (indexType === VectorIndexType.IVFFLAT) {
      const lists = options.lists || 100;
      // Validate lists parameter
      if (!Number.isInteger(lists) || lists < 1 || lists > 10000) {
        throw new Error(
          `Invalid lists parameter: ${lists}. Must be integer between 1 and 10000`
        );
      }
      return `
        CREATE INDEX IF NOT EXISTS idx_${validCollection}_vector 
        ON ${tableName} 
        USING ivfflat (embedding ${distance})
        WITH (lists = ${lists})
      `;
    }

    // HNSW support (if available in newer pgvector versions)
    if (indexType === VectorIndexType.HNSW) {
      const m = options.m || 16;
      const efConstruction = options.efConstruction || 64;
      // Validate HNSW parameters
      if (!Number.isInteger(m) || m < 1 || m > 100) {
        throw new Error(
          `Invalid m parameter: ${m}. Must be integer between 1 and 100`
        );
      }
      if (
        !Number.isInteger(efConstruction) ||
        efConstruction < 1 ||
        efConstruction > 1000
      ) {
        throw new Error(
          `Invalid efConstruction parameter: ${efConstruction}. Must be integer between 1 and 1000`
        );
      }
      return `
        CREATE INDEX IF NOT EXISTS idx_${validCollection}_vector 
        ON ${tableName} 
        USING hnsw (embedding ${distance})
        WITH (m = ${m}, ef_construction = ${efConstruction})
      `;
    }

    throw new Error(`Unsupported index type: ${indexType}`);
  },

  /**
   * Drop collection
   */
  DROP_COLLECTION: (name: string, schema?: string) => {
    // Validate and escape identifiers to prevent SQL injection
    const validCollection =
      SQLIdentifierValidator.validateSQLiteCollection(name);
    const escapedCollection =
      SQLIdentifierValidator.escapePostgreSQL(validCollection);

    let tableName: string;
    if (schema) {
      const validSchema =
        SQLIdentifierValidator.validatePostgreSQLSchema(schema);
      const escapedSchema =
        SQLIdentifierValidator.escapePostgreSQL(validSchema);
      tableName = `${escapedSchema}.${escapedCollection}`;
    } else {
      tableName = escapedCollection;
    }

    return `DROP TABLE IF EXISTS ${tableName} CASCADE`;
  },

  /**
   * Check if collection exists
   */
  CHECK_COLLECTION: (name: string, schema?: string) => {
    return `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1 
        ${schema ? 'AND table_schema = $2' : 'AND table_schema = current_schema()'}
      ) as exists
    `;
  },

  /**
   * List collections
   */
  LIST_COLLECTIONS: (schema?: string) => {
    return `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ${schema ? '$1' : 'current_schema()'}
      AND table_name LIKE 'vec_%'
      ORDER BY table_name
    `;
  }
};

/**
 * Get distance operator for metric
 */
function getDistanceOperator(metric: VectorMetric): string {
  switch (metric) {
    case 'euclidean':
      return 'vector_l2_ops';
    case 'cosine':
      return 'vector_cosine_ops';
    case 'ip':
      return 'vector_ip_ops';
    default:
      return 'vector_l2_ops';
  }
}

/**
 * Get distance function for metric
 */
export function getDistanceFunction(metric: VectorMetric): string {
  switch (metric) {
    case 'euclidean':
      return '<->';
    case 'cosine':
      return '<=>';
    case 'ip':
      return '<#>';
    default:
      return '<->';
  }
}

/**
 * Initialize pgvector extension
 */
export async function initializePgVector(pool: Pool): Promise<void> {
  try {
    // Check if extension exists
    const checkResult = await pool.query(VectorSQL.CHECK_EXTENSION);

    if (!checkResult.rows[0]?.exists) {
      // Create extension
      await pool.query(VectorSQL.CREATE_EXTENSION);
      logger.info(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'pgvector extension created'
      );
    } else {
      logger.debug(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'pgvector extension already exists'
      );
    }
  } catch (error) {
    // Check if it's a permission error
    if (error instanceof Error && error.message.includes('permission denied')) {
      logger.error(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'Cannot create pgvector extension. Please run: CREATE EXTENSION vector;',
        { error: error.message }
      );
      throw new Error(
        'pgvector extension not installed. Please ask your database administrator to run: CREATE EXTENSION vector;'
      );
    }
    throw error;
  }
}

/**
 * Create a vector collection
 */
export async function createVectorCollection(
  pool: Pool,
  config: VectorCollectionConfig,
  schema?: string
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create table
    await client.query(
      VectorSQL.CREATE_COLLECTION(config.name, config.dimension, schema)
    );

    // Create metadata index
    await client.query(VectorSQL.CREATE_METADATA_INDEX(config.name, schema));

    // Create vector index if specified
    if (config.index) {
      const metric = config.metric || 'cosine';
      await client.query(
        VectorSQL.CREATE_VECTOR_INDEX(
          config.name,
          config.index.type as VectorIndexType,
          metric,
          config.index,
          schema
        )
      );
    }

    await client.query('COMMIT');

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLVector',
      'Vector collection created',
      {
        collection: config.name,
        dimension: config.dimension,
        metric: config.metric,
        indexType: config.index?.type
      }
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Drop a vector collection
 */
export async function dropVectorCollection(
  pool: Pool,
  name: string,
  schema?: string
): Promise<void> {
  await pool.query(VectorSQL.DROP_COLLECTION(name, schema));

  logger.info(
    LogCategory.STORAGE,
    'PostgreSQLVector',
    'Vector collection dropped',
    {
      collection: name
    }
  );
}

/**
 * Check if collection exists
 */
export async function checkCollectionExists(
  pool: Pool,
  name: string,
  schema?: string
): Promise<boolean> {
  const params = schema ? [name, schema] : [name];
  const result = await pool.query(
    VectorSQL.CHECK_COLLECTION(name, schema),
    params
  );
  return result.rows[0]?.exists || false;
}

/**
 * List all vector collections
 */
export async function listVectorCollections(
  pool: Pool,
  schema?: string
): Promise<string[]> {
  const params = schema ? [schema] : [];
  const result = await pool.query(VectorSQL.LIST_COLLECTIONS(schema), params);
  return result.rows.map((row) => row.table_name);
}
