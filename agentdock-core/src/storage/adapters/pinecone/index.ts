/**
 * @fileoverview Pinecone vector database adapter
 *
 * This adapter provides key-value storage on top of Pinecone's vector database.
 * While Pinecone is primarily designed for vector similarity search, this adapter
 * enables using it as a general-purpose storage backend by generating vectors
 * from keys and storing values in metadata.
 *
 * Note: This adapter has limitations compared to traditional key-value stores:
 * - List operations are not efficient (no prefix scanning)
 * - No native list data structure support
 * - Metadata size limits may affect large values
 *
 * For vector-specific operations, use the vector methods directly.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { chunkArray } from '../../utils/array';
import { PineconeClient } from './client';
import { KVOperations } from './operations/kv';
import {
  PineconeAdapterOptions,
  PineconeIndexConfig,
  PineconeIndexStats,
  PineconeQueryOptions,
  PineconeQueryResponse,
  PineconeStorageAdapter,
  PineconeUpdateRequest,
  PineconeVector
} from './types';

// Export types
export type {
  PineconeAdapterOptions,
  PineconeIndexConfig,
  PineconeVector,
  PineconeQueryOptions,
  PineconeQueryResponse
};

/**
 * Default index configuration for storage operations
 */
const DEFAULT_STORAGE_INDEX = 'agentdock-storage';
const DEFAULT_VECTOR_DIMENSION = 384;

/**
 * Pinecone storage adapter
 */
export class PineconeAdapter
  extends BaseStorageAdapter
  implements PineconeStorageAdapter
{
  private client: PineconeClient;
  private kvOps?: KVOperations;
  private options: Required<PineconeAdapterOptions>;
  private initialized = false;

  constructor(options: PineconeAdapterOptions) {
    super();

    if (!options.apiKey) {
      throw new Error('Pinecone API key is required');
    }

    this.options = {
      apiKey: options.apiKey,
      environment: options.environment || '',
      defaultIndex: options.defaultIndex || DEFAULT_STORAGE_INDEX,
      namespace: options.namespace || 'default',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100
    };

    this.client = new PineconeClient({
      apiKey: this.options.apiKey,
      environment: this.options.environment,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries
    });
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if default index exists
      const indexes = await this.client.listIndexes();
      if (!indexes.includes(this.options.defaultIndex)) {
        // Create default index for storage operations
        await this.createIndex({
          name: this.options.defaultIndex,
          dimension: DEFAULT_VECTOR_DIMENSION,
          metric: 'cosine'
        });
      }

      // Get environment from the first index if not set
      if (!this.options.environment && indexes.length > 0) {
        const indexInfo = await this.client.describeIndex(indexes[0]);
        if (indexInfo.status?.host) {
          // Extract environment from host
          const match = indexInfo.status.host.match(/-([\w-]+)\.svc\./);
          if (match) {
            this.options.environment = match[1];
            this.client = new PineconeClient({
              ...this.options,
              environment: this.options.environment
            });
          }
        }
      }

      // Initialize KV operations
      this.kvOps = new KVOperations(
        this.client,
        this.options.defaultIndex,
        this.options.namespace,
        DEFAULT_VECTOR_DIMENSION
      );

      this.initialized = true;
      logger.info(
        LogCategory.STORAGE,
        'PineconeAdapter',
        'Adapter initialized',
        {
          defaultIndex: this.options.defaultIndex,
          namespace: this.options.namespace
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PineconeAdapter',
        'Failed to initialize',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Ensure adapter is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ========== Storage Operations ==========

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.ensureInitialized();
    return this.kvOps!.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.ensureInitialized();
    return this.kvOps!.set(key, value, options);
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps!.delete(key, options);
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps!.exists(key, options);
  }

  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    await this.ensureInitialized();
    return this.kvOps!.list(prefix, options);
  }

  async clear(prefix?: string): Promise<void> {
    await this.ensureInitialized();
    return this.kvOps!.clear(prefix);
  }

  // ========== Batch Operations ==========

  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.ensureInitialized();

    const result: Record<string, T | null> = {};

    // Process in batches
    const batches = chunkArray(keys, this.options.batchSize);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (key) => {
          result[key] = await this.get<T>(key, options);
        })
      );
    }

    return result;
  }

  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();

    const entries = Object.entries(items);
    const batches = chunkArray(entries, this.options.batchSize);

    for (const batch of batches) {
      await Promise.all(
        batch.map(([key, value]) => this.set(key, value, options))
      );
    }
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.ensureInitialized();

    let deleted = 0;
    const batches = chunkArray(keys, this.options.batchSize);

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((key) => this.delete(key, options))
      );
      deleted += results.filter(Boolean).length;
    }

    return deleted;
  }

  // ========== List Operations (Not Supported) ==========

  async getList<T>(): Promise<T[] | null> {
    logger.warn(
      LogCategory.STORAGE,
      'PineconeAdapter',
      'List operations are not supported in Pinecone adapter'
    );
    return null;
  }

  async saveList<T>(): Promise<void> {
    logger.warn(
      LogCategory.STORAGE,
      'PineconeAdapter',
      'List operations are not supported in Pinecone adapter'
    );
  }

  async deleteList(): Promise<boolean> {
    logger.warn(
      LogCategory.STORAGE,
      'PineconeAdapter',
      'List operations are not supported in Pinecone adapter'
    );
    return false;
  }

  // ========== Vector Operations ==========

  async createIndex(config: PineconeIndexConfig): Promise<void> {
    await this.client.createIndex(config);
  }

  async deleteIndex(name: string): Promise<void> {
    await this.client.deleteIndex(name);
  }

  async listIndexes(): Promise<string[]> {
    return this.client.listIndexes();
  }

  async getIndexStats(name: string): Promise<PineconeIndexStats> {
    return this.client.getIndexStats(name);
  }

  async upsertVectors(
    indexName: string,
    vectors: PineconeVector[],
    namespace?: string
  ): Promise<void> {
    // Process in batches
    const batches = chunkArray(vectors, this.options.batchSize);

    for (const batch of batches) {
      await this.client.upsertVectors(indexName, batch, namespace);
    }
  }

  async queryVectors(
    indexName: string,
    vector: number[],
    options?: PineconeQueryOptions
  ): Promise<PineconeQueryResponse> {
    return this.client.queryVectors(indexName, vector, options);
  }

  async fetchVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<Record<string, PineconeVector>> {
    // Pinecone has a limit on fetch size
    const maxFetchSize = 1000;

    if (ids.length <= maxFetchSize) {
      return this.client.fetchVectors(indexName, ids, namespace);
    }

    // Process in batches
    const result: Record<string, PineconeVector> = {};
    const batches = chunkArray(ids, maxFetchSize);

    for (const batch of batches) {
      const batchResult = await this.client.fetchVectors(
        indexName,
        batch,
        namespace
      );
      Object.assign(result, batchResult);
    }

    return result;
  }

  async updateVectors(
    indexName: string,
    updates: PineconeUpdateRequest[]
  ): Promise<void> {
    await this.client.updateVectors(indexName, updates);
  }

  async deleteVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<void> {
    // Process in batches
    const batches = chunkArray(ids, this.options.batchSize);

    for (const batch of batches) {
      await this.client.deleteVectors(indexName, batch, namespace);
    }
  }

  async deleteAllVectors(indexName: string, namespace?: string): Promise<void> {
    await this.client.deleteAllVectors(indexName, namespace);
  }

  // ========== Cleanup ==========

  async close(): Promise<void> {
    // No persistent connections to close
    this.initialized = false;
    logger.info(LogCategory.STORAGE, 'PineconeAdapter', 'Adapter closed');
  }

  async destroy(): Promise<void> {
    await this.close();
  }
}
