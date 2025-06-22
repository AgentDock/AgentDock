/**
 * @fileoverview Server-side storage initialization
 * 
 * This module handles the registration of Node.js-dependent storage adapters
 * based on environment configuration. It should only be imported in API routes.
 */

import { getStorageFactory, logger, LogCategory } from 'agentdock-core';
import {
  registerSQLiteAdapter,
  registerPostgreSQLAdapter,
  registerPostgreSQLVectorAdapter,
  registerMongoDBAdapter,
  isAdapterRegistered
} from 'agentdock-core/storage';

let initialized = false;

/**
 * Initializes storage adapters based on environment configuration
 * 
 * This function should be called once at the start of your API routes
 * to register the appropriate storage adapters.
 */
export async function initializeStorageAdapters(): Promise<void> {
  if (initialized) {
    return;
  }

  // Ensure we're running server-side
  if (typeof window !== 'undefined') {
    throw new Error('Storage adapters can only be initialized server-side');
  }

  const factory = getStorageFactory();

  try {
    // Register SQLite for local development
    if (process.env.ENABLE_SQLITE === 'true' || process.env.NODE_ENV === 'development') {
      if (!isAdapterRegistered(factory, 'sqlite')) {
        await registerSQLiteAdapter(factory);
        logger.info(LogCategory.STORAGE, 'StorageInit', 'SQLite adapter registered');
      }
    }

    // Register PostgreSQL if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      if (!isAdapterRegistered(factory, 'postgresql')) {
        await registerPostgreSQLAdapter(factory);
        logger.info(LogCategory.STORAGE, 'StorageInit', 'PostgreSQL adapter registered');
      }

      // Also register PostgreSQL Vector if enabled
      if (process.env.ENABLE_PGVECTOR === 'true') {
        if (!isAdapterRegistered(factory, 'postgresql-vector')) {
          await registerPostgreSQLVectorAdapter(factory);
          logger.info(LogCategory.STORAGE, 'StorageInit', 'PostgreSQL Vector adapter registered');
        }
      }
    }

    // Register MongoDB if explicitly enabled
    if (process.env.ENABLE_MONGODB === 'true' && process.env.MONGODB_URI) {
      if (!isAdapterRegistered(factory, 'mongodb')) {
        await registerMongoDBAdapter(factory);
        logger.info(LogCategory.STORAGE, 'StorageInit', 'MongoDB adapter registered');
      }
    }

    // Set appropriate default based on what's available
    if (process.env.DATABASE_URL && isAdapterRegistered(factory, 'postgresql')) {
      factory.setDefaultType('postgresql');
      logger.info(LogCategory.STORAGE, 'StorageInit', 'Default storage set to PostgreSQL');
    } else if (process.env.NODE_ENV === 'development' && isAdapterRegistered(factory, 'sqlite')) {
      factory.setDefaultType('sqlite');
      logger.info(LogCategory.STORAGE, 'StorageInit', 'Default storage set to SQLite');
    }

    initialized = true;
    logger.info(LogCategory.STORAGE, 'StorageInit', 'Storage adapters initialized');
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'StorageInit',
      'Failed to initialize storage adapters',
      { error: error instanceof Error ? error.message : String(error) }
    );
    // Don't throw - allow app to continue with default memory storage
  }
}

/**
 * Gets initialization status
 */
export function isStorageInitialized(): boolean {
  return initialized;
}

// Automatically initialize on import if in API route context
if (typeof window === 'undefined' && !initialized) {
  initializeStorageAdapters().catch((error) => {
    logger.error(
      LogCategory.STORAGE,
      'StorageInit',
      'Auto-initialization failed',
      { error: error instanceof Error ? error.message : String(error) }
    );
  });
} 