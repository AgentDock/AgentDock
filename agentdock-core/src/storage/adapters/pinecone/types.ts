/**
 * @fileoverview Pinecone vector database adapter types
 */

import { BaseStorageAdapter } from '../../base-adapter';

/**
 * Pinecone index configuration
 */
export interface PineconeIndexConfig {
  /**
   * Index name
   */
  name: string;

  /**
   * Vector dimension
   */
  dimension: number;

  /**
   * Similarity metric
   */
  metric?: 'euclidean' | 'cosine' | 'dotproduct';

  /**
   * Cloud provider (for creation)
   */
  cloud?: 'aws' | 'gcp' | 'azure';

  /**
   * Cloud region (for creation)
   */
  region?: string;

  /**
   * Number of replicas
   */
  replicas?: number;

  /**
   * Number of pods
   */
  pods?: number;

  /**
   * Pod type
   */
  podType?: string;

  /**
   * Metadata config
   */
  metadataConfig?: Record<string, 'string' | 'number' | 'boolean'>;
}

/**
 * Pinecone adapter configuration
 */
export interface PineconeAdapterOptions {
  /**
   * Pinecone API key
   */
  apiKey: string;

  /**
   * Environment/Index URL (for newer Pinecone)
   */
  environment?: string;

  /**
   * Default index to use
   */
  defaultIndex?: string;

  /**
   * Default namespace
   */
  namespace?: string;

  /**
   * Request timeout in ms
   */
  timeout?: number;

  /**
   * Max retries for failed requests
   */
  maxRetries?: number;

  /**
   * Batch size for operations
   */
  batchSize?: number;
}

/**
 * Vector record in Pinecone format
 */
export interface PineconeVector {
  /**
   * Unique vector ID
   */
  id: string;

  /**
   * Vector values
   */
  values: number[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Sparse values (for hybrid search)
   */
  sparseValues?: {
    indices: number[];
    values: number[];
  };
}

/**
 * Query options for Pinecone
 */
export interface PineconeQueryOptions {
  /**
   * Number of results to return
   */
  topK?: number;

  /**
   * Include vector values in response
   */
  includeValues?: boolean;

  /**
   * Include metadata in response
   */
  includeMetadata?: boolean;

  /**
   * Metadata filter
   */
  filter?: Record<string, any>;

  /**
   * Namespace to query
   */
  namespace?: string;
}

/**
 * Query response from Pinecone
 */
export interface PineconeQueryResponse {
  /**
   * Matching vectors
   */
  matches: Array<{
    id: string;
    score: number;
    values?: number[];
    metadata?: Record<string, any>;
    sparseValues?: {
      indices: number[];
      values: number[];
    };
  }>;

  /**
   * Query namespace
   */
  namespace?: string;
}

/**
 * Pinecone index statistics
 */
export interface PineconeIndexStats {
  /**
   * Vector count by namespace
   */
  namespaces: Record<
    string,
    {
      vectorCount: number;
    }
  >;

  /**
   * Total vector count
   */
  totalVectorCount: number;

  /**
   * Index dimension
   */
  dimension: number;

  /**
   * Index fullness (0-1)
   */
  indexFullness: number;
}

/**
 * Update operation for Pinecone
 */
export interface PineconeUpdateRequest {
  /**
   * Vector ID to update
   */
  id: string;

  /**
   * New vector values (optional)
   */
  values?: number[];

  /**
   * Set metadata (replaces all)
   */
  setMetadata?: Record<string, any>;

  /**
   * Namespace
   */
  namespace?: string;
}

/**
 * Storage metadata for KV operations
 * Stored alongside vectors to enable storage operations
 */
export interface StorageMetadata {
  /**
   * Storage type marker
   */
  _storage_type: 'kv' | 'list';

  /**
   * Original key
   */
  _key: string;

  /**
   * Namespace
   */
  _namespace: string;

  /**
   * TTL expiration timestamp
   */
  _ttl_expires?: number;

  /**
   * Serialized value (for KV)
   */
  _value?: string;

  /**
   * List items (for lists)
   */
  _list_items?: string[];

  /**
   * Value type for deserialization
   */
  _type?: string;
}

/**
 * Extended BaseStorageAdapter with vector operations
 */
export interface PineconeStorageAdapter extends BaseStorageAdapter {
  /**
   * Initialize a Pinecone index
   */
  createIndex(config: PineconeIndexConfig): Promise<void>;

  /**
   * Delete an index
   */
  deleteIndex(name: string): Promise<void>;

  /**
   * List all indexes
   */
  listIndexes(): Promise<string[]>;

  /**
   * Get index statistics
   */
  getIndexStats(name: string): Promise<PineconeIndexStats>;

  /**
   * Upsert vectors
   */
  upsertVectors(
    indexName: string,
    vectors: PineconeVector[],
    namespace?: string
  ): Promise<void>;

  /**
   * Query vectors
   */
  queryVectors(
    indexName: string,
    vector: number[],
    options?: PineconeQueryOptions
  ): Promise<PineconeQueryResponse>;

  /**
   * Fetch vectors by ID
   */
  fetchVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<Record<string, PineconeVector>>;

  /**
   * Update vectors
   */
  updateVectors(
    indexName: string,
    updates: PineconeUpdateRequest[]
  ): Promise<void>;

  /**
   * Delete vectors
   */
  deleteVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<void>;

  /**
   * Delete all vectors in a namespace
   */
  deleteAllVectors(indexName: string, namespace?: string): Promise<void>;
}
