/**
 * @fileoverview Key-value operations for ChromaDB adapter
 */

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageMetadata, StorageOptions } from '../../../types';
import { ChromaDBClient } from '../client';
import {
  ChromaDocument,
  ChromaEmbeddingFunction,
  ChromaInclude,
  ChromaLogicalFilter,
  ChromaWhereFilter
} from '../types';

/**
 * Key-value operations for ChromaDB
 */
export class KVOperations {
  constructor(
    private client: ChromaDBClient,
    private collection: string,
    private namespace: string,
    private embeddingFunction: ChromaEmbeddingFunction
  ) {}

  /**
   * Generate document ID from key
   */
  private getDocumentId(key: string): string {
    return `${this.namespace}:kv:${key}`;
  }

  /**
   * Create storage metadata
   */
  private createMetadata(
    key: string,
    value: unknown,
    ttl?: number
  ): Record<string, string | number | boolean> {
    const metadata: Record<string, string | number | boolean> = {
      _storage_type: 'kv',
      _key: key,
      _namespace: this.namespace,
      _value: JSON.stringify(value),
      _type: typeof value,
      _created: Date.now(),
      _updated: Date.now()
    };

    if (ttl) {
      metadata._ttl_expires = Date.now() + ttl;
    }

    return metadata;
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const namespace = options?.namespace || this.namespace;
    const docId = `${namespace}:kv:${key}`;

    try {
      const result = await this.client.getDocuments(
        this.collection,
        [docId],
        [ChromaInclude.METADATAS]
      );

      if (!result.metadatas[0]) {
        return null;
      }

      const metadata = result.metadatas[0];

      // Check TTL
      if (
        metadata._ttl_expires &&
        typeof metadata._ttl_expires === 'number' &&
        metadata._ttl_expires < Date.now()
      ) {
        await this.delete(key, options);
        return null;
      }

      // Parse value
      if (metadata._value && typeof metadata._value === 'string') {
        return JSON.parse(metadata._value) as T;
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set a value
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const namespace = options?.namespace || this.namespace;
    const docId = `${namespace}:kv:${key}`;

    // Get TTL from options if provided (convert seconds to milliseconds)
    const ttl = options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined;
    const metadata = this.createMetadata(key, value, ttl);

    // Generate embedding for the key (as document content)
    const embeddings = await this.embeddingFunction.generate([key]);

    const document: ChromaDocument = {
      id: docId,
      document: key,
      embedding: embeddings[0],
      metadata: metadata
    };

    await this.client.upsertDocuments(this.collection, [document]);

    logger.debug(LogCategory.STORAGE, 'ChromaDB:KV', 'Value set', {
      key,
      namespace,
      ttl
    });
  }

  /**
   * Delete a value
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const namespace = options?.namespace || this.namespace;
    const docId = `${namespace}:kv:${key}`;

    try {
      const deletedIds = await this.client.deleteDocuments(this.collection, [
        docId
      ]);

      return deletedIds.length > 0;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * List keys with prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    // Validate prefix is provided
    if (!prefix) {
      logger.warn(
        LogCategory.STORAGE,
        'ChromaDB:KV',
        'List operation requires a prefix, empty prefix not supported'
      );
      return [];
    }

    const namespace = options?.namespace || this.namespace;

    // Build filter for namespace and prefix
    const filter: ChromaWhereFilter = {
      _namespace: { $eq: namespace },
      _storage_type: { $eq: 'kv' }
    };

    // ChromaDB limitation: No efficient prefix scanning due to vector-first design
    // This operation requires client-side filtering which is inefficient for large datasets
    try {
      const result = await this.client.peekDocuments(
        this.collection,
        options?.limit || 1000
      );

      const keys: string[] = [];
      const now = Date.now();

      // Client-side filtering (necessary due to ChromaDB's vector-first architecture)
      for (let i = 0; i < result.metadatas.length; i++) {
        const metadata = result.metadatas[i];

        if (!metadata) continue;

        // Check namespace and type
        if (
          metadata._namespace !== namespace ||
          metadata._storage_type !== 'kv'
        ) {
          continue;
        }

        // Check TTL expiration
        if (
          metadata._ttl_expires &&
          typeof metadata._ttl_expires === 'number' &&
          metadata._ttl_expires < now
        ) {
          continue;
        }

        // Check prefix match
        if (
          typeof metadata._key === 'string' &&
          metadata._key.startsWith(prefix)
        ) {
          keys.push(metadata._key);
        }
      }

      return keys.sort();
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'ChromaDB:KV', 'Failed to list keys', {
        error: error instanceof Error ? error.message : String(error),
        prefix,
        namespace
      });
      return [];
    }
  }

  /**
   * Clear all keys with optional prefix
   */
  async clear(prefix?: string): Promise<void> {
    const filter: ChromaWhereFilter = {
      _namespace: { $eq: this.namespace },
      _storage_type: { $eq: 'kv' }
    };

    if (prefix) {
      // Since ChromaDB doesn't support prefix matching,
      // we need to get all keys and delete matching ones
      const keys = await this.list(prefix);

      if (keys.length > 0) {
        const ids = keys.map((key) => `${this.namespace}:kv:${key}`);
        await this.client.deleteDocuments(this.collection, ids);
      }
    } else {
      // Delete all KV items in namespace
      await this.client.deleteDocuments(this.collection, undefined, filter);
    }

    logger.debug(LogCategory.STORAGE, 'ChromaDB:KV', 'Cleared keys', {
      namespace: this.namespace,
      prefix
    });
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<void> {
    const now = Date.now();

    // ChromaDB doesn't support complex queries on metadata,
    // so we need to scan and delete expired items
    try {
      const result = await this.client.peekDocuments(this.collection, 10000);
      const expiredIds: string[] = [];

      for (let i = 0; i < result.metadatas.length; i++) {
        const metadata = result.metadatas[i];

        if (!metadata) continue;

        if (
          metadata._ttl_expires &&
          typeof metadata._ttl_expires === 'number' &&
          metadata._ttl_expires < now
        ) {
          expiredIds.push(result.ids[i]);
        }
      }

      if (expiredIds.length > 0) {
        await this.client.deleteDocuments(this.collection, expiredIds);

        logger.debug(
          LogCategory.STORAGE,
          'ChromaDB:KV',
          'Cleaned up expired entries',
          {
            count: expiredIds.length
          }
        );
      }
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ChromaDB:KV',
        'Failed to cleanup expired entries',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}
