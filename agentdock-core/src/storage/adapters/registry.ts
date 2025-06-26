/**
 * @fileoverview Optional adapter registration for Node.js environments.
 *
 * This module provides functions to register storage adapters that depend on
 * Node.js APIs. These adapters are not imported by default to avoid bundling
 * issues in client-side environments.
 */

import { LogCategory, logger } from '../../logging';
import { StorageFactory } from '../factory';

/**
 * Registers the SQLite adapter
 *
 * @param factory - Storage factory instance
 */
export async function registerSQLiteAdapter(
  factory: StorageFactory
): Promise<void> {
  try {
    const { SQLiteAdapter } = await import('./sqlite');
    factory.registerAdapter('sqlite', (options = {}) => {
      return new SQLiteAdapter({
        path: options.config?.path || './agentdock.db',
        namespace: options.namespace,
        verbose: options.config?.verbose,
        walMode: options.config?.walMode
      });
    });
    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered SQLite adapter'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register SQLite adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers the SQLite-vec adapter (SQLite with vector support)
 *
 * @param factory - Storage factory instance
 */
export async function registerSQLiteVecAdapter(
  factory: StorageFactory
): Promise<void> {
  try {
    const { SQLiteVecAdapter } = await import('./sqlite-vec');
    factory.registerAdapter('sqlite-vec', (options = {}) => {
      return new SQLiteVecAdapter({
        path: options.config?.path || './agentdock.db',
        namespace: options.namespace,
        verbose: options.config?.verbose,
        walMode: options.config?.walMode,
        // Vector-specific options
        enableVector: options.config?.enableVector,
        defaultDimension: options.config?.defaultDimension,
        defaultMetric: options.config?.defaultMetric,
        vecExtensionPath: options.config?.vecExtensionPath
      });
    });

    // Register alias
    factory.registerAdapter(
      'sqlite-vector',
      factory.getProviderFactory('sqlite-vec')!
    );

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered SQLite-vec adapter'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register SQLite-vec adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers the PostgreSQL adapter
 *
 * @param factory - Storage factory instance
 */
export async function registerPostgreSQLAdapter(
  factory: StorageFactory
): Promise<void> {
  try {
    const { PostgreSQLAdapter } = await import('./postgresql');
    factory.registerAdapter('postgresql', (options = {}) => {
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

    // Register alias
    factory.registerAdapter(
      'postgres',
      factory.getProviderFactory('postgresql')!
    );

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered PostgreSQL adapter'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register PostgreSQL adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers the PostgreSQL Vector adapter (with pgvector)
 *
 * @param factory - Storage factory instance
 */
export async function registerPostgreSQLVectorAdapter(
  factory: StorageFactory
): Promise<void> {
  try {
    const { PostgreSQLVectorAdapter } = await import('./postgresql-vector');
    factory.registerAdapter('postgresql-vector', (options = {}) => {
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

    // Register aliases
    factory.registerAdapter(
      'pgvector',
      factory.getProviderFactory('postgresql-vector')!
    );
    factory.registerAdapter(
      'pg-vector',
      factory.getProviderFactory('postgresql-vector')!
    );

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered PostgreSQL Vector adapter'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register PostgreSQL Vector adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers the MongoDB adapter
 *
 * @param factory - Storage factory instance
 *
 * @note MongoDB adapter is OPTIONAL and not included in the default agent chat setup.
 *       For memory systems, we officially support:
 *       - SQLite + sqlite-vec (development)
 *       - PostgreSQL + pgvector (production)
 *
 *       MongoDB can be used for basic KV storage but lacks native vector search.
 *       MongoDB Atlas offers vector search as a separate service, but it's not
 *       implemented in this adapter. Users requiring MongoDB should understand
 *       these limitations.
 */
export async function registerMongoDBAdapter(
  factory: StorageFactory
): Promise<void> {
  try {
    const { MongoDBAdapter } = await import('./mongodb');
    factory.registerAdapter('mongodb', (options = {}) => {
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

    // Register alias
    factory.registerAdapter('mongo', factory.getProviderFactory('mongodb')!);

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered MongoDB adapter'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register MongoDB adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers all cloud storage adapters
 *
 * @param factory - Storage factory instance
 */
export async function registerCloudAdapters(
  factory: StorageFactory
): Promise<void> {
  try {
    // S3 Adapter
    const { S3Adapter } = await import('./s3');
    factory.registerAdapter('s3', (options = {}) => {
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

    // DynamoDB Adapter
    const { DynamoDBAdapter } = await import('./dynamodb');
    factory.registerAdapter('dynamodb', (options = {}) => {
      // Type-safe configuration validation
      if (!options.config?.tableName) {
        throw new Error('DynamoDB adapter requires tableName in config');
      }
      return new DynamoDBAdapter({
        tableName: options.config.tableName,
        region: options.config.region,
        credentials: options.config.credentials,
        endpoint: options.config.endpoint,
        namespace: options.namespace,
        partitionKey: options.config.partitionKey,
        sortKey: options.config.sortKey,
        ttlAttribute: options.config.ttlAttribute,
        createTableIfNotExists: options.config.createTableIfNotExists,
        billingMode: options.config.billingMode,
        readCapacityUnits: options.config.readCapacityUnits,
        writeCapacityUnits: options.config.writeCapacityUnits,
        clientConfig: options.config.clientConfig
      });
    });

    // Cloudflare KV Adapter
    const { CloudflareKVAdapter } = await import('./cloudflare-kv');
    factory.registerAdapter('cloudflare-kv', (options = {}) => {
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
    factory.registerAdapter(
      'cf-kv',
      factory.getProviderFactory('cloudflare-kv')!
    );

    // Cloudflare D1 Adapter
    const { CloudflareD1Adapter } = await import('./cloudflare-d1');
    factory.registerAdapter('cloudflare-d1', (options = {}) => {
      if (!options.config?.d1Database) {
        throw new Error('Cloudflare D1 adapter requires d1Database in config');
      }
      return new CloudflareD1Adapter({
        d1Database: options.config.d1Database,
        namespace: options.namespace,
        kvTableName: options.config.kvTableName,
        listTableName: options.config.listTableName,
        enableCleanup: options.config.enableCleanup,
        cleanupInterval: options.config.cleanupInterval
      });
    });
    factory.registerAdapter(
      'cf-d1',
      factory.getProviderFactory('cloudflare-d1')!
    );

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered cloud adapters'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register cloud adapters',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Registers all vector database adapters
 *
 * @param factory - Storage factory instance
 */
export async function registerVectorAdapters(
  factory: StorageFactory
): Promise<void> {
  try {
    // Pinecone Adapter
    const { PineconeAdapter } = await import('./pinecone');
    factory.registerAdapter('pinecone', (options = {}) => {
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

    // Qdrant Adapter
    const { QdrantAdapter } = await import('./qdrant');
    factory.registerAdapter('qdrant', (options = {}) => {
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

    // ChromaDB Adapter
    const { ChromaDBAdapter } = await import('./chromadb');
    factory.registerAdapter('chromadb', (options = {}) => {
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
    factory.registerAdapter('chroma', factory.getProviderFactory('chromadb')!);

    logger.info(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Registered vector adapters'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'AdapterRegistry',
      'Failed to register vector adapters',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}

/**
 * Convenience function to register all recommended adapters for agent chat applications
 *
 * @param factory - Storage factory instance
 * @param options - Registration options
 *
 * @note This registers ONLY the officially supported adapters for AgentDock memory:
 *       - SQLite/SQLite-vec for development (zero external dependencies)
 *       - PostgreSQL/PostgreSQL-Vector for production (single database solution)
 *
 *       Other adapters (MongoDB, S3, DynamoDB, etc.) are available but must be
 *       registered separately using their specific registration functions.
 *       They are NOT part of the official memory system support.
 */
export async function registerAgentChatAdapters(
  factory: StorageFactory,
  options: {
    enableSQLite?: boolean;
    enableSQLiteVec?: boolean;
    enablePostgreSQL?: boolean;
    enableVector?: boolean;
  } = {}
): Promise<void> {
  const {
    enableSQLite = true,
    enableSQLiteVec = false, // Default false until sqlite-vec is installed
    enablePostgreSQL = true,
    enableVector = true
  } = options;

  // Register SQLite for local development
  if (enableSQLite) {
    await registerSQLiteAdapter(factory);
  }

  // Register SQLite-vec if requested
  if (enableSQLiteVec) {
    await registerSQLiteVecAdapter(factory);
  }

  // Register PostgreSQL for production
  if (enablePostgreSQL && process.env.DATABASE_URL) {
    await registerPostgreSQLAdapter(factory);

    // Also register vector if requested
    if (enableVector) {
      await registerPostgreSQLVectorAdapter(factory);
    }
  }

  logger.info(
    LogCategory.STORAGE,
    'AdapterRegistry',
    'Registered agent chat adapters',
    { enableSQLite, enableSQLiteVec, enablePostgreSQL, enableVector }
  );
}

/**
 * Helper to check if an adapter is registered
 *
 * @param factory - Storage factory instance
 * @param type - Adapter type to check
 * @returns True if the adapter is registered
 */
export function isAdapterRegistered(
  factory: StorageFactory,
  type: string
): boolean {
  return factory.getProviderFactory(type) !== undefined;
}
