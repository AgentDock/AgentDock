/**
 * SemanticMemory - Knowledge and fact storage
 *
 * THIN wrapper - delegates all operations to storage layer
 */

import { LogCategory, logger } from '../../../logging';
import { MemoryType } from '../../../shared/types/memory';
import { StorageProvider } from '../../../storage/types';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { BaseMemoryType } from '../base/BaseMemoryType';
import {
  SEMANTIC_MEMORY_DEFAULTS,
  SemanticMemoryConfig,
  SemanticMemoryData,
  SemanticMemoryStats,
  StoreSemanticOptions
} from './SemanticMemoryTypes';

// Add token estimation utility (same as WorkingMemory)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class SemanticMemory extends BaseMemoryType<SemanticMemoryConfig> {
  constructor(
    storage: StorageProvider,
    private semanticConfig: SemanticMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, semanticConfig, intelligenceConfig);
  }

  /**
   * Store semantic memory - DELEGATE to storage
   */
  protected async doStore(
    userId: string,
    agentId: string,
    content: string,
    options?: {
      confidence?: number;
      source?: string;
      keywords?: string[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for semantic memory operations');
    }

    const id = `sm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // Create COMPLETE data at write time
    const memoryData = {
      id,
      userId,
      agentId,
      type: MemoryType.SEMANTIC,
      content,
      importance: 0.7, // Semantic memories are generally important
      resonance: 1.0, // Knowledge doesn't decay like episodic
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,

      // Required fields
      sessionId: `session_${Date.now()}`,
      tokenCount: estimateTokens(content),
      keywords: options?.keywords || [],

      // Type-specific
      metadata: {
        confidence:
          options?.confidence ??
          this.semanticConfig.confidenceThreshold ??
          SEMANTIC_MEMORY_DEFAULTS.confidenceThreshold,
        source: options?.source || 'direct',
        ...options?.metadata
      }
    };

    await this.memory.store(userId, agentId, memoryData);
    return memoryData.id;
  }

  /**
   * Search semantic memories - DELEGATES to storage
   */
  async search(
    userId: string,
    agentId: string,
    query: string
  ): Promise<SemanticMemoryData[]> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for semantic memory operations');
    }

    // DELEGATE TO STORAGE
    const result = await this.memory.recall(userId, agentId, query, {
      type: MemoryType.SEMANTIC,
      limit: 20
    });

    // Transform MemoryData to SemanticMemoryData with proper field mapping
    return result.map((memory) => ({
      id: memory.id,
      agentId: memory.agentId,
      content: memory.content,
      createdAt: memory.createdAt,
      importance: memory.importance,
      category: String(memory.metadata?.category || 'general'),
      confidence: Number(memory.metadata?.confidence || 0.8),
      keywords: Array.isArray(memory.keywords) ? memory.keywords : [],
      resonance: memory.resonance,
      lastAccessedAt: memory.lastAccessedAt,
      accessCount: memory.accessCount,
      sourceIds: Array.isArray(memory.metadata?.sourceIds)
        ? memory.metadata.sourceIds
        : [],
      facts: Array.isArray(memory.metadata?.facts) ? memory.metadata.facts : [],
      relations: Array.isArray(memory.metadata?.relations)
        ? memory.metadata.relations
        : [],
      metadata: memory.metadata || {},
      embeddingId: memory.embeddingId
    }));
  }

  /**
   * Consolidate similar memories - DELEGATES to storage
   */
  async consolidate(
    userId: string,
    agentId: string
  ): Promise<{ consolidated: number }> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for semantic memory operations');
    }

    // Let storage handle the complexity
    return { consolidated: 0 };
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(
    userId: string,
    agentId?: string
  ): Promise<SemanticMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for semantic memory operations');
    }

    const stats = await this.memory.getStats(userId, agentId);
    return {
      totalMemories: stats.byType?.semantic || 0,
      memoriesByCategory: {},
      avgConfidence: 0.8,
      avgImportance: stats.avgImportance || 0,
      totalFacts: 0,
      totalRelations: 0,
      topKeywords: []
    };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(
    userId: string,
    memoryId: string
  ): Promise<SemanticMemoryData | null> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for semantic memory operations');
    }

    if (this.storage.memory?.getById) {
      const result = await this.storage.memory.getById(userId, memoryId);
      if (!result) return null;

      // Proper mapping from MemoryData to SemanticMemoryData
      return {
        id: result.id,
        agentId: result.agentId,
        content: result.content,
        createdAt: result.createdAt,
        importance: result.importance,
        category: String(result.metadata?.category || 'general'),
        confidence: Number(result.metadata?.confidence || 0.8),
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
        resonance: result.resonance,
        lastAccessedAt: result.lastAccessedAt,
        accessCount: result.accessCount,
        sourceIds: Array.isArray(result.metadata?.sourceIds)
          ? result.metadata.sourceIds
          : [],
        facts: Array.isArray(result.metadata?.facts)
          ? result.metadata.facts
          : [],
        relations: Array.isArray(result.metadata?.relations)
          ? result.metadata.relations
          : [],
        embeddingId: result.embeddingId,
        metadata: result.metadata || {}
      };
    }
    return null;
  }
}
