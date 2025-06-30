/**
 * @fileoverview Essential adapter registration for Node.js environments.
 *
 * This module provides functions to register ONLY the essential storage adapters:
 * - SQLite/SQLite-vec for development (zero external dependencies)
 * - PostgreSQL/PostgreSQL-Vector for production (single database solution)
 *
 * Optional adapters (MongoDB, S3, DynamoDB, etc.) have been moved to separate
 * registration files to prevent bundling when not needed.
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
 * Convenience function to register all recommended adapters for agent chat applications
 *
 * @param factory - Storage factory instance
 * @param options - Registration options
 *
 * @note This registers ONLY the officially supported adapters for AgentDock memory:
 *       - SQLite/SQLite-vec for development (zero external dependencies)
 *       - PostgreSQL/PostgreSQL-Vector for production (single database solution)
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
