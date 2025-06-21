/**
 * @fileoverview Storage factory for creating and managing storage providers.
 *
 * This file implements a factory pattern for creating storage providers,
 * allowing for central configuration and provider management.
 */

import { LogCategory, logger } from '../logging';
import { ChromaDBAdapter } from './adapters/chromadb';
import { CloudflareD1Adapter } from './adapters/cloudflare-d1';
import { CloudflareKVAdapter } from './adapters/cloudflare-kv';
import { DynamoDBAdapter } from './adapters/dynamodb';
import { MongoDBAdapter } from './adapters/mongodb';
import { PineconeAdapter } from './adapters/pinecone';
import { PostgreSQLAdapter } from './adapters/postgresql';
import { PostgreSQLVectorAdapter } from './adapters/postgresql-vector';
import { QdrantAdapter } from './adapters/qdrant';
import { S3Adapter } from './adapters/s3';
import { SQLiteAdapter } from './adapters/sqlite';
import {
  MemoryStorageProvider,
  RedisStorageProvider,
  VercelKVProvider
} from './providers';
import {
  StorageProvider,
  StorageProviderFactory,
  StorageProviderOptions
} from './types';

/**
 * Registry of provider factories
 */
interface ProviderRegistry {
  [type: string]: StorageProviderFactory;
}

/**
 * Storage provider instance cache
 */
interface ProviderCache {
  [cacheKey: string]: StorageProvider;
}

/**
 * Storage factory for creating and managing storage providers
 */
export class StorageFactory {
  private static instance: StorageFactory;
  private providers: ProviderRegistry = {};
  private providerCache: ProviderCache = {};
  private defaultType: string = 'sqlite';

  /**
   * Creates a new storage factory
   *
   * @private Use StorageFactory.getInstance() instead
   */
  private constructor() {
    // Register SQLite as the default provider
    this.registerProvider('sqlite', (options = {}) => {
      return new SQLiteAdapter({
        path: options.config?.path || './agentdock.db',
        namespace: options.namespace,
        verbose: options.config?.verbose,
        walMode: options.config?.walMode
      });
    });

    // Register PostgreSQL provider
    this.registerProvider('postgresql', (options = {}) => {
      return new PostgreSQLAdapter({
        connectionString:
          options.config?.connectionString || process.env.DATABASE_URL,
        connection: options.config?.connection,
        pool: options.config?.pool,
        namespace: options.namespace,
        schema: options.config?.schema,
        ssl: options.config?.ssl,
        preparedStatements: options.config?.preparedStatements
      });
    });

    // Alias for postgres
    this.registerProvider('postgres', this.providers['postgresql']);

    // Register PostgreSQL Vector provider (with pgvector)
    this.registerProvider('postgresql-vector', (options = {}) => {
      return new PostgreSQLVectorAdapter({
        connectionString:
          options.config?.connectionString || process.env.DATABASE_URL,
        connection: options.config?.connection,
        pool: options.config?.pool,
        namespace: options.namespace,
        schema: options.config?.schema,
        ssl: options.config?.ssl,
        preparedStatements: options.config?.preparedStatements,
        // Vector-specific options
        enableVector: options.config?.enableVector,
        defaultDimension: options.config?.defaultDimension,
        defaultMetric: options.config?.defaultMetric,
        defaultIndexType: options.config?.defaultIndexType,
        ivfflat: options.config?.ivfflat
      });
    });

    // Aliases for postgresql-vector
    this.registerProvider('pgvector', this.providers['postgresql-vector']);
    this.registerProvider('pg-vector', this.providers['postgresql-vector']);

    // Register MongoDB provider
    this.registerProvider('mongodb', (options = {}) => {
      return new MongoDBAdapter({
        namespace: options.namespace,
        config: {
          uri:
            options.config?.uri ||
            process.env.MONGODB_URI ||
            'mongodb://localhost:27017',
          database: options.config?.database || 'agentdock',
          collection: options.config?.collection,
          options: options.config?.options,
          indexes: options.config?.indexes
        }
      });
    });

    // Alias for mongo
    this.registerProvider('mongo', this.providers['mongodb']);

    // Register built-in providers
    this.registerProvider('memory', (options = {}) => {
      return new MemoryStorageProvider(options);
    });

    this.registerProvider('redis', (options = {}) => {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error(
          'REDIS_URL environment variable is required for Redis provider'
        );
      }

      return new RedisStorageProvider({
        namespace: options.namespace || 'default',
        url,
        token: process.env.REDIS_TOKEN || 'placeholder_token' // Required by @upstash/redis
      });
    });

    this.registerProvider('vercel-kv', (options = {}) => {
      return new VercelKVProvider({
        namespace: options.namespace
      });
    });

    // Register S3 adapter
    this.registerProvider('s3', (options = {}) => {
      return new S3Adapter({
        bucket: options.config?.bucket || process.env.S3_BUCKET,
        region: options.config?.region || process.env.AWS_REGION || 'us-east-1',
        endpoint: options.config?.endpoint,
        credentials:
          options.config?.credentials ||
          (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
              }
            : undefined),
        forcePathStyle: options.config?.forcePathStyle,
        prefix: options.config?.prefix || options.namespace,
        clientConfig: options.config?.clientConfig
      });
    });

    // Register DynamoDB adapter
    this.registerProvider('dynamodb', (options = {}) => {
      const dynamoConfig = options as any;
      if (!dynamoConfig.tableName) {
        throw new Error('DynamoDB adapter requires tableName in config');
      }
      return new DynamoDBAdapter(dynamoConfig);
    });

    // Register Cloudflare KV adapter
    this.registerProvider('cloudflare-kv', (options = {}) => {
      if (!options.config?.kvNamespace) {
        throw new Error('Cloudflare KV adapter requires kvNamespace in config');
      }
      return new CloudflareKVAdapter({
        kvNamespace: options.config.kvNamespace,
        namespace: options.namespace,
        defaultTtl: options.config.defaultTtl,
        storeTypeMetadata: options.config.storeTypeMetadata
      });
    });

    // Alias for cf-kv
    this.registerProvider('cf-kv', this.providers['cloudflare-kv']);

    // Register Cloudflare D1 adapter
    this.registerProvider('cloudflare-d1', (options = {}) => {
      if (!options.config?.d1Database) {
        throw new Error('Cloudflare D1 adapter requires d1Database in config');
      }
      const d1Adapter = new CloudflareD1Adapter({
        d1Database: options.config.d1Database,
        namespace: options.namespace,
        kvTableName: options.config.kvTableName,
        listTableName: options.config.listTableName,
        enableCleanup: options.config.enableCleanup,
        cleanupInterval: options.config.cleanupInterval
      });
      // D1 requires initialization before use
      return d1Adapter;
    });

    // Alias for cf-d1
    this.registerProvider('cf-d1', this.providers['cloudflare-d1']);

    // Register Pinecone adapter
    this.registerProvider('pinecone', (options = {}) => {
      if (!options.config?.apiKey) {
        throw new Error('Pinecone adapter requires apiKey in config');
      }
      return new PineconeAdapter({
        apiKey: options.config.apiKey,
        environment: options.config.environment,
        defaultIndex: options.config.defaultIndex,
        namespace: options.namespace,
        timeout: options.config.timeout,
        maxRetries: options.config.maxRetries,
        batchSize: options.config.batchSize
      });
    });

    // Register Qdrant adapter
    this.registerProvider('qdrant', (options = {}) => {
      if (!options.config?.host) {
        throw new Error('Qdrant adapter requires host in config');
      }
      return new QdrantAdapter({
        host: options.config.host,
        port: options.config.port,
        https: options.config.https,
        apiKey: options.config.apiKey,
        defaultCollection: options.config.defaultCollection,
        namespace: options.namespace,
        timeout: options.config.timeout,
        maxRetries: options.config.maxRetries,
        batchSize: options.config.batchSize
      });
    });

    // Register ChromaDB adapter
    this.registerProvider('chromadb', (options = {}) => {
      return new ChromaDBAdapter({
        host: options.config?.host || 'http://localhost:8000',
        authToken: options.config?.authToken,
        defaultCollection: options.config?.defaultCollection,
        namespace: options.namespace,
        timeout: options.config?.timeout,
        maxRetries: options.config?.maxRetries,
        batchSize: options.config?.batchSize,
        embeddingFunction: options.config?.embeddingFunction
      });
    });

    // Alias for chroma
    this.registerProvider('chroma', this.providers['chromadb']);

    logger.debug(
      LogCategory.STORAGE,
      'StorageFactory',
      'Initialized storage factory',
      { defaultType: this.defaultType }
    );
  }

  /**
   * Gets the singleton instance of the storage factory
   */
  public static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  /**
   * Registers a new provider factory
   *
   * @param type - Provider type identifier
   * @param factory - Factory function for creating providers
   */
  public registerProvider(type: string, factory: StorageProviderFactory): void {
    this.providers[type] = factory;

    logger.debug(LogCategory.STORAGE, 'StorageFactory', 'Registered provider', {
      type
    });
  }

  /**
   * Sets the default provider type
   *
   * @param type - Provider type to use as default
   */
  public setDefaultType(type: string): void {
    if (!this.providers[type]) {
      throw new Error(`Provider type '${type}' is not registered`);
    }

    this.defaultType = type;

    logger.debug(
      LogCategory.STORAGE,
      'StorageFactory',
      'Set default provider type',
      { type }
    );
  }

  /**
   * Gets the default provider type
   */
  public getDefaultType(): string {
    return this.defaultType;
  }

  /**
   * Creates a cache key for a provider instance
   */
  private getCacheKey(options: StorageProviderOptions): string {
    const { type, namespace = 'default' } = options;
    return `${type}:${namespace}`;
  }

  /**
   * Creates a new provider instance
   *
   * @param options - Provider options
   * @returns A storage provider instance
   *
   * @breaking-change Since v2.0: Factory functions now receive the entire StorageProviderOptions
   * object (including 'type' and 'config' properties) instead of just the config object.
   * Built-in providers ignore extra properties, but third-party providers may need updates.
   */
  public createProvider(options: StorageProviderOptions): StorageProvider {
    const type = options.type || this.defaultType;
    const factory = this.providers[type];

    if (!factory) {
      throw new Error(`Provider type '${type}' is not registered`);
    }

    // Create a new instance
    // Pass the full options object so the factory function can access namespace etc.
    return factory(options);
  }

  /**
   * Gets or creates a provider instance
   *
   * This will return an existing instance if one exists with the same
   * type and namespace, or create a new one if not.
   *
   * @param options - Provider options
   * @returns A storage provider instance
   */
  public getProvider(
    options: Partial<StorageProviderOptions> = {}
  ): StorageProvider {
    const fullOptions: StorageProviderOptions = {
      type: options.type || this.defaultType,
      namespace: options.namespace || 'default',
      config: options.config || {}
    };

    const cacheKey = this.getCacheKey(fullOptions);

    // Check if we already have an instance
    if (this.providerCache[cacheKey]) {
      return this.providerCache[cacheKey];
    }

    // Create a new instance
    const provider = this.createProvider(fullOptions);

    // Cache the instance
    this.providerCache[cacheKey] = provider;

    return provider;
  }

  /**
   * Gets the default provider
   *
   * @returns The default storage provider
   */
  public getDefaultProvider(): StorageProvider {
    return this.getProvider({ type: this.defaultType });
  }

  /**
   * Clears the provider cache
   *
   * This will destroy all cached providers and remove them from the cache.
   */
  public async clearCache(): Promise<void> {
    // Destroy all providers
    for (const [cacheKey, provider] of Object.entries(this.providerCache)) {
      try {
        if (provider.destroy) {
          await provider.destroy();
        }
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'StorageFactory',
          'Error destroying provider',
          {
            cacheKey,
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }

    // Clear the cache
    this.providerCache = {};

    logger.debug(
      LogCategory.STORAGE,
      'StorageFactory',
      'Cleared provider cache'
    );
  }

  /**
   * Registers a new adapter factory
   *
   * @param type - Adapter type identifier
   * @param factory - Factory function for creating adapters
   */
  public registerAdapter(type: string, factory: StorageProviderFactory): void {
    this.providers[type] = factory;

    logger.debug(LogCategory.STORAGE, 'StorageFactory', 'Registered adapter', {
      type
    });
  }
}

/**
 * Gets the storage factory instance
 */
export function getStorageFactory(): StorageFactory {
  return StorageFactory.getInstance();
}

// Global storage map to ensure persistence between function invocations
const GLOBAL_STORAGE = new Map<string, any>();

/**
 * Creates a storage provider based on configuration
 *
 * @param config - Provider configuration
 * @returns The storage provider instance
 */
export function createStorageProvider(config: {
  type: string;
  namespace: string;
  config?: Record<string, any>;
}): StorageProvider {
  // Use the storage factory to get the provider
  const factory = getStorageFactory();

  // Special handling for memory provider with persistence flag to support serverless
  if (config.type === 'memory' && config.config?.isPersistent) {
    logger.debug(
      LogCategory.STORAGE,
      'Factory',
      'Creating persistent memory storage provider',
      { namespace: config.namespace }
    );

    // Create a memory provider with the global storage
    return new MemoryStorageProvider({
      namespace: config.namespace,
      ...config.config,
      store: GLOBAL_STORAGE
    });
  }

  // Use the standard provider creation path
  return factory.getProvider({
    type: config.type,
    namespace: config.namespace,
    config: config.config
  });
}

/**
 * Gets the default storage provider
 *
 * @returns The default storage provider
 */
export function getDefaultStorageProvider(): StorageProvider {
  return getStorageFactory().getDefaultProvider();
}
