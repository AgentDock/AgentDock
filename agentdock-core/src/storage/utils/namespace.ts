/**
 * Namespace utilities for key isolation
 */

import { NamespaceOptions } from './types';

/**
 * Namespace manager for isolating keys
 */
export class NamespaceManager {
  private readonly separator: string;
  private activeNamespace?: string;

  constructor(options: NamespaceOptions = {}) {
    this.separator = options.separator || ':';
  }

  /**
   * Set the active namespace
   */
  setNamespace(namespace?: string): void {
    this.activeNamespace = namespace;
  }

  /**
   * Get the active namespace
   */
  getNamespace(): string | undefined {
    return this.activeNamespace;
  }

  /**
   * Apply namespace to a key
   */
  applyNamespace(key: string, namespace?: string): string {
    const ns = namespace || this.activeNamespace;
    return ns ? `${ns}${this.separator}${key}` : key;
  }

  /**
   * Remove namespace from a key
   */
  removeNamespace(key: string, namespace?: string): string {
    const ns = namespace || this.activeNamespace;
    if (!ns) return key;

    const prefix = `${ns}${this.separator}`;
    return key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }

  /**
   * Check if a key belongs to a namespace
   */
  belongsToNamespace(key: string, namespace?: string): boolean {
    const ns = namespace || this.activeNamespace;
    if (!ns) return true;

    return key.startsWith(`${ns}${this.separator}`);
  }

  /**
   * Extract namespace from a key
   */
  extractNamespace(key: string): { namespace?: string; key: string } {
    const separatorIndex = key.indexOf(this.separator);

    if (separatorIndex === -1) {
      return { key };
    }

    return {
      namespace: key.substring(0, separatorIndex),
      key: key.substring(separatorIndex + this.separator.length)
    };
  }

  /**
   * Create a pattern for namespace matching
   */
  createNamespacePattern(namespace?: string): string {
    const ns = namespace || this.activeNamespace;
    return ns ? `${ns}${this.separator}*` : '*';
  }
}

/**
 * Create a namespace-aware wrapper for storage operations
 */
export function withNamespace<
  T extends {
    get: (key: string, ...args: any[]) => any;
    set: (key: string, value: any, ...args: any[]) => any;
    delete: (key: string, ...args: any[]) => any;
    exists: (key: string, ...args: any[]) => any;
  }
>(storage: T, namespace: string, separator: string = ':'): T {
  const manager = new NamespaceManager({ separator });
  manager.setNamespace(namespace);

  return new Proxy(storage, {
    get(target, prop) {
      switch (prop) {
        case 'get':
        case 'delete':
        case 'exists':
          return (key: string, ...args: any[]) => {
            const namespacedKey = manager.applyNamespace(key);
            return (target[prop as keyof T] as any)(namespacedKey, ...args);
          };

        case 'set':
          return (key: string, value: any, ...args: any[]) => {
            const namespacedKey = manager.applyNamespace(key);
            return target.set(namespacedKey, value, ...args);
          };

        default:
          return target[prop as keyof T];
      }
    }
  });
}

/**
 * Filter keys by namespace
 */
export function filterKeysByNamespace(
  keys: string[],
  namespace: string,
  separator: string = ':'
): string[] {
  const prefix = `${namespace}${separator}`;
  return keys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));
}
