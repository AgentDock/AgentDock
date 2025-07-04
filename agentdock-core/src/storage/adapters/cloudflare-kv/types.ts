/**
 * @fileoverview Cloudflare KV-specific types and interfaces
 */

/**
 * Cloudflare KV namespace interface
 * This matches the KV namespace API from Cloudflare Workers
 */
export interface KVNamespace {
  get(
    key: string,
    options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ): Promise<any>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
  getWithMetadata<Metadata = unknown>(
    key: string,
    options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ): Promise<KVValueWithMetadata<Metadata>>;
}

export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: any;
}

export interface KVListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
}

export interface KVListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: any }>;
  list_complete: boolean;
  cursor?: string;
}

export interface KVValueWithMetadata<Metadata = unknown> {
  value: any;
  metadata: Metadata | null;
}

/**
 * Configuration options for Cloudflare KV adapter
 */
export interface CloudflareKVAdapterOptions {
  /**
   * KV namespace binding
   * In Workers: env.MY_KV_NAMESPACE
   * In tests/local: mock implementation
   */
  kvNamespace: KVNamespace;

  /**
   * Default namespace for this adapter instance
   */
  namespace?: string;

  /**
   * Default TTL in seconds for all values
   */
  defaultTtl?: number;

  /**
   * Whether to store type information in metadata
   * Helps with deserialization of complex types
   */
  storeTypeMetadata?: boolean;
}

/**
 * Internal metadata stored with each value
 */
export interface CloudflareKVMetadata {
  /** Namespace the key belongs to */
  namespace?: string;

  /** Original type of the value */
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

  /** Creation timestamp */
  createdAt?: number;

  /** User-provided metadata */
  custom?: Record<string, any>;
}

/**
 * Connection wrapper for Cloudflare KV
 */
export interface CloudflareKVConnection {
  kv: KVNamespace;
  defaultNamespace?: string;
  defaultTtl?: number;
  storeTypeMetadata: boolean;
}
