/**
 * @fileoverview SQLite-vec adapter types for vector operations
 */

import { VectorMetric, VectorSearchResult } from '../../base-types';
import { SQLiteAdapterOptions } from '../sqlite/types';

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

// Re-export vector types from base-types
export type {
  VectorCollectionConfig,
  VectorData,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetric
} from '../../base-types';

/**
 * Vector insert options
 */
export interface VectorInsertOptions {
  /**
   * Additional metadata to store with the vector
   */
  metadata?: Record<string, any>;
}

// SQLite-vec specific search result extension
export interface SQLiteVecSearchResult extends VectorSearchResult {
  /**
   * Distance from query vector (lower = more similar)
   */
  distance: number;
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

// Re-export VectorOperations from base-types
export type { VectorOperations } from '../../base-types';
