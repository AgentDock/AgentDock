/**
 * @fileoverview Cloudflare KV storage adapter implementation
 *
 * Edge-compatible storage adapter for Cloudflare Workers KV.
 * Provides globally distributed, eventually consistent storage.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import { ListOptions, StorageOptions } from '../../types';
import { CloudflareKVConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { CloudflareKVAdapterOptions, CloudflareKVConnection } from './types';

// Export types
export type { CloudflareKVAdapterOptions, KVNamespace } from './types';

/**
 * Cloudflare KV storage adapter - Edge-native distributed storage
 *
 * Features:
 * - Global distribution with low-latency reads
 * - Eventually consistent writes (60s globally)
 * - Native TTL support
 * - Metadata storage for type preservation
 * - Cloudflare Workers integration
 */
export class CloudflareKVAdapter extends BaseStorageAdapter {
  private connectionManager: CloudflareKVConnectionManager;
  private connection!: CloudflareKVConnection;

  // Operation handlers
  private kvOps!: KVOperations;
  private listOps!: ListOperations;
  private batchOps!: BatchOperations;

  constructor(options: CloudflareKVAdapterOptions) {
    super();
    if (!options.kvNamespace) {
      throw new Error('CloudflareKV adapter requires kvNamespace');
    }
    this.connectionManager = new CloudflareKVConnectionManager(options);
    this.initialize();
  }

  /**
   * Initialize the adapter
   */
  private initialize(): void {
    this.connection = this.connectionManager.getConnection();

    // Initialize operation handlers
    this.kvOps = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batchOps = new BatchOperations(this.connection);

    logger.info(LogCategory.STORAGE, 'CloudflareKV', 'Adapter initialized', {
      hasDefaultNamespace: !!this.connection.defaultNamespace,
      storeTypeMetadata: this.connection.storeTypeMetadata
    });
  }

  // Key-value operations
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    return this.kvOps.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    return this.kvOps.set(key, value, options);
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    return this.kvOps.delete(key, options);
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    return this.kvOps.exists(key, options);
  }

  async clear(prefix?: string): Promise<void> {
    return this.kvOps.clear(prefix);
  }

  // Batch operations
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    return this.batchOps.getMany<T>(keys, options);
  }

  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    return this.batchOps.setMany(items, options);
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    return this.batchOps.deleteMany(keys, options);
  }

  // List operations
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    return this.listOps.list(prefix, options);
  }

  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    return this.listOps.getList<T>(key, start, end, options);
  }

  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    return this.listOps.saveList(key, values, options);
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    return this.listOps.deleteList(key, options);
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
  withNamespace(namespace: string): CloudflareKVAdapter {
    return new CloudflareKVAdapter({
      kvNamespace: this.connection.kv,
      namespace,
      defaultTtl: this.connection.defaultTtl,
      storeTypeMetadata: this.connection.storeTypeMetadata
    });
  }
}
