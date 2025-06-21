/**
 * DynamoDB-specific utilities
 */

import { KeyManager, SerializationManager } from '../../utils';
import { DynamoDBConnection, DynamoDBItem } from './types';

/**
 * Build pattern for key matching
 */
export function buildPattern(prefix: string): RegExp {
  // Escape special regex characters
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}`);
}

/**
 * Build composite key for DynamoDB
 */
export function buildCompositeKey(
  namespace: string | undefined,
  key: string
): { pk: string; sk: string } {
  const ns = namespace || 'default';
  return {
    pk: `ns#${ns}`,
    sk: `key#${key}`
  };
}

/**
 * Build list key for DynamoDB
 */
export function buildListKey(
  namespace: string | undefined,
  listName: string
): { pk: string; sk: string } {
  const ns = namespace || 'default';
  return {
    pk: `ns#${ns}`,
    sk: `list#${listName}`
  };
}

/**
 * Parse key from composite key
 */
export function parseKey(sk: string): string {
  return sk.replace(/^(key|list)#/, '');
}

/**
 * Convert DynamoDB item to storage format
 */
export function itemToStorageFormat<T>(
  item: Record<string, any>,
  connection: DynamoDBConnection
): T | null {
  if (!item || !item.value) return null;

  const serializer = new SerializationManager();
  return serializer.deserialize<T>(item.value.S || item.value);
}

/**
 * Convert value to DynamoDB item format
 */
export function valueToItemFormat<T>(
  key: string,
  value: T,
  namespace: string | undefined,
  ttl: number | undefined,
  metadata?: Record<string, any>
): Record<string, any> {
  const serializer = new SerializationManager();
  const { pk, sk } = buildCompositeKey(namespace, key);

  const item: Record<string, any> = {
    pk: { S: pk },
    sk: { S: sk },
    value: { S: serializer.serialize(value) },
    namespace: { S: namespace || 'default' },
    type: { S: 'kv' }
  };

  if (ttl) {
    item.expiresAt = { N: String(ttl) };
  }

  if (metadata) {
    item.metadata = { M: convertToAttributeValue(metadata) };
  }

  return item;
}

/**
 * Convert JavaScript object to DynamoDB AttributeValue format
 */
export function convertToAttributeValue(obj: any): any {
  if (obj === null || obj === undefined) {
    return { NULL: true };
  }

  if (typeof obj === 'string') {
    return { S: obj };
  }

  if (typeof obj === 'number') {
    return { N: String(obj) };
  }

  if (typeof obj === 'boolean') {
    return { BOOL: obj };
  }

  if (Array.isArray(obj)) {
    return { L: obj.map(convertToAttributeValue) };
  }

  if (typeof obj === 'object') {
    const map: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      map[key] = convertToAttributeValue(value);
    }
    return { M: map };
  }

  // Default to string
  return { S: String(obj) };
}

/**
 * Convert DynamoDB AttributeValue format to JavaScript object
 */
export function convertFromAttributeValue(attr: any): any {
  if (attr.NULL) return null;
  if (attr.S !== undefined) return attr.S;
  if (attr.N !== undefined) return Number(attr.N);
  if (attr.BOOL !== undefined) return attr.BOOL;

  if (attr.L) {
    return attr.L.map(convertFromAttributeValue);
  }

  if (attr.M) {
    const obj: Record<string, any> = {};
    for (const [key, value] of Object.entries(attr.M)) {
      obj[key] = convertFromAttributeValue(value);
    }
    return obj;
  }

  return null;
}
