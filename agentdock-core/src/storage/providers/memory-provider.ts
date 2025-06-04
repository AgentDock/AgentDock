/**
 * In-memory storage provider implementation
 *
 * This provider stores data in memory and is intended for development and testing.
 * It should not be used in production environments where persistence is required.
 */

import { LogCategory, logger } from '../../logging';
import { ListOptions, StorageOptions, StorageProvider } from '../types';

/**
 * Storage item with metadata
 */
interface StorageItem<T> {
  value: T;
  expiresAt?: number; // Timestamp when this item expires
  namespace?: string;
  metadata?: Record<string, any>;
}

/**
 * In-memory storage provider
 *
 * @remarks
 * This provider is suitable for development and testing, but not for production
 * as it doesn't persist data across server restarts or between serverless function invocations.
 */
export class MemoryStorageProvider implements StorageProvider {
  private store: Map<string, StorageItem<any>>;
  private namespace: string;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Creates a new memory storage provider
   *
   * @param options - Configuration options
   */
  constructor(
    options: {
      namespace?: string;
      cleanupIntervalMs?: number;
      store?: Map<string, StorageItem<any>>; // Add store parameter for persistence
    } = {}
  ) {
    // Use provided store or create a new one
    this.store = options.store || new Map();
    this.namespace = options.namespace || 'default';

    // Set up automatic cleanup if an interval is specified
    if (options.cleanupIntervalMs) {
      this.startCleanup(options.cleanupIntervalMs);
    }

    logger.debug(
      LogCategory.STORAGE,
      'MemoryStorageProvider',
      'Initialized memory storage provider',
      {
        namespace: this.namespace,
        isPersistent: !!options.store
      }
    );
  }

  /**
   * Prepends namespace to key
   */
  private getNamespacedKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  /**
   * Checks if an item has expired
   */
  private isExpired(item: StorageItem<any>): boolean {
    return typeof item.expiresAt === 'number' && item.expiresAt <= Date.now();
  }

  /**
   * Starts automatic cleanup of expired items
   */
  private startCleanup(intervalMs: number): void {
    // Clear any existing interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Set up new interval
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        logger.error(
          LogCategory.STORAGE,
          'MemoryStorageProvider',
          'Error during cleanup',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }, intervalMs);

    // Don't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Cleans up expired items
   */
  private cleanup(): void {
    let removedCount = 0;

    for (const [key, item] of this.store.entries()) {
      if (this.isExpired(item)) {
        this.store.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'MemoryStorageProvider',
        'Removed expired items',
        {
          namespace: this.namespace,
          count: removedCount,
          remaining: this.store.size
        }
      );
    }
  }

  /**
   * Stops the cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Gets a value from storage
   */
  public async get<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);
    const item = this.store.get(namespacedKey);

    // Return null if item doesn't exist
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (this.isExpired(item)) {
      // Remove expired item
      this.store.delete(namespacedKey);
      return null;
    }

    return item.value as T;
  }

  /**
   * Sets a value in storage
   */
  public async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);

    // Calculate expiration time if TTL is provided
    let expiresAt: number | undefined;
    if (typeof options.ttlSeconds === 'number' && options.ttlSeconds > 0) {
      expiresAt = Date.now() + options.ttlSeconds * 1000;
    }

    // Store the item
    this.store.set(namespacedKey, {
      value,
      expiresAt,
      namespace: options.namespace || this.namespace,
      metadata: options.metadata
    });
  }

  /**
   * Deletes a value from storage
   */
  public async delete(
    key: string,
    options: StorageOptions = {}
  ): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);
    return this.store.delete(namespacedKey);
  }

  /**
   * Checks if a key exists in storage
   */
  public async exists(
    key: string,
    options: StorageOptions = {}
  ): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);
    const item = this.store.get(namespacedKey);

    // Key doesn't exist
    if (!item) {
      return false;
    }

    // Check if item has expired
    if (this.isExpired(item)) {
      // Remove expired item
      this.store.delete(namespacedKey);
      return false;
    }

    return true;
  }

  /**
   * Gets multiple values from storage
   */
  public async getMany<T>(
    keys: string[],
    options: StorageOptions = {}
  ): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};

    for (const key of keys) {
      result[key] = await this.get<T>(key, options);
    }

    return result;
  }

  /**
   * Sets multiple values in storage
   */
  public async setMany<T>(
    items: Record<string, T>,
    options: StorageOptions = {}
  ): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      await this.set(key, value, options);
    }
  }

  /**
   * Deletes multiple values from storage
   */
  public async deleteMany(
    keys: string[],
    options: StorageOptions = {}
  ): Promise<number> {
    let deletedCount = 0;

    for (const key of keys) {
      const deleted = await this.delete(key, options);
      if (deleted) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Lists keys with a given prefix
   */
  public async list(
    prefix: string,
    options: ListOptions = {}
  ): Promise<string[]> {
    const namespacedPrefix = this.getNamespacedKey(prefix, options.namespace);
    const results: string[] = [];

    // Get the base namespace length to strip from returned keys
    const namespacePrefix = `${options.namespace || this.namespace}:`;
    const prefixLength = namespacePrefix.length;

    // Iterate through all keys
    for (const [key, item] of this.store.entries()) {
      // Skip expired items
      if (this.isExpired(item)) {
        continue;
      }

      // Check if key starts with the namespaced prefix
      if (key.startsWith(namespacedPrefix)) {
        // Remove namespace from key before adding to results
        const unNamespacedKey = key.substring(prefixLength);
        results.push(unNamespacedKey);
      }
    }

    // Apply pagination if specified
    if (typeof options.limit === 'number' && options.limit > 0) {
      const start = options.offset || 0;
      return results.slice(start, start + options.limit);
    }

    return results;
  }

  /**
   * Clears all data from storage
   */
  public async clear(prefix?: string): Promise<void> {
    if (prefix) {
      // Delete only keys with the given prefix
      const namespacedPrefix = this.getNamespacedKey(prefix);

      for (const key of Array.from(this.store.keys())) {
        if (key.startsWith(namespacedPrefix)) {
          this.store.delete(key);
        }
      }
    } else {
      // Clear all keys in this namespace
      const namespacePrefix = `${this.namespace}:`;

      for (const key of Array.from(this.store.keys())) {
        if (key.startsWith(namespacePrefix)) {
          this.store.delete(key);
        }
      }
    }
  }

  /**
   * Destroys the provider and cleans up resources
   */
  public async destroy(): Promise<void> {
    this.stopCleanup();
    this.store.clear();
  }

  /**
   * Gets a range of elements from a list stored in memory
   */
  public async getList<T>(
    key: string,
    start: number = 0,
    end: number = -1,
    options: StorageOptions = {}
  ): Promise<T[] | null> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);
    const item = this.store.get(namespacedKey);

    if (!item || !Array.isArray(item.value)) {
      return null; // Key doesn't exist or value is not an array
    }

    if (this.isExpired(item)) {
      this.store.delete(namespacedKey);
      return null;
    }

    // Handle Python-style negative indexing for end
    const actualEnd = end < 0 ? item.value.length + end + 1 : end + 1;

    // Slice the array, ensuring indices are within bounds
    const startIndex = Math.max(0, start);
    const endIndex = Math.min(item.value.length, actualEnd);

    if (startIndex >= endIndex) {
      return []; // Return empty if range is invalid
    }

    return item.value.slice(startIndex, endIndex) as T[];
  }

  /**
   * Saves/overwrites an entire list in memory
   */
  public async saveList<T>(
    key: string,
    values: T[],
    options: StorageOptions = {}
  ): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key, options.namespace);
    let expiresAt: number | undefined;
    if (typeof options.ttlSeconds === 'number' && options.ttlSeconds > 0) {
      expiresAt = Date.now() + options.ttlSeconds * 1000;
    }
    this.store.set(namespacedKey, {
      value: values,
      expiresAt,
      namespace: options.namespace || this.namespace
    });
  }

  /**
   * Deletes an entire list from memory
   */
  public async deleteList(
    key: string,
    options: StorageOptions = {}
  ): Promise<boolean> {
    // Use the existing delete method
    return await this.delete(key, options);
  }
}
