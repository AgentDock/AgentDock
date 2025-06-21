/**
 * @fileoverview Cloudflare KV connection management
 */

import { LogCategory, logger } from '../../../logging';
import { CloudflareKVAdapterOptions, CloudflareKVConnection } from './types';

/**
 * Manages Cloudflare KV connections
 */
export class CloudflareKVConnectionManager {
  private connection: CloudflareKVConnection;

  constructor(private options: CloudflareKVAdapterOptions) {
    if (!options.kvNamespace) {
      throw new Error('CloudflareKV adapter requires kvNamespace');
    }

    this.connection = {
      kv: options.kvNamespace,
      defaultNamespace: options.namespace,
      defaultTtl: options.defaultTtl,
      storeTypeMetadata: options.storeTypeMetadata ?? true
    };

    logger.debug(
      LogCategory.STORAGE,
      'CloudflareKV',
      'Connection initialized',
      {
        hasNamespace: !!options.namespace,
        defaultTtl: options.defaultTtl,
        storeTypeMetadata: this.connection.storeTypeMetadata
      }
    );
  }

  /**
   * Get the KV connection
   */
  getConnection(): CloudflareKVConnection {
    return this.connection;
  }

  /**
   * Cloudflare KV doesn't need explicit cleanup
   */
  async close(): Promise<void> {
    logger.debug(LogCategory.STORAGE, 'CloudflareKV', 'Connection closed');
  }

  /**
   * Check if KV is accessible
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try to list with limit 1 to check if KV is accessible
      await this.connection.kv.list({ limit: 1 });
      return true;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'CloudflareKV', 'Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
