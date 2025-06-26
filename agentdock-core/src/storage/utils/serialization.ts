/**
 * Serialization utilities for storage adapters
 */

import {
  SerializationOptions,
  ValueDeserializer,
  ValueSerializer
} from './types';

/**
 * Default JSON serializer
 */
export const jsonSerializer: ValueSerializer = <T>(value: T): string => {
  return JSON.stringify(value);
};

/**
 * Default JSON deserializer
 */
export const jsonDeserializer: ValueDeserializer = <T>(
  data: string | Buffer
): T => {
  const str = Buffer.isBuffer(data) ? data.toString('utf-8') : data;
  return JSON.parse(str);
};

/**
 * Serialization manager for handling different serialization strategies
 */
export class SerializationManager {
  private serializers = new Map<string, ValueSerializer>();
  private deserializers = new Map<string, ValueDeserializer>();

  constructor() {
    // Register default serializers
    this.registerSerializer('json', jsonSerializer);
    this.registerDeserializer('json', jsonDeserializer);
  }

  registerSerializer(type: string, serializer: ValueSerializer): void {
    this.serializers.set(type, serializer);
  }

  registerDeserializer(type: string, deserializer: ValueDeserializer): void {
    this.deserializers.set(type, deserializer);
  }

  serialize<T>(
    value: T,
    type: string = 'json',
    options?: SerializationOptions
  ): string | Buffer {
    const serializer = this.serializers.get(type);
    if (!serializer) {
      throw new Error(`Serializer not found for type: ${type}`);
    }
    return serializer(value, options);
  }

  deserialize<T>(
    data: string | Buffer,
    type: string = 'json',
    options?: SerializationOptions
  ): T {
    const deserializer = this.deserializers.get(type);
    if (!deserializer) {
      throw new Error(`Deserializer not found for type: ${type}`);
    }
    return deserializer<T>(data, options);
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(value: string, defaultValue: T): T {
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Safe JSON stringification with error handling
 */
export function safeJsonStringify(
  value: any,
  defaultValue: string = '{}'
): string {
  try {
    return JSON.stringify(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Type guards for serialization
 */
export function isSerializable(value: any): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert various types to string for storage
 */
export function toStorageString(value: any): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Buffer) return value.toString('base64');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Parse storage string back to original type
 */
export function fromStorageString(value: string, type?: string): any {
  if (!type) return value;

  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'date':
      return new Date(value);
    case 'buffer':
      return Buffer.from(value, 'base64');
    case 'json':
      return JSON.parse(value);
    default:
      return value;
  }
}
