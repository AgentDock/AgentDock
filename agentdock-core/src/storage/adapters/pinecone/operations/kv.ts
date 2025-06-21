/**
 * @fileoverview Key-value operations for Pinecone adapter
 *
 * Since Pinecone is a vector database, we implement KV operations
 * by storing serialized values in metadata with a generated vector.
 */

import { createHash } from 'crypto';

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { KeyManager } from '../../../utils/key-manager';
import { SerializationManager } from '../../../utils/serialization';
import { PineconeClient } from '../client';
import { PineconeVector, StorageMetadata } from '../types';

/**
 * KV operations for Pinecone
 */
export class KVOperations {
  private client: PineconeClient;
  private keyManager: KeyManager;
  private serialization: SerializationManager;
  private defaultIndex: string;
  private defaultNamespace: string;
  private vectorDimension: number;

  constructor(
    client: PineconeClient,
    defaultIndex: string,
    namespace: string,
    vectorDimension = 384 // Default dimension for storage vectors
  ) {
    this.client = client;
    this.defaultIndex = defaultIndex;
    this.defaultNamespace = namespace;
    this.vectorDimension = vectorDimension;
    this.keyManager = new KeyManager();
    this.serialization = new SerializationManager();
  }

  /**
   * Generate a deterministic vector from a key
   * This ensures the same key always maps to the same vector
   */
  private generateVectorFromKey(key: string): number[] {
    const hash = createHash('sha256').update(key).digest();
    const vector: number[] = [];

    // Generate a deterministic vector from the hash
    for (let i = 0; i < this.vectorDimension; i++) {
      const byte = hash[i % hash.length];
      // Normalize to [-1, 1] range
      vector.push((byte / 255) * 2 - 1);
    }

    return vector;
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.keyManager.createKey(key, options?.namespace);
    const vectorId = this.createVectorId(fullKey);

    try {
      const result = await this.client.fetchVectors(
        this.defaultIndex,
        [vectorId],
        this.getNamespace(options)
      );

      const vector = result[vectorId];
      if (!vector?.metadata) {
        return null;
      }

      const metadata = vector.metadata as StorageMetadata;

      // Check TTL
      if (metadata._ttl_expires && metadata._ttl_expires < Date.now()) {
        await this.delete(key, options);
        return null;
      }

      // Deserialize value
      if (metadata._value) {
        return this.serialization.deserialize<T>(metadata._value);
      }

      return null;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PineconeKV', 'Failed to get value', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.keyManager.createKey(key, options?.namespace);
    const vectorId = this.createVectorId(fullKey);

    const metadata: StorageMetadata = {
      _storage_type: 'kv',
      _key: fullKey,
      _namespace: options?.namespace || this.defaultNamespace,
      _value: JSON.stringify(value),
      _type: typeof value
    };

    // Add TTL if specified
    if (options?.ttlSeconds) {
      metadata._ttl_expires = Date.now() + options.ttlSeconds * 1000;
    }

    const vector: PineconeVector = {
      id: vectorId,
      values: this.generateVectorFromKey(fullKey),
      metadata
    };

    await this.client.upsertVectors(
      this.defaultIndex,
      [vector],
      this.getNamespace(options)
    );

    logger.debug(LogCategory.STORAGE, 'PineconeKV', 'Value set', {
      key,
      ttl: options?.ttlSeconds
    });
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.keyManager.createKey(key, options?.namespace);
    const vectorId = this.createVectorId(fullKey);

    try {
      // Check if exists first
      const exists = await this.exists(key, options);
      if (!exists) {
        return false;
      }

      await this.client.deleteVectors(
        this.defaultIndex,
        [vectorId],
        this.getNamespace(options)
      );

      logger.debug(LogCategory.STORAGE, 'PineconeKV', 'Value deleted', { key });
      return true;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PineconeKV',
        'Failed to delete value',
        {
          key,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    // Pinecone doesn't support prefix listing directly
    // We need to query all vectors and filter client-side
    try {
      const stats = await this.client.getIndexStats(this.defaultIndex);
      const namespace = this.getNamespace(options);
      const namespaceStats = stats.namespaces[namespace || ''];

      if (!namespaceStats || namespaceStats.vectorCount === 0) {
        return [];
      }

      // For listing, we need to implement a workaround
      // This is not efficient for large datasets
      logger.warn(
        LogCategory.STORAGE,
        'PineconeKV',
        'List operation is inefficient in Pinecone - consider using a different storage adapter for heavy list operations'
      );

      // Return empty array for now - full implementation would require
      // maintaining a separate index or using metadata filters
      return [];
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'PineconeKV', 'Failed to list keys', {
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Clear all data or data with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      // Clear entire namespace
      await this.client.deleteAllVectors(
        this.defaultIndex,
        this.getNamespace()
      );

      logger.info(LogCategory.STORAGE, 'PineconeKV', 'Namespace cleared');
    } else {
      // Pinecone doesn't support prefix-based deletion
      logger.warn(
        LogCategory.STORAGE,
        'PineconeKV',
        'Prefix-based clear not supported - use clear() without prefix to clear entire namespace'
      );
    }
  }

  /**
   * Create a vector ID from a key
   */
  private createVectorId(key: string): string {
    // Pinecone IDs must be strings, we'll use a hash of the key
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get namespace for operations
   */
  private getNamespace(options?: StorageOptions): string | undefined {
    return options?.namespace || this.defaultNamespace || undefined;
  }
}
