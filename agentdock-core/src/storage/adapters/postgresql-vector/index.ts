/**
 * @fileoverview PostgreSQL Vector storage adapter using pgvector extension
 *
 * Extends the base PostgreSQL adapter with vector similarity search capabilities.
 * Requires pgvector extension to be installed in PostgreSQL.
 */

import { LogCategory, logger } from '../../../logging';
import { VectorOperations } from '../../base-types';
import { PostgreSQLAdapter } from '../postgresql';
import { PostgreSQLConnectionManager } from '../postgresql/connection';
import { PostgreSQLConnection } from '../postgresql/types';
import { PostgreSQLVectorMemoryOperations } from './operations/memory';
import {
  deleteVectors,
  getVector,
  insertVectors,
  searchVectors
} from './operations/vector';
import {
  collectionExists,
  createVectorCollection,
  dropVectorCollection,
  initializeVectorSchema,
  listVectorCollections
} from './schema';
import {
  PostgreSQLVectorAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorIndexType,
  VectorMetric,
  VectorSearchOptions,
  VectorSearchResult
} from './types';

// Export types
export type {
  PostgreSQLVectorAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetric,
  VectorIndexType
};

// Export operations
export { PostgreSQLVectorMemoryOperations } from './operations/memory';

/**
 * PostgreSQL + Vector storage adapter
 * Extends the base PostgreSQL adapter with vector similarity search capabilities.
 */
export class PostgreSQLVectorAdapter
  extends PostgreSQLAdapter
  implements VectorOperations
{
  private vectorOptions: PostgreSQLVectorAdapterOptions;
  private isVectorInitialized = false;

  // Override parent memory property with vector-enabled operations
  declare memory?: PostgreSQLVectorMemoryOperations;

  protected async initializeMemoryOperations(): Promise<void> {
    const connection = await this.getConnection();
    if (!connection) return;

    // Use vector-enhanced memory operations
    this.memory = new PostgreSQLVectorMemoryOperations(
      connection.pool,
      connection.schema
    );
  }

  constructor(options: PostgreSQLVectorAdapterOptions) {
    super(options);
    this.vectorOptions = {
      ...options,
      enableVector: options.enableVector ?? true,
      defaultDimension: options.defaultDimension || 1536,
      defaultMetric: options.defaultMetric || 'cosine',
      defaultIndexType: options.defaultIndexType || VectorIndexType.IVFFLAT
    };
  }

  /**
   * Initialize the adapter and pgvector extension
   */
  async initialize(): Promise<void> {
    await super.initialize();

    if (this.vectorOptions.enableVector && !this.isVectorInitialized) {
      // Use parent class connection instead of creating duplicate
      const connection = await this.getConnection();
      await initializeVectorSchema(connection.pool, connection.schema);

      // Set IVF Flat probes if configured
      if (this.vectorOptions.ivfflat?.probes) {
        await connection.pool.query(
          `SET ivfflat.probes = ${this.vectorOptions.ivfflat.probes}`
        );
      }

      // Initialize vector-enabled memory operations (override parent memory)
      this.memory = new PostgreSQLVectorMemoryOperations(
        connection.pool,
        connection.schema
      );

      // Create GIN indexes for text search performance (managed service compatible)
      await this.createTextSearchIndexes(connection);

      this.isVectorInitialized = true;
      logger.info(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'Vector adapter initialized with hybrid search capabilities'
      );
    }
  }

  /**
   * Create GIN indexes for text search performance
   *
   * Uses built-in PostgreSQL features only - no extensions required
   * Compatible with all managed database services
   */
  private async createTextSearchIndexes(
    connection: PostgreSQLConnection
  ): Promise<void> {
    try {
      // Create GIN index for full-text search on memory content
      // Uses to_tsvector which is built-in to PostgreSQL
      await connection.pool.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_content_gin 
        ON ${connection.schema}.memories 
        USING GIN (to_tsvector('english', content)) 
        WITH (fastupdate = off);
      `);

      // Create GIN index for keywords JSONB search
      await connection.pool.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_keywords_gin 
        ON ${connection.schema}.memories 
        USING GIN (keywords) 
        WITH (fastupdate = off);
      `);

      // Create HNSW index for vector similarity search (if not exists)
      await connection.pool.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_embedding_hnsw 
        ON ${connection.schema}.memories 
        USING hnsw (embedding vector_cosine_ops) 
        WITH (m = 16, ef_construction = 64);
      `);

      logger.info(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'Text search and vector indexes created for optimal hybrid search performance'
      );
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'Some indexes may already exist or failed to create',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Get the vector connection (ensure initialized)
   */
  private async getVectorConnection(): Promise<PostgreSQLConnection> {
    await this.initialize();
    return this.getConnection();
  }

  /**
   * Create a vector collection
   */
  async createCollection(config: VectorCollectionConfig): Promise<void> {
    const connection = await this.getVectorConnection();
    const fullConfig: VectorCollectionConfig = {
      ...config,
      metric: config.metric || this.vectorOptions.defaultMetric,
      index: config.index || {
        type: this.vectorOptions.defaultIndexType!,
        lists: this.vectorOptions.ivfflat?.lists
      }
    };

    // The function expects (client, schema, config) not (pool, config, schema)
    const client = await connection.pool.connect();
    try {
      await createVectorCollection(client, connection.schema, fullConfig);
    } finally {
      client.release();
    }
  }

  /**
   * Drop a vector collection
   */
  async dropCollection(name: string): Promise<void> {
    const connection = await this.getVectorConnection();
    await dropVectorCollection(connection.pool, connection.schema, name);
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    const connection = await this.getVectorConnection();
    return collectionExists(connection.pool, connection.schema, name);
  }

  /**
   * List all vector collections
   */
  async listCollections(): Promise<string[]> {
    const connection = await this.getVectorConnection();
    const collections = await listVectorCollections(
      connection.pool,
      connection.schema
    );
    // Extract just the names from the VectorCollectionConfig objects
    return collections.map((config) => config.name);
  }

  /**
   * Insert vectors into collection
   */
  async insertVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    const connection = await this.getVectorConnection();
    await insertVectors(
      connection.pool,
      connection.schema,
      collection,
      vectors
    );
  }

  /**
   * Update vectors in collection
   */
  async updateVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    // Use upsert pattern since we don't have a separate update function
    await this.insertVectors(collection, vectors);
  }

  /**
   * Delete vectors from collection
   */
  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    const connection = await this.getVectorConnection();
    await deleteVectors(connection.pool, connection.schema, collection, ids);
  }

  /**
   * Search for similar vectors
   */
  async searchVectors(
    collection: string,
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const connection = await this.getVectorConnection();

    return searchVectors(
      connection.pool,
      connection.schema,
      collection,
      queryVector,
      options
    );
  }

  /**
   * Get vector by ID
   */
  async getVector(collection: string, id: string): Promise<VectorData | null> {
    const connection = await this.getVectorConnection();
    return getVector(connection.pool, connection.schema, collection, id);
  }

  /**
   * Upsert vectors (insert or update)
   */
  async upsertVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    // Since insertVectors now uses UPSERT logic, we can just call it directly
    await this.insertVectors(collection, vectors);
  }

  /**
   * Create a new instance with different vector configuration
   */
  withVectorConfig(
    config: Partial<PostgreSQLVectorAdapterOptions>
  ): PostgreSQLVectorAdapter {
    return new PostgreSQLVectorAdapter({
      ...this.vectorOptions,
      ...config
    });
  }

  /**
   * Hybrid search: combine vector similarity with metadata filtering
   */
  async hybridSearch(
    collection: string,
    queryVector: number[],
    metadata: Record<string, any>,
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    return this.searchVectors(collection, queryVector, {
      ...options,
      filter: { ...options?.filter, ...metadata }
    });
  }

  /**
   * Close the adapter and vector connections
   */
  async close(): Promise<void> {
    await super.close();
  }

  /**
   * Destroy the adapter
   */
  async destroy(): Promise<void> {
    await this.close();
  }
}
