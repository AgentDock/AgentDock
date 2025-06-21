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
import type { MongoConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { MongoConnection, MongoDBConfig } from './types';

export class MongoDBAdapter extends BaseStorageAdapter {
  private connectionManager?: MongoConnectionManager;
  private connection?: MongoConnection;

  // Operation handlers
  private kvOps!: KVOperations;
  private listOps!: ListOperations;
  private batchOps!: BatchOperations;

  constructor(private config: MongoDBConfig) {
    super();
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    try {
      // Lazy load MongoDB connection manager
      const { MongoConnectionManager: ConnManager } = await import(
        './connection'
      );
      this.connectionManager = new ConnManager(this.config);
    } catch (error) {
      throw new Error(
        'MongoDB driver not found. Please install it with: npm install mongodb'
      );
    }

    this.connection = await this.connectionManager.getConnection();

    // Initialize operation handlers
    this.kvOps = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batchOps = new BatchOperations(this.connection);

    logger.info(LogCategory.STORAGE, 'MongoDBAdapter', 'Adapter initialized', {
      database: this.config.database,
      collection: this.config.collection || 'agentdock_kv',
      namespace: this.config.namespace
    });
  }

  /**
   * Close the adapter
   */
  async close(): Promise<void> {
    if (this.connectionManager) {
      await this.connectionManager.close();
    }
    logger.info(LogCategory.STORAGE, 'MongoDBAdapter', 'Adapter closed');
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.close();
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.ensureInitialized();
    return this.kvOps.get<T>(key, options);
  }

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.ensureInitialized();
    return this.kvOps.set<T>(key, value, options);
  }

  /**
   * Delete a value by key
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps.delete(key, options);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps.exists(key, options);
  }

  /**
   * Get multiple values
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.ensureInitialized();
    return this.batchOps.getMany<T>(keys, options);
  }

  /**
   * Set multiple values
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    return this.batchOps.setMany<T>(items, options);
  }

  /**
   * Delete multiple values
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.ensureInitialized();
    return this.batchOps.deleteMany(keys, options);
  }

  /**
   * List keys matching a prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    await this.ensureInitialized();
    return this.kvOps.list(prefix, options);
  }

  /**
   * Clear all data or data matching a prefix
   */
  async clear(prefix?: string): Promise<void> {
    await this.ensureInitialized();

    // Clear KV data
    await this.kvOps.clear(prefix);

    // Clear list data if no prefix (clear everything)
    if (!prefix) {
      await this.listOps.clear();
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
    return this.listOps.getList<T>(key, start, end, options);
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
    return this.listOps.saveList<T>(key, values, options);
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.listOps.deleteList(key, options);
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
