/**
 * ProceduralMemory - Action pattern storage
 *
 * THIN wrapper - delegates all operations to storage layer
 */

import { LogCategory, logger } from '../../../logging';
import { MemoryType } from '../../../shared/types/memory';
import { StorageProvider } from '../../../storage/types';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { BaseMemoryType } from '../base/BaseMemoryType';
import {
  LearningResult,
  PatternMatchResult,
  PROCEDURAL_MEMORY_DEFAULTS,
  ProceduralMemoryConfig,
  ProceduralMemoryData,
  ProceduralMemoryStats,
  StoreProceduralOptions
} from './ProceduralMemoryTypes';

// Add token estimation utility (same as WorkingMemory)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ProceduralMemory extends BaseMemoryType<ProceduralMemoryConfig> {
  constructor(
    storage: StorageProvider,
    private proceduralConfig: ProceduralMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, proceduralConfig, intelligenceConfig);
  }

  /**
   * Store procedural memory - DELEGATE to storage
   */
  protected async doStore(
    userId: string,
    agentId: string,
    content: string,
    options?: {
      trigger?: string;
      action?: string;
      outcome?: string;
      success?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }

    const id = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // Create COMPLETE data at write time
    const memoryData = {
      id,
      userId,
      agentId,
      type: MemoryType.PROCEDURAL,
      content,
      importance: 0.8, // Procedural memories are valuable
      resonance: 1.0, // Patterns don't decay
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,

      // Required fields
      sessionId: `session_${Date.now()}`,
      tokenCount: estimateTokens(content),

      // Type-specific
      metadata: {
        trigger: options?.trigger || content,
        action: options?.action || 'unknown',
        outcome: options?.outcome || 'pending',
        success: options?.success ?? true,
        ...options?.metadata
      }
    };

    await this.memory.store(userId, agentId, memoryData);
    return memoryData.id;
  }

  /**
   * Learn from outcome - Simplified delegation
   */
  async learn(
    userId: string,
    agentId: string,
    trigger: string,
    action: string
  ): Promise<LearningResult> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }

    const content = `${trigger} -> ${action}`;
    const patternId = await this.store(userId, agentId, content, {
      pattern: content,
      confidence:
        this.proceduralConfig.confidenceThreshold ??
        PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold
    });

    return {
      patternId,
      learned: true,
      confidence:
        this.proceduralConfig.confidenceThreshold ??
        PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
      reason: 'Pattern learned successfully'
    };
  }

  /**
   * Find matching patterns - DELEGATES to storage
   */
  async getRecommendedActions(
    userId: string,
    agentId: string,
    trigger: string,
    context: Record<string, unknown> = {}
  ): Promise<PatternMatchResult[]> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }

    // DELEGATE TO STORAGE
    const result = await this.memory.recall(userId, agentId, trigger, {
      type: MemoryType.PROCEDURAL,
      limit: 5
    });

    return result.map((memory): PatternMatchResult => {
      // Extract from generic MemoryData to ProceduralMemoryData
      const [triggerPart, actionPart] = memory.content.includes('->')
        ? memory.content.split('->').map((s) => s.trim())
        : [memory.content, 'unknown'];

      const proceduralData: ProceduralMemoryData = {
        id: memory.id,
        agentId: memory.agentId,
        createdAt: memory.createdAt,
        trigger: String(memory.metadata?.trigger || triggerPart),
        action: String(memory.metadata?.action || actionPart),
        context: String(memory.metadata?.context || ''),
        pattern: String(memory.metadata?.pattern || memory.content),
        confidence: Number(
          memory.metadata?.confidence ||
            this.proceduralConfig.confidenceThreshold ||
            PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold
        ),
        successCount: Number(memory.metadata?.successCount || 1),
        totalCount: Number(memory.metadata?.totalCount || 1),
        lastUsed:
          typeof memory.metadata?.lastUsed === 'number'
            ? memory.metadata.lastUsed
            : Date.now(),
        conditions: Array.isArray(memory.metadata?.conditions)
          ? memory.metadata.conditions
          : [],
        outcomes: Array.isArray(memory.metadata?.outcomes)
          ? memory.metadata.outcomes
          : [
              {
                success: true,
                timestamp: Date.now()
              }
            ],
        metadata: memory.metadata || {}
      };

      return {
        pattern: proceduralData,
        confidence:
          this.proceduralConfig.confidenceThreshold ??
          PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
        contextMatch: 0.5,
        reason: 'Pattern matched from storage recall'
      };
    });
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(
    userId: string,
    agentId?: string
  ): Promise<ProceduralMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }

    const stats = await this.memory.getStats(userId, agentId);
    return {
      totalPatterns: stats.byType?.procedural || 0,
      patternsByCategory: {},
      avgConfidence:
        this.proceduralConfig.confidenceThreshold ??
        PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
      avgSuccessRate:
        this.proceduralConfig.minSuccessRate ??
        PROCEDURAL_MEMORY_DEFAULTS.minSuccessRate,
      mostUsedPatterns: [],
      recentOutcomes: []
    };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(
    userId: string,
    memoryId: string
  ): Promise<ProceduralMemoryData | null> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }

    if (this.memory.getById) {
      const result = await this.memory.getById(userId, memoryId);
      if (!result) return null;

      // Proper mapping from MemoryData to ProceduralMemoryData
      return {
        id: result.id,
        agentId: result.agentId,
        createdAt: result.createdAt,
        // Extract procedural-specific properties from metadata and content
        trigger: String(
          result.metadata?.trigger ||
            (result.content.split('->')[0] || 'unknown').trim()
        ),
        action: String(
          result.metadata?.action ||
            (result.content.split('->')[1] || 'unknown').trim()
        ),
        context: String(result.metadata?.context || ''),
        pattern: String(result.metadata?.pattern || result.content),
        confidence: Number(
          result.metadata?.confidence ||
            this.proceduralConfig.confidenceThreshold ||
            PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold
        ),
        successCount: Number(result.metadata?.successCount || 1),
        totalCount: Number(result.metadata?.totalCount || 1),
        lastUsed:
          typeof result.metadata?.lastUsed === 'number'
            ? result.metadata.lastUsed
            : Date.now(),
        conditions: Array.isArray(result.metadata?.conditions)
          ? result.metadata.conditions
          : [],
        outcomes: Array.isArray(result.metadata?.outcomes)
          ? result.metadata.outcomes
          : [
              {
                success: true,
                timestamp: Date.now()
              }
            ],
        metadata: result.metadata || {}
      };
    }
    return null;
  }
}
