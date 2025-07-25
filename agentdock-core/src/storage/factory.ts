/**
 * @fileoverview Storage factory for creating and managing storage providers.
 *
 * This file implements a factory pattern for creating storage providers,
 * allowing for central configuration and provider management.
 */

import { LogCategory, logger } from '../logging';
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
  private defaultType: string = 'memory';

  /**
   * Creates a new storage factory
   *
   * @private Use StorageFactory.getInstance() instead
   */
  private constructor() {
    // Register built-in providers (Edge-compatible)
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

    // NOTE: Node.js-dependent adapters (SQLite, PostgreSQL, MongoDB, etc.) are not registered here
    // to avoid importing Node.js modules at build time. They should be registered separately
    // when running in a Node.js environment via registerNodeAdapters() or similar.

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

  /**
   * Gets the provider factory for a given type
   *
   * @param type - Provider type identifier
   * @returns The provider factory function or undefined
   */
  public getProviderFactory(type: string): StorageProviderFactory | undefined {
    return this.providers[type];
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
