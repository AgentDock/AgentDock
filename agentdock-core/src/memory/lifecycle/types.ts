/**
 * @fileoverview Lifecycle Types - Memory evolution and lifecycle interfaces
 *
 * Provides type definitions for memory evolution tracking, lifecycle management,
 * and automated memory promotion/cleanup operations.
 *
 * @author AgentDock Core Team
 */

import { DecayResult } from '../base-types';
import { DecayConfiguration, DecayOperationResult } from '../decay/types';

/**
 * Types of changes that can occur to a memory over its lifecycle.
 */
export type MemoryChangeType =
  | 'importance' // Importance score changed
  | 'resonance' // Resonance score changed
  | 'content' // Content was modified
  | 'type' // Memory type changed (e.g., episodic → semantic)
  | 'connections' // Connections were added/removed
  | 'metadata' // Metadata was updated
  | 'access' // Access patterns changed
  | 'decay' // Memory underwent decay
  | 'promotion' // Memory was promoted between types
  | 'consolidation' // Memory was consolidated with others
  | 'deletion'; // Memory was marked for deletion

/**
 * Record of a single change to a memory over time.
 */
export interface MemoryEvolution {
  /** Unique identifier for this evolution record */
  id: string;

  /** ID of the memory that changed */
  memoryId: string;

  /** When this change occurred */
  timestamp: Date;

  /** Type of change that occurred */
  changeType: MemoryChangeType;

  /** Previous value before the change */
  previousValue: any;

  /** New value after the change */
  newValue: any;

  /** Reason for the change */
  reason: string;

  /** System or process that caused the change */
  source?: string;

  /** Additional context about the change */
  metadata?: Record<string, any>;
}

/**
 * Configuration for memory promotion between types.
 */
export interface PromotionConfiguration {
  /** Age in days before episodic memories can be promoted to semantic */
  episodicToSemanticDays: number;

  /** Minimum importance score required for promotion */
  minImportanceForPromotion: number;

  /** Minimum access count required for promotion */
  minAccessCountForPromotion: number;

  /** Whether to preserve original episodic memory after promotion */
  preserveOriginal?: boolean;

  /** Custom promotion rules (JavaScript expressions) */
  customPromotionRules?: Array<{
    id: string;
    name: string;
    condition: string;
    fromType: string;
    toType: string;
    enabled: boolean;
  }>;
}

/**
 * Configuration for memory cleanup operations.
 */
export interface CleanupConfiguration {
  /** Resonance threshold below which memories are deleted */
  deleteThreshold: number;

  /** Whether to archive memories before deletion */
  archiveEnabled: boolean;

  /** Maximum number of memories per agent */
  maxMemoriesPerAgent: number;

  /** Archive storage location pattern */
  archiveKeyPattern?: string;

  /** TTL for archived memories in seconds */
  archiveTTL?: number;

  /** Whether to compress memories when archiving */
  compressArchive?: boolean;
}

/**
 * Combined lifecycle configuration.
 */
export interface LifecycleConfig {
  /** Decay configuration */
  decayConfig: DecayConfiguration;

  /** Promotion configuration */
  promotionConfig: PromotionConfiguration;

  /** Cleanup configuration */
  cleanupConfig: CleanupConfiguration;
}

/**
 * Result of a memory promotion operation.
 */
export interface PromotionResult {
  /** Number of memories evaluated for promotion */
  candidateCount: number;

  /** Number of memories actually promoted */
  promotedCount: number;

  /** Details of promoted memories */
  promotions?: Array<{
    memoryId: string;
    fromType: string;
    toType: string;
    reason: string;
  }>;

  /** Any errors encountered */
  errors?: string[];
}

/**
 * Result of a cleanup operation.
 */
export interface CleanupResult {
  /** Number of memories evaluated for cleanup */
  evaluatedCount: number;

  /** Number of memories archived */
  archivedCount: number;

  /** Number of memories deleted */
  deletedCount: number;

  /** Storage space freed (approximate bytes) */
  spaceFeed?: number;

  /** Any errors encountered */
  errors?: string[];
}

/**
 * Combined result of all lifecycle operations.
 */
export interface LifecycleResult {
  /** Decay operation results */
  decay: DecayResult;

  /** Promotion operation results */
  promotion: PromotionResult;

  /** Cleanup operation results */
  cleanup: CleanupResult;

  /** Memory limit enforcement results */
  limits?: {
    enforced: boolean;
    removedCount: number;
    method: 'oldest' | 'lowest-resonance' | 'custom';
  };

  /** When the lifecycle operation completed */
  timestamp: Date;

  /** Total operation duration in milliseconds */
  durationMs?: number;
}

/**
 * Insights about memory lifecycle patterns.
 */
export interface LifecycleInsights {
  /** Total number of changes tracked */
  totalChanges: number;

  /** Number of importance changes */
  importanceChanges: number;

  /** Average lifespan of memories (in days) */
  averageLifespan: number;

  /** Most common decay pattern */
  decayPattern: 'linear' | 'exponential' | 'sudden' | 'stable';

  /** Memory promotion success rate */
  promotionSuccessRate?: number;

  /** Most common change types */
  changeTypeDistribution: Record<MemoryChangeType, number>;

  /** Trend analysis */
  trends?: {
    growthRate: number; // Memories per day
    retentionRate: number; // Percentage surviving 30 days
    qualityTrend: 'improving' | 'declining' | 'stable';
  };
}
