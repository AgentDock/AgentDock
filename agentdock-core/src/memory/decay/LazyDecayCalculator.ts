/**
 * @fileoverview LazyDecayCalculator - On-demand memory decay calculation
 *
 * Calculates memory decay on-demand when memories are accessed, providing
 * efficient decay without scheduled batch processes.
 *
 * Features:
 * - On-demand calculation during recall/access
 * - Respects neverDecay and customHalfLife settings
 * - Reinforcement logic for frequently accessed memories
 * - Zero-cost for memories that don't need decay updates
 *
 * @author AgentDock Core Team
 */

import { z } from 'zod';

import { LogCategory, logger } from '../../logging';
import { MemoryData } from '../../storage/types';

/**
 * Decay calculation result for a single memory
 */
export interface DecayCalculationResult {
  memoryId: string;
  oldResonance: number;
  newResonance: number;
  shouldUpdate: boolean;
  decayApplied: boolean;
  reinforcementApplied: boolean;
  reason: string;
}

/**
 * Zod schema for lazy decay configuration validation
 */
const LazyDecayConfigSchema = z.object({
  /** Default half-life in days for memories without custom settings */
  defaultHalfLife: z
    .number()
    .positive('defaultHalfLife must be positive')
    .default(30),

  /** Minimum resonance before marking memory for archival */
  archivalThreshold: z
    .number()
    .min(0, 'archivalThreshold must be >= 0')
    .max(1, 'archivalThreshold must be <= 1')
    .default(0.1),

  /** Enable reinforcement of frequently accessed memories */
  enableReinforcement: z.boolean().default(true),

  /** Reinforcement factor for accessed memories */
  reinforcementFactor: z
    .number()
    .positive('reinforcementFactor must be positive')
    .max(1, 'reinforcementFactor must be <= 1')
    .default(0.1),

  /** Maximum resonance cap to prevent over-reinforcement */
  maxResonance: z.number().min(1, 'maxResonance must be >= 1').default(2.0),

  /** Minimum time between updates (prevents excessive database writes) */
  minUpdateIntervalMs: z
    .number()
    .positive('minUpdateIntervalMs must be positive')
    .int('minUpdateIntervalMs must be an integer')
    .default(60000),

  /** Threshold for significant change to trigger updates (default: 0.1) */
  significantChangeThreshold: z
    .number()
    .min(0, 'significantChangeThreshold must be >= 0')
    .max(1, 'significantChangeThreshold must be <= 1')
    .default(0.1),

  /** Access count threshold for reinforcement (default: 5) */
  accessCountThreshold: z
    .number()
    .positive('accessCountThreshold must be positive')
    .int('accessCountThreshold must be an integer')
    .default(5)
});

/**
 * Configuration for lazy decay calculations
 */
export type LazyDecayConfig = z.infer<typeof LazyDecayConfigSchema>;

/**
 * LazyDecayCalculator - Efficient on-demand decay calculation
 *
 * Calculates decay only when memories are accessed, eliminating the need
 * for expensive scheduled batch processes while maintaining accuracy.
 */
export class LazyDecayCalculator {
  private config: LazyDecayConfig;

  constructor(config: Partial<LazyDecayConfig> = {}) {
    try {
      // Validate and parse configuration with Zod
      this.config = LazyDecayConfigSchema.parse(config);

      logger.debug(LogCategory.STORAGE, 'LazyDecayCalculator', 'Initialized', {
        config: this.config
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(`Invalid LazyDecayCalculator configuration: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Calculate decay for a single memory on-demand
   *
   * @param memory - Memory to calculate decay for
   * @param accessTime - Current access time (defaults to now)
   * @returns Decay calculation result
   */
  calculateDecay(
    memory: MemoryData,
    accessTime: number = Date.now()
  ): DecayCalculationResult {
    const result: DecayCalculationResult = {
      memoryId: memory.id,
      oldResonance: memory.resonance,
      newResonance: memory.resonance,
      shouldUpdate: false,
      decayApplied: false,
      reinforcementApplied: false,
      reason: 'no_change'
    };

    try {
      // Skip archived memories
      if (memory.status === 'archived') {
        result.reason = 'archived';
        return result;
      }

      // Skip memories marked as never decay
      if (memory.neverDecay) {
        result.reason = 'never_decay';

        // Still apply reinforcement if enabled and memory is FREQUENTLY accessed (LAZY behavior)
        if (
          this.config.enableReinforcement &&
          memory.reinforceable !== false &&
          memory.accessCount &&
          memory.accessCount > this.config.accessCountThreshold
        ) {
          // Only reinforce frequently accessed memories
          result.newResonance = this.applyReinforcement(memory.resonance);
          result.reinforcementApplied =
            result.newResonance !== memory.resonance;
          result.shouldUpdate = result.reinforcementApplied;
          result.reason = result.reinforcementApplied
            ? 'reinforcement_only'
            : 'never_decay';
        }

        return result;
      }

      // Check if enough time has passed since last update
      const timeSinceUpdate = accessTime - memory.updatedAt;
      if (timeSinceUpdate < this.config.minUpdateIntervalMs) {
        result.reason = 'too_recent';
        return result;
      }

      // Calculate time-based decay
      let halfLife = memory.customHalfLife ?? this.config.defaultHalfLife;

      // Apply temporal pattern influence on decay rate
      if (memory.metadata?.temporalInsights) {
        const insights = memory.metadata.temporalInsights as
          | { patterns: Array<{ type: string; confidence: number }> }
          | undefined;
        if (insights?.patterns && Array.isArray(insights.patterns)) {
          const patterns = insights.patterns;

          // Memories from burst periods decay slower (up to 30% slower)
          const burstPattern = patterns.find((p) => p.type === 'burst');
          if (burstPattern) {
            halfLife *= 1 + burstPattern.confidence * 0.3;
          }

          // Memories from regular daily patterns also decay slower (up to 20% slower)
          const dailyPattern = patterns.find((p) => p.type === 'daily');
          if (dailyPattern && dailyPattern.confidence > 0.7) {
            halfLife *= 1.2;
          }
        }
      }

      const daysSinceLastAccess =
        (accessTime - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);

      // Exponential decay formula: newValue = originalValue * (0.5)^(time/halfLife)
      const decayFactor = Math.pow(0.5, daysSinceLastAccess / halfLife);
      const decayedResonance = memory.resonance * decayFactor;

      result.newResonance = decayedResonance;
      result.decayApplied = decayedResonance !== memory.resonance;

      // Apply reinforcement if enabled and memory is FREQUENTLY accessed (LAZY behavior)
      if (
        this.config.enableReinforcement &&
        memory.reinforceable !== false &&
        memory.accessCount &&
        memory.accessCount > this.config.accessCountThreshold
      ) {
        // Only reinforce frequently accessed memories
        result.newResonance = this.applyReinforcement(result.newResonance);
        result.reinforcementApplied = result.newResonance !== decayedResonance;
      }

      // Determine if update is needed - LAZY: Only update on significant changes (10%+)
      const significantChange =
        Math.abs(result.newResonance - memory.resonance) >
        this.config.significantChangeThreshold;
      result.shouldUpdate = significantChange;

      // Set reason
      if (result.decayApplied && result.reinforcementApplied) {
        result.reason = 'decay_and_reinforcement';
      } else if (result.decayApplied) {
        result.reason = 'decay_applied';
      } else if (result.reinforcementApplied) {
        result.reason = 'reinforcement_applied';
      } else {
        result.reason = 'no_significant_change';
      }

      // Cap resonance at maximum
      result.newResonance = Math.min(
        result.newResonance,
        this.config.maxResonance
      );

      logger.debug(
        LogCategory.STORAGE,
        'LazyDecayCalculator',
        'Decay calculated',
        {
          memoryId: memory.id,
          oldResonance: result.oldResonance,
          newResonance: result.newResonance,
          daysSinceAccess: daysSinceLastAccess,
          halfLife,
          reason: result.reason
        }
      );

      return result;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'LazyDecayCalculator',
        'Decay calculation failed',
        {
          memoryId: memory.id,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      result.reason = 'calculation_error';
      return result;
    }
  }

  /**
   * Calculate decay for multiple memories efficiently
   *
   * @param memories - Array of memories to process
   * @param accessTime - Current access time (defaults to now)
   * @returns Array of decay calculation results
   */
  calculateBatchDecay(
    memories: MemoryData[],
    accessTime: number = Date.now()
  ): DecayCalculationResult[] {
    const startTime = Date.now();

    const results = memories.map((memory) =>
      this.calculateDecay(memory, accessTime)
    );

    const processingTime = Date.now() - startTime;
    const updatesNeeded = results.filter((r) => r.shouldUpdate).length;

    logger.debug(
      LogCategory.STORAGE,
      'LazyDecayCalculator',
      'Batch decay calculated',
      {
        totalMemories: memories.length,
        updatesNeeded,
        processingTimeMs: processingTime,
        avgTimePerMemory: processingTime / memories.length
      }
    );

    return results;
  }

  /**
   * Check if a memory should be archived based on low resonance
   *
   * @param memory - Memory to check
   * @returns Whether memory should be archived
   */
  shouldArchive(memory: MemoryData): boolean {
    if (memory.neverDecay || memory.status === 'archived') {
      return false;
    }

    return memory.resonance < this.config.archivalThreshold;
  }

  /**
   * Get memories that need archival from a batch
   *
   * @param memories - Array of memories to check
   * @returns Array of memory IDs that should be archived
   */
  getMemoriesToArchive(memories: MemoryData[]): string[] {
    return memories
      .filter((memory) => this.shouldArchive(memory))
      .map((memory) => memory.id);
  }

  /**
   * Apply reinforcement to resonance value
   *
   * @param currentResonance - Current resonance value
   * @returns New resonance value with reinforcement applied
   */
  private applyReinforcement(currentResonance: number): number {
    const reinforcement = currentResonance * this.config.reinforcementFactor;
    const newResonance = currentResonance + reinforcement;

    // Cap at maximum resonance
    return Math.min(newResonance, this.config.maxResonance);
  }

  /**
   * Update configuration at runtime
   *
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<LazyDecayConfig>): void {
    try {
      // Validate the merged configuration with Zod
      const mergedConfig = { ...this.config, ...newConfig };
      this.config = LazyDecayConfigSchema.parse(mergedConfig);

      logger.debug(
        LogCategory.STORAGE,
        'LazyDecayCalculator',
        'Configuration updated',
        {
          newConfig
        }
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(
          `Invalid LazyDecayCalculator configuration update: ${issues}`
        );
      }
      throw error;
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current decay configuration
   */
  getConfig(): LazyDecayConfig {
    return { ...this.config };
  }
}
