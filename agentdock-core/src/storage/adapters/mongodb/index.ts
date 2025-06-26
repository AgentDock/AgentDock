/**
 * MongoDB storage adapter
 *
 * Provides MongoDB-based storage with native TTL support
 * and efficient document operations.
 *
 * Features:
 * - Native TTL support via MongoDB's expireAfterSeconds
 * - Document-based storage with flexible schemas
 * - Full-text search capabilities
 * - Atomic operations
 * - Connection pooling
 * - Custom indexing
 *
 * @module
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { KeyManager } from '../../utils/key-manager';
import { TTLManager } from '../../utils/ttl-manager';
import type { MongoConnectionManager } from './connection';
import { MongoBatchOperations } from './operations/batch';
import { MongoKVOperations } from './operations/kv';
import { MongoListOperations } from './operations/list';
import { MongoConnection, MongoDBConfig } from './types';

export interface MongoDBAdapterOptions extends StorageOptions {
  config: MongoDBConfig;
}

export class MongoDBAdapter extends BaseStorageAdapter {
  private config: MongoDBConfig;
  private connectionManager!: MongoConnectionManager;
  private connection!: MongoConnection;
  private kvOps!: MongoKVOperations;
  private listOps!: MongoListOperations;
  private batchOps!: MongoBatchOperations;
  private initPromise: Promise<void> | null = null;

  // Utility instances
  private keyManager: KeyManager;
  private ttlManager: TTLManager;
  private namespace?: string;

  // Namespace-specific operation caches
  private kvOpsCache = new Map<string, MongoKVOperations>();
  private batchOpsCache = new Map<string, MongoBatchOperations>();

  constructor(options: MongoDBAdapterOptions) {
    super();
    this.config = options.config;
    this.namespace = options.namespace;

    // Initialize utilities
    this.keyManager = new KeyManager();
    this.ttlManager = new TTLManager();
  }

  /**
   * Initialize the MongoDB connection
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      // Lazy load connection manager
      const { MongoConnectionManager } = await import('./connection');

      this.connectionManager = new MongoConnectionManager({
        uri: this.config.uri,
        database: this.config.database,
        collection: this.config.collection,
        options: this.config.options,
        indexes: this.config.indexes
      });

      this.connection = await this.connectionManager.getConnection();

      // Initialize operations
      this.kvOps = new MongoKVOperations(
        this.connection.kvCollection,
        this.keyManager,
        this.ttlManager,
        this.namespace
      );

      this.listOps = new MongoListOperations(
        this.connection.listCollection,
        this.keyManager,
        this.namespace
      );

      this.batchOps = new MongoBatchOperations(
        this.connection,
        this.keyManager,
        this.ttlManager,
        this.namespace
      );

      // MongoDB handles TTL automatically with expireAfterSeconds index
      // The TTL manager is already set up with automatic cleanup in its constructor

      await logger.info(
        LogCategory.STORAGE,
        'MongoDBAdapter',
        'MongoDB adapter initialized',
        {
          database: this.config.database,
          collection: this.config.collection || 'agentdock'
        }
      );
    } catch (error) {
      await logger.error(
        LogCategory.STORAGE,
        'MongoDBAdapter',
        'Failed to initialize MongoDB adapter',
        {
          error
        }
      );
      throw error;
    }
  }

  /**
   * Close the adapter
   */
  async close(): Promise<void> {
    if (this.connectionManager) {
      await this.connectionManager.close();
    }
    await logger.info(LogCategory.STORAGE, 'MongoDBAdapter', 'Adapter closed');
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.ttlManager.stopCleanupTimer();
    await this.close();
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.ensureInitialized();
    // MongoDB operations don't accept options parameter, handle namespace separately
    const actualNamespace = options?.namespace || this.namespace;
    if (actualNamespace !== this.namespace) {
      const kvOps = this.getKVOps(actualNamespace);
      return kvOps.get(key);
    }
    return this.kvOps.get(key);
  }

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.ensureInitialized();
    // Convert ttlSeconds to milliseconds
    const ttlMs = options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined;

    const actualNamespace = options?.namespace || this.namespace;
    if (actualNamespace !== this.namespace) {
      const kvOps = this.getKVOps(actualNamespace);
      return kvOps.set(key, value, ttlMs);
    }
    return this.kvOps.set(key, value, ttlMs);
  }

  /**
   * Delete a value by key
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    const actualNamespace = options?.namespace || this.namespace;
    if (actualNamespace !== this.namespace) {
      const kvOps = this.getKVOps(actualNamespace);
      return kvOps.delete(key);
    }
    return this.kvOps.delete(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    const actualNamespace = options?.namespace || this.namespace;
    if (actualNamespace !== this.namespace) {
      const kvOps = this.getKVOps(actualNamespace);
      return kvOps.exists(key);
    }
    return this.kvOps.exists(key);
  }

  /**
   * Get multiple values
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.ensureInitialized();
    const actualNamespace = options?.namespace || this.namespace;

    let batchOps = this.batchOps;
    if (actualNamespace !== this.namespace) {
      batchOps = this.getBatchOps(actualNamespace);
    }

    const values = await batchOps.mget(keys);
    const result: Record<string, T | null> = {};

    keys.forEach((key, index) => {
      result[key] = values[index] as T | null;
    });

    return result;
  }

  /**
   * Set multiple values
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    const actualNamespace = options?.namespace || this.namespace;
    const ttlMs = options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined;

    let batchOps = this.batchOps;
    if (actualNamespace !== this.namespace) {
      batchOps = this.getBatchOps(actualNamespace);
    }

    const pairs = Object.entries(items).map(([key, value]) => ({
      key,
      value,
      ttl: ttlMs
    }));

    await batchOps.mset(pairs);
  }

  /**
   * Delete multiple values
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.ensureInitialized();
    return this.batchOps.mdel(keys);
  }

  /**
   * List keys matching a prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    await this.ensureInitialized();
    return this.kvOps.keys(prefix);
  }

  /**
   * Clear all data or data matching a prefix
   */
  async clear(prefix?: string): Promise<void> {
    await this.ensureInitialized();

    // Clear KV data
    await this.kvOps.clear();

    // Clear list data if no prefix (clear everything)
    if (!prefix) {
      // MongoDB doesn't have a specific list clear method
      // It's handled by the clear method in KV operations
    }
  }

  /**
   * Get a list by key
   */
  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    await this.ensureInitialized();
    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = -1;
    }
    const range = await this.listOps.lrange(key, start, end);
    return range.length > 0 ? (range as T[]) : null;
  }

  /**
   * Save a list
   */
  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    // Clear existing list
    const fullKey = this.keyManager.createKey(key, this.namespace);
    await this.connection.listCollection.deleteOne({ _id: fullKey });

    // Add new values
    if (values.length > 0) {
      await this.listOps.rpush(key, ...values);
    }
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    const fullKey = this.keyManager.createKey(key, this.namespace);
    const result = await this.connection.listCollection.deleteOne({
      _id: fullKey
    });
    return result.deletedCount > 0;
  }

  /**
   * Get cached KV operations for namespace
   */
  private getKVOps(namespace?: string): MongoKVOperations {
    const key = namespace || 'default';
    let kvOps = this.kvOpsCache.get(key);
    if (!kvOps) {
      kvOps = new MongoKVOperations(
        this.connection.kvCollection,
        this.keyManager,
        this.ttlManager,
        namespace
      );
      this.kvOpsCache.set(key, kvOps);
    }
    return kvOps;
  }

  /**
   * Get cached batch operations for namespace
   */
  private getBatchOps(namespace?: string): MongoBatchOperations {
    const key = namespace || 'default';
    let batchOps = this.batchOpsCache.get(key);
    if (!batchOps) {
      batchOps = new MongoBatchOperations(
        this.connection,
        this.keyManager,
        this.ttlManager,
        namespace
      );
      this.batchOpsCache.set(key, batchOps);
    }
    return batchOps;
  }

  /**
   * Ensure adapter is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.connection || !this.connectionManager) {
      await this.initialize();
    }
  }
}

// Export types
export type { MongoDBConfig } from './types';
export type { MongoConnection } from './types';
