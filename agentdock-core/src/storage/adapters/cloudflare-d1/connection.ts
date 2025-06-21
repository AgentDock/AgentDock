/**
 * @fileoverview Cloudflare D1 connection management
 */

import { LogCategory, logger } from '../../../logging';
import { cleanupExpired, initializeSchema } from './schema';
import { CloudflareD1AdapterOptions, CloudflareD1Connection } from './types';

/**
 * Manages Cloudflare D1 connections
 */
export class CloudflareD1ConnectionManager {
  private connection: CloudflareD1Connection;
  private cleanupTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(private options: CloudflareD1AdapterOptions) {
    if (!options.d1Database) {
      throw new Error('CloudflareD1 adapter requires d1Database');
    }

    this.connection = {
      db: options.d1Database,
      kvTableName: options.kvTableName || 'agentdock_kv',
      listTableName: options.listTableName || 'agentdock_lists',
      defaultNamespace: options.namespace,
      enableCleanup: options.enableCleanup ?? true,
      cleanupInterval: options.cleanupInterval || 3600
    };
  }

  /**
   * Initialize the connection and schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize schema
      await initializeSchema(
        this.connection.db,
        this.connection.kvTableName,
        this.connection.listTableName
      );

      // Start cleanup timer if enabled
      if (this.connection.enableCleanup) {
        this.startCleanupTimer();
      }

      this.isInitialized = true;

      logger.debug(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Connection initialized',
        {
          kvTable: this.connection.kvTableName,
          listTable: this.connection.listTableName,
          hasNamespace: !!this.connection.defaultNamespace,
          cleanupEnabled: this.connection.enableCleanup
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'CloudflareD1',
        'Failed to initialize connection',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Get the D1 connection
   */
  getConnection(): CloudflareD1Connection {
    if (!this.isInitialized) {
      throw new Error(
        'CloudflareD1 connection not initialized. Call initialize() first.'
      );
    }
    return this.connection;
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await cleanupExpired(
          this.connection.db,
          this.connection.kvTableName,
          this.connection.listTableName
        );
      } catch (error) {
        logger.error(
          LogCategory.STORAGE,
          'CloudflareD1',
          'Cleanup timer error',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }, this.connection.cleanupInterval * 1000);
  }

  /**
   * Close the connection and stop cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.isInitialized = false;
    logger.debug(LogCategory.STORAGE, 'CloudflareD1', 'Connection closed');
  }

  /**
   * Check if D1 is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Simple query to check if database is accessible
      const result = await this.connection.db
        .prepare('SELECT 1 as test')
        .first<{ test: number }>();

      return result?.test === 1;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareD1', 'Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
