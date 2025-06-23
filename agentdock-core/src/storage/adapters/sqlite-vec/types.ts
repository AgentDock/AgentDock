/**
 * @fileoverview SQLite-vec adapter types for vector operations
 */

import { SQLiteAdapterOptions } from '../sqlite/types';

/**
 * Vector similarity metrics supported by sqlite-vec
 */
export enum VectorMetric {
  EUCLIDEAN = 'euclidean', // L2 distance
  COSINE = 'cosine', // Cosine similarity
  DOT_PRODUCT = 'dot' // Dot product
}

/**
 * Configuration for SQLite-vec adapter
 */
export interface SQLiteVecAdapterOptions extends SQLiteAdapterOptions {
  /**
   * Enable vector operations
   * Will load sqlite-vec extension if not loaded
   */
  enableVector?: boolean;

  /**
   * Default vector dimension for collections
   */
  defaultDimension?: number;

  /**
   * Default similarity metric
   */
  defaultMetric?: VectorMetric;

  /**
   * Path to sqlite-vec extension (if not in default location)
   */
  vecExtensionPath?: string;
}

/**
 * Vector collection configuration
 */
export interface VectorCollectionConfig {
  /**
   * Collection name
   */
  name: string;

  /**
   * Vector dimension
   */
  dimension: number;

  /**
   * Similarity metric
   */
  metric?: VectorMetric;
}

/**
 * Vector data with metadata
 */
export interface VectorData {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Vector embedding
   */
  vector: number[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /**
   * Number of results to return
   */
  k?: number;

  /**
   * Similarity threshold (0-1 for cosine, varies for other metrics)
   */
  threshold?: number;

  /**
   * Filter by metadata
   */
  filter?: Record<string, any>;

  /**
   * Include vectors in results
   */
  includeVector?: boolean;

  /**
   * Include distance/similarity score
   */
  includeScore?: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /**
   * Document ID
   */
  id: string;

  /**
   * Similarity/distance score
   */
  score: number;

  /**
   * Optional vector
   */
  vector?: number[];

  /**
   * Document metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Row type for vector store
 */
export interface VectorRow {
  id: string;
  collection: string;
  vector_data: Buffer;
  metadata?: string | null;
  created_at?: number;
  updated_at?: number;
}

/**
 * Extension of base operations for vector support
 */
export interface VectorOperations {
  /**
   * Create a vector collection
   */
  createCollection(config: VectorCollectionConfig): Promise<void>;

  /**
   * Drop a vector collection
   */
  dropCollection(name: string): Promise<void>;

  /**
   * Insert vectors
   */
  insertVectors(collection: string, vectors: VectorData[]): Promise<void>;

  /**
   * Update vectors
   */
  updateVectors(collection: string, vectors: VectorData[]): Promise<void>;

  /**
   * Delete vectors
   */
  deleteVectors(collection: string, ids: string[]): Promise<void>;

  /**
   * Search for similar vectors
   */
  searchVectors(
    collection: string,
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>;

  /**
   * Get vector by ID
   */
  getVector(collection: string, id: string): Promise<VectorData | null>;

  /**
   * Check if collection exists
   */
  collectionExists(name: string): Promise<boolean>;

  /**
   * List all vector collections
   */
  listCollections(): Promise<string[]>;
}
