/**
 * S3-specific utility functions
 */

import { KeyManager } from '../../utils';

/**
 * Create S3 key with namespace and prefix
 */
export function createS3Key(
  key: string,
  namespace: string | undefined,
  prefix: string | undefined,
  keyManager: KeyManager
): string {
  const namespaceKey = keyManager.createKey(key, namespace);
  return prefix ? `${prefix}/${namespaceKey}` : namespaceKey;
}

/**
 * Create S3 prefix for pattern matching
 */
export function createS3Prefix(
  pattern: string,
  namespace: string | undefined,
  prefix: string | undefined
): string {
  const patternPrefix = pattern.split('*')[0];
  const namespacePrefix = namespace
    ? `${namespace}:${patternPrefix}`
    : patternPrefix;
  return prefix ? `${prefix}/${namespacePrefix}` : namespacePrefix;
}

/**
 * Extract key from S3 object key
 */
export function extractKeyFromS3Key(
  s3Key: string,
  prefix: string | undefined,
  keyManager: KeyManager
): string | null {
  // Remove connection prefix if present
  if (prefix) {
    if (!s3Key.startsWith(prefix + '/')) {
      return null;
    }
    s3Key = s3Key.substring(prefix.length + 1);
  }

  // Extract base key from namespace
  const { baseKey } = keyManager.extractNamespace(s3Key);
  return baseKey;
}

/**
 * Check if key matches pattern
 */
export function matchesPattern(key: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$'
  );

  return regex.test(key);
}
