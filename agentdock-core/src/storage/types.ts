/**
 * @fileoverview Type definitions for the storage abstraction layer.
 *
 * This file defines the interfaces and types for the storage system,
 * allowing for pluggable storage providers with a consistent interface.
 */

import { MemoryType } from '../shared/types/memory';

/**
 * Type-safe storage metadata interface
 */
export interface StorageMetadata {
  created?: Date;
  updated?: Date;
  version?: number;
  source?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  // Allow additional properties but typed
  [key: string]: unknown;
}

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
  metadata?: StorageMetadata;
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

  /**
   * Memory operations (optional - not all storage providers support memory operations)
   */
  memory?: MemoryOperations;
}

/**
 * Memory operations interface for storage providers that support memory functionality
 * This is the standard interface - storage adapters may implement extended versions
 */
export interface MemoryOperations {
  store(userId: string, agentId: string, memory: MemoryData): Promise<string>;
  recall(
    userId: string,
    agentId: string,
    query: string,
    options?: MemoryRecallOptions
  ): Promise<MemoryData[]>;
  update(
    userId: string,
    agentId: string,
    memoryId: string,
    updates: Partial<MemoryData>
  ): Promise<void>;
  delete(userId: string, agentId: string, memoryId: string): Promise<void>;
  getStats(userId: string, agentId?: string): Promise<MemoryOperationStats>;
  getById?(userId: string, memoryId: string): Promise<MemoryData | null>;

  // Extended operations - may not be implemented by all providers
  batchStore?(
    userId: string,
    agentId: string,
    memories: MemoryData[]
  ): Promise<string[]>;
  applyDecay?(userId: string, agentId: string, decayRules: any): Promise<any>;
  createConnections?(userId: string, connections: any[]): Promise<void>;
  findConnectedMemories?(
    userId: string,
    memoryId: string,
    depth?: number
  ): Promise<any>;
}

/**
 * Memory data structure for storage operations
 */
export interface MemoryData {
  id: string;
  userId: string; // Required for user isolation
  agentId: string;
  type: MemoryType;
  content: string;
  importance: number;
  resonance: number;
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;

  // Fields that exist in PostgreSQL Memory table
  sessionId?: string;
  tokenCount?: number;
  keywords?: string[];
  embeddingId?: string;

  // Type-specific metadata (properly typed)
  metadata?: {
    contextWindow?: number;
    expiresAt?: number;
    context?: string;
    category?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

/**
 * Options for memory recall operations
 */
export interface MemoryRecallOptions {
  type?: MemoryType;
  limit?: number;
  threshold?: number;
  minImportance?: number;
  useVectorSearch?: boolean;
  timeRange?: { start: Date; end: Date };
}

/**
 * Memory operation statistics
 */
export interface MemoryOperationStats {
  totalMemories: number;
  byType: Record<string, number>;
  avgImportance: number;
  totalSize: string;
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
