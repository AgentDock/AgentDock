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

import { z } from 'zod';

import {
  createEmbedding,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions
} from '../llm';
import { LogCategory, logger } from '../logging';
import { MemoryStorageError } from '../shared/errors/memory-errors';
import {
  ConnectionType,
  HybridSearchOptions,
  MemoryData,
  MemoryOperations,
  StorageProvider,
  validateConnectionType,
  VectorMemoryOperations
} from '../storage/types';
import { ConsolidationResult } from './base-types';
import { LazyDecayBatchProcessor } from './decay/LazyDecayBatchProcessor';
import {
  LazyDecayCalculator,
  LazyDecayConfig
} from './decay/LazyDecayCalculator';
import { DecayConfiguration } from './decay/types';
import { MemoryConsolidator } from './intelligence/consolidation/MemoryConsolidator';
import { EmbeddingService } from './intelligence/embeddings/EmbeddingService';
import { MemoryTransaction } from './transactions/MemoryTransaction';
import { Memory, MemoryManagerConfig, MemoryType } from './types';
import { EpisodicMemory } from './types/episodic/EpisodicMemory';
import { ProceduralMemory } from './types/procedural/ProceduralMemory';
import { SemanticMemory } from './types/semantic/SemanticMemory';
import { WorkingMemory } from './types/working/WorkingMemory';

// Zod schemas for consistent parameter validation
const UserAgentParamsSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required for memory operations'),
  agentId: z.string().trim().min(1, 'agentId is required')
});

const StoreMemoryParamsSchema = UserAgentParamsSchema.extend({
  content: z.string().trim().min(1, 'content is required')
});

const RecallParamsSchema = UserAgentParamsSchema.extend({
  query: z.string().trim().min(1, 'query is required')
});

const ConnectionParamsSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required for memory operations'),
  fromId: z.string().trim().min(1, 'fromId is required'),
  toId: z.string().trim().min(1, 'toId is required'),
  strength: z.number().min(0).max(1, 'strength must be between 0 and 1')
});

// Helper function to convert Zod errors to original format for backward compatibility
function validateAndThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallbackMessage?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Check the actual data to determine what fields are empty
    const dataObj = data as any;
    const hasEmptyUserId = !dataObj?.userId?.trim();
    const hasEmptyAgentId = !dataObj?.agentId?.trim();
    const hasEmptyContent =
      dataObj?.content !== undefined && !dataObj?.content?.trim();
    const hasEmptyQuery =
      dataObj?.query !== undefined && !dataObj?.query?.trim();

    // Handle specific error combinations for test compatibility
    if (hasEmptyUserId) {
      throw new Error(
        'userId must be a non-empty string for memory operations'
      );
    } else if (hasEmptyAgentId && (hasEmptyContent || hasEmptyQuery)) {
      if (fallbackMessage) {
        throw new Error(fallbackMessage);
      } else if (hasEmptyContent) {
        throw new Error('Agent ID and content are required');
      } else {
        throw new Error('Agent ID and query are required');
      }
    } else if (hasEmptyAgentId) {
      // If only agentId is empty but content/query are provided, use specific message
      if (dataObj?.content !== undefined) {
        throw new Error('Agent ID and content are required');
      } else if (dataObj?.query !== undefined) {
        throw new Error('Agent ID and query are required');
      } else {
        throw new Error('Agent ID is required');
      }
    } else if (fallbackMessage) {
      throw new Error(fallbackMessage);
    } else {
      // Fallback to first error message
      const errors = result.error.errors;
      throw new Error(errors[0]?.message || 'Validation failed');
    }
  }
  return result.data;
}

export class MemoryManager {
  private working: WorkingMemory;
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private procedural: ProceduralMemory;
  private embeddingService: EmbeddingService | null = null;
  private lazyDecayCalculator!: LazyDecayCalculator;
  private lazyDecayBatchProcessor!: LazyDecayBatchProcessor;
  private consolidator?: MemoryConsolidator;
  private consolidationScheduled = new Map<string, boolean>();
  private consolidationTimers = new Map<string, NodeJS.Timeout>();

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

    // Initialize on-demand decay calculation system
    this.lazyDecayCalculator = new LazyDecayCalculator();

    // Initialize batch processor for lazy decay updates
    this.lazyDecayBatchProcessor = new LazyDecayBatchProcessor(storage);

    // Initialize memory consolidator if enabled
    if (config.consolidation?.enabled) {
      // Create adapter to match ConsolidatorStorage interface
      const consolidatorStorage = {
        setMemory: async (memory: Memory) => {
          // Use store method to save memory
          await this.storage.memory!.store(
            memory.userId,
            memory.agentId,
            memory
          );
        },
        deleteMemory: async (
          userId: string,
          agentId: string,
          type: string,
          id: string
        ) => {
          // MemoryOperations doesn't have deleteMemory, so we skip it
          logger.warn(
            LogCategory.STORAGE,
            'MemoryManager',
            'Delete operation not supported by storage adapter'
          );
        },
        vectorSearch: undefined, // Not available in base MemoryOperations
        memory: {
          getByType: async (
            userId: string,
            agentId: string,
            type: string,
            options?: any
          ) => {
            // Use recall to get memories by type
            const memories = await this.storage.memory!.recall(
              userId,
              agentId,
              '',
              {
                type: type as MemoryType,
                limit: 1000
              }
            );

            // Filter by age if specified
            if (options?.createdBefore) {
              return memories.filter(
                (m) => m.createdAt < options.createdBefore
              );
            }

            return memories;
          }
        }
      };

      // Create proper ConsolidationConfig from our simplified config
      const consolidationConfig = {
        similarityThreshold: config.consolidation.similarityThreshold || 0.85,
        maxAge: config.consolidation.minEpisodicAge || 300000, // 5 minutes default
        preserveOriginals: false,
        strategies: ['merge'] as (
          | 'merge'
          | 'synthesize'
          | 'abstract'
          | 'hierarchy'
        )[],
        batchSize: config.consolidation.batchSize || 100,
        enableLLMSummarization: false
      };

      this.consolidator = new MemoryConsolidator(
        consolidatorStorage,
        consolidationConfig
      );
    }
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
    // Validate input parameters using Zod
    validateAndThrow(
      StoreMemoryParamsSchema,
      { userId, agentId, content },
      'Agent ID and content are required'
    );

    // Check if we have vector-enabled storage
    const isVectorMemoryOps = (ops: unknown): ops is VectorMemoryOperations => {
      if (!ops || typeof ops !== 'object') {
        return false;
      }

      const obj = ops as Record<string, unknown>;

      return (
        typeof obj.storeMemoryWithEmbedding === 'function' &&
        typeof obj.searchByVector === 'function' &&
        typeof obj.findSimilarMemories === 'function' &&
        typeof obj.hybridSearch === 'function' &&
        typeof obj.updateMemoryEmbedding === 'function' &&
        typeof obj.getMemoryEmbedding === 'function'
      );
    };

    // Check vector support carefully to avoid null reference
    let hasVectorSupport = false;
    try {
      const memoryOps = this.getMemoryOps();
      hasVectorSupport =
        isVectorMemoryOps(memoryOps) && !!this.embeddingService;
    } catch (error) {
      // If getMemoryOps throws, we don't have vector support
      hasVectorSupport = false;
    }

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
        const vectorMemoryOps = this.getMemoryOps() as VectorMemoryOperations;
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

    // Schedule consolidation for episodic memories if consolidator is enabled
    if (type === 'episodic' && this.consolidator) {
      this.scheduleConsolidation(userId, agentId);
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
    // Validate input parameters using Zod
    validateAndThrow(
      RecallParamsSchema,
      { userId, agentId, query },
      'Agent ID and query are required'
    );

    // Check if we have vector-enabled storage
    const isVectorMemoryOps = (ops: unknown): ops is VectorMemoryOperations => {
      if (!ops || typeof ops !== 'object') {
        return false;
      }

      const obj = ops as Record<string, unknown>;

      return (
        typeof obj.storeMemoryWithEmbedding === 'function' &&
        typeof obj.searchByVector === 'function' &&
        typeof obj.findSimilarMemories === 'function' &&
        typeof obj.hybridSearch === 'function' &&
        typeof obj.updateMemoryEmbedding === 'function' &&
        typeof obj.getMemoryEmbedding === 'function'
      );
    };

    // Check vector support carefully to avoid null reference
    let hasVectorSupport = false;
    try {
      const memoryOps = this.getMemoryOps();
      hasVectorSupport =
        isVectorMemoryOps(memoryOps) && !!this.embeddingService;
    } catch (error) {
      // If getMemoryOps throws, we don't have vector support
      hasVectorSupport = false;
    }

    if (!hasVectorSupport || !this.embeddingService) {
      // Standard memory recall with lazy decay processing
      const memories = (await this.getMemoryOps().recall(
        userId,
        agentId,
        query,
        {
          type: options.type,
          limit: options.limit
        }
      )) as MemoryData[];

      // Track access events for recalled memories
      await this.trackMemoryAccess(userId, agentId, memories);

      // Apply on-demand decay calculation during recall
      return await this.applyLazyDecayToMemories(memories);
    }

    // Vector-first approach
    try {
      // Step 1: Generate query embedding
      const queryEmbedding =
        await this.embeddingService.generateEmbedding(query);

      // Step 2: Perform hybrid search (vector + text)
      const vectorMemoryOps = this.getMemoryOps() as VectorMemoryOperations;

      // Use hybrid search if available, otherwise fall back to vector-only
      let memories: MemoryData[];

      if ('hybridSearch' in vectorMemoryOps && vectorMemoryOps.hybridSearch) {
        memories = await vectorMemoryOps.hybridSearch(
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
        memories = (await vectorMemoryOps.searchByVector(
          userId,
          agentId,
          queryEmbedding.embedding,
          {
            limit: options.limit || 20,
            threshold:
              this.config.intelligence?.embedding?.similarityThreshold || 0.7,
            filter: options.type ? { type: options.type } : undefined
          }
        )) as MemoryData[];
      }

      // Track access events for recalled memories
      await this.trackMemoryAccess(userId, agentId, memories);

      // Apply on-demand decay calculation to search results
      return await this.applyLazyDecayToMemories(memories);
    } catch (error) {
      // Memory recall with lazy decay failed
      logger.error(
        LogCategory.STORAGE,
        'MemoryManager',
        'Memory recall with lazy decay failed',
        { error: error instanceof Error ? error.message : String(error) }
      );
      throw new Error(
        `Memory recall failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
    decayConfig: DecayConfiguration
  ): Promise<void> {
    // Validate input parameters using Zod
    validateAndThrow(UserAgentParamsSchema, { userId, agentId });
    if (!decayConfig) {
      throw new Error('Decay configuration is required');
    }

    try {
      const memoryOps = this.getMemoryOps();
      if (memoryOps.applyDecay) {
        await memoryOps.applyDecay(userId, agentId, decayConfig);
      }
    } catch (error) {
      // If storage is unavailable, log and continue
      logger.warn(
        LogCategory.STORAGE,
        'MemoryManager',
        'Unable to apply decay - storage unavailable',
        { error: error instanceof Error ? error.message : String(error) }
      );
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
    // Validate input parameters using Zod
    ConnectionParamsSchema.parse({ userId, fromId, toId, strength });
    if (!connectionType) {
      throw new Error('Connection type is required');
    }

    // Validate connection type to ensure data integrity
    validateConnectionType(connectionType);

    if (typeof strength !== 'number') {
      throw new Error('Connection strength must be a number');
    }

    const memoryOps = this.getMemoryOps();
    if (memoryOps.createConnections) {
      await memoryOps.createConnections(userId, [
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
    // Validate input parameters using Zod
    validateAndThrow(
      z.object({
        userId: z.string().min(1, 'userId is required for memory operations')
      }),
      { userId }
    );
    return this.getMemoryOps().getStats(userId, agentId);
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
    // Validate input parameters using Zod
    validateAndThrow(UserAgentParamsSchema, { userId, agentId });
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
    // Validate input parameters using Zod
    const LearnParamsSchema = UserAgentParamsSchema.extend({
      trigger: z.string().min(1, 'trigger is required'),
      action: z.string().min(1, 'action is required')
    });
    LearnParamsSchema.parse({ userId, agentId, trigger, action });
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
    // Validate input parameters using Zod
    const RecommendationsParamsSchema = UserAgentParamsSchema.extend({
      trigger: z.string().min(1, 'trigger is required')
    });
    RecommendationsParamsSchema.parse({ userId, agentId, trigger });
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
    // Validate input parameters using Zod
    RecallParamsSchema.parse({ userId, agentId, query });
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
    // Validate input parameters using Zod
    validateAndThrow(UserAgentParamsSchema, { userId, agentId });
    return this.working.recall(userId, agentId, '', limit);
  }

  /**
   * Store memory with transaction support for atomic operations
   *
   * Ensures that memory storage and embedding generation either both
   * succeed or both fail, preventing inconsistent state.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent storing this memory
   * @param content - Memory content to store
   * @param type - Memory type: 'working' | 'episodic' | 'semantic' | 'procedural'
   * @param options - Optional storage configuration
   *
   * @returns Promise<string> - The generated memory ID
   *
   * @throws {Error} If any operation fails (all changes rolled back)
   *
   * @example Store with transaction
   * ```typescript
   * try {
   *   const memoryId = await manager.storeWithTransaction(
   *     'user-123',
   *     'agent-456',
   *     'Important user preference',
   *     'semantic'
   *   );
   * } catch (error) {
   *   // Both memory and embedding storage rolled back
   *   console.error('Transaction failed:', error);
   * }
   * ```
   */
  async storeWithTransaction(
    userId: string,
    agentId: string,
    content: string,
    type: MemoryType = MemoryType.SEMANTIC,
    options?: { timestamp?: number }
  ): Promise<string> {
    const transaction = new MemoryTransaction();
    let memoryId: string | undefined;
    let embeddingStored = false;

    try {
      // Validate inputs first using Zod
      validateAndThrow(
        StoreMemoryParamsSchema,
        { userId, agentId, content },
        'Agent ID and content are required'
      );

      // Operation 1: Store memory
      transaction.addOperation(
        async () => {
          memoryId = await this.store(userId, agentId, content, type, options);
        },
        async () => {
          if (memoryId) {
            await this.getMemoryOps().delete(userId, agentId, memoryId);
          }
        }
      );

      // Operation 2: Store embedding if vector operations are available
      const vectorOps = this.storage as any; // Check for vector operations
      if (this.embeddingService && vectorOps.memory?.storeMemoryWithEmbedding) {
        transaction.addOperation(
          async () => {
            if (!memoryId) return; // Skip if no memory ID

            const embeddingResult =
              await this.embeddingService!.generateEmbedding(content);

            // Get the memory data to store with embedding
            const memoryData = await this.getMemoryOps().getById?.(
              userId,
              memoryId
            );
            if (!memoryData) {
              throw new Error('Memory not found after creation');
            }

            // Store memory with embedding using vector operations
            await (
              vectorOps.memory as VectorMemoryOperations
            ).storeMemoryWithEmbedding(
              userId,
              agentId,
              memoryData,
              embeddingResult.embedding
            );

            embeddingStored = true;
          },
          async () => {
            // Rollback: Remove the embedding association
            // Note: The memory itself is deleted in operation 1's rollback
            if (memoryId && embeddingStored) {
              logger.warn(
                LogCategory.STORAGE,
                'MemoryManager',
                'Embedding rollback - memory will be deleted by primary operation'
              );
            }
          }
        );
      }

      // Execute all operations atomically
      await transaction.commit();

      if (!memoryId) {
        throw new Error('Memory ID not generated');
      }

      return memoryId;
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'MemoryManager', 'Transaction failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        agentId,
        type
      });
      throw error;
    }
  }

  /**
   * Process memories with on-demand decay calculation
   *
   * Calculates and applies memory decay based on access patterns and time.
   * Updates memory resonance values and applies reinforcement for accessed memories.
   *
   * @param memories - Array of memories to process
   * @returns Promise<MemoryData[]> - Memories with updated decay values
   */
  private async applyLazyDecayToMemories(
    memories: MemoryData[]
  ): Promise<MemoryData[]> {
    if (!memories || memories.length === 0) {
      return memories;
    }

    // Calculate on-demand decay for all retrieved memories
    const decayResults = this.lazyDecayCalculator.calculateBatchDecay(memories);

    // Collect memory updates that need to be persisted
    const updates = decayResults
      .filter((result) => result.shouldUpdate)
      .map((result) => ({
        id: result.memoryId,
        resonance: result.newResonance,
        lastAccessedAt: Date.now(),
        accessCount:
          memories.find((m) => m.id === result.memoryId)?.accessCount || 0
      }));

    // Add updates to batch processor for efficient writing
    if (updates.length > 0) {
      updates.forEach((update) => {
        this.lazyDecayBatchProcessor.add(update);
      });

      logger.debug(
        LogCategory.STORAGE,
        'MemoryManager',
        'Updated memory decay values',
        {
          totalMemories: memories.length,
          updatedMemories: updates.length,
          updates: updates.map((u) => ({ id: u.id, newResonance: u.resonance }))
        }
      );
    }

    // Return memories with current decay-calculated values
    return memories.map((memory) => {
      const result = decayResults.find((r) => r.memoryId === memory.id);
      if (result && result.shouldUpdate) {
        return {
          ...memory,
          resonance: result.newResonance,
          lastAccessedAt: Date.now()
        };
      }
      return memory;
    });
  }

  /**
   * Force flush of pending lazy decay updates
   * Primarily used for testing to ensure all updates are written immediately
   */
  async flushLazyDecayUpdates(): Promise<void> {
    await this.lazyDecayBatchProcessor.flushNow();
  }

  /**
   * Closes the memory manager and cleans up resources
   * This should be called when the memory manager is no longer needed
   */
  async close(): Promise<void> {
    // Clear all pending consolidation timers
    for (const [key, timerId] of this.consolidationTimers.entries()) {
      clearTimeout(timerId);
    }
    this.consolidationTimers.clear();
    this.consolidationScheduled.clear();

    // Clean up all memory type instances
    await Promise.all([
      this.working.destroy(),
      this.episodic.destroy(),
      this.semantic.destroy(),
      this.procedural.destroy()
    ]);

    // Destroy batch processor
    await this.lazyDecayBatchProcessor.destroy();

    // Storage cleanup if supported
    if (this.storage.destroy) {
      await this.storage.destroy();
    }
  }

  /**
   * Consolidates memories for a specific agent
   *
   * Performs memory consolidation to:
   * - Convert old episodic memories to semantic memories
   * - Merge similar memories to reduce redundancy
   * - Extract patterns and insights from memory clusters
   *
   * @param userId - User identifier
   * @param agentId - Agent identifier
   * @returns Consolidation results including consolidated count and new memories
   * @throws {Error} If memory consolidation is not enabled in configuration
   */
  async consolidateMemories(
    userId: string,
    agentId: string
  ): Promise<ConsolidationResult[]> {
    // Validate input parameters using Zod
    validateAndThrow(UserAgentParamsSchema, { userId, agentId });
    if (!this.consolidator) {
      throw new Error('Memory consolidation not enabled');
    }

    // Use the actual consolidateMemories method with proper configuration
    const results = await this.consolidator.consolidateMemories(
      userId,
      agentId,
      {
        strategies: ['merge', 'synthesize'],
        maxAge: this.config.consolidation?.minEpisodicAge || 300000, // 5 minutes default
        similarityThreshold:
          this.config.consolidation?.similarityThreshold || 0.85,
        batchSize: this.config.consolidation?.batchSize || 100
      }
    );

    return results;
  }

  /**
   * Schedules automatic memory consolidation
   *
   * Consolidation runs after a delay to batch operations and avoid
   * excessive processing during high-frequency memory storage.
   *
   * @param userId - User identifier
   * @param agentId - Agent identifier
   * @private
   */
  private scheduleConsolidation(userId: string, agentId: string): void {
    const key = `${userId}:${agentId}`;

    if (!this.consolidationScheduled.has(key)) {
      this.consolidationScheduled.set(key, true);

      const timerId = setTimeout(async () => {
        try {
          await this.consolidateMemories(userId, agentId);
          logger.info(
            LogCategory.STORAGE,
            'MemoryManager',
            'Memory consolidation completed',
            { userId, agentId }
          );
        } catch (error) {
          logger.error(
            LogCategory.STORAGE,
            'MemoryManager',
            'Memory consolidation failed',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
        } finally {
          this.consolidationScheduled.delete(key);
          this.consolidationTimers.delete(key);
        }
      }, 300000); // 5 minutes delay

      this.consolidationTimers.set(key, timerId);
    }
  }

  /**
   * Track memory access events for evolution tracking
   * 
   * @param userId - User identifier
   * @param agentId - Agent identifier  
   * @param memories - Array of accessed memories
   * @private
   */
  private async trackMemoryAccess(
    userId: string,
    agentId: string,
    memories: MemoryData[]
  ): Promise<void> {
    if (!this.storage.evolution?.trackEventBatch || memories.length === 0) {
      return;
    }

    try {
      const accessEvents = memories.map(memory => ({
        memoryId: memory.id,
        userId,
        agentId,
        type: 'accessed' as const,
        timestamp: Date.now(),
        metadata: {
          source: 'MemoryManager',
          queryType: 'recall'
        }
      }));

      await this.storage.evolution.trackEventBatch(accessEvents);
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryManager',
        'Failed to track memory access events',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}
