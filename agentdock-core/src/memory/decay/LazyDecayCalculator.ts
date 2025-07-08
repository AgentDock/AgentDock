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
 * Configuration for lazy decay calculations
 */
export interface LazyDecayConfig {
  /** Default half-life in days for memories without custom settings */
  defaultHalfLife: number;
  
  /** Minimum resonance before marking memory for archival */
  archivalThreshold: number;
  
  /** Enable reinforcement of frequently accessed memories */
  enableReinforcement: boolean;
  
  /** Reinforcement factor for accessed memories */
  reinforcementFactor: number;
  
  /** Maximum resonance cap to prevent over-reinforcement */
  maxResonance: number;
  
  /** Minimum time between updates (prevents excessive database writes) */
  minUpdateIntervalMs: number;
}

/**
 * LazyDecayCalculator - Efficient on-demand decay calculation
 *
 * Calculates decay only when memories are accessed, eliminating the need
 * for expensive scheduled batch processes while maintaining accuracy.
 */
export class LazyDecayCalculator {
  private config: LazyDecayConfig;

  constructor(config: Partial<LazyDecayConfig> = {}) {
    this.config = {
      defaultHalfLife: config.defaultHalfLife ?? 30, // 30 days default
      archivalThreshold: config.archivalThreshold ?? 0.1,
      enableReinforcement: config.enableReinforcement ?? true,
      reinforcementFactor: config.reinforcementFactor ?? 0.1,
      maxResonance: config.maxResonance ?? 2.0,
      minUpdateIntervalMs: config.minUpdateIntervalMs ?? 60000, // 1 minute
      ...config
    };

    logger.debug(LogCategory.STORAGE, 'LazyDecayCalculator', 'Initialized', {
      config: this.config
    });
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
        if (this.config.enableReinforcement && 
            memory.reinforceable !== false && 
            memory.accessCount && memory.accessCount > 5) { // Only reinforce frequently accessed memories
          result.newResonance = this.applyReinforcement(memory.resonance);
          result.reinforcementApplied = result.newResonance !== memory.resonance;
          result.shouldUpdate = result.reinforcementApplied;
          result.reason = result.reinforcementApplied ? 'reinforcement_only' : 'never_decay';
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
      const halfLife = memory.customHalfLife ?? this.config.defaultHalfLife;
      const daysSinceLastAccess = (accessTime - memory.lastAccessedAt) / (1000 * 60 * 60 * 24);
      
      // Exponential decay formula: newValue = originalValue * (0.5)^(time/halfLife)
      const decayFactor = Math.pow(0.5, daysSinceLastAccess / halfLife);
      const decayedResonance = memory.resonance * decayFactor;
      
      result.newResonance = decayedResonance;
      result.decayApplied = decayedResonance !== memory.resonance;

      // Apply reinforcement if enabled and memory is FREQUENTLY accessed (LAZY behavior)
      if (this.config.enableReinforcement && 
          memory.reinforceable !== false && 
          memory.accessCount && memory.accessCount > 5) { // Only reinforce frequently accessed memories
        result.newResonance = this.applyReinforcement(result.newResonance);
        result.reinforcementApplied = result.newResonance !== decayedResonance;
      }

      // Determine if update is needed - LAZY: Only update on significant changes (10%+)
      const significantChange = Math.abs(result.newResonance - memory.resonance) > 0.1;
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
      result.newResonance = Math.min(result.newResonance, this.config.maxResonance);

      logger.debug(LogCategory.STORAGE, 'LazyDecayCalculator', 'Decay calculated', {
        memoryId: memory.id,
        oldResonance: result.oldResonance,
        newResonance: result.newResonance,
        daysSinceAccess: daysSinceLastAccess,
        halfLife,
        reason: result.reason
      });

      return result;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'LazyDecayCalculator', 'Decay calculation failed', {
        memoryId: memory.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
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
    
    const results = memories.map(memory => this.calculateDecay(memory, accessTime));
    
    const processingTime = Date.now() - startTime;
    const updatesNeeded = results.filter(r => r.shouldUpdate).length;
    
    logger.debug(LogCategory.STORAGE, 'LazyDecayCalculator', 'Batch decay calculated', {
      totalMemories: memories.length,
      updatesNeeded,
      processingTimeMs: processingTime,
      avgTimePerMemory: processingTime / memories.length
    });

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
      .filter(memory => this.shouldArchive(memory))
      .map(memory => memory.id);
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
    this.config = { ...this.config, ...newConfig };
    
    logger.debug(LogCategory.STORAGE, 'LazyDecayCalculator', 'Configuration updated', {
      newConfig
    });
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