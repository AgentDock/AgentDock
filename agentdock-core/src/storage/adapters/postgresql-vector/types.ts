/**
 * @fileoverview PostgreSQL Vector adapter types using pgvector extension
 */

import { PostgreSQLAdapterOptions } from '../postgresql/types';

/**
 * Vector similarity metrics supported by pgvector
 */
export enum VectorMetric {
  EUCLIDEAN = 'euclidean', // L2 distance
  COSINE = 'cosine', // Cosine distance
  INNER_PRODUCT = 'ip' // Inner product (negative)
}

/**
 * Vector index types supported by pgvector
 */
export enum VectorIndexType {
  IVFFLAT = 'ivfflat', // IVF Flat index
  HNSW = 'hnsw' // HNSW index (if available)
}

/**
 * Configuration for PostgreSQL Vector adapter
 */
export interface PostgreSQLVectorAdapterOptions
  extends PostgreSQLAdapterOptions {
  /**
   * Enable vector operations
   * Will create pgvector extension if not exists
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
   * Default index type
   */
  defaultIndexType?: VectorIndexType;

  /**
   * IVF Flat index configuration
   */
  ivfflat?: {
    lists?: number; // Number of lists (default: dimension / 16)
    probes?: number; // Number of probes for searches (default: 1)
  };
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

  /**
   * Index configuration
   */
  index?: {
    type: VectorIndexType;
    lists?: number; // For IVF Flat
    m?: number; // For HNSW (if supported)
    efConstruction?: number; // For HNSW
  };
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
