/**
 * Key management utilities for storage adapters
 */

import { KeyTransformer, NamespaceOptions } from './types';

const DEFAULT_NAMESPACE_OPTIONS: Required<NamespaceOptions> = {
  separator: ':',
  maxLength: 255,
  allowedCharacters: /^[a-zA-Z0-9:_\-.]+$/
};

export class KeyManager {
  private options: Required<NamespaceOptions>;
  private keyCache = new Map<string, string>();

  constructor(options: NamespaceOptions = {}) {
    this.options = {
      ...DEFAULT_NAMESPACE_OPTIONS,
      ...options
    } as Required<NamespaceOptions>;
  }

  /**
   * Create a key with optional namespace
   */
  createKey(key: string, namespace?: string): string {
    const cacheKey = `${namespace || ''}${this.options.separator}${key}`;

    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }

    const fullKey = namespace
      ? `${namespace}${this.options.separator}${key}`
      : key;

    this.validateKey(fullKey);
    this.keyCache.set(cacheKey, fullKey);

    return fullKey;
  }

  /**
   * Extract namespace from a key
   */
  extractNamespace(key: string): { namespace?: string; baseKey: string } {
    const separatorIndex = key.indexOf(this.options.separator);

    if (separatorIndex === -1) {
      return { baseKey: key };
    }

    return {
      namespace: key.substring(0, separatorIndex),
      baseKey: key.substring(separatorIndex + this.options.separator.length)
    };
  }

  /**
   * Validate a key against configured rules
   */
  validateKey(key: string): void {
    if (!key || key.length === 0) {
      throw new Error('Key cannot be empty');
    }

    if (key.length > this.options.maxLength) {
      throw new Error(
        `Key length exceeds maximum of ${this.options.maxLength} characters`
      );
    }

    if (!this.options.allowedCharacters.test(key)) {
      throw new Error('Key contains invalid characters');
    }
  }

  /**
   * Create a pattern for matching keys with wildcards
   */
  createPattern(pattern: string, namespace?: string): string {
    const basePattern = namespace
      ? `${namespace}${this.options.separator}${pattern}`
      : pattern;

    // Convert simple wildcards to SQL/Redis compatible patterns
    return basePattern
      .replace(/\*/g, '%') // SQL LIKE
      .replace(/\?/g, '_'); // SQL LIKE single character
  }

  /**
   * Clear the key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }
}

/**
 * Factory function for creating key transformers
 */
export function createKeyTransformer(
  options: NamespaceOptions = {}
): KeyTransformer {
  const manager = new KeyManager(options);
  return (key: string, namespace?: string) => manager.createKey(key, namespace);
}

/**
 * Utility to batch transform keys
 */
export function batchTransformKeys(
  keys: string[],
  transformer: KeyTransformer,
  namespace?: string
): string[] {
  return keys.map((key) => transformer(key, namespace));
}
