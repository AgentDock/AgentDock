/**
 * WorkingMemory - Thin wrapper for ephemeral memory storage
 *
 * Delegates ALL operations to storage layer - NO reimplementation
 */

import { LogCategory, logger } from '../../../logging';
import { MemoryStorageError } from '../../../shared/errors/memory-errors';
import { MemoryType } from '../../../shared/types/memory';
import { MemoryOperations, StorageProvider } from '../../../storage/types';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { BaseMemoryType } from '../base/BaseMemoryType';
import {
  StoreOptions,
  WorkingMemoryConfig,
  WorkingMemoryData,
  WorkingMemoryStats
} from './WorkingMemoryTypes';
import { estimateTokens } from './WorkingMemoryUtils';

export class WorkingMemory extends BaseMemoryType<WorkingMemoryConfig> {
  constructor(
    storage: StorageProvider,
    private workingConfig: WorkingMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, workingConfig, intelligenceConfig);
  }

  /**
   * Validates storage is available and returns memory operations
   * @throws {MemoryStorageError} If storage or memory operations are unavailable
   * @returns Memory operations interface
   * @private
   */
  private getMemoryOps(): MemoryOperations {
    if (!this.storage) {
      throw new MemoryStorageError(
        'Storage provider not available',
        'STORAGE_NOT_INITIALIZED'
      );
    }

    if (!this.storage.memory) {
      throw new MemoryStorageError(
        'Memory operations not available - storage may be disconnected or destroyed',
        'MEMORY_OPS_UNAVAILABLE'
      );
    }

    return this.storage.memory;
  }

  /**
   * Store working memory - DELEGATES to storage
   */
  protected async doStore(
    userId: string,
    agentId: string,
    content: string,
    options?: StoreOptions
  ): Promise<string> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for working memory operations'
      );
    }

    const id = `wm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // Create COMPLETE data at write time
    const memoryData = {
      id,
      userId,
      agentId,
      type: MemoryType.WORKING,
      content,
      importance: options?.importance ?? 0.8,
      resonance: 1.0, // New memories start with full resonance
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,

      // Required fields
      sessionId: options?.sessionId || `session_${Date.now()}`,
      tokenCount: estimateTokens(content),

      // Type-specific metadata
      metadata: {
        ...options?.metadata, // User metadata FIRST
        contextWindow:
          options?.contextWindow ?? this.workingConfig.maxContextItems,
        expiresAt:
          now + (options?.ttlSeconds ?? this.workingConfig.ttlSeconds) * 1000
        // System fields LAST - cannot be overridden
      }
    };

    await this.getMemoryOps().store(userId, agentId, memoryData);
    return memoryData.id;
  }

  /**
   * Recall memories - DELEGATES to storage
   */
  async recall(
    userId: string,
    agentId: string,
    query: string,
    limit: number = 10
  ): Promise<WorkingMemoryData[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for working memory operations'
      );
    }

    // DELEGATE TO STORAGE
    const result = await this.getMemoryOps().recall(userId, agentId, query, {
      type: MemoryType.WORKING,
      limit
    });
    
    // Transform MemoryData to WorkingMemoryData with proper field mapping
    return result.map(memory => ({
      id: memory.id,
      agentId: memory.agentId,
      content: memory.content,
      createdAt: memory.createdAt,
      importance: memory.importance,
      sessionId: memory.sessionId || `session_${Date.now()}`,
      contextWindow: memory.metadata?.contextWindow ?? this.workingConfig.maxContextItems,
      tokenCount: memory.tokenCount ?? 0,
      expiresAt: memory.metadata?.expiresAt ?? 0,
      metadata: memory.metadata
    }));
  }

  /**
   * Clear working memory - Uses storage operations
   */
  async clear(
    userId: string,
    agentId: string,
    sessionId?: string
  ): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for working memory operations'
      );
    }

    // Use storage recall to find memories to delete
    const memories = await this.getMemoryOps().recall(userId, agentId, '', {
      type: MemoryType.WORKING,
      limit: 1000 // Get all working memories
    });

    // Filter by sessionId if provided
    const toDelete = sessionId
      ? memories.filter((m) => m.sessionId === sessionId)
      : memories;

    // Batch delete through storage
    await Promise.all(
      toDelete.map((m) => this.getMemoryOps().delete(userId, agentId, m.id!))
    );
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(
    userId: string,
    agentId?: string
  ): Promise<WorkingMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for working memory operations');
    }

    const stats = await this.getMemoryOps().getStats(userId, agentId);

    // Get all working memories to calculate token statistics
    const workingMemories = await this.getMemoryOps().recall(
      userId,
      agentId || '',
      '',
      {
        type: MemoryType.WORKING,
        limit: 1000 // Get all working memories for accurate stats
      }
    );

    // Calculate real token statistics
    const totalTokens = workingMemories.reduce(
      (sum, memory) => sum + (memory.tokenCount || 0),
      0
    );
    const avgTokensPerMemory =
      workingMemories.length > 0 ? totalTokens / workingMemories.length : 0;

    // Calculate expired memories
    const now = Date.now();
    const expiredMemories = workingMemories.filter((memory) => {
      const expiresAt = memory.metadata?.expiresAt;
      return expiresAt && expiresAt < now;
    }).length;

    // Calculate encrypted memories
    const encryptedMemories = workingMemories.filter(
      (memory) => memory.metadata?.encrypted === true
    ).length;

    // Find oldest and newest memories
    const timestamps = workingMemories.map((m) => m.createdAt).filter(Boolean);
    const oldestMemory =
      timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const newestMemory =
      timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    return {
      totalMemories: stats.byType?.working || 0,
      totalTokens,
      avgTokensPerMemory,
      expiredMemories,
      encryptedMemories,
      oldestMemory,
      newestMemory
    };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(
    userId: string,
    memoryId: string
  ): Promise<WorkingMemoryData | null> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for working memory operations');
    }

    if (!this.storage.memory?.getById) {
      return null;
    }

    const result = await this.storage.memory.getById(userId, memoryId);
    if (!result) return null;

    // Validate type
    if (result.type !== MemoryType.WORKING) {
      logger.error(
        LogCategory.STORAGE,
        'WorkingMemory',
        'Type mismatch in getById',
        {
          expected: MemoryType.WORKING,
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
        'WorkingMemory',
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
      contextWindow:
        result.metadata?.contextWindow ?? this.workingConfig.maxContextItems,
      tokenCount: result.tokenCount ?? 0, // Use stored value or 0
      expiresAt: result.metadata?.expiresAt ?? 0, // Use stored value or 0
      metadata: result.metadata
    };
  }
}
