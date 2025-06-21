/**
 * @fileoverview Base storage adapter with common utilities
 *
 * This provides a foundation for all storage adapters with
 * serialization/deserialization utilities and abstract methods.
 */

import { StorageOptions, StorageProvider } from './types';

/**
 * Base class for storage adapters with common utilities
 */
export abstract class BaseStorageAdapter implements StorageProvider {
  /**
   * Serialize a value to string for storage
   */
  protected serializeValue<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a value from string
   */
  protected deserializeValue<T>(serialized: string): T {
    try {
      return JSON.parse(serialized) as T;
    } catch (error) {
      throw new Error(`Failed to deserialize value: ${error}`);
    }
  }

  /**
   * Generate a key with optional namespace prefix
   */
  protected getFullKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${namespace}:${key}`;
    }
    return key;
  }

  /**
   * Remove namespace prefix from a key
   */
  protected removeNamespacePrefix(key: string, namespace?: string): string {
    if (namespace && key.startsWith(`${namespace}:`)) {
      return key.substring(namespace.length + 1);
    }
    return key;
  }

  /**
   * Check if a key belongs to a namespace
   */
  protected keyBelongsToNamespace(key: string, namespace?: string): boolean {
    if (!namespace) return true;
    return key.startsWith(`${namespace}:`);
  }

  // Abstract methods that must be implemented by subclasses
  abstract get<T>(key: string, options?: StorageOptions): Promise<T | null>;
  abstract set<T>(
    key: string,
    value: T,
    options?: StorageOptions
  ): Promise<void>;
  abstract delete(key: string, options?: StorageOptions): Promise<boolean>;
  abstract exists(key: string, options?: StorageOptions): Promise<boolean>;
  abstract getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>>;
  abstract setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void>;
  abstract deleteMany(
    keys: string[],
    options?: StorageOptions
  ): Promise<number>;
  abstract list(prefix: string, options?: StorageOptions): Promise<string[]>;
  abstract clear(prefix?: string): Promise<void>;
  abstract getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null>;
  abstract saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void>;
  abstract deleteList(key: string, options?: StorageOptions): Promise<boolean>;
  abstract destroy?(): Promise<void>;
}
