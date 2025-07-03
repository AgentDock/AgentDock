/**
 * @fileoverview MemoryLifecycleManager - Orchestrate complete memory lifecycle
 *
 * Coordinates decay, promotion, and cleanup operations for automated memory
 * management. Integrates with existing storage adapters and intelligence layer.
 *
 * @example
 * ```typescript
 * const lifecycleConfig: LifecycleConfig = {
 *   decayConfig: {
 *     agentId: 'therapy_agent',
 *     rules: [
 *       {
 *         id: 'critical_info',
 *         name: 'Critical Information',
 *         condition: "keywords.includes('trauma')",
 *         neverDecay: true,
 *         enabled: true
 *       }
 *     ],
 *     defaultDecayRate: 0.05,
 *     decayInterval: 24 * 60 * 60 * 1000
 *   },
 *   promotionConfig: {
 *     episodicToSemanticDays: 30,
 *     minImportanceForPromotion: 0.6,
 *     minAccessCountForPromotion: 3
 *   },
 *   cleanupConfig: {
 *     deleteThreshold: 0.1,
 *     archiveEnabled: true,
 *     maxMemoriesPerAgent: 10000
 *   }
 * };
 *
 * const manager = new MemoryLifecycleManager(storage, lifecycleConfig);
 * const result = await manager.runLifecycle('therapy_agent');
 * ```
 *
 * @author AgentDock Core Team
 */

import { LogCategory, logger } from '../../logging';
import { StorageProvider } from '../../storage';
import { generateId } from '../../storage/utils';
import { ConfigurableDecayEngine } from '../decay/ConfigurableDecayEngine';
import { Memory, MemoryType } from '../types/common';
import { MemoryEvolutionTracker } from './MemoryEvolutionTracker';
import {
  CleanupConfiguration,
  CleanupResult,
  LifecycleConfig,
  LifecycleResult,
  PromotionConfiguration,
  PromotionResult
} from './types';

/**
 * Orchestrates complete memory lifecycle management.
 *
 * Key features:
 * - Automated decay with user-defined rules
 * - Memory promotion between types (episodic → semantic)
 * - Cleanup and archival operations
 * - Memory limit enforcement
 * - Comprehensive tracking and insights
 */
export class MemoryLifecycleManager {
  private readonly storage: StorageProvider;
  private readonly config: LifecycleConfig;
  private readonly decayEngine: ConfigurableDecayEngine;
  private readonly evolutionTracker: MemoryEvolutionTracker;

  /**
   * Creates a new MemoryLifecycleManager.
   *
   * @param storage - Storage provider for memory operations
   * @param config - Lifecycle configuration
   */
  constructor(storage: StorageProvider, config: LifecycleConfig) {
    this.storage = storage;
    this.config = config;
    this.decayEngine = new ConfigurableDecayEngine(storage, config.decayConfig);
    this.evolutionTracker = new MemoryEvolutionTracker(storage);

    logger.debug(
      LogCategory.STORAGE,
      'MemoryLifecycleManager',
      'Initialized lifecycle manager',
      {
        agentId: config.decayConfig.agentId,
        decayRules: config.decayConfig.rules.length,
        promotionEnabled: config.promotionConfig.episodicToSemanticDays > 0,
        cleanupEnabled: config.cleanupConfig.deleteThreshold < 1.0
      }
    );
  }

  /**
   * Run complete lifecycle management for an agent.
   *
   * @param userId - User identifier
   * @param agentId - Agent identifier
   * @returns Promise resolving to lifecycle operation results
   */
  async runLifecycle(
    userId: string,
    agentId: string
  ): Promise<LifecycleResult> {
    const startTime = Date.now();

    logger.info(
      LogCategory.STORAGE,
      'MemoryLifecycleManager',
      'Starting lifecycle management',
      {
        userId,
        agentId
      }
    );

    try {
      // 1. Apply decay rules
      const decayResult = await this.decayEngine.applyDecay(userId, agentId);

      // 2. Promote old episodic memories to semantic
      const promotionResult = await this.promoteMemories(userId, agentId);

      // 3. Clean up low-resonance memories
      const cleanupResult = await this.cleanupMemories(userId, agentId);

      // 4. Enforce memory limits
      const limitsResult = await this.enforceMemoryLimits(userId, agentId);

      const result: LifecycleResult = {
        decay: decayResult,
        promotion: promotionResult,
        cleanup: cleanupResult,
        limits: limitsResult,
        timestamp: new Date(),
        durationMs: Date.now() - startTime
      };

      logger.info(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Lifecycle management completed',
        {
          userId,
          agentId,
          decayUpdated: result.decay.decayed,
          decayDeleted: result.decay.removed,
          promoted: result.promotion.promotedCount,
          cleaned: result.cleanup.deletedCount,
          durationMs: result.durationMs
        }
      );

      return result;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Lifecycle management failed',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Promote old, important episodic memories to semantic memories.
   *
   * @private
   */
  private async promoteMemories(
    userId: string,
    agentId: string
  ): Promise<PromotionResult> {
    const config = this.config.promotionConfig;
    const cutoffTime =
      Date.now() - config.episodicToSemanticDays * 24 * 60 * 60 * 1000;

    try {
      // Get episodic memories older than cutoff
      const candidateMemories = await this.getEpisodicCandidates(
        userId,
        agentId,
        cutoffTime,
        config
      );

      if (candidateMemories.length === 0) {
        return {
          candidateCount: 0,
          promotedCount: 0,
          promotions: []
        };
      }

      const promotions: Array<{
        memoryId: string;
        fromType: string;
        toType: string;
        reason: string;
      }> = [];

      let promotedCount = 0;

      for (const memory of candidateMemories) {
        try {
          // Convert to semantic memory
          const semanticMemory = await this.convertToSemantic(memory);

          // Store semantic memory
          const semanticKey = `memory:${userId}:${agentId}:${semanticMemory.id}`;
          await this.storage.set(semanticKey, semanticMemory);

          // Track evolution
          await this.evolutionTracker.trackEvolution(memory.id, {
            changeType: 'promotion',
            previousValue: 'episodic',
            newValue: 'semantic',
            reason: `Lifecycle promotion: age ${config.episodicToSemanticDays} days, importance ${memory.importance}, access count ${memory.accessCount}`
          });

          // Remove original episodic memory if not preserving
          if (!config.preserveOriginal) {
            const episodicKey = `memory:${userId}:${agentId}:${memory.id}`;
            await this.storage.delete(episodicKey);
          }

          promotions.push({
            memoryId: memory.id,
            fromType: MemoryType.EPISODIC,
            toType: MemoryType.SEMANTIC,
            reason: 'Age and importance criteria met'
          });

          promotedCount++;
        } catch (error) {
          logger.warn(
            LogCategory.STORAGE,
            'MemoryLifecycleManager',
            'Failed to promote memory',
            {
              memoryId: memory.id,
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }

      logger.info(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory promotion completed',
        {
          userId,
          agentId,
          candidateCount: candidateMemories.length,
          promotedCount
        }
      );

      return {
        candidateCount: candidateMemories.length,
        promotedCount,
        promotions
      };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory promotion failed',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      return {
        candidateCount: 0,
        promotedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Clean up memories through archival and deletion.
   *
   * @private
   */
  private async cleanupMemories(
    userId: string,
    agentId: string
  ): Promise<CleanupResult> {
    const config = this.config.cleanupConfig;

    try {
      // Get all memories for evaluation
      const allMemories = await this.getAllAgentMemories(userId, agentId);

      if (allMemories.length === 0) {
        return {
          evaluatedCount: 0,
          archivedCount: 0,
          deletedCount: 0
        };
      }

      // Filter memories for cleanup (below threshold)
      const lowResonanceMemories = allMemories.filter(
        (memory) => (memory.resonance || 1.0) < config.deleteThreshold
      );

      let archivedCount = 0;
      let deletedCount = 0;

      for (const memory of lowResonanceMemories) {
        try {
          // Archive if enabled
          if (config.archiveEnabled) {
            await this.archiveMemory(userId, agentId, memory, config);
            archivedCount++;
          }

          // Delete from primary storage
          const memoryKey = `memory:${userId}:${agentId}:${memory.id}`;
          await this.storage.delete(memoryKey);
          deletedCount++;

          // Track evolution
          await this.evolutionTracker.trackEvolution(memory.id, {
            changeType: 'deletion',
            previousValue: 'active',
            newValue: 'deleted',
            reason: `Cleanup: resonance ${memory.resonance} below threshold ${config.deleteThreshold}`
          });
        } catch (error) {
          logger.warn(
            LogCategory.STORAGE,
            'MemoryLifecycleManager',
            'Failed to cleanup memory',
            {
              memoryId: memory.id,
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }

      logger.info(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory cleanup completed',
        {
          userId,
          agentId,
          evaluatedCount: allMemories.length,
          archivedCount,
          deletedCount
        }
      );

      return {
        evaluatedCount: allMemories.length,
        archivedCount,
        deletedCount
      };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory cleanup failed',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      return {
        evaluatedCount: 0,
        archivedCount: 0,
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Enforce memory limits by removing oldest or lowest-resonance memories.
   *
   * @private
   */
  private async enforceMemoryLimits(
    userId: string,
    agentId: string
  ): Promise<{
    enforced: boolean;
    removedCount: number;
    method: 'oldest' | 'lowest-resonance' | 'custom';
  }> {
    const maxMemories = this.config.cleanupConfig.maxMemoriesPerAgent;

    try {
      const allMemories = await this.getAllAgentMemories(userId, agentId);

      if (allMemories.length <= maxMemories) {
        return {
          enforced: false,
          removedCount: 0,
          method: 'custom'
        };
      }

      const excessCount = allMemories.length - maxMemories;

      // Sort by resonance (ascending) then by age (oldest first)
      const sortedMemories = allMemories.sort((a, b) => {
        const resonanceDiff = (a.resonance || 1.0) - (b.resonance || 1.0);
        if (Math.abs(resonanceDiff) < 0.001) {
          // If resonance is similar, prefer older memories for removal
          return a.createdAt - b.createdAt;
        }
        return resonanceDiff;
      });

      let removedCount = 0;

      // Remove excess memories
      for (let i = 0; i < excessCount; i++) {
        const memory = sortedMemories[i];

        try {
          // Archive if enabled
          if (this.config.cleanupConfig.archiveEnabled) {
            await this.archiveMemory(
              userId,
              agentId,
              memory,
              this.config.cleanupConfig
            );
          }

          // Delete from primary storage
          const memoryKey = `memory:${userId}:${agentId}:${memory.id}`;
          await this.storage.delete(memoryKey);
          removedCount++;

          // Track evolution
          await this.evolutionTracker.trackEvolution(memory.id, {
            changeType: 'deletion',
            previousValue: 'active',
            newValue: 'deleted',
            reason: `Memory limit enforcement: agent has ${allMemories.length} memories, limit is ${maxMemories}`
          });
        } catch (error) {
          logger.warn(
            LogCategory.STORAGE,
            'MemoryLifecycleManager',
            'Failed to remove memory for limit enforcement',
            {
              memoryId: memory.id,
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }

      logger.info(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory limits enforced',
        {
          userId,
          agentId,
          totalMemories: allMemories.length,
          limit: maxMemories,
          removedCount
        }
      );

      return {
        enforced: true,
        removedCount,
        method: 'lowest-resonance'
      };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Memory limit enforcement failed',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      return {
        enforced: false,
        removedCount: 0,
        method: 'custom'
      };
    }
  }

  /**
   * Get episodic memories that are candidates for promotion.
   *
   * @private
   */
  private async getEpisodicCandidates(
    userId: string,
    agentId: string,
    cutoffTime: number,
    config: PromotionConfiguration
  ): Promise<Memory[]> {
    const allMemories = await this.getAllAgentMemories(userId, agentId);

    return allMemories.filter(
      (memory) =>
        memory.type === MemoryType.EPISODIC &&
        memory.createdAt < cutoffTime &&
        memory.importance >= config.minImportanceForPromotion &&
        memory.accessCount >= config.minAccessCountForPromotion
    );
  }

  /**
   * Convert episodic memory to semantic memory.
   *
   * @private
   */
  private async convertToSemantic(episodicMemory: Memory): Promise<Memory> {
    return {
      ...episodicMemory,
      id: generateId('sem'), // New ID for semantic memory
      type: MemoryType.SEMANTIC,
      updatedAt: Date.now(),
      metadata: {
        ...episodicMemory.metadata,
        originalType: MemoryType.EPISODIC,
        originalId: episodicMemory.id,
        promotedAt: Date.now(),
        promotionReason: 'lifecycle_age_and_importance'
      }
    };
  }

  /**
   * Archive a memory before deletion.
   *
   * @private
   */
  private async archiveMemory(
    userId: string,
    agentId: string,
    memory: Memory,
    config: CleanupConfiguration
  ): Promise<void> {
    const archiveKey = config.archiveKeyPattern
      ? config.archiveKeyPattern
          .replace('{agentId}', agentId)
          .replace('{memoryId}', memory.id)
      : `archive:${agentId}:${memory.id}`;

    const archiveData = {
      ...memory,
      archivedAt: Date.now(),
      originalKey: `memory:${userId}:${agentId}:${memory.id}`
    };

    await this.storage.set(archiveKey, archiveData, {
      ttlSeconds: config.archiveTTL || 365 * 24 * 60 * 60 // Default 1 year
    });
  }

  /**
   * Get all memories for an agent.
   *
   * @private
   */
  private async getAllAgentMemories(
    userId: string,
    agentId: string
  ): Promise<Memory[]> {
    const memories: Memory[] = [];

    try {
      const memoryKeys = await this.storage.list(
        `memory:${userId}:${agentId}:`
      );

      for (const key of memoryKeys) {
        const memory = await this.storage.get<Memory>(key);
        if (memory) {
          memories.push(memory);
        }
      }

      return memories;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryLifecycleManager',
        'Failed to retrieve some memories',
        {
          userId,
          agentId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return memories;
    }
  }
}
