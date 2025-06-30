/**
 * WorkingMemory - Thin wrapper for ephemeral memory storage
 * 
 * Delegates ALL operations to storage layer - NO reimplementation
 */

import { StorageProvider } from '../../../storage/types';
import { MemoryType } from '../../../shared/types/memory';
import { LogCategory, logger } from '../../../logging';
import { BaseMemoryType } from '../base/BaseMemoryType';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { 
  WorkingMemoryConfig, 
  WorkingMemoryData,
  StoreOptions,
  WorkingMemoryStats
} from './WorkingMemoryTypes';

export class WorkingMemory extends BaseMemoryType {
  constructor(
    storage: StorageProvider,
    private workingConfig: WorkingMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, workingConfig, intelligenceConfig);
    if (!storage.memory) {
      throw new Error('Storage must support memory operations');
    }
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
      throw new Error('userId must be a non-empty string for working memory operations');
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
      tokenCount: 0, // TODO: Add proper token counting service
      
      // Type-specific metadata
      metadata: {
        ...options?.metadata, // User metadata FIRST
        contextWindow: options?.contextWindow ?? this.workingConfig.maxContextItems,
        expiresAt: now + ((options?.ttlSeconds ?? this.workingConfig.ttlSeconds) * 1000)
        // System fields LAST - cannot be overridden
      }
    };
    
    await this.storage.memory!.store(userId, agentId, memoryData);
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
      throw new Error('userId must be a non-empty string for working memory operations');
    }
    
    // DELEGATE TO STORAGE
    const result = await this.storage.memory!.recall(userId, agentId, query, {
      type: MemoryType.WORKING,
      limit
    });
    return result as unknown as WorkingMemoryData[];
  }

  /**
   * Clear working memory - Uses storage operations
   */
  async clear(userId: string, agentId: string, sessionId?: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error('userId must be a non-empty string for working memory operations');
    }
    
    // Use storage recall to find memories to delete
    const memories = await this.storage.memory!.recall(userId, agentId, '', {
      type: MemoryType.WORKING,
      limit: 1000 // Get all working memories
    });
    
    // Filter by sessionId if provided
    const toDelete = sessionId 
      ? memories.filter(m => m.sessionId === sessionId)
      : memories;
    
    // Batch delete through storage
    await Promise.all(
      toDelete.map(m => this.storage.memory!.delete(userId, agentId, m.id!))
    );
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(userId: string, agentId?: string): Promise<WorkingMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for working memory operations');
    }
    
    const stats = await this.storage.memory!.getStats(userId, agentId);
    return {
      totalMemories: stats.byType?.working || 0,
      totalTokens: 0, // Would need token counting in storage
      avgTokensPerMemory: 0,
      expiredMemories: 0,
      encryptedMemories: 0,
      oldestMemory: Date.now(),
      newestMemory: Date.now()
    };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(userId: string, memoryId: string): Promise<WorkingMemoryData | null> {
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
      contextWindow: result.metadata?.contextWindow ?? this.workingConfig.maxContextItems,
      tokenCount: result.tokenCount ?? 0, // Use stored value or 0
      expiresAt: result.metadata?.expiresAt ?? 0, // Use stored value or 0
      metadata: result.metadata
    };
  }
}