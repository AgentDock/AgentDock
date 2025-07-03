/**
 * @fileoverview SQLite-vec storage adapter with vector similarity search
 *
 * Extends the base SQLite adapter with vector operations using sqlite-vec extension.
 * Provides semantic search capabilities for AI memory systems.
 */

import { LogCategory, logger } from '../../../logging';
import { VectorOperations } from '../../base-types';
import { MemoryOperations } from '../../types';
import { SQLiteAdapter } from '../sqlite';
import { SQLiteConnectionManager } from '../sqlite/connection';
import { SQLiteConnection } from '../sqlite/types';
import { SQLiteVecMemoryOperations } from './operations/memory';
import {
  deleteVector,
  getCollectionStats,
  getVector,
  insertVector,
  searchVectors,
  updateVector
} from './operations/vector';
import {
  checkCollectionExists,
  createVectorCollection,
  createVectorTables,
  dropVectorCollection,
  getCollectionMetadata,
  initializeSqliteVec,
  listVectorCollections
} from './schema';
import { initializeMemorySchemaWithFTS5 } from './schema-memory';
import {
  SQLiteVecAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorInsertOptions,
  VectorMetric,
  VectorSearchOptions,
  VectorSearchResult
} from './types';

// Export types
export type {
  SQLiteVecAdapterOptions,
  VectorCollectionConfig,
  VectorData,
  VectorSearchOptions,
  VectorSearchResult,
  VectorInsertOptions
};
export type { VectorMetric };

// Re-export VectorOperations from base-types
export type { VectorOperations } from '../../base-types';

/**
 * SQLite storage adapter with vector similarity search capabilities
 *
 * Features:
 * - sqlite-vec extension for vector operations
 * - Multiple distance metrics (Euclidean, Cosine, Dot Product)
 * - Metadata filtering
 * - Zero-config local vector search
 * - All standard SQLite adapter features
 */
export class SQLiteVecAdapter
  extends SQLiteAdapter
  implements VectorOperations
{
  private vectorOptions: SQLiteVecAdapterOptions;
  private isVectorInitialized = false;
  private vectorConnectionManager: SQLiteConnectionManager;
  private vectorConnection?: SQLiteConnection;
  public memory?: MemoryOperations;

  constructor(options: SQLiteVecAdapterOptions = {}) {
    super(options);
    this.vectorOptions = {
      ...options,
      enableVector: options.enableVector ?? true,
      defaultDimension: options.defaultDimension || 1536,
      defaultMetric: options.defaultMetric || 'cosine'
    };
    // Create our own connection manager to access the connection
    this.vectorConnectionManager = new SQLiteConnectionManager(options);
  }

  /**
   * Initialize the adapter and sqlite-vec extension
   */
  async initialize(): Promise<void> {
    await super.initialize();

    if (this.vectorOptions.enableVector && !this.isVectorInitialized) {
      // Get connection from our own manager
      this.vectorConnection =
        await this.vectorConnectionManager.getConnection();

      try {
        // Initialize sqlite-vec extension
        await initializeSqliteVec(
          this.vectorConnection.db,
          this.vectorOptions.vecExtensionPath
        );

        // Create vector tables
        await createVectorTables(this.vectorConnection.db);

        // Initialize memory schema with FTS5 support
        await initializeMemorySchemaWithFTS5(this.vectorConnection.db);

        // Create enhanced memory operations
        this.memory = new SQLiteVecMemoryOperations(this.vectorConnection.db);

        this.isVectorInitialized = true;
        logger.info(
          LogCategory.STORAGE,
          'SQLiteVec',
          'Vector adapter with FTS5 memory support initialized'
        );
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'SQLiteVec',
          'Failed to initialize vector operations',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
        // Continue without vector support
        this.isVectorInitialized = false;
      }
    }
  }

  /**
   * Get the vector connection (ensure initialized)
   */
  private async getVectorConnection(): Promise<SQLiteConnection> {
    await this.initialize();
    if (!this.vectorConnection) {
      throw new Error('Vector connection not initialized');
    }
    if (!this.isVectorInitialized) {
      throw new Error(
        'Vector operations not available. Ensure sqlite-vec extension is installed.'
      );
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
      metric: config.metric || this.vectorOptions.defaultMetric
    };

    await createVectorCollection(connection.db, fullConfig);
  }

  /**
   * Drop a vector collection
   */
  async dropCollection(name: string): Promise<void> {
    const connection = await this.getVectorConnection();
    await dropVectorCollection(connection.db, name);
  }

  /**
   * Check if collection exists
   */
  async collectionExists(name: string): Promise<boolean> {
    const connection = await this.getVectorConnection();
    return checkCollectionExists(connection.db, name);
  }

  /**
   * List all vector collections
   */
  async listCollections(): Promise<string[]> {
    const connection = await this.getVectorConnection();
    return listVectorCollections(connection.db);
  }

  /**
   * Insert vectors into collection
   */
  async insertVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    const connection = await this.getVectorConnection();

    // Insert each vector individually using the new API
    for (const vector of vectors) {
      await insertVector(connection.db, collection, vector.id, vector.vector, {
        metadata: vector.metadata
      });
    }
  }

  /**
   * Update vectors in collection
   */
  async updateVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    const connection = await this.getVectorConnection();

    // Update each vector individually using the new API
    for (const vector of vectors) {
      await updateVector(connection.db, collection, vector.id, vector.vector);
    }
  }

  /**
   * Delete vectors from collection
   */
  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    const connection = await this.getVectorConnection();

    // Delete each vector individually using the new API
    for (const id of ids) {
      await deleteVector(connection.db, collection, id);
    }
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
    return searchVectors(connection.db, collection, queryVector, options);
  }

  /**
   * Get vector by ID
   */
  async getVector(collection: string, id: string): Promise<VectorData | null> {
    const connection = await this.getVectorConnection();
    const vector = await getVector(connection.db, collection, id);

    if (!vector) {
      return null;
    }

    // Convert the returned number[] to VectorData format
    return {
      id: id,
      vector: vector,
      metadata: undefined // sqlite-vec doesn't store metadata in the same way
    };
  }

  /**
   * Upsert vectors (insert or update)
   */
  async upsertVectors(
    collection: string,
    vectors: VectorData[]
  ): Promise<void> {
    const connection = await this.getVectorConnection();

    for (const vector of vectors) {
      // Try to get existing vector
      const existing = await getVector(connection.db, collection, vector.id);

      if (existing) {
        // Update existing
        await updateVector(connection.db, collection, vector.id, vector.vector);
      } else {
        // Insert new
        await insertVector(
          connection.db,
          collection,
          vector.id,
          vector.vector,
          {
            metadata: vector.metadata
          }
        );
      }
    }
  }

  /**
   * Create a new instance with different vector configuration
   */
  withVectorConfig(config: Partial<SQLiteVecAdapterOptions>): SQLiteVecAdapter {
    return new SQLiteVecAdapter({
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
    if (this.vectorConnectionManager) {
      await this.vectorConnectionManager.close();
    }
  }

  /**
   * Destroy the adapter
   */
  async destroy(): Promise<void> {
    await this.close();
  }
}
