/**
 * S3 Storage Adapter
 *
 * An object storage adapter using AWS S3 with support for:
 * - Large object storage
 * - S3-compatible services (MinIO, etc.)
 * - Metadata-based TTL
 * - Namespace isolation via prefixes
 * - Batch operations
 * - Presigned URLs for direct access
 */

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { BaseStorageAdapter } from '../../base-adapter';
import { StorageOptions } from '../../types';
import { ErrorMapper, KeyManager, TTLManager } from '../../utils';
import { S3ConnectionManager } from './connection';
import { S3BatchOperations } from './operations/batch';
import { S3KVOperations } from './operations/kv';
import { S3Config } from './types';
import { createS3Key } from './utils';

export class S3Adapter extends BaseStorageAdapter {
  private connectionManager: S3ConnectionManager;
  private kvOps!: S3KVOperations;
  private batchOps!: S3BatchOperations;
  private keyManager: KeyManager;
  private ttlManager: TTLManager;
  private isInitialized = false;
  protected namespace?: string;
  private config: S3Config; // Store config for creating namespaced instances

  constructor(config: S3Config) {
    super();
    this.config = config;
    this.connectionManager = new S3ConnectionManager(config);
    this.keyManager = new KeyManager();
    this.ttlManager = new TTLManager({ cleanupInterval: 0 }); // No auto cleanup for S3
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const connection = await this.connectionManager.getConnection();

      // Initialize operation handlers
      this.kvOps = new S3KVOperations(
        connection,
        this.keyManager,
        this.ttlManager,
        this.namespace
      );

      this.batchOps = new S3BatchOperations(
        connection,
        this.keyManager,
        this.ttlManager,
        this.namespace
      );

      this.isInitialized = true;
    } catch (error) {
      throw ErrorMapper.mapError(error, 'generic');
    }
  }

  /**
   * Ensure the adapter is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // StorageProvider implementation

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;
    return (await nsAdapter.kvOps.get(key)) as T | null;
  }

  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;
    await nsAdapter.kvOps.set(
      key,
      value,
      options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined
    );
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;
    try {
      await nsAdapter.kvOps.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;
    return nsAdapter.kvOps.exists(key);
  }

  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;

    const values = await nsAdapter.batchOps.mget(keys);

    const result: Record<string, T | null> = {};
    keys.forEach((key, index) => {
      result[key] = values[index] as T | null;
    });

    return result;
  }

  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;

    const pairs = Object.entries(items).map(([key, value]) => ({
      key,
      value,
      ttl: options?.ttlSeconds ? options.ttlSeconds * 1000 : undefined
    }));

    await nsAdapter.batchOps.mset(pairs);
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;
    return nsAdapter.batchOps.mdel(keys);
  }

  async list(prefix: string, options?: StorageOptions): Promise<string[]> {
    await this.ensureInitialized();
    const namespace = options?.namespace || this.namespace;
    const nsAdapter =
      namespace && namespace !== this.namespace
        ? await this.withNamespace(namespace)
        : this;

    const pattern = prefix ? `${prefix}*` : '*';
    return nsAdapter.kvOps.keys(pattern);
  }

  async clear(prefix?: string): Promise<void> {
    await this.ensureInitialized();
    if (prefix) {
      const keys = await this.list(prefix);
      if (keys.length > 0) {
        await this.deleteMany(keys);
      }
    } else {
      await this.kvOps.clear();
    }
  }

  // S3 doesn't support native lists, so we'll simulate with special objects
  async getList<T>(
    _key: string,
    _start?: number,
    _end?: number,
    _options?: StorageOptions
  ): Promise<T[] | null> {
    // Lists are not supported in S3 adapter
    return null;
  }

  async saveList<T>(
    _key: string,
    _values: T[],
    _options?: StorageOptions
  ): Promise<void> {
    // Lists are not supported in S3 adapter
    throw new Error('List operations are not supported in S3 adapter');
  }

  async deleteList(_key: string, _options?: StorageOptions): Promise<boolean> {
    // Lists are not supported in S3 adapter
    return false;
  }

  async destroy(): Promise<void> {
    await this.connectionManager.close();
    this.ttlManager.stopCleanupTimer();
    this.isInitialized = false;
  }

  // S3-specific methods

  /**
   * Get a presigned URL for direct access
   */
  async getPresignedUrl(
    key: string,
    operation: 'get' | 'put' = 'get',
    options?: { expiresIn?: number; contentType?: string }
  ): Promise<string> {
    await this.ensureInitialized();
    const connection = await this.connectionManager.getConnection();
    const fullKey = createS3Key(
      key,
      this.namespace,
      connection.prefix,
      this.keyManager
    );

    const command =
      operation === 'get'
        ? new GetObjectCommand({ Bucket: connection.bucket, Key: fullKey })
        : new PutObjectCommand({
            Bucket: connection.bucket,
            Key: fullKey,
            ContentType: options?.contentType
          });

    return await getSignedUrl(connection.client, command, {
      expiresIn: options?.expiresIn || 3600 // 1 hour default
    });
  }

  /**
   * Create a namespaced instance
   */
  async withNamespace(namespace: string): Promise<S3Adapter> {
    // Ensure the adapter is initialized before creating namespaced instance
    await this.ensureInitialized();

    // Create a new adapter instance using the constructor for proper initialization
    const nsAdapter = new S3Adapter(this.config);
    nsAdapter.namespace = namespace;

    // Share the existing connection manager to avoid creating new connections
    nsAdapter.connectionManager = this.connectionManager;

    // Mark as initialized and ensure connection exists
    nsAdapter.isInitialized = true;

    // Use getConnection() to ensure connection exists (handles race conditions)
    const connection = await this.connectionManager.getConnection();

    // Initialize operations with the namespace
    nsAdapter.kvOps = new S3KVOperations(
      connection,
      nsAdapter.keyManager,
      nsAdapter.ttlManager,
      namespace
    );

    nsAdapter.batchOps = new S3BatchOperations(
      connection,
      nsAdapter.keyManager,
      nsAdapter.ttlManager,
      namespace
    );

    return nsAdapter;
  }

  async keys(pattern?: string): Promise<string[]> {
    await this.ensureInitialized();
    return this.kvOps.keys(pattern);
  }

  async size(): Promise<number> {
    await this.ensureInitialized();
    return this.kvOps.size();
  }

  async ttl(key: string): Promise<number | null> {
    await this.ensureInitialized();
    return this.kvOps.ttl(key);
  }

  async mexists(keys: string[]): Promise<boolean[]> {
    await this.ensureInitialized();
    return this.batchOps.mexists(keys);
  }
}

// Export types and config
export * from './types';
