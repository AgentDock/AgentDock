/**
 * @fileoverview SQLite storage adapter implementation
 *
 * This is the default storage adapter for AgentDock OSS, providing
 * zero-config persistent storage using SQLite.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { SQLiteConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { SQLiteAdapterOptions, SQLiteConnection } from './types';

// Export types
export type { SQLiteAdapterOptions } from './types';

/**
 * SQLite storage adapter - Zero-config persistent storage
 */
export class SQLiteAdapter extends BaseStorageAdapter {
  private connectionManager: SQLiteConnectionManager;
  private connection?: SQLiteConnection;

  // Operation handlers
  private kvOps!: KVOperations;
  private listOps!: ListOperations;
  private batchOps!: BatchOperations;

  constructor(options: SQLiteAdapterOptions = {}) {
    super();
    this.connectionManager = new SQLiteConnectionManager(options);
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    this.connection = await this.connectionManager.getConnection();

    // Initialize operation handlers
    this.kvOps = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batchOps = new BatchOperations(this.connection);

    logger.info(LogCategory.STORAGE, 'SQLiteAdapter', 'Adapter initialized');
  }

  /**
   * Close the adapter
   */
  async close(): Promise<void> {
    await this.connectionManager.close();
    logger.info(LogCategory.STORAGE, 'SQLiteAdapter', 'Adapter closed');
  }

  /**
   * Clean up and close the database
   */
  async destroy(): Promise<void> {
    await this.close();
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    return this.kvOps.get<T>(key, options);
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    return this.kvOps.set<T>(key, value, options);
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    return this.kvOps.delete(key, options);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    return this.kvOps.exists(key, options);
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    return this.batchOps.getMany<T>(keys, options);
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    return this.batchOps.setMany<T>(items, options);
  }

  /**
   * Delete multiple values at once
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    return this.batchOps.deleteMany(keys, options);
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    return this.kvOps.list(prefix, options);
  }

  /**
   * Clear all data or data with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    // Clear KV data
    await this.kvOps.clear(prefix);

    // Clear list data
    await this.listOps.clearLists(prefix);
  }

  /**
   * Get a range of elements from a list
   */
  async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1,
    options?: StorageOptions
  ): Promise<T[] | null> {
    return this.listOps.getList<T>(key, start, end, options);
  }

  /**
   * Save an entire list
   */
  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    return this.listOps.saveList<T>(key, values, options);
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    return this.listOps.deleteList(key, options);
  }
}
