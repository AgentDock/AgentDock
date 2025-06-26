/**
 * @fileoverview Edge Runtime compatible storage factory.
 *
 * This factory only registers providers that work in Edge Runtime environments.
 * Node.js specific adapters (SQLite, PostgreSQL, MongoDB, etc.) are not included.
 */

import { LogCategory, logger } from '../logging';
import { MemoryStorageProvider, VercelKVProvider } from './providers';
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
 * Edge-compatible storage factory
 */
export class EdgeStorageFactory {
  private static instance: EdgeStorageFactory;
  private providers: ProviderRegistry = {};
  private providerCache: ProviderCache = {};
  private defaultType: string = 'memory'; // Memory is always Edge-compatible

  /**
   * Creates a new storage factory
   *
   * @private Use EdgeStorageFactory.getInstance() instead
   */
  private constructor() {
    // Register only Edge-compatible providers
    this.registerProvider('memory', (options = {}) => {
      return new MemoryStorageProvider(options);
    });

    this.registerProvider('vercel-kv', (options = {}) => {
      return new VercelKVProvider({
        namespace: options.namespace
      });
    });

    logger.debug(
      LogCategory.STORAGE,
      'EdgeStorageFactory',
      'Initialized Edge-compatible storage factory',
      { defaultType: this.defaultType }
    );
  }

  /**
   * Gets the singleton instance of the storage factory
   */
  public static getInstance(): EdgeStorageFactory {
    if (!EdgeStorageFactory.instance) {
      EdgeStorageFactory.instance = new EdgeStorageFactory();
    }
    return EdgeStorageFactory.instance;
  }

  /**
   * Registers a new provider factory
   *
   * @param type - Provider type identifier
   * @param factory - Factory function for creating providers
   */
  public registerProvider(type: string, factory: StorageProviderFactory): void {
    this.providers[type] = factory;

    logger.debug(
      LogCategory.STORAGE,
      'EdgeStorageFactory',
      'Registered provider',
      {
        type
      }
    );
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
   */
  public createProvider(options: StorageProviderOptions): StorageProvider {
    const type = options.type || this.defaultType;
    const factory = this.providers[type];

    if (!factory) {
      throw new Error(
        `Provider type '${type}' is not registered in Edge-compatible factory`
      );
    }

    // Create a new instance
    return factory(options);
  }

  /**
   * Gets or creates a provider instance
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
          'EdgeStorageFactory',
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
      'EdgeStorageFactory',
      'Cleared provider cache'
    );
  }
}

/**
 * Gets the Edge-compatible storage factory instance
 */
export function getEdgeStorageFactory(): EdgeStorageFactory {
  return EdgeStorageFactory.getInstance();
}

/**
 * Creates an Edge-compatible storage provider
 *
 * @param config - Provider configuration
 * @returns The storage provider instance
 */
export function createEdgeStorageProvider(config: {
  type: string;
  namespace: string;
  config?: Record<string, any>;
}): StorageProvider {
  const factory = getEdgeStorageFactory();

  // Memory provider gets fresh instance per request (no global state)
  // This prevents memory leaks and data bleeding in serverless environments
  if (config.type === 'memory') {
    logger.debug(
      LogCategory.STORAGE,
      'EdgeFactory',
      'Creating request-scoped memory storage provider',
      { namespace: config.namespace }
    );

    return new MemoryStorageProvider({
      namespace: config.namespace,
      ...config.config
      // No shared store - each request gets isolated storage
    });
  }

  return factory.getProvider({
    type: config.type,
    namespace: config.namespace,
    config: config.config
  });
}
