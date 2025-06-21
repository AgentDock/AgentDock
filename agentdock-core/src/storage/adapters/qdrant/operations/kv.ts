/**
 * @fileoverview Key-value operations for Qdrant adapter
 *
 * Since Qdrant is a vector database, we implement KV operations
 * by storing serialized values in payloads with generated vectors.
 */

import { createHash } from 'crypto';

import { LogCategory, logger } from '../../../../logging';
import { ListOptions, StorageOptions } from '../../../types';
import { KeyManager } from '../../../utils/key-manager';
import { SerializationManager } from '../../../utils/serialization';
import { QdrantClient } from '../client';
import { Payload, QdrantFilter, QdrantPoint, StorageMetadata } from '../types';

/**
 * KV operations for Qdrant
 */
export class KVOperations {
  private client: QdrantClient;
  private keyManager: KeyManager;
  private serialization: SerializationManager;
  private defaultCollection: string;
  private defaultNamespace: string;
  private vectorDimension: number;

  constructor(
    client: QdrantClient,
    defaultCollection: string,
    namespace: string,
    vectorDimension = 384 // Default dimension for storage vectors
  ) {
    this.client = client;
    this.defaultCollection = defaultCollection;
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
   * Create a point ID from a key
   */
  private createPointId(key: string): string {
    // Qdrant supports string IDs, we'll use a hash of the key
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.keyManager.createKey(key, options?.namespace);
    const pointId = this.createPointId(fullKey);

    try {
      const points = await this.client.retrievePoints(
        this.defaultCollection,
        [pointId],
        true, // with payload
        false // without vector
      );

      if (!points.length || !points[0].payload) {
        return null;
      }

      const payload = points[0].payload;

      // Check if it's a storage metadata
      if (!payload._storage_type || payload._storage_type !== 'kv') {
        return null;
      }

      // Check TTL
      if (
        payload._ttl_expires &&
        typeof payload._ttl_expires === 'number' &&
        payload._ttl_expires < Date.now()
      ) {
        await this.delete(key, options);
        return null;
      }

      // Deserialize value
      if (payload._value && typeof payload._value === 'string') {
        return JSON.parse(payload._value) as T;
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }

      logger.error(LogCategory.STORAGE, 'QdrantKV', 'Failed to get value', {
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
    const pointId = this.createPointId(fullKey);

    const payload: Payload = {
      _storage_type: 'kv',
      _key: fullKey,
      _namespace: options?.namespace || this.defaultNamespace,
      _value: JSON.stringify(value),
      _type: typeof value
    };

    // Add TTL if specified
    if (options?.ttlSeconds) {
      payload._ttl_expires = Date.now() + options.ttlSeconds * 1000;
    }

    const point: QdrantPoint = {
      id: pointId,
      vector: this.generateVectorFromKey(fullKey),
      payload
    };

    await this.client.upsertPoints(this.defaultCollection, [point]);

    logger.debug(LogCategory.STORAGE, 'QdrantKV', 'Value set', {
      key,
      ttl: options?.ttlSeconds
    });
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const fullKey = this.keyManager.createKey(key, options?.namespace);
    const pointId = this.createPointId(fullKey);

    try {
      // Check if exists first
      const exists = await this.exists(key, options);
      if (!exists) {
        return false;
      }

      await this.client.deletePoints(this.defaultCollection, [pointId]);

      logger.debug(LogCategory.STORAGE, 'QdrantKV', 'Value deleted', { key });
      return true;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'QdrantKV', 'Failed to delete value', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });
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
    const namespace = options?.namespace || this.defaultNamespace;
    const fullPrefix = this.keyManager.createKey(prefix, namespace);

    // Create a filter for the prefix
    const filter: QdrantFilter = {
      must: [
        {
          key: '_storage_type',
          match: { value: 'kv' }
        },
        {
          key: '_namespace',
          match: { value: namespace }
        }
      ]
    };

    // Qdrant doesn't support prefix matching directly
    // We'll use scroll to get all points and filter client-side
    const keys: string[] = [];
    let offset: string | number | undefined;

    try {
      do {
        const response = await this.client.scrollPoints(
          this.defaultCollection,
          {
            offset,
            limit: options?.limit || 1000,
            with_payload: ['_key'],
            filter
          }
        );

        for (const point of response.points) {
          if (
            point.payload?._key &&
            typeof point.payload._key === 'string' &&
            point.payload._key.startsWith(fullPrefix)
          ) {
            // Extract the base key without namespace
            const parts = this.keyManager.extractNamespace(point.payload._key);
            keys.push(parts.baseKey);
          }
        }

        offset = response.next_page_offset;

        // If we have enough keys, stop
        if (options?.limit && keys.length >= options.limit) {
          return keys.slice(0, options.limit);
        }
      } while (offset !== null && offset !== undefined);

      return keys;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'QdrantKV', 'Failed to list keys', {
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
    const namespace = this.defaultNamespace;

    if (!prefix) {
      // Clear entire namespace
      const filter: QdrantFilter = {
        must: [
          {
            key: '_storage_type',
            match: { value: 'kv' }
          },
          {
            key: '_namespace',
            match: { value: namespace }
          }
        ]
      };

      await this.client.deletePointsByFilter(this.defaultCollection, filter);

      logger.info(LogCategory.STORAGE, 'QdrantKV', 'Namespace cleared', {
        namespace
      });
    } else {
      // Delete by prefix - need to list and delete individually
      const keys = await this.list(prefix, { limit: 10000 });

      if (keys.length > 0) {
        const pointIds = keys.map((key) => {
          const fullKey = this.keyManager.createKey(key, namespace);
          return this.createPointId(fullKey);
        });

        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < pointIds.length; i += batchSize) {
          const batch = pointIds.slice(i, i + batchSize);
          await this.client.deletePoints(this.defaultCollection, batch);
        }

        logger.info(LogCategory.STORAGE, 'QdrantKV', 'Cleared by prefix', {
          prefix,
          count: keys.length
        });
      }
    }
  }
}
