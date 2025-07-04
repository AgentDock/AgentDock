/**
 * MemoryManager - Orchestrates AgentDock memory system with vector-first approach
 *
 * Integrates vector similarity search with traditional memory operations
 */

import {
  createEmbedding,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions
} from '../llm';
import { LogCategory, logger } from '../logging';
import {
  ConnectionType,
  HybridSearchOptions,
  StorageProvider,
  VectorMemoryOperations
} from '../storage/types';
import { EmbeddingService } from './intelligence/embeddings/EmbeddingService';
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
  private embeddingService: EmbeddingService | null = null;

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
    this.working = new WorkingMemory(
      storage,
      config.working,
      config.intelligence
    );
    this.episodic = new EpisodicMemory(
      storage,
      config.episodic,
      config.intelligence
    );
    this.semantic = new SemanticMemory(
      storage,
      config.semantic,
      config.intelligence
    );
    this.procedural = new ProceduralMemory(
      storage,
      config.procedural,
      config.intelligence
    );

    // Initialize embedding service if intelligence config provides embedding settings
    if (config.intelligence?.embedding?.enabled) {
      // Build proper EmbeddingConfig from IntelligenceLayerConfig
      const validProviders = ['openai', 'google', 'mistral'];
      let provider =
        config.intelligence.embedding.provider ||
        process.env.EMBEDDING_PROVIDER ||
        'openai';

      if (!validProviders.includes(provider)) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryManager',
          `Embedding provider '${provider}' not yet implemented. Using 'openai'. Check TODO in settings page for status.`,
          { requested: provider, available: validProviders }
        );
        provider = 'openai';
      }

      // Add logging for debugging
      logger.debug(
        LogCategory.STORAGE,
        'MemoryManager',
        'Initializing embedding service',
        {
          provider,
          model: config.intelligence.embedding.model || 'default',
          source: config.intelligence.embedding.provider
            ? 'config'
            : 'environment'
        }
      );

      // Add logging for non-default providers
      if (provider !== 'openai') {
        logger.info(
          LogCategory.STORAGE,
          'MemoryManager',
          `Using ${provider} embedding provider`
        );
      }

      const model =
        config.intelligence.embedding.model ||
        getDefaultEmbeddingModel(provider);
      const dimensions = getEmbeddingDimensions(provider, model);

      // Get API key from environment or config
      const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] || '';

      if (!apiKey) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryManager',
          'No API key found for embedding provider. Embedding features will be disabled.'
        );
        return;
      }

      const embeddingModel = createEmbedding({
        provider: provider as
          | 'openai'
          | 'google'
          | 'mistral'
          | 'voyage'
          | 'cohere',
        apiKey,
        model,
        dimensions
      });

      this.embeddingService = new EmbeddingService(embeddingModel, {
        provider,
        model,
        dimensions,
        cacheEnabled: true,
        batchSize: 100,
        cacheSize: 1000
      });
    }
  }

  /**
   * Store memory - Simple delegation to memory types with optional embedding generation
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

    // Check if we have vector-enabled storage
    const isVectorMemoryOps = (ops: any): ops is VectorMemoryOperations => {
      return ops && typeof ops.storeMemoryWithEmbedding === 'function';
    };

    const hasVectorSupport =
      this.storage.memory &&
      isVectorMemoryOps(this.storage.memory) &&
      this.embeddingService;

    // Generate embedding if vector support is available
    let memoryId: string;

    if (hasVectorSupport && this.embeddingService) {
      try {
        // Generate embedding for the content
        const embeddingResult =
          await this.embeddingService.generateEmbedding(content);

        // Store using the appropriate memory type handler
        const memoryData = await this.prepareMemoryData(
          userId,
          agentId,
          content,
          type
        );

        // Store with embedding
        const vectorMemoryOps = this.storage.memory as VectorMemoryOperations;
        memoryId = await vectorMemoryOps.storeMemoryWithEmbedding(
          userId,
          agentId,
          memoryData,
          embeddingResult.embedding
        );
      } catch (error) {
        // Fallback to traditional storage on error
        console.error(
          'Vector storage failed, falling back to traditional storage:',
          error
        );
        memoryId = await this.delegateToMemoryType(
          userId,
          agentId,
          content,
          type
        );
      }
    } else {
      // Traditional storage without embeddings
      memoryId = await this.delegateToMemoryType(
        userId,
        agentId,
        content,
        type
      );
    }

    return memoryId;
  }

  /**
   * Prepare memory data for storage
   */
  private async prepareMemoryData(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType
  ): Promise<any> {
    // Create basic memory data structure
    const now = Date.now();
    return {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      agentId,
      type,
      content,
      importance: 0.5, // Default importance
      resonance: 0.5, // Default resonance
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      metadata: {
        memoryType: type
      }
    };
  }

  /**
   * Delegate storage to appropriate memory type
   */
  private async delegateToMemoryType(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType
  ): Promise<string> {
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
   * Recall memories - Vector-first approach with hybrid search
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

    // Check if we have vector-enabled storage
    const isVectorMemoryOps = (ops: any): ops is VectorMemoryOperations => {
      return ops && typeof ops.searchByVector === 'function';
    };

    const hasVectorSupport =
      this.storage.memory &&
      isVectorMemoryOps(this.storage.memory) &&
      this.embeddingService;

    if (!hasVectorSupport || !this.embeddingService) {
      // Fallback to traditional recall if no vector support
      return this.storage.memory!.recall(userId, agentId, query, {
        type: options.type,
        limit: options.limit
      });
    }

    // Vector-first approach
    try {
      // Step 1: Generate query embedding
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      // Step 2: Perform hybrid search (vector + text)
      const vectorMemoryOps = this.storage.memory as VectorMemoryOperations;

      // Use hybrid search if available, otherwise fall back to vector-only
      if ('hybridSearch' in vectorMemoryOps && vectorMemoryOps.hybridSearch) {
        return await vectorMemoryOps.hybridSearch(
          userId,
          agentId,
          query,
          queryEmbedding.embedding,
          {
            limit: options.limit || 20,
            threshold:
              this.config.intelligence?.embedding?.similarityThreshold || 0.7,
            textWeight: 0.3, // 30% text as per PRD
            vectorWeight: 0.7, // 70% vector as per PRD
            filter: options.type ? { type: options.type } : undefined
          }
        );
      } else {
        // Fallback to vector-only search
        return await vectorMemoryOps.searchByVector(
          userId,
          agentId,
          queryEmbedding.embedding,
          {
            limit: options.limit || 20,
            threshold:
              this.config.intelligence?.embedding?.similarityThreshold || 0.7,
            filter: options.type ? { type: options.type } : undefined
          }
        );
      }
    } catch (error) {
      // Fallback to traditional recall on error
      console.error(
        'Vector recall failed, falling back to traditional recall:',
        error
      );
      return this.storage.memory!.recall(userId, agentId, query, {
        type: options.type,
        limit: options.limit
      });
    }
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
    connectionType: ConnectionType,
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
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourceMemoryId: fromId,
          targetMemoryId: toId,
          connectionType: connectionType,
          strength,
          createdAt: Date.now()
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
