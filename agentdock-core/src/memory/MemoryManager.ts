/**
 * MemoryManager - Simple orchestrator for AgentDock memory system
 *
 * Delegates ALL operations to memory types and storage layer - NO complex logic
 */

import { StorageProvider } from '../storage/types';
import { MemoryManagerConfig, MemoryType } from './types';
import { EpisodicMemory } from './types/episodic/EpisodicMemory';
import { ProceduralMemory } from './types/procedural/ProceduralMemory';
import { SemanticMemory } from './types/semantic/SemanticMemory';
import { WorkingMemory } from './types/working/WorkingMemory';

export class MemoryManager {
  private working: WorkingMemory;
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private procedural: ProceduralMemory;

  constructor(
    private storage: StorageProvider,
    private config: MemoryManagerConfig
  ) {
    if (!storage.memory) {
      throw new Error('Storage must support memory operations');
    }

    if (!config.working) {
      throw new Error('Working memory configuration is required');
    }
    if (!config.episodic) {
      throw new Error('Episodic memory configuration is required');
    }
    if (!config.semantic) {
      throw new Error('Semantic memory configuration is required');
    }
    if (!config.procedural) {
      throw new Error('Procedural memory configuration is required');
    }

    // Initialize all memory types - USER-CONFIGURED
    this.working = new WorkingMemory(storage, config.working);
    this.episodic = new EpisodicMemory(storage, config.episodic);
    this.semantic = new SemanticMemory(storage, config.semantic);
    this.procedural = new ProceduralMemory(storage, config.procedural);
  }

  /**
   * Store memory - Simple delegation to memory types
   */
  async store(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType = MemoryType.SEMANTIC
  ): Promise<string> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId || !content?.trim()) {
      throw new Error('Agent ID and content are required');
    }

    // SIMPLE DELEGATION - NO COMPLEX LOGIC
    switch (type) {
      case 'working':
        return this.working.store(userId, agentId, content);
      case 'episodic':
        return this.episodic.store(userId, agentId, content);
      case 'semantic':
        return this.semantic.store(userId, agentId, content);
      case 'procedural':
        return this.procedural.store(userId, agentId, content);
      default:
        throw new Error(`Unknown memory type: ${type}`);
    }
  }

  /**
   * Recall memories - Let storage handle the complexity
   */
  async recall(
    userId: string,
    agentId: string,
    query: string,
    options: { type?: MemoryType; limit?: number } = {}
  ): Promise<any[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId || !query?.trim()) {
      throw new Error('Agent ID and query are required');
    }

    // DELEGATE TO STORAGE - Don't reimplement recall logic
    return this.storage.memory!.recall(userId, agentId, query, {
      type: options.type,
      limit: options.limit
    });
  }

  /**
   * Apply decay - DELEGATE to storage
   */
  async decay(
    userId: string,
    agentId: string,
    decayConfig: any
  ): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    if (!decayConfig) {
      throw new Error('Decay configuration is required');
    }

    if (this.storage.memory?.applyDecay) {
      await this.storage.memory.applyDecay(userId, agentId, decayConfig);
    }
  }

  /**
   * Create connection - DELEGATE to storage
   */
  async createConnection(
    userId: string,
    fromId: string,
    toId: string,
    connectionType: string,
    strength: number
  ): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!fromId || !toId) {
      throw new Error('Both memory IDs are required');
    }
    if (!connectionType) {
      throw new Error('Connection type is required');
    }
    if (typeof strength !== 'number') {
      throw new Error('Connection strength must be a number');
    }

    if (this.storage.memory?.createConnections) {
      await this.storage.memory.createConnections(userId, [
        {
          fromMemoryId: fromId,
          toMemoryId: toId,
          type: connectionType,
          strength
        }
      ]);
    }
  }

  /**
   * Get memory statistics - DELEGATE to storage
   */
  async getStats(userId: string, agentId?: string): Promise<any> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    return this.storage.memory!.getStats(userId, agentId);
  }

  /**
   * Clear working memory - Simple delegation
   */
  async clearWorkingMemory(userId: string, agentId: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    await this.working.clear(userId, agentId);
  }

  /**
   * Learn from outcome - Simple delegation
   */
  async learn(
    userId: string,
    agentId: string,
    trigger: string,
    action: string
  ): Promise<any> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId || !trigger || !action) {
      throw new Error('Agent ID, trigger, and action are required');
    }
    return this.procedural.learn(userId, agentId, trigger, action);
  }

  /**
   * Get recommendations - Simple delegation
   */
  async getRecommendations(
    userId: string,
    agentId: string,
    trigger: string
  ): Promise<any[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId || !trigger) {
      throw new Error('Agent ID and trigger are required');
    }
    return this.procedural.getRecommendedActions(userId, agentId, trigger);
  }

  /**
   * Search semantic knowledge - Simple delegation
   */
  async searchKnowledge(
    userId: string,
    agentId: string,
    query: string
  ): Promise<any[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId || !query) {
      throw new Error('Agent ID and query are required');
    }
    return this.semantic.search(userId, agentId, query);
  }

  /**
   * Get working memory context - Simple delegation
   */
  async getWorkingContext(
    userId: string,
    agentId: string,
    limit?: number
  ): Promise<any[]> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    }
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    return this.working.recall(userId, agentId, '', limit);
  }

  /**
   * Close memory manager - Cleanup
   */
  async close(): Promise<void> {
    // Storage cleanup if supported
    if (this.storage.destroy) {
      await this.storage.destroy();
    }
  }
}
