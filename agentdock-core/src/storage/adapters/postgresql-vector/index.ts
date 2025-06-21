/**
 * @fileoverview PostgreSQL Vector storage adapter using pgvector extension
 *
 * Extends the base PostgreSQL adapter with vector similarity search capabilities.
 * Requires pgvector extension to be installed in PostgreSQL.
 */

import { LogCategory, logger } from '../../../logging';
import { PostgreSQLAdapter } from '../postgresql';
import { PostgreSQLConnectionManager } from '../postgresql/connection';
import { PostgreSQLConnection } from '../postgresql/types';
import {
  deleteVectors,
  getVectorById,
  insertVectors,
  searchVectors,
  updateVectors
} from './operations/vector';
import {
  checkCollectionExists,
  createVectorCollection,
  dropVectorCollection,
  initializePgVector,
  listVectorCollections
} from './schema';
import {
  PostgreSQLVectorAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorIndexType,
  VectorMetric,
  VectorOperations,
  VectorSearchOptions,
  VectorSearchResult
} from './types';

// Export types
export type {
  PostgreSQLVectorAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorSearchOptions,
  VectorSearchResult
};
export { VectorMetric, VectorIndexType };

/**
 * PostgreSQL storage adapter with vector similarity search capabilities
 *
 * Features:
 * - pgvector extension for vector operations
 * - Multiple distance metrics (Euclidean, Cosine, Inner Product)
 * - IVF Flat and HNSW indexing
 * - Metadata filtering
 * - Hybrid search (vector + metadata)
 * - All standard PostgreSQL adapter features
 */
export class PostgreSQLVectorAdapter
  extends PostgreSQLAdapter
  implements VectorOperations
{
  private vectorOptions: PostgreSQLVectorAdapterOptions;
  private isVectorInitialized = false;
  private vectorConnectionManager: PostgreSQLConnectionManager;
  private vectorConnection?: PostgreSQLConnection;

  constructor(options: PostgreSQLVectorAdapterOptions) {
    super(options);
    this.vectorOptions = {
      ...options,
      enableVector: options.enableVector ?? true,
      defaultDimension: options.defaultDimension || 1536,
      defaultMetric: options.defaultMetric || VectorMetric.COSINE,
      defaultIndexType: options.defaultIndexType || VectorIndexType.IVFFLAT
    };
    // Create our own connection manager to access the connection
    this.vectorConnectionManager = new PostgreSQLConnectionManager(options);
  }

  /**
   * Initialize the adapter and pgvector extension
   */
  async initialize(): Promise<void> {
    await super.initialize();

    if (this.vectorOptions.enableVector && !this.isVectorInitialized) {
      // Get connection from our own manager
      this.vectorConnection =
        await this.vectorConnectionManager.getConnection();
      await initializePgVector(this.vectorConnection.pool);

      // Set IVF Flat probes if configured
      if (this.vectorOptions.ivfflat?.probes) {
        await this.vectorConnection.pool.query(
          `SET ivfflat.probes = ${this.vectorOptions.ivfflat.probes}`
        );
      }

      this.isVectorInitialized = true;
      logger.info(
        LogCategory.STORAGE,
        'PostgreSQLVector',
        'Vector adapter initialized'
      );
    }
  }

  /**
   * Get the vector connection (ensure initialized)
   */
  private async getVectorConnection(): Promise<PostgreSQLConnection> {
    await this.initialize();
    if (!this.vectorConnection) {
      throw new Error('Vector connection not initialized');
    }
    return this.vectorConnection;
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

    await createVectorCollection(
      connection.pool,
      fullConfig,
      connection.schema
    );
  }

  /**
   * Drop a vector collection
   */
  async dropCollection(name: string): Promise<void> {
    const connection = await this.getVectorConnection();
    await dropVectorCollection(connection.pool, name, connection.schema);
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    const connection = await this.getVectorConnection();
    return checkCollectionExists(connection.pool, name, connection.schema);
  }

  /**
   * List all vector collections
   */
  async listCollections(): Promise<string[]> {
    const connection = await this.getVectorConnection();
    return listVectorCollections(connection.pool, connection.schema);
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
      collection,
      vectors,
      connection.schema
    );
  }

  /**
   * Update vectors in collection
   */
  async updateVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    const connection = await this.getVectorConnection();
    await updateVectors(
      connection.pool,
      collection,
      vectors,
      connection.schema
    );
  }

  /**
   * Delete vectors from collection
   */
  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    const connection = await this.getVectorConnection();
    await deleteVectors(connection.pool, collection, ids, connection.schema);
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
    const metric = this.vectorOptions.defaultMetric!;

    return searchVectors(
      connection.pool,
      collection,
      queryVector,
      metric,
      options,
      connection.schema
    );
  }

  /**
   * Get vector by ID
   */
  async getVector(collection: string, id: string): Promise<VectorData | null> {
    const connection = await this.getVectorConnection();
    return getVectorById(connection.pool, collection, id, connection.schema);
  }

  /**
   * Upsert vectors (insert or update)
   */
  async upsertVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    // For simplicity, we'll update existing and insert new
    // In a production system, you might want to use ON CONFLICT UPDATE
    const existingIds = await Promise.all(
      vectors.map((v) => this.getVector(collection, v.id))
    );

    const toUpdate = vectors.filter((_, i) => existingIds[i] !== null);
    const toInsert = vectors.filter((_, i) => existingIds[i] === null);

    if (toUpdate.length > 0) {
      await this.updateVectors(collection, toUpdate);
    }

    if (toInsert.length > 0) {
      await this.insertVectors(collection, toInsert);
    }
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
    await this.vectorConnectionManager.close();
  }

  /**
   * Destroy the adapter
   */
  async destroy(): Promise<void> {
    await this.close();
  }
}
