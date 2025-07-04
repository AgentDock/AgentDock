/**
 * @fileoverview ChromaDB vector database adapter types
 */

import { BaseStorageAdapter } from '../../base-adapter';
import {
  MemoryData,
  MemoryOperations,
  MemoryOperationStats,
  MemoryRecallOptions,
  StorageMetadata,
  StorageProvider
} from '../../types';

/**
 * Distance functions supported by ChromaDB
 */
export enum ChromaDistance {
  L2 = 'l2',
  COSINE = 'cosine',
  IP = 'ip'
}

/**
 * ChromaDB collection metadata
 */
export interface ChromaCollectionMetadata {
  [key: string]: string | number | boolean;
}

/**
 * ChromaDB adapter configuration
 */
export interface ChromaDBAdapterOptions {
  /**
   * ChromaDB server URL (default: http://localhost:8000)
   */
  host?: string;

  /**
   * Authentication token (optional)
   */
  authToken?: string;

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
   * Default embedding function
   */
  embeddingFunction?: ChromaEmbeddingFunction;
}

/**
 * Embedding function for ChromaDB
 */
export interface ChromaEmbeddingFunction {
  /**
   * Generate embeddings for documents
   */
  generate(documents: string[]): Promise<number[][]>;
}

/**
 * Document to add to ChromaDB
 */
export interface ChromaDocument {
  /**
   * Unique document ID
   */
  id: string;

  /**
   * Document content (optional if embedding provided)
   */
  document?: string;

  /**
   * Pre-computed embedding (optional if document provided)
   */
  embedding?: number[];

  /**
   * Document metadata
   */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Query parameters for ChromaDB
 */
export interface ChromaQueryParams {
  /**
   * Number of results to return
   */
  nResults?: number;

  /**
   * Filter by metadata
   */
  where?: ChromaWhereFilter;

  /**
   * Filter by document content
   */
  whereDocument?: ChromaWhereDocumentFilter;

  /**
   * Include distances in results
   */
  include?: ChromaInclude[];
}

/**
 * What to include in query results
 */
export enum ChromaInclude {
  DOCUMENTS = 'documents',
  METADATAS = 'metadatas',
  DISTANCES = 'distances',
  EMBEDDINGS = 'embeddings'
}

/**
 * Metadata filter operators
 */
export interface ChromaWhereFilter {
  [key: string]: ChromaFilterValue | ChromaLogicalFilter;
}

/**
 * Document content filter
 */
export interface ChromaWhereDocumentFilter {
  $contains?: string;
  $not_contains?: string;
  $and?: ChromaWhereDocumentFilter[];
  $or?: ChromaWhereDocumentFilter[];
}

/**
 * Filter value types
 */
export type ChromaFilterValue =
  | string
  | number
  | boolean
  | { $eq: string | number | boolean }
  | { $ne: string | number | boolean }
  | { $gt: number }
  | { $gte: number }
  | { $lt: number }
  | { $lte: number }
  | { $in: Array<string | number> }
  | { $nin: Array<string | number> };

/**
 * Logical filter operators
 */
export interface ChromaLogicalFilter {
  $and?: ChromaWhereFilter[];
  $or?: ChromaWhereFilter[];
}

/**
 * Query result from ChromaDB
 */
export interface ChromaQueryResult {
  /**
   * Document IDs
   */
  ids: string[][];

  /**
   * Distances (if requested)
   */
  distances?: number[][];

  /**
   * Documents (if requested)
   */
  documents?: Array<string | null>[];

  /**
   * Metadata (if requested)
   */
  metadatas?: Array<Record<string, string | number | boolean> | null>[];

  /**
   * Embeddings (if requested)
   */
  embeddings?: number[][][];
}

/**
 * Collection info
 */
export interface ChromaCollectionInfo {
  /**
   * Collection name
   */
  name: string;

  /**
   * Collection ID
   */
  id: string;

  /**
   * Collection metadata
   */
  metadata: ChromaCollectionMetadata | null;

  /**
   * Number of items in collection
   */
  count?: number;
}

/**
 * Get result from ChromaDB
 */
export interface ChromaGetResult {
  /**
   * Document IDs
   */
  ids: string[];

  /**
   * Documents
   */
  documents: Array<string | null>;

  /**
   * Metadata
   */
  metadatas: Array<Record<string, string | number | boolean> | null>;

  /**
   * Embeddings
   */
  embeddings: Array<number[] | null>;
}

/**
 * ChromaDB-specific storage metadata for KV operations
 * Stored in ChromaDB metadata to enable storage operations
 */
export interface ChromaMetadata {
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

  /**
   * Creation timestamp
   */
  _created?: number;

  /**
   * Last update timestamp
   */
  _updated?: number;
}

/**
 * Default embedding function that creates zero vectors
 */
export class DefaultEmbeddingFunction implements ChromaEmbeddingFunction {
  constructor(private dimension: number = 384) {}

  async generate(documents: string[]): Promise<number[][]> {
    // Generate zero vectors as placeholders
    // In production, use a real embedding model
    return documents.map(() => new Array(this.dimension).fill(0));
  }
}

/**
 * Extended BaseStorageAdapter with vector operations
 */
export interface ChromaDBStorageAdapter extends BaseStorageAdapter {
  /**
   * Create a collection
   */
  createCollection(
    name: string,
    metadata?: ChromaCollectionMetadata,
    embeddingFunction?: ChromaEmbeddingFunction
  ): Promise<void>;

  /**
   * Delete a collection
   */
  deleteCollection(name: string): Promise<void>;

  /**
   * List all collections
   */
  listCollections(): Promise<ChromaCollectionInfo[]>;

  /**
   * Get collection info
   */
  getCollection(name: string): Promise<ChromaCollectionInfo>;

  /**
   * Add documents to collection
   */
  addDocuments(collection: string, documents: ChromaDocument[]): Promise<void>;

  /**
   * Query collection by vector similarity
   */
  queryDocuments(
    collection: string,
    queryEmbeddings: number[][],
    params?: ChromaQueryParams
  ): Promise<ChromaQueryResult>;

  /**
   * Query collection by text (requires embedding function)
   */
  queryByText(
    collection: string,
    queryTexts: string[],
    params?: ChromaQueryParams
  ): Promise<ChromaQueryResult>;

  /**
   * Get documents by ID
   */
  getDocuments(
    collection: string,
    ids: string[],
    include?: ChromaInclude[]
  ): Promise<ChromaGetResult>;

  /**
   * Update document metadata
   */
  updateDocuments(
    collection: string,
    ids: string[],
    metadatas?: Record<string, string | number | boolean>[],
    documents?: string[],
    embeddings?: number[][]
  ): Promise<void>;

  /**
   * Delete documents
   */
  deleteDocuments(
    collection: string,
    ids?: string[],
    where?: ChromaWhereFilter,
    whereDocument?: ChromaWhereDocumentFilter
  ): Promise<string[]>;

  /**
   * Count documents in collection
   */
  countDocuments(collection: string): Promise<number>;

  /**
   * Peek at first n documents
   */
  peekDocuments(collection: string, limit?: number): Promise<ChromaGetResult>;
}
