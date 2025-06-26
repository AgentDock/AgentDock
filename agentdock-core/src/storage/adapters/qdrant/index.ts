/**
 * @fileoverview Qdrant vector database adapter
 *
 * This adapter provides key-value storage on top of Qdrant's vector database.
 * Qdrant is an open-source vector database that can be self-hosted or used
 * as a managed service. It offers excellent performance and rich filtering capabilities.
 *
 * Note: This adapter has limitations compared to traditional key-value stores:
 * - List operations use client-side filtering
 * - No native list data structure support
 * - Payload size limits may affect large values
 *
 * For vector-specific operations, use the vector methods directly.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { chunkArray } from '../../utils/array';
import { QdrantClient } from './client';
import { KVOperations } from './operations/kv';
import {
  Payload,
  QdrantAdapterOptions,
  QdrantBatchResult,
  QdrantCollectionConfig,
  QdrantCollectionInfo,
  QdrantDistance,
  QdrantFilter,
  QdrantPoint,
  QdrantScrollParams,
  QdrantScrollResponse,
  QdrantSearchParams,
  QdrantSearchResult,
  QdrantStorageAdapter
} from './types';

// Export types
export type {
  QdrantAdapterOptions,
  QdrantCollectionConfig,
  QdrantPoint,
  QdrantSearchParams,
  QdrantSearchResult,
  QdrantFilter
};

/**
 * Default collection configuration for storage operations
 */
const DEFAULT_STORAGE_COLLECTION = 'agentdock-storage';
const DEFAULT_VECTOR_DIMENSION = 384;

/**
 * Qdrant storage adapter
 */
export class QdrantAdapter
  extends BaseStorageAdapter
  implements QdrantStorageAdapter
{
  private client: QdrantClient;
  private kvOps?: KVOperations;
  private options: Required<QdrantAdapterOptions>;
  private initialized = false;

  constructor(options: QdrantAdapterOptions) {
    super();

    if (!options.host) {
      throw new Error('Qdrant host is required');
    }

    this.options = {
      host: options.host,
      port: options.port || 6333,
      https: options.https || false,
      apiKey: options.apiKey || '',
      defaultCollection:
        options.defaultCollection || DEFAULT_STORAGE_COLLECTION,
      namespace: options.namespace || 'default',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100
    };

    this.client = new QdrantClient({
      host: this.options.host,
      port: this.options.port,
      https: this.options.https,
      apiKey: this.options.apiKey || undefined,
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
      // Check if default collection exists
      const exists = await this.client.collectionExists(
        this.options.defaultCollection
      );

      if (!exists) {
        // Create default collection for storage operations
        await this.createCollection({
          name: this.options.defaultCollection,
          vectors: {
            size: DEFAULT_VECTOR_DIMENSION,
            distance: QdrantDistance.COSINE
          },
          // Optimize for storage operations
          on_disk_payload: true,
          hnsw_config: {
            m: 16,
            ef_construct: 100,
            full_scan_threshold: 10000
          }
        });

        // Create indexes for common fields
        await this.client.createFieldIndex(
          this.options.defaultCollection,
          '_storage_type',
          'keyword'
        );
        await this.client.createFieldIndex(
          this.options.defaultCollection,
          '_namespace',
          'keyword'
        );
        await this.client.createFieldIndex(
          this.options.defaultCollection,
          '_ttl_expires',
          'integer'
        );
      }

      // Initialize KV operations
      this.kvOps = new KVOperations(
        this.client,
        this.options.defaultCollection,
        this.options.namespace,
        DEFAULT_VECTOR_DIMENSION
      );

      this.initialized = true;
      logger.info(LogCategory.STORAGE, 'QdrantAdapter', 'Adapter initialized', {
        host: this.options.host,
        defaultCollection: this.options.defaultCollection,
        namespace: this.options.namespace
      });
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'QdrantAdapter',
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
      'QdrantAdapter',
      'List operations are not supported in Qdrant adapter'
    );
    return null;
  }

  async saveList<T>(): Promise<void> {
    logger.warn(
      LogCategory.STORAGE,
      'QdrantAdapter',
      'List operations are not supported in Qdrant adapter'
    );
  }

  async deleteList(): Promise<boolean> {
    logger.warn(
      LogCategory.STORAGE,
      'QdrantAdapter',
      'List operations are not supported in Qdrant adapter'
    );
    return false;
  }

  // ========== Vector Operations ==========

  async createCollection(config: QdrantCollectionConfig): Promise<void> {
    await this.client.createCollection(config);
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection(name);
  }

  async listCollections(): Promise<string[]> {
    return this.client.listCollections();
  }

  async getCollectionInfo(name: string): Promise<QdrantCollectionInfo> {
    return this.client.getCollectionInfo(name);
  }

  async upsertPoints(
    collection: string,
    points: QdrantPoint[]
  ): Promise<QdrantBatchResult> {
    // Process in batches
    const batches = chunkArray(points, this.options.batchSize);
    const allIds: Array<string | number> = [];

    for (const batch of batches) {
      const result = await this.client.upsertPoints(collection, batch);
      if (result.ids) {
        allIds.push(...result.ids);
      }
    }

    return {
      status: 'completed',
      ids: allIds
    };
  }

  async searchPoints(
    collection: string,
    vector: number[],
    params?: QdrantSearchParams
  ): Promise<QdrantSearchResult[]> {
    return this.client.searchPoints(collection, vector, params);
  }

  async retrievePoints(
    collection: string,
    ids: Array<string | number>,
    withPayload: boolean | string[] = true,
    withVector: boolean | string[] = false
  ): Promise<QdrantPoint[]> {
    // Qdrant has a limit on retrieve size
    const maxRetrieveSize = 1000;

    if (ids.length <= maxRetrieveSize) {
      return this.client.retrievePoints(
        collection,
        ids,
        withPayload,
        withVector
      );
    }

    // Process in batches
    const result: QdrantPoint[] = [];
    const batches = chunkArray(ids, maxRetrieveSize);

    for (const batch of batches) {
      const batchResult = await this.client.retrievePoints(
        collection,
        batch,
        withPayload,
        withVector
      );
      result.push(...batchResult);
    }

    return result;
  }

  async updatePayload(
    collection: string,
    points: Array<{
      id: string | number;
      payload: Payload;
    }>
  ): Promise<QdrantBatchResult> {
    // Process in batches
    const batches = chunkArray(points, this.options.batchSize);
    const allIds: Array<string | number> = [];

    for (const batch of batches) {
      const result = await this.client.updatePayload(collection, batch);
      if (result.ids) {
        allIds.push(...result.ids);
      }
    }

    return {
      status: 'completed',
      ids: allIds
    };
  }

  async deletePoints(
    collection: string,
    ids: Array<string | number>
  ): Promise<QdrantBatchResult> {
    // Process in batches
    const batches = chunkArray(ids, this.options.batchSize);
    const allIds: Array<string | number> = [];

    for (const batch of batches) {
      const result = await this.client.deletePoints(collection, batch);
      if (result.ids) {
        allIds.push(...result.ids);
      }
    }

    return {
      status: 'completed',
      ids: allIds
    };
  }

  async scrollPoints(
    collection: string,
    params?: QdrantScrollParams
  ): Promise<QdrantScrollResponse> {
    return this.client.scrollPoints(collection, params);
  }

  async countPoints(
    collection: string,
    filter?: QdrantFilter
  ): Promise<number> {
    return this.client.countPoints(collection, filter);
  }

  // ========== TTL Cleanup ==========

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<void> {
    await this.ensureInitialized();

    // Delete all points where TTL has expired
    const filter: QdrantFilter = {
      must: [
        {
          key: '_ttl_expires',
          range: {
            lt: Date.now()
          }
        }
      ]
    };

    await this.client.deletePointsByFilter(
      this.options.defaultCollection,
      filter
    );

    logger.debug(
      LogCategory.STORAGE,
      'QdrantAdapter',
      'Cleaned up expired entries'
    );
  }

  // ========== Cleanup ==========

  async close(): Promise<void> {
    // No persistent connections to close
    this.initialized = false;
    logger.info(LogCategory.STORAGE, 'QdrantAdapter', 'Adapter closed');
  }

  async destroy(): Promise<void> {
    await this.close();
  }
}
