/**
 * @fileoverview Base types shared across storage adapters
 * These are storage-specific types that multiple adapters need
 * Import these instead of creating duplicates
 */

import { BaseMemoryItem, MemoryType } from '../shared/types/memory';
import { ConnectionType } from './types';

// Re-export core enums from their authoritative sources
export { MemoryType } from '../shared/types/memory';
export type { ConnectionType } from './types';

/**
 * Vector operations interface for ALL vector database adapters
 * Single source of truth - no duplicates allowed
 */
export interface VectorOperations {
  createCollection(config: VectorCollectionConfig): Promise<void>;
  dropCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  listCollections(): Promise<string[]>;
  insertVectors(collection: string, vectors: VectorData[]): Promise<void>;
  updateVectors(collection: string, vectors: VectorData[]): Promise<void>;
  deleteVectors(collection: string, ids: string[]): Promise<void>;
  searchVectors(
    collection: string,
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>;
  getVector(collection: string, id: string): Promise<VectorData | null>;
}

/**
 * Vector similarity metrics supported across adapters
 * Note: Different adapters may support different subsets
 */
export type VectorMetric =
  | 'euclidean' // L2 distance (supported by all)
  | 'cosine' // Cosine similarity (supported by all)
  | 'dot_product' // Dot product (alias for inner product)
  | 'ip' // Inner product (PostgreSQL pgvector)
  | 'dot'; // Dot product (SQLite-vec)

/**
 * Vector index types
 */
export type VectorIndexType =
  | 'ivfflat' // IVF Flat index (PostgreSQL)
  | 'hnsw' // HNSW index (PostgreSQL)
  | 'flat' // Flat/brute-force search
  | string; // Allow adapter-specific types

export interface VectorCollectionConfig {
  name: string;
  dimension: number;
  metric?: VectorMetric;
  index?: {
    type: VectorIndexType;
    [key: string]: any; // Allow adapter-specific options
  };
  metadata?: Record<string, unknown>;
}

export interface VectorData {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
  threshold?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Batch processing configuration - unified for storage and memory layers
 */
export interface BatchProcessorConfig {
  batchSize: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay?: number;
  onError?: 'continue' | 'stop';
  timeout?: number;
}

/**
 * Batch processing results - unified across all batch operations
 */
export interface BatchResult {
  batchId: string;
  processed: number;
  succeeded: number;
  failed: number;
  duration: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * Database-specific types for PostgreSQL/SQLite memory operations
 */
export interface DatabaseMemoryQuery {
  userId: string;
  agentId: string;
  type?: MemoryType;
  minImportance?: number;
  maxAge?: number;
  keywords?: string[];
  limit?: number;
  offset?: number;
}

export interface DatabaseRecallOptions {
  query: string;
  userId: string;
  agentId: string;
  limit?: number;
  threshold?: number;
  includeConnections?: boolean;
}

export interface DatabaseDecayRules {
  type: 'age' | 'access' | 'importance';
  threshold: number;
  action: 'decay' | 'remove';
  rate?: number;
}

/**
 * Consolidation result for storage layer operations
 * FRAMEWORK STANDARD - Single definition for storage utilities
 * Uses BaseMemoryItem to maintain type safety without circular dependencies
 */
export interface ConsolidationResult<T = BaseMemoryItem> {
  /** Original memories that were consolidated */
  original: T[];

  /** The new consolidated memory */
  consolidated: T;

  /** Strategy used for consolidation */
  strategy: 'merge' | 'synthesize' | 'abstract' | 'hierarchy';

  /** Confidence in the consolidation (0-1) */
  confidence: number;

  /** Additional metadata about the consolidation */
  metadata?: {
    /** IDs of memories that were preserved */
    preservedIds?: string[];

    /** Algorithm used for consolidation */
    algorithm?: string;

    /** Similarity scores between memories */
    similarityScores?: number[];

    /** Time taken for consolidation */
    duration?: number;

    /** Reason for consolidation */
    reason?: string;

    /** Allow extension for future features */
    [key: string]: unknown;
  };
}
