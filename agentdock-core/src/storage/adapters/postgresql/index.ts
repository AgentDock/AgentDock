/**
 * @fileoverview PostgreSQL storage adapter - Production-ready adapter for AgentDock
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import {
  MemoryOperations as IMemoryOperations,
  ListOptions,
  StorageOptions
} from '../../types';
import { PostgreSQLConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { MemoryOperations } from './operations/memory';
import { PostgreSQLAdapterOptions, PostgreSQLConnection } from './types';

// Export types
export type { PostgreSQLAdapterOptions } from './types';
export { BatchOperations } from './operations/batch';

/**
 * PostgreSQL storage adapter - Production-ready with ACID compliance
 */
export class PostgreSQLAdapter extends BaseStorageAdapter {
  private connectionManager: PostgreSQLConnectionManager;
  private connection?: PostgreSQLConnection;

  // Operation handlers
  private kvOps!: KVOperations;
  private listOps!: ListOperations;
  private batchOps!: BatchOperations;

  // Memory operations (optional)
  memory?: IMemoryOperations;

  private initPromise?: Promise<void>;

  constructor(options: PostgreSQLAdapterOptions = {}) {
    super();
    this.connectionManager = new PostgreSQLConnectionManager(options);
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
    this.connection = await this.connectionManager.getConnection();

    // Initialize operation handlers
    this.kvOps = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batchOps = new BatchOperations(this.connection);

    // Initialize memory operations if tables exist
    await this.initializeMemoryOperations();

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLAdapter',
      'Adapter initialized'
    );
  }

  /**
   * Initialize memory operations if memory tables exist
   */
  private async initializeMemoryOperations(): Promise<void> {
    if (!this.connection) return;

    try {
      // Check if memory tables exist
      const client = await this.connection.pool.connect();
      try {
        const result = await client.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 AND table_name = 'memories'
          )
        `,
          [this.connection.schema]
        );

        if (result.rows[0].exists) {
          // Initialize memory operations directly (no bridge)
          this.memory = new MemoryOperations(
            this.connection.pool,
            this.connection.schema
          );

          logger.info(
            LogCategory.STORAGE,
            'PostgreSQLAdapter',
            'Memory operations enabled',
            { schema: this.connection.schema }
          );
        } else {
          logger.debug(
            LogCategory.STORAGE,
            'PostgreSQLAdapter',
            'Memory tables not found - memory operations disabled',
            { schema: this.connection.schema }
          );
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'PostgreSQLAdapter',
        'Failed to check for memory tables',
        {
          error: error instanceof Error ? error.message : String(error),
          schema: this.connection.schema
        }
      );
      // Memory operations remain disabled
    }
  }

  /**
   * Close the adapter
   */
  async close(): Promise<void> {
    await this.connectionManager.close();
    logger.info(LogCategory.STORAGE, 'PostgreSQLAdapter', 'Adapter closed');
  }

  /**
   * Get a value from storage
   */
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.initialize();
    return this.kvOps.get<T>(key, options);
  }

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.initialize();
    return this.kvOps.set<T>(key, value, options);
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.initialize();
    return this.kvOps.delete(key, options);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.initialize();
    return this.kvOps.exists(key, options);
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.initialize();
    return this.batchOps.getMany<T>(keys, options);
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.initialize();
    return this.batchOps.setMany<T>(items, options);
  }

  /**
   * Delete multiple values at once
   */
  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.initialize();
    return this.batchOps.deleteMany(keys, options);
  }

  /**
   * List keys with a given prefix
   */
  async list(prefix: string, options?: ListOptions): Promise<string[]> {
    await this.initialize();
    return this.kvOps.list(prefix, options);
  }

  /**
   * Clear all data or data with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    await this.initialize();

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
    await this.initialize();
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
    await this.initialize();
    return this.listOps.saveList<T>(key, values, options);
  }

  /**
   * Delete a list
   */
  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    await this.initialize();
    return this.listOps.deleteList(key, options);
  }

  /**
   * Clean up and close the database
   */
  async destroy(): Promise<void> {
    await this.close();
  }
}
