/**
 * @fileoverview PostgreSQL Vector adapter types using pgvector extension
 */

import { VectorMetric, VectorSearchOptions } from '../../base-types';
import { PostgreSQLAdapterOptions } from '../postgresql/types';

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

// Re-export vector types from base-types
export type {
  VectorCollectionConfig,
  VectorData,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetric
} from '../../base-types';

// PostgreSQL-specific search options extension
export interface PostgreSQLVectorSearchOptions extends VectorSearchOptions {
  /**
   * Number of results to return (alias for limit)
   */
  k?: number;

  /**
   * Whether to include similarity scores in results (default: true)
   */
  includeScore?: boolean;

  /**
   * Whether to include the vector data in results (default: false)
   */
  includeVector?: boolean;
}

// Re-export VectorOperations from base-types
export type { VectorOperations } from '../../base-types';
