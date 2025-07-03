/**
 * EpisodicMemory - Handles time-based sequential memories
 *
 * THIN wrapper - delegates all operations to storage layer
 */

// Remove circular dependency - generate ID inline
import { LogCategory, logger } from '../../../logging';
import { MemoryType } from '../../../shared/types/memory';
import { StorageProvider } from '../../../storage/types';
import { DecayResult } from '../../base-types';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { BaseMemoryType } from '../base/BaseMemoryType';
import {
  EpisodicMemoryConfig,
  EpisodicMemoryData,
  EpisodicMemoryStats,
  StoreEpisodicOptions
} from './EpisodicMemoryTypes';

export class EpisodicMemory extends BaseMemoryType {
  constructor(
    storage: StorageProvider,
    private episodicConfig: EpisodicMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, episodicConfig, intelligenceConfig);
    if (!storage.memory) {
      throw new Error('Storage must support memory operations');
    }
  }

  /**
   * Store episodic memory - DELEGATE to storage
   */
  protected async doStore(
    userId: string,
    agentId: string,
    content: string,
    options?: StoreEpisodicOptions
  ): Promise<string> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for episodic memory operations');
    }

    const id = `ep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // Create COMPLETE data at write time
    const memoryData = {
      id,
      userId,
      agentId,
      type: MemoryType.EPISODIC,
      content,
      importance: 0.5, // Episodic memories start neutral
      resonance: 1.0, // Full resonance when fresh
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,

      // Required fields
      sessionId: `session_${Date.now()}`,
      tokenCount: 0, // TODO: Add proper token counting

      // Type-specific
      metadata: {
        tags: options?.tags || [],
        expiresAt: now + this.episodicConfig.compressionAge * 86400000
      }
    };

    await this.storage.memory!.store(userId, agentId, memoryData);
    return memoryData.id;
  }

  /**
   * Recall episodic memories - DELEGATES to storage
   */
  async recall(
    userId: string,
    agentId: string,
    query: string,
    options?: { limit?: number; timeRange?: { start: Date; end: Date } }
  ): Promise<EpisodicMemoryData[]> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for episodic memory operations');
    }

    const result = await this.storage.memory!.recall(userId, agentId, query, {
      type: MemoryType.EPISODIC,
      limit: options?.limit || 20,
      timeRange: options?.timeRange
    });

    return result as unknown as EpisodicMemoryData[];
  }

  /**
   * Apply decay - DELEGATES to storage
   */
  async decay(userId: string, agentId: string): Promise<DecayResult> {
    if (this.storage.memory?.applyDecay) {
      const result = await this.storage.memory.applyDecay(userId, agentId, {
        decayRate: this.episodicConfig.decayRate || 0.1
      });
      return {
        processed: result.processed || 0,
        decayed: result.decayed || 0,
        removed: result.removed || 0,
        averageDecay: result.decayed > 0 ? result.decayed / result.processed : 0
      };
    }
    return {
      processed: 0,
      decayed: 0,
      removed: 0,
      averageDecay: 0
    };
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(
    userId: string,
    agentId?: string
  ): Promise<EpisodicMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for episodic memory operations');
    }

    const stats = await this.storage.memory!.getStats(userId, agentId);
    return {
      totalMemories: stats.byType?.episodic || 0,
      memoriesBySession: {},
      avgImportance: stats.avgImportance || 0,
      avgResonance: 0.5,
      oldestMemory: Date.now(),
      newestMemory: Date.now(),
      topTags: []
    };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(
    userId: string,
    memoryId: string
  ): Promise<EpisodicMemoryData | null> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for episodic memory operations');
    }

    if (!this.storage.memory?.getById) {
      return null;
    }

    const result = await this.storage.memory.getById(userId, memoryId);
    if (!result) return null;

    // Validate type
    if (result.type !== MemoryType.EPISODIC) {
      logger.error(
        LogCategory.STORAGE,
        'EpisodicMemory',
        'Type mismatch in getById',
        {
          expected: MemoryType.EPISODIC,
          actual: result.type,
          memoryId
        }
      );
      return null;
    }

    // Validate required fields exist
    if (!result.sessionId) {
      logger.error(
        LogCategory.STORAGE,
        'EpisodicMemory',
        'Missing required sessionId',
        { memoryId }
      );
      return null;
    }

    // Return ONLY validated data - NO SYNTHESIS
    return {
      id: result.id,
      agentId: result.agentId,
      content: result.content,
      createdAt: result.createdAt,
      importance: result.importance,
      sessionId: result.sessionId,
      context: result.metadata?.context || '',
      resonance: result.resonance,
      lastAccessedAt: result.lastAccessedAt,
      accessCount: result.accessCount,
      sourceMessageIds: [],
      tags: Array.isArray(result.metadata?.tags) ? result.metadata.tags : [],
      embeddingId: result.embeddingId,
      metadata: result.metadata || {}
    };
  }
}
