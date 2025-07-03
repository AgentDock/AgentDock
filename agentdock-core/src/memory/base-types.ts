/**
 * @fileoverview Base types for memory layer
 * These extend storage types with memory-specific functionality
 * FRAMEWORK STANDARD - Import these instead of creating duplicates
 */

import { ConsolidationResult as BaseConsolidationResult } from '../storage/base-types';
import { MemoryData } from '../storage/types';

// Re-export for convenience
export type { MemoryData, MemoryData as Memory } from '../storage/types';

/**
 * Re-export ConsolidationResult from storage with proper typing
 * This ensures type safety while maintaining single source of truth
 */
export type ConsolidationResult = BaseConsolidationResult<MemoryData>;

/**
 * Decay result - SINGLE DEFINITION for entire framework
 * Used by lifecycle and episodic memory types
 */
export interface DecayResult {
  /** Number of memories processed */
  processed: number;

  /** Number of memories that underwent decay */
  decayed: number;

  /** Number of memories removed due to decay */
  removed: number;

  /** Average decay applied (0-1) */
  averageDecay: number;

  /** Additional metadata about the decay operation */
  metadata?: {
    /** Decay rules applied */
    rules?: string[];

    /** Duration of decay operation */
    duration?: number;

    /** IDs of memories that decayed */
    decayedIds?: string[];

    /** IDs of memories that were removed */
    removedIds?: string[];

    /** Total importance lost to decay */
    importanceLost?: number;

    /** Allow extension for future features */
    [key: string]: unknown;
  };
}

/**
 * Intelligence layer results - SINGLE DEFINITION
 */
export interface ImportanceScore {
  /** Overall importance score (0-1) */
  score: number;

  /** Breakdown of factors contributing to importance */
  factors: {
    /** Recency factor */
    recency: number;

    /** Frequency of access factor */
    frequency: number;

    /** Number of connections factor */
    connections: number;

    /** Semantic relevance factor */
    semanticRelevance: number;

    /** Emotional weight factor */
    emotionalWeight: number;
  };

  /** Confidence in the importance calculation */
  confidence: number;
}
