/**
 * @fileoverview Server-side storage initialization
 *
 * This module handles the registration of Node.js-dependent storage adapters
 * based on environment configuration. It should only be imported in API routes.
 */

import { getStorageFactory, LogCategory, logger } from 'agentdock-core';

import {
  isAdapterRegistered,
  registerPostgreSQLAdapter,
  registerPostgreSQLVectorAdapter,
  registerSQLiteAdapter,
  registerSQLiteVecAdapter
} from 'agentdock-core/storage';

let initialized = false;
let initializationPromise: Promise<void> | null = null;

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

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization and cache the promise
  initializationPromise = performInitialization();
  return initializationPromise;
}

async function performInitialization(): Promise<void> {
  // Ensure we're running server-side
  if (typeof window !== 'undefined') {
    throw new Error('Storage adapters can only be initialized server-side');
  }

  const factory = getStorageFactory();

  try {
    // Register SQLite for local development
    if (
      process.env.ENABLE_SQLITE === 'true' ||
      process.env.NODE_ENV === 'development'
    ) {
      if (!isAdapterRegistered(factory, 'sqlite')) {
        await registerSQLiteAdapter(factory);
        logger.info(
          LogCategory.STORAGE,
          'StorageInit',
          'SQLite adapter registered'
        );
      }

      // Also register SQLite-vec for local vector search (advanced memory)
      if (
        process.env.ENABLE_SQLITE_VEC === 'true' ||
        process.env.NODE_ENV === 'development'
      ) {
        if (!isAdapterRegistered(factory, 'sqlite-vec')) {
          try {
            await registerSQLiteVecAdapter(factory);
            logger.info(
              LogCategory.STORAGE,
              'StorageInit',
              'SQLite-vec adapter registered for local vector search'
            );
          } catch (error) {
            logger.warn(
              LogCategory.STORAGE,
              'StorageInit',
              'SQLite-vec adapter registration failed - vector search unavailable',
              { error: error instanceof Error ? error.message : String(error) }
            );
          }
        }
      }
    }

    // Register PostgreSQL if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      if (!isAdapterRegistered(factory, 'postgresql')) {
        await registerPostgreSQLAdapter(factory);
        logger.info(
          LogCategory.STORAGE,
          'StorageInit',
          'PostgreSQL adapter registered'
        );
      }

      // Also register PostgreSQL Vector if enabled
      if (process.env.ENABLE_PGVECTOR === 'true') {
        if (!isAdapterRegistered(factory, 'postgresql-vector')) {
          await registerPostgreSQLVectorAdapter(factory);
          logger.info(
            LogCategory.STORAGE,
            'StorageInit',
            'PostgreSQL Vector adapter registered'
          );
        }
      }
    }

    // MongoDB is NOT auto-registered
    // To use MongoDB, manually register it in your API routes:
    // await registerMongoDBAdapter(factory);

    // Set appropriate default based on what's available
    if (
      process.env.DATABASE_URL &&
      isAdapterRegistered(factory, 'postgresql')
    ) {
      factory.setDefaultType('postgresql');
      logger.info(
        LogCategory.STORAGE,
        'StorageInit',
        'Default storage set to PostgreSQL'
      );
    } else if (
      process.env.NODE_ENV === 'development' &&
      isAdapterRegistered(factory, 'sqlite')
    ) {
      factory.setDefaultType('sqlite');
      logger.info(
        LogCategory.STORAGE,
        'StorageInit',
        'Default storage set to SQLite'
      );
    }

    initialized = true;
    logger.info(
      LogCategory.STORAGE,
      'StorageInit',
      'Storage adapters initialized'
    );
  } catch (error) {
    // Reset promise to allow retry
    initializationPromise = null;
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

/**
 * Lazy initialization - only initialize when explicitly called
 * This prevents race conditions on module import.
 *
 * Call initializeStorageAdapters() explicitly in your API routes.
 */
