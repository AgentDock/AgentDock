/**
 * @fileoverview Cloudflare D1 storage adapter implementation
 *
 * Edge SQL database storage adapter for Cloudflare Workers D1.
 * Provides SQLite-compatible storage at the edge with global distribution.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { CloudflareD1ConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { CloudflareD1AdapterOptions, CloudflareD1Connection } from './types';

// Export types
export type { CloudflareD1AdapterOptions, D1Database } from './types';

/**
 * Cloudflare D1 storage adapter - Edge SQL database storage
 *
 * Features:
 * - SQLite-compatible API at the edge
 * - Global distribution with replication
 * - ACID transactions
 * - Batch operations
 * - TTL support with automatic cleanup
 * - Namespace isolation
 * - Zero-latency reads from edge locations
 */
export class CloudflareD1Adapter extends BaseStorageAdapter {
  private connectionManager: CloudflareD1ConnectionManager;
  private connection!: CloudflareD1Connection;

  // Operation handlers
  private kvOps!: KVOperations;
  private listOps!: ListOperations;
  private batchOps!: BatchOperations;

  private initPromise?: Promise<void>;

  constructor(options: CloudflareD1AdapterOptions) {
    super();
    if (!options.d1Database) {
      throw new Error('CloudflareD1 adapter requires d1Database');
    }
    this.connectionManager = new CloudflareD1ConnectionManager(options);
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    await this.connectionManager.initialize();
    this.connection = this.connectionManager.getConnection();

    // Initialize operation handlers
    this.kvOps = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batchOps = new BatchOperations(this.connection);

    logger.info(LogCategory.STORAGE, 'CloudflareD1', 'Adapter initialized', {
      kvTable: this.connection.kvTableName,
      listTable: this.connection.listTableName,
      hasDefaultNamespace: !!this.connection.defaultNamespace
    });
  }

  // Key-value operations
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.ensureInitialized();
    return this.kvOps.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.ensureInitialized();
    return this.kvOps.set(key, value, options);
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps.delete(key, options);
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.kvOps.exists(key, options);
  }

  async clear(prefix?: string): Promise<void> {
    await this.ensureInitialized();
    return this.kvOps.clear(prefix);
  }

  // Batch operations
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.ensureInitialized();
    return this.batchOps.getMany<T>(keys, options);
  }

  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    return this.batchOps.setMany(items, options);
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.ensureInitialized();
    return this.batchOps.deleteMany(keys, options);
  }

  // List operations
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    await this.ensureInitialized();
    return this.listOps.list(prefix, options);
  }

  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    await this.ensureInitialized();
    return this.listOps.getList<T>(key, start, end, options);
  }

  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    return this.listOps.saveList(key, values, options);
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    return this.listOps.deleteList(key, options);
  }

  /**
   * Ensure the adapter is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      await this.initialize();
    }
  }

  /**
   * Destroy the adapter and clean up resources
   */
  async destroy(): Promise<void> {
    await this.connectionManager.close();
  }

  /**
   * Get connection health status
   */
  async isHealthy(): Promise<boolean> {
    return this.connectionManager.isHealthy();
  }

  /**
   * Create a new adapter instance with a different namespace
   */
  withNamespace(namespace: string): CloudflareD1Adapter {
    return new CloudflareD1Adapter({
      d1Database: this.connection.db,
      namespace,
      kvTableName: this.connection.kvTableName,
      listTableName: this.connection.listTableName,
      enableCleanup: this.connection.enableCleanup,
      cleanupInterval: this.connection.cleanupInterval
    });
  }

  /**
   * Execute raw SQL query (D1-specific feature)
   */
  async exec(query: string): Promise<any> {
    await this.ensureInitialized();
    return this.connection.db.exec(query);
  }

  /**
   * Prepare a SQL statement (D1-specific feature)
   */
  async prepare(query: string): Promise<any> {
    await this.ensureInitialized();
    return this.connection.db.prepare(query);
  }
}
