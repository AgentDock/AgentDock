/**
 * Common types for storage utilities
 */

export interface SerializationOptions {
  compress?: boolean;
  encrypt?: boolean;
  encryptionKey?: string;
}

export interface ConnectionPoolOptions {
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  testOnBorrow?: boolean;
  evictionRunIntervalMillis?: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  factor?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
}

export interface NamespaceOptions {
  separator?: string;
  maxLength?: number;
  allowedCharacters?: RegExp;
}

export interface TTLOptions {
  defaultTTL?: number;
  cleanupInterval?: number;
  maxTTL?: number;
  minTTL?: number;
}

export interface TransactionOptions {
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
  timeout?: number;
  readOnly?: boolean;
}

export type KeyTransformer = (key: string, namespace?: string) => string;
export type ValueSerializer = <T>(
  value: T,
  options?: SerializationOptions
) => string | Buffer;
export type ValueDeserializer = <T>(
  data: string | Buffer,
  options?: SerializationOptions
) => T;
