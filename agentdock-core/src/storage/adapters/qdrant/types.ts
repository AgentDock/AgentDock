/**
 * @fileoverview Qdrant vector database adapter types
 */

import { BaseStorageAdapter } from '../../base-adapter';

/**
 * Allowed payload value types in Qdrant
 */
export type PayloadValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | null;

/**
 * Payload type for Qdrant points
 */
export type Payload = Record<
  string,
  PayloadValue | Record<string, PayloadValue>
>;

/**
 * Distance metrics supported by Qdrant
 */
export enum QdrantDistance {
  COSINE = 'Cosine',
  EUCLID = 'Euclid',
  DOT = 'Dot'
}

/**
 * Collection configuration for Qdrant
 */
export interface QdrantCollectionConfig {
  /**
   * Collection name
   */
  name: string;

  /**
   * Vector configuration
   */
  vectors: {
    /**
     * Vector dimension
     */
    size: number;

    /**
     * Distance metric
     */
    distance: QdrantDistance;

    /**
     * Optional: Multiple named vectors
     */
    [key: string]:
      | {
          size: number;
          distance: QdrantDistance;
        }
      | number
      | QdrantDistance;
  };

  /**
   * Shard configuration
   */
  shard_number?: number;

  /**
   * Replication factor
   */
  replication_factor?: number;

  /**
   * Write consistency factor
   */
  write_consistency_factor?: number;

  /**
   * On disk payload
   */
  on_disk_payload?: boolean;

  /**
   * HNSW config
   */
  hnsw_config?: {
    m?: number;
    ef_construct?: number;
    full_scan_threshold?: number;
    max_indexing_threads?: number;
  };

  /**
   * Optimizers config
   */
  optimizers_config?: {
    deleted_threshold?: number;
    vacuum_min_vector_number?: number;
    default_segment_number?: number;
    max_segment_size?: number;
    memmap_threshold?: number;
    indexing_threshold?: number;
  };
}

/**
 * Qdrant adapter configuration
 */
export interface QdrantAdapterOptions {
  /**
   * Qdrant host URL
   */
  host: string;

  /**
   * API key (optional)
   */
  apiKey?: string;

  /**
   * Default collection name
   */
  defaultCollection?: string;

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

  /**
   * Use HTTPS
   */
  https?: boolean;

  /**
   * Port (defaults to 6333)
   */
  port?: number;
}

/**
 * Point (vector) in Qdrant format
 */
export interface QdrantPoint {
  /**
   * Unique point ID
   */
  id: string | number;

  /**
   * Vector values
   */
  vector: number[] | { [key: string]: number[] };

  /**
   * Optional payload (metadata)
   */
  payload?: Payload;
}

/**
 * Search parameters for Qdrant
 */
export interface QdrantSearchParams {
  /**
   * Number of results to return
   */
  limit?: number;

  /**
   * Score threshold
   */
  score_threshold?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Include payload in results
   */
  with_payload?: boolean | string[];

  /**
   * Include vectors in results
   */
  with_vector?: boolean | string[];

  /**
   * Filter conditions
   */
  filter?: QdrantFilter;

  /**
   * Search parameters
   */
  params?: {
    hnsw_ef?: number;
    exact?: boolean;
  };
}

/**
 * Filter conditions for Qdrant
 */
export interface QdrantFilter {
  /**
   * Must conditions (AND)
   */
  must?: Array<QdrantCondition>;

  /**
   * Should conditions (OR)
   */
  should?: Array<QdrantCondition>;

  /**
   * Must not conditions (NOT)
   */
  must_not?: Array<QdrantCondition>;
}

/**
 * Single filter condition
 */
export interface QdrantCondition {
  /**
   * Field key
   */
  key?: string;

  /**
   * Match conditions
   */
  match?: {
    value?: PayloadValue;
    text?: string;
    any?: PayloadValue[];
    except?: PayloadValue[];
  };

  /**
   * Range conditions
   */
  range?: {
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
  };

  /**
   * Geo conditions
   */
  geo_radius?: {
    center: {
      lon: number;
      lat: number;
    };
    radius: number;
  };

  /**
   * Nested filters
   */
  filter?: QdrantFilter;

  /**
   * Has field condition
   */
  has_id?: Array<string | number>;

  /**
   * Is empty condition
   */
  is_empty?: {
    key: string;
  };

  /**
   * Is null condition
   */
  is_null?: {
    key: string;
  };
}

/**
 * Search result from Qdrant
 */
export interface QdrantSearchResult {
  /**
   * Point ID
   */
  id: string | number;

  /**
   * Version
   */
  version?: number;

  /**
   * Similarity score
   */
  score: number;

  /**
   * Payload (if requested)
   */
  payload?: Payload;

  /**
   * Vector (if requested)
   */
  vector?: number[] | { [key: string]: number[] };
}

/**
 * Batch operation result
 */
export interface QdrantBatchResult {
  /**
   * Operation status
   */
  status: 'completed' | 'failed';

  /**
   * Affected IDs
   */
  ids?: Array<string | number>;

  /**
   * Error details
   */
  error?: string;
}

/**
 * Collection info
 */
export interface QdrantCollectionInfo {
  /**
   * Collection status
   */
  status: 'green' | 'yellow' | 'red';

  /**
   * Number of vectors
   */
  vectors_count: number;

  /**
   * Number of indexed vectors
   */
  indexed_vectors_count: number;

  /**
   * Points count
   */
  points_count: number;

  /**
   * Segments count
   */
  segments_count: number;

  /**
   * Collection config
   */
  config: QdrantCollectionConfig;
}

/**
 * Scroll request parameters
 */
export interface QdrantScrollParams {
  /**
   * Scroll offset
   */
  offset?: string | number;

  /**
   * Limit per page
   */
  limit?: number;

  /**
   * Include payload
   */
  with_payload?: boolean | string[];

  /**
   * Include vectors
   */
  with_vector?: boolean | string[];

  /**
   * Filter conditions
   */
  filter?: QdrantFilter;
}

/**
 * Scroll response
 */
export interface QdrantScrollResponse {
  /**
   * Points
   */
  points: Array<{
    id: string | number;
    payload?: Payload;
    vector?: number[] | { [key: string]: number[] };
  }>;

  /**
   * Next page offset
   */
  next_page_offset?: string | number;
}

/**
 * Qdrant-specific storage metadata for KV operations
 * Stored in Qdrant payload to enable storage operations
 */
export interface QdrantMetadata {
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
export interface QdrantStorageAdapter extends BaseStorageAdapter {
  /**
   * Create a collection
   */
  createCollection(config: QdrantCollectionConfig): Promise<void>;

  /**
   * Delete a collection
   */
  deleteCollection(name: string): Promise<void>;

  /**
   * List all collections
   */
  listCollections(): Promise<string[]>;

  /**
   * Get collection info
   */
  getCollectionInfo(name: string): Promise<QdrantCollectionInfo>;

  /**
   * Upsert points
   */
  upsertPoints(
    collection: string,
    points: QdrantPoint[]
  ): Promise<QdrantBatchResult>;

  /**
   * Search for similar vectors
   */
  searchPoints(
    collection: string,
    vector: number[],
    params?: QdrantSearchParams
  ): Promise<QdrantSearchResult[]>;

  /**
   * Retrieve points by ID
   */
  retrievePoints(
    collection: string,
    ids: Array<string | number>,
    withPayload?: boolean | string[],
    withVector?: boolean | string[]
  ): Promise<QdrantPoint[]>;

  /**
   * Update point payloads
   */
  updatePayload(
    collection: string,
    points: Array<{
      id: string | number;
      payload: Payload;
    }>
  ): Promise<QdrantBatchResult>;

  /**
   * Delete points
   */
  deletePoints(
    collection: string,
    ids: Array<string | number>
  ): Promise<QdrantBatchResult>;

  /**
   * Scroll through all points
   */
  scrollPoints(
    collection: string,
    params?: QdrantScrollParams
  ): Promise<QdrantScrollResponse>;

  /**
   * Count points with optional filter
   */
  countPoints(collection: string, filter?: QdrantFilter): Promise<number>;
}
