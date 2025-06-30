/**
 * @fileoverview SQLite storage adapter implementation
 *
 * This is the default storage adapter for AgentDock OSS, providing
 * zero-config persistent storage using SQLite.
 */

import { LogCategory, logger } from '../../../logging';
import { BaseStorageAdapter } from '../../base-adapter';
import {
  MemoryOperations as IMemoryOperations,
  ListOptions,
  StorageOptions
} from '../../types';
import { SQLiteConnectionManager } from './connection';
import { BatchOperations } from './operations/batch';
import { KVOperations } from './operations/kv';
import { ListOperations } from './operations/list';
import { SqliteMemoryOperations } from './operations/memory';
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

  // Memory operations (optional)
  memory?: IMemoryOperations;

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

    // Initialize memory operations if tables exist (or auto-create for SQLite)
    await this.initializeMemoryOperations();

    logger.info(LogCategory.STORAGE, 'SQLiteAdapter', 'Adapter initialized');
  }

  /**
   * Initialize memory operations - auto-creates tables for SQLite
   */
  private async initializeMemoryOperations(): Promise<void> {
    if (!this.connection) return;

    try {
      // Check if memory tables exist
      const result = this.connection.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='memories'
      `
        )
        .get();

      if (result) {
        // Tables exist - initialize memory operations directly (no bridge)
        this.memory = new SqliteMemoryOperations(this.connection.db);

        logger.info(
          LogCategory.STORAGE,
          'SQLiteAdapter',
          'Memory operations enabled'
        );
      } else {
        // Tables don't exist - auto-create them for SQLite
        logger.info(
          LogCategory.STORAGE,
          'SQLiteAdapter',
          'Memory tables not found - creating them automatically'
        );

        await this.createMemoryTables();

        // Now initialize memory operations
        this.memory = new SqliteMemoryOperations(this.connection.db);

        logger.info(
          LogCategory.STORAGE,
          'SQLiteAdapter',
          'Memory operations enabled with auto-created tables'
        );
      }
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteAdapter',
        'Failed to check for memory tables',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      // Memory operations remain disabled
    }
  }

  /**
   * Create memory tables if they don't exist
   */
  private async createMemoryTables(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not available');
    }

    const createMemoriesTable = `
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        importance REAL NOT NULL DEFAULT 0.5,
        resonance REAL NOT NULL DEFAULT 0.5,
        access_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        session_id TEXT,
        token_count INTEGER,
        keywords TEXT,
        embedding_id TEXT,
        metadata TEXT,
        extraction_method TEXT,
        batch_id TEXT,
        source_message_ids TEXT,
        embedding_model TEXT,
        embedding_dimension INTEGER
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_memories_user_agent ON memories(user_id, agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)',
      'CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)',
      'CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_memories_content_fts ON memories(content)'
    ];

    try {
      // Create the memories table
      this.connection.db.exec(createMemoriesTable);

      // Create indexes for better performance
      for (const indexSQL of createIndexes) {
        this.connection.db.exec(indexSQL);
      }

      logger.info(
        LogCategory.STORAGE,
        'SQLiteAdapter',
        'Memory tables and indexes created successfully'
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteAdapter',
        'Failed to create memory tables',
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw error;
    }
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
