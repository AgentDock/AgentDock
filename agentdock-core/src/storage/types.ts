/**
 * @fileoverview Type definitions for the storage abstraction layer.
 *
 * This file defines the interfaces and types for the storage system,
 * allowing for pluggable storage providers with a consistent interface.
 */

/**
 * Common options for storage operations
 */
export interface StorageOptions {
  /** TTL (time-to-live) in seconds for the key */
  ttlSeconds?: number;

  /**
   * Optional namespace override
   * If specified, this namespace will be used instead of the provider's default
   */
  namespace?: string;

  /**
   * Additional metadata to store with the value
   * This can be used for filtering and organization
   */
  metadata?: Record<string, any>;
}

/**
 * Options for listing keys
 */
export interface ListOptions extends StorageOptions {
  /**
   * Maximum number of keys to return
   */
  limit?: number;

  /**
   * Starting offset for pagination
   */
  offset?: number;

  /**
   * Whether to include metadata in the results
   */
  includeMetadata?: boolean;
}

/**
 * Core storage provider interface
 *
 * All storage providers must implement this interface to be compatible
 * with the storage abstraction layer.
 */
export interface StorageProvider {
  /**
   * Gets a value from storage
   *
   * @param key - The key to retrieve
   * @param options - Optional storage options
   * @returns The value or null if not found
   */
  get<T>(key: string, options?: StorageOptions): Promise<T | null>;

  /**
   * Sets a value in storage
   *
   * @param key - The key to set
   * @param value - The value to store
   * @param options - Optional storage options
   */
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;

  /**
   * Deletes a value from storage
   *
   * @param key - The key to delete
   * @param options - Optional storage options
   * @returns Whether the key was deleted
   */
  delete(key: string, options?: StorageOptions): Promise<boolean>;

  /**
   * Checks if a key exists in storage
   *
   * @param key - The key to check
   * @param options - Optional storage options
   * @returns Whether the key exists
   */
  exists(key: string, options?: StorageOptions): Promise<boolean>;

  /**
   * Gets multiple values from storage
   *
   * @param keys - The keys to retrieve
   * @param options - Optional storage options
   * @returns Object mapping keys to values
   */
  getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>>;

  /**
   * Sets multiple values in storage
   *
   * @param items - Object mapping keys to values
   * @param options - Optional storage options
   */
  setMany<T>(items: Record<string, T>, options?: StorageOptions): Promise<void>;

  /**
   * Deletes multiple values from storage
   *
   * @param keys - The keys to delete
   * @param options - Optional storage options
   * @returns Number of keys deleted
   */
  deleteMany(keys: string[], options?: StorageOptions): Promise<number>;

  /**
   * Lists keys with a given prefix
   *
   * @param prefix - The prefix to filter by
   * @param options - Optional list options
   * @returns Array of matching keys
   */
  list(prefix: string, options?: ListOptions): Promise<string[]>;

  /**
   * Clears all data from storage
   *
   * @param prefix - Optional prefix to limit clearing to keys with this prefix
   */
  clear(prefix?: string): Promise<void>;

  /**
   * Gets a range of elements from a list in storage
   *
   * @param key - The key of the list to retrieve
   * @param start - The starting index (0-based, inclusive)
   * @param end - The ending index (0-based, inclusive, use -1 for end)
   * @param options - Optional storage options
   * @returns Array of values or null if the list doesn't exist
   */
  getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null>;

  /**
   * Saves/overwrites an entire list in storage.
   * This should ideally perform an atomic delete and push.
   *
   * @param key - The key of the list to save
   * @param values - The array of values to store
   * @param options - Optional storage options (e.g., ttl)
   */
  saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void>;

  /**
   * Deletes an entire list from storage
   * (Functionally similar to delete, but explicit for list types)
   *
   * @param key - The key of the list to delete
   * @param options - Optional storage options
   * @returns Whether the list was deleted
   */
  deleteList(key: string, options?: StorageOptions): Promise<boolean>;

  /**
   * Destroys the provider and cleans up resources
   * This should be called when the provider is no longer needed
   */
  destroy?(): Promise<void>;
}

/**
 * Options for creating a storage provider
 */
export interface StorageProviderOptions {
  /**
   * Provider type
   */
  type: string;

  /**
   * Default namespace for this provider
   */
  namespace?: string;

  /**
   * Provider-specific configuration
   */
  config?: Record<string, any>;
}

/**
 * Factory function type for creating storage providers
 */
export type StorageProviderFactory = (
  options?: Record<string, any>
) => StorageProvider;
