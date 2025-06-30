/**
 * ProceduralMemory - Action pattern storage
 * 
 * THIN wrapper - delegates all operations to storage layer
 */

import { StorageProvider } from '../../../storage/types';
import { MemoryType } from '../../../shared/types/memory';
import { LogCategory, logger } from '../../../logging';
import { BaseMemoryType } from '../base/BaseMemoryType';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { 
  ProceduralMemoryConfig, 
  ProceduralMemoryData,
  StoreProceduralOptions,
  ProceduralMemoryStats,
  LearningResult,
  PatternMatchResult,
  PROCEDURAL_MEMORY_DEFAULTS
} from './ProceduralMemoryTypes';

export class ProceduralMemory extends BaseMemoryType {
  constructor(
    storage: StorageProvider,
    private proceduralConfig: ProceduralMemoryConfig,
    intelligenceConfig?: IntelligenceLayerConfig
  ) {
    super(storage, proceduralConfig, intelligenceConfig);
    if (!storage.memory) {
      throw new Error('Storage must support memory operations');
    }
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
      metadata?: Record<string, any>;
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
      tokenCount: 0, // TODO: Add proper token counting
      
      // Type-specific
      metadata: {
        trigger: options?.trigger || content,
        action: options?.action || 'unknown',
        outcome: options?.outcome || 'pending',
        success: options?.success ?? true,
        ...options?.metadata
      }
    };
    
    await this.storage.memory!.store(userId, agentId, memoryData);
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
      confidence: this.proceduralConfig.confidenceThreshold ?? PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold
     });
    
    return {
      patternId,
      learned: true,
      confidence: this.proceduralConfig.confidenceThreshold ?? PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
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
    context: Record<string, any> = {}
  ): Promise<any[]> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }
    
    // DELEGATE TO STORAGE
    const result = await this.storage.memory!.recall(userId, agentId, trigger, {
      type: MemoryType.PROCEDURAL,
      limit: 5
    });
    return result.map(memory => ({
      pattern: memory,
      confidence: this.proceduralConfig.confidenceThreshold ?? PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
      contextMatch: 0.5
    }));
  }

  /**
   * Get stats - DELEGATES to storage
   */
  async getStats(userId: string, agentId?: string): Promise<ProceduralMemoryStats> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }
    
    const stats = await this.storage.memory!.getStats(userId, agentId);
         return {
       totalPatterns: stats.byType?.procedural || 0,
       patternsByCategory: {},
       avgConfidence: this.proceduralConfig.confidenceThreshold ?? PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold,
       avgSuccessRate: this.proceduralConfig.minSuccessRate ?? PROCEDURAL_MEMORY_DEFAULTS.minSuccessRate,
       mostUsedPatterns: [],
       recentOutcomes: []
     };
  }

  /**
   * Get by ID - DELEGATES to storage
   */
  async getById(userId: string, memoryId: string): Promise<ProceduralMemoryData | null> {
    if (!userId || !userId.trim()) {
      throw new Error('userId is required for procedural memory operations');
    }
    
    if (this.storage.memory?.getById) {
      const result = await this.storage.memory.getById(userId, memoryId);
      if (!result) return null;

      // Proper mapping from MemoryData to ProceduralMemoryData
      return {
        id: result.id,
        agentId: result.agentId,
        createdAt: result.createdAt,
        // Extract procedural-specific properties from metadata and content
        trigger: String(result.metadata?.trigger || (
          result.content.split('->')[0] || 'unknown'
        ).trim()),
        action: String(result.metadata?.action || (
          result.content.split('->')[1] || 'unknown'  
        ).trim()),
        context: String(result.metadata?.context || ''),
        pattern: String(result.metadata?.pattern || result.content),
        confidence: Number(result.metadata?.confidence || 0.5),
        successCount: Number(result.metadata?.successCount || 1),
        totalCount: Number(result.metadata?.totalCount || 1),
        lastUsed: typeof result.metadata?.lastUsed === 'number' 
          ? result.metadata.lastUsed 
          : Date.now(),
        conditions: Array.isArray(result.metadata?.conditions) ? result.metadata.conditions : [],
        outcomes: Array.isArray(result.metadata?.outcomes) ? result.metadata.outcomes : [{
          success: true,
          timestamp: Date.now()
        }],
        metadata: result.metadata || {}
      };
    }
    return null;
  }
}