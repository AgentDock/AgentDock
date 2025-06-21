/**
 * @fileoverview ChromaDB vector database adapter
 *
 * This adapter provides key-value storage on top of ChromaDB's vector database.
 * ChromaDB is an open-source embedding database that makes it easy to build
 * LLM apps by providing a simple API for storing and querying embeddings.
 *
 * Note: This adapter has limitations compared to traditional key-value stores:
 * - KV operations require vector embeddings (auto-generated)
 * - List operations are not supported efficiently
 * - Prefix matching requires client-side filtering
 *
 * For vector-specific operations, use the vector methods directly.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { chunkArray } from '../../utils/array';
import { ChromaDBClient } from './client';
import { KVOperations } from './operations/kv';
import {
  ChromaCollectionInfo,
  ChromaCollectionMetadata,
  ChromaDBAdapterOptions,
  ChromaDBStorageAdapter,
  ChromaDocument,
  ChromaEmbeddingFunction,
  ChromaGetResult,
  ChromaInclude,
  ChromaQueryParams,
  ChromaQueryResult,
  ChromaWhereDocumentFilter,
  ChromaWhereFilter,
  DefaultEmbeddingFunction
} from './types';

// Export types
export type {
  ChromaDBAdapterOptions,
  ChromaCollectionInfo,
  ChromaDocument,
  ChromaQueryParams,
  ChromaQueryResult,
  ChromaWhereFilter
};

/**
 * Default collection name for storage operations
 */
const DEFAULT_STORAGE_COLLECTION = 'agentdock-storage';
const DEFAULT_VECTOR_DIMENSION = 384;

/**
 * ChromaDB storage adapter
 */
export class ChromaDBAdapter
  extends BaseStorageAdapter
  implements ChromaDBStorageAdapter
{
  private client: ChromaDBClient;
  private kvOps?: KVOperations;
  private options: Required<ChromaDBAdapterOptions>;
  private embeddingFunction: ChromaEmbeddingFunction;
  private initialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: ChromaDBAdapterOptions) {
    super();

    this.options = {
      host: options.host || 'http://localhost:8000',
      authToken: options.authToken || '',
      defaultCollection:
        options.defaultCollection || DEFAULT_STORAGE_COLLECTION,
      namespace: options.namespace || 'default',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100,
      embeddingFunction:
        options.embeddingFunction ||
        new DefaultEmbeddingFunction(DEFAULT_VECTOR_DIMENSION)
    };

    this.embeddingFunction = this.options.embeddingFunction;

    this.client = new ChromaDBClient({
      host: this.options.host,
      authToken: this.options.authToken || undefined,
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
      // Check health
      const isHealthy = await this.client.healthCheck();
      if (!isHealthy) {
        throw new Error('ChromaDB server is not healthy');
      }

      // Check if default collection exists
      const exists = await this.client.collectionExists(
        this.options.defaultCollection
      );

      if (!exists) {
        // Create default collection for storage operations
        await this.createCollection(this.options.defaultCollection, {
          description: 'AgentDock storage collection',
          type: 'storage'
        });
      }

      // Initialize KV operations
      this.kvOps = new KVOperations(
        this.client,
        this.options.defaultCollection,
        this.options.namespace,
        this.embeddingFunction
      );

      // Start cleanup interval (every 5 minutes)
      this.cleanupInterval = setInterval(
        () => {
          this.kvOps?.cleanupExpired().catch((error) => {
            logger.error(
              LogCategory.STORAGE,
              'ChromaDBAdapter',
              'Cleanup failed',
              {
                error: error instanceof Error ? error.message : String(error)
              }
            );
          });
        },
        5 * 60 * 1000
      );

      this.initialized = true;
      logger.info(
        LogCategory.STORAGE,
        'ChromaDBAdapter',
        'Adapter initialized',
        {
          host: this.options.host,
          defaultCollection: this.options.defaultCollection,
          namespace: this.options.namespace
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ChromaDBAdapter',
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
      'ChromaDBAdapter',
      'List operations are not supported in ChromaDB adapter'
    );
    return null;
  }

  async saveList<T>(): Promise<void> {
    logger.warn(
      LogCategory.STORAGE,
      'ChromaDBAdapter',
      'List operations are not supported in ChromaDB adapter'
    );
  }

  async deleteList(): Promise<boolean> {
    logger.warn(
      LogCategory.STORAGE,
      'ChromaDBAdapter',
      'List operations are not supported in ChromaDB adapter'
    );
    return false;
  }

  // ========== Vector Operations ==========

  async createCollection(
    name: string,
    metadata?: ChromaCollectionMetadata
  ): Promise<void> {
    await this.client.createCollection(name, metadata);
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection(name);
  }

  async listCollections(): Promise<ChromaCollectionInfo[]> {
    return this.client.listCollections();
  }

  async getCollection(name: string): Promise<ChromaCollectionInfo> {
    return this.client.getCollection(name);
  }

  async addDocuments(
    collection: string,
    documents: ChromaDocument[]
  ): Promise<void> {
    // Process in batches
    const batches = chunkArray(documents, this.options.batchSize);

    for (const batch of batches) {
      await this.client.addDocuments(collection, batch);
    }
  }

  async queryDocuments(
    collection: string,
    queryEmbeddings: number[][],
    params?: ChromaQueryParams
  ): Promise<ChromaQueryResult> {
    return this.client.queryDocuments(collection, queryEmbeddings, params);
  }

  async queryByText(
    collection: string,
    queryTexts: string[],
    params?: ChromaQueryParams
  ): Promise<ChromaQueryResult> {
    // Generate embeddings for query texts
    const embeddings = await this.embeddingFunction.generate(queryTexts);
    return this.queryDocuments(collection, embeddings, params);
  }

  async getDocuments(
    collection: string,
    ids: string[],
    include?: ChromaInclude[]
  ): Promise<ChromaGetResult> {
    // ChromaDB might have limits on get size
    const maxGetSize = 1000;

    if (ids.length <= maxGetSize) {
      return this.client.getDocuments(collection, ids, include);
    }

    // Process in batches and merge results
    const batches = chunkArray(ids, maxGetSize);
    const results: ChromaGetResult = {
      ids: [],
      documents: [],
      metadatas: [],
      embeddings: []
    };

    for (const batch of batches) {
      const batchResult = await this.client.getDocuments(
        collection,
        batch,
        include
      );
      results.ids.push(...batchResult.ids);
      results.documents.push(...batchResult.documents);
      results.metadatas.push(...batchResult.metadatas);
      results.embeddings.push(...batchResult.embeddings);
    }

    return results;
  }

  async updateDocuments(
    collection: string,
    ids: string[],
    metadatas?: Record<string, string | number | boolean>[],
    documents?: string[],
    embeddings?: number[][]
  ): Promise<void> {
    await this.client.updateDocuments(
      collection,
      ids,
      metadatas,
      documents,
      embeddings
    );
  }

  async deleteDocuments(
    collection: string,
    ids?: string[],
    where?: ChromaWhereFilter,
    whereDocument?: ChromaWhereDocumentFilter
  ): Promise<string[]> {
    if (ids && ids.length > this.options.batchSize) {
      // Process in batches
      const batches = chunkArray(ids, this.options.batchSize);
      const allDeleted: string[] = [];

      for (const batch of batches) {
        const deleted = await this.client.deleteDocuments(collection, batch);
        allDeleted.push(...deleted);
      }

      return allDeleted;
    }

    return this.client.deleteDocuments(collection, ids, where, whereDocument);
  }

  async countDocuments(collection: string): Promise<number> {
    return this.client.countDocuments(collection);
  }

  async peekDocuments(
    collection: string,
    limit?: number
  ): Promise<ChromaGetResult> {
    return this.client.peekDocuments(collection, limit);
  }

  // ========== TTL Cleanup ==========

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<void> {
    await this.ensureInitialized();
    await this.kvOps!.cleanupExpired();
  }

  // ========== Cleanup ==========

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.initialized = false;
    logger.info(LogCategory.STORAGE, 'ChromaDBAdapter', 'Adapter closed');
  }

  async destroy(): Promise<void> {
    await this.close();
  }
}
