/**
 * Core memory management system for AgentDock AI agents
 *
 * Provides multi-type memory storage with automatic importance calculation,
 * decay over time, and intelligent connection discovery between memories.
 * Supports configurable embedding providers for semantic similarity.
 *
 * Features:
 * - Multi-type memory support (working, episodic, semantic, procedural)
 * - Configurable embedding providers (OpenAI, Google, Mistral, Voyage, Cohere)
 * - Automatic importance and resonance calculation
 * - Time-based memory decay with access patterns
 * - Progressive enhancement for connection discovery
 * - User-level data isolation for security
 * - Vector-first storage with hybrid search capabilities
 * - Graceful fallback to traditional storage
 *
 * @example Basic usage
 * ```typescript
 * const manager = new MemoryManager(storage, {
 *   working: { maxTokens: 4000 },
 *   episodic: { maxMemoriesPerSession: 1000 },
 *   semantic: { maxMemoriesPerCategory: 2000 },
 *   procedural: { minSuccessRate: 0.7 }
 * });
 *
 * // Store a memory
 * const memoryId = await manager.store(
 *   'user-123',
 *   'agent-456',
 *   'User prefers dark mode',
 *   'semantic'
 * );
 *
 * // Recall related memories
 * const memories = await manager.recall(
 *   'user-123',
 *   'agent-456',
 *   'user preferences'
 * );
 * ```
 *
 * @example With custom embedding provider
 * ```typescript
 * // Set environment variables
 * process.env.EMBEDDING_PROVIDER = 'google';
 * process.env.GOOGLE_API_KEY = 'your-key';
 *
 * const manager = new MemoryManager(storage, config);
 * ```
 *
 * @example Vector-enhanced configuration
 * ```typescript
 * const config = {
 *   working: { maxTokens: 4000 },
 *   episodic: { maxMemoriesPerSession: 1000 },
 *   semantic: { maxMemoriesPerCategory: 2000 },
 *   procedural: { minSuccessRate: 0.7 },
 *   intelligence: {
 *     embedding: {
 *       enabled: true,
 *       provider: 'google',
 *       model: 'text-embedding-004',
 *       similarityThreshold: 0.75
 *     }
 *   }
 * };
 * ```
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
   * Stores a new memory in the system with automatic importance calculation
   *
   * Uses vector-first approach when embedding service is available, automatically
   * generating embeddings for semantic similarity search. Falls back gracefully
   * to traditional storage when vector operations fail.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent storing this memory
   * @param content - Memory content to store
   * @param type - Memory type: 'working' | 'episodic' | 'semantic' | 'procedural'
   * @param options - Optional storage configuration
   * @param options.timestamp - Custom timestamp for historical memory injection
   *
   * @returns Promise<string> - The generated memory ID
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId or content is empty
   * @throws {Error} If storage operation fails
   * @throws {Error} If content exceeds token limit for memory type
   *
   * @example Store semantic memory
   * ```typescript
   * const memoryId = await manager.store(
   *   'user-123',
   *   'agent-456',
   *   'User prefers dark mode UI',
   *   'semantic'
   * );
   * ```
   *
   * @example Store historical memory with custom timestamp
   * ```typescript
   * const memoryId = await manager.store(
   *   'user-123',
   *   'agent-456',
   *   'User completed onboarding 10 years ago',
   *   'episodic',
   *   { timestamp: Date.now() - (10 * 365 * 24 * 60 * 60 * 1000) }
   * );
   * ```
   */
  async store(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType = MemoryType.SEMANTIC,
    options?: { timestamp?: number }
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
          type,
          options?.timestamp
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
        logger.error(
          LogCategory.STORAGE,
          'MemoryManager',
          'Vector storage failed, falling back to traditional storage',
          { error: error instanceof Error ? error.message : String(error) }
        );
        memoryId = await this.delegateToMemoryType(
          userId,
          agentId,
          content,
          type,
          options?.timestamp
        );
      }
    } else {
      // Traditional storage without embeddings
      memoryId = await this.delegateToMemoryType(
        userId,
        agentId,
        content,
        type,
        options?.timestamp
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
    type: MemoryType,
    timestamp?: number
  ): Promise<any> {
    // Create basic memory data structure
    const now = Date.now();
    return {
      id: `mem_${timestamp || now}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      agentId,
      type,
      content,
      importance: 0.5, // Default importance
      resonance: 0.5, // Default resonance
      accessCount: 0,
      createdAt: timestamp || now,
      updatedAt: now,
      lastAccessedAt: now,
      metadata: {
        memoryType: type
      }
    };
  }

  /**
   * Delegate storage to appropriate memory type
   * Note: Individual memory types don't yet support timestamp injection
   * Historical timestamps are preserved when using vector storage
   */
  private async delegateToMemoryType(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType,
    timestamp?: number
  ): Promise<string> {
    // Log if timestamp injection attempted with traditional storage
    if (timestamp && timestamp !== Date.now()) {
      logger.info(
        LogCategory.STORAGE,
        'MemoryManager',
        'Historical timestamp injection requires vector storage. Using current time.',
        { requestedTimestamp: new Date(timestamp).toISOString() }
      );
    }

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
   * Recalls memories using vector-first approach with hybrid search
   *
   * Performs semantic similarity search using embeddings when available,
   * combining vector search (70%) with text search (30%) for optimal results.
   * Falls back to traditional text-based search when vector operations fail.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent requesting memories
   * @param query - Search query to find related memories
   * @param options - Optional search configuration
   * @param options.type - Filter by memory type
   * @param options.limit - Maximum number of memories to return (default: 20)
   *
   * @returns Promise<any[]> - Array of matching memories with relevance scores
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId or query is empty
   * @throws {Error} If storage operation fails
   *
   * @example Basic memory recall
   * ```typescript
   * const memories = await manager.recall(
   *   'user-123',
   *   'agent-456',
   *   'user preferences'
   * );
   * ```
   *
   * @example Filtered recall with options
   * ```typescript
   * const workingMemories = await manager.recall(
   *   'user-123',
   *   'agent-456',
   *   'current tasks',
   *   { type: 'working', limit: 10 }
   * );
   * ```
   *
   * @example Semantic search with vector similarity
   * ```typescript
   * // If embedding service is configured, performs semantic similarity search
   * const relatedMemories = await manager.recall(
   *   'user-123',
   *   'agent-456',
   *   'dark theme settings'
   * );
   * // Returns memories about UI preferences, themes, display settings
   * ```
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
      logger.error(
        LogCategory.STORAGE,
        'MemoryManager',
        'Vector recall failed, falling back to traditional recall',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return this.storage.memory!.recall(userId, agentId, query, {
        type: options.type,
        limit: options.limit
      });
    }
  }

  /**
   * Applies time-based memory decay to reduce importance over time
   *
   * Implements exponential decay algorithm to gradually reduce memory importance
   * and resonance based on age and access patterns. Memories that are accessed
   * frequently maintain higher importance scores.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent whose memories to decay
   * @param decayConfig - Configuration for decay algorithm
   * @param decayConfig.decayRate - Rate of importance reduction (0-1)
   * @param decayConfig.minImportance - Minimum importance threshold
   * @param decayConfig.accessBonus - Bonus for recently accessed memories
   *
   * @returns Promise<void> - Completes when decay is applied
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId is empty
   * @throws {Error} If decayConfig is missing
   * @throws {Error} If storage operation fails
   *
   * @example Basic decay application
   * ```typescript
   * await manager.decay('user-123', 'agent-456', {
   *   decayRate: 0.1,
   *   minImportance: 0.1,
   *   accessBonus: 0.05
   * });
   * ```
   *
   * @example Aggressive decay for working memory
   * ```typescript
   * await manager.decay('user-123', 'agent-456', {
   *   decayRate: 0.3,
   *   minImportance: 0.05,
   *   accessBonus: 0.1
   * });
   * ```
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
   * Creates a manual connection between two memories
   *
   * Establishes a directed connection between memories with specified type and strength.
   * Connections enable graph-based memory traversal and influence recall relevance.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param fromId - Source memory ID
   * @param toId - Target memory ID
   * @param connectionType - Type of connection (causal, temporal, semantic, etc.)
   * @param strength - Connection strength (0-1, higher = stronger)
   *
   * @returns Promise<void> - Completes when connection is created
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If fromId or toId is empty
   * @throws {Error} If connectionType is missing
   * @throws {Error} If strength is not a number
   * @throws {Error} If storage operation fails
   *
   * @example Create causal connection
   * ```typescript
   * await manager.createConnection(
   *   'user-123',
   *   'mem_user_clicked_button',
   *   'mem_modal_opened',
   *   'causal',
   *   0.9
   * );
   * ```
   *
   * @example Create semantic connection
   * ```typescript
   * await manager.createConnection(
   *   'user-123',
   *   'mem_dark_mode_preference',
   *   'mem_ui_theme_settings',
   *   'semantic',
   *   0.8
   * );
   * ```
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
   * Retrieves memory statistics and usage metrics
   *
   * Provides comprehensive analytics about memory usage including count by type,
   * storage usage, connection statistics, and performance metrics.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - Optional agent ID to filter statistics
   *
   * @returns Promise<any> - Object containing memory statistics
   * @returns Promise<{
   *   totalMemories: number;
   *   memoriesByType: Record<string, number>;
   *   totalConnections: number;
   *   storageUsage: number;
   *   averageImportance: number;
   *   lastActivity: Date;
   * }>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If storage operation fails
   *
   * @example Get user-wide statistics
   * ```typescript
   * const stats = await manager.getStats('user-123');
   * console.log(`Total memories: ${stats.totalMemories}`);
   * console.log(`Working: ${stats.memoriesByType.working}`);
   * ```
   *
   * @example Get agent-specific statistics
   * ```typescript
   * const agentStats = await manager.getStats('user-123', 'agent-456');
   * console.log(`Agent has ${agentStats.totalMemories} memories`);
   * ```
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
   * Clears all working memory for a specific agent
   *
   * Removes all temporary memories from working memory type, typically used
   * when starting a new conversation or task session.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent whose working memory to clear
   *
   * @returns Promise<void> - Completes when working memory is cleared
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId is empty
   * @throws {Error} If storage operation fails
   *
   * @example Clear working memory for new session
   * ```typescript
   * await manager.clearWorkingMemory('user-123', 'agent-456');
   * ```
   *
   * @example Clear working memory with confirmation
   * ```typescript
   * const stats = await manager.getStats('user-123', 'agent-456');
   * if (stats.memoriesByType.working > 0) {
   *   await manager.clearWorkingMemory('user-123', 'agent-456');
   *   console.log('Working memory cleared');
   * }
   * ```
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
   * Records a successful action pattern for procedural learning
   *
   * Stores trigger-action pairs that can be used for future recommendations.
   * Builds procedural memory by learning from successful outcomes.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent learning the pattern
   * @param trigger - The condition or context that triggered the action
   * @param action - The successful action taken
   *
   * @returns Promise<any> - Learning result with pattern ID and confidence
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId, trigger, or action is empty
   * @throws {Error} If storage operation fails
   *
   * @example Learn from successful interaction
   * ```typescript
   * const result = await manager.learn(
   *   'user-123',
   *   'agent-456',
   *   'user asks for help',
   *   'provide step-by-step instructions'
   * );
   * ```
   *
   * @example Learn from error resolution
   * ```typescript
   * const result = await manager.learn(
   *   'user-123',
   *   'agent-456',
   *   'API timeout error',
   *   'retry with exponential backoff'
   * );
   * ```
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
   * Gets recommended actions based on procedural memory patterns
   *
   * Analyzes historical trigger-action patterns to suggest appropriate actions
   * for the current context. Returns actions ranked by confidence score.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent requesting recommendations
   * @param trigger - The current context or condition
   *
   * @returns Promise<any[]> - Array of recommended actions with confidence scores
   * @returns Promise<Array<{
   *   action: string;
   *   confidence: number;
   *   timesUsed: number;
   *   lastUsed: Date;
   * }>>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId or trigger is empty
   * @throws {Error} If storage operation fails
   *
   * @example Get recommendations for user request
   * ```typescript
   * const recommendations = await manager.getRecommendations(
   *   'user-123',
   *   'agent-456',
   *   'user asks for help'
   * );
   *
   * // Use the highest confidence recommendation
   * const bestAction = recommendations[0];
   * console.log(`Recommend: ${bestAction.action} (${bestAction.confidence})`);
   * ```
   *
   * @example Get recommendations for error handling
   * ```typescript
   * const recommendations = await manager.getRecommendations(
   *   'user-123',
   *   'agent-456',
   *   'API timeout error'
   * );
   *
   * for (const rec of recommendations) {
   *   console.log(`${rec.action} - used ${rec.timesUsed} times`);
   * }
   * ```
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
   * Searches semantic knowledge base for relevant information
   *
   * Performs targeted search within semantic memory type to find factual
   * information, knowledge, and learned concepts related to the query.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent searching for knowledge
   * @param query - Search query for knowledge lookup
   *
   * @returns Promise<any[]> - Array of relevant knowledge entries
   * @returns Promise<Array<{
   *   content: string;
   *   importance: number;
   *   category: string;
   *   createdAt: Date;
   *   accessCount: number;
   * }>>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId or query is empty
   * @throws {Error} If storage operation fails
   *
   * @example Search for factual knowledge
   * ```typescript
   * const knowledge = await manager.searchKnowledge(
   *   'user-123',
   *   'agent-456',
   *   'JavaScript async patterns'
   * );
   *
   * for (const item of knowledge) {
   *   console.log(`${item.category}: ${item.content}`);
   * }
   * ```
   *
   * @example Search for user-specific knowledge
   * ```typescript
   * const userKnowledge = await manager.searchKnowledge(
   *   'user-123',
   *   'agent-456',
   *   'user preferences and settings'
   * );
   * ```
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
   * Retrieves current working context for active conversation
   *
   * Gets the most recent working memories that form the current context
   * for ongoing conversation or task execution.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent whose working context to retrieve
   * @param limit - Maximum number of context items to return (default: all)
   *
   * @returns Promise<any[]> - Array of working context memories
   * @returns Promise<Array<{
   *   content: string;
   *   importance: number;
   *   createdAt: Date;
   *   sessionId?: string;
   * }>>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If agentId is empty
   * @throws {Error} If storage operation fails
   *
   * @example Get current working context
   * ```typescript
   * const context = await manager.getWorkingContext(
   *   'user-123',
   *   'agent-456',
   *   5
   * );
   *
   * console.log('Current context:');
   * context.forEach(item => console.log(`- ${item.content}`));
   * ```
   *
   * @example Get full working context
   * ```typescript
   * const fullContext = await manager.getWorkingContext(
   *   'user-123',
   *   'agent-456'
   * );
   *
   * const contextSummary = fullContext
   *   .map(item => item.content)
   *   .join(' ');
   * ```
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
   * Closes the memory manager and performs cleanup
   *
   * Properly shuts down the memory manager, releasing resources and
   * performing any necessary cleanup operations. Should be called
   * when the memory manager is no longer needed.
   *
   * @returns Promise<void> - Completes when cleanup is finished
   *
   * @throws {Error} If cleanup operations fail
   *
   * @example Graceful shutdown
   * ```typescript
   * try {
   *   await manager.close();
   *   console.log('Memory manager closed successfully');
   * } catch (error) {
   *   console.error('Error during cleanup:', error);
   * }
   * ```
   *
   * @example Close in finally block
   * ```typescript
   * let manager;
   * try {
   *   manager = new MemoryManager(storage, config);
   *   // ... use memory manager
   * } finally {
   *   if (manager) {
   *     await manager.close();
   *   }
   * }
   * ```
   */
  async close(): Promise<void> {
    // Storage cleanup if supported
    if (this.storage.destroy) {
      await this.storage.destroy();
    }
  }
}
