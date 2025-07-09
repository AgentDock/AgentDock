import { Pool } from 'pg';

import { LogCategory, logger } from '../../logging';
import { MemoryError } from '../../shared/errors/memory-errors';
import { StorageProvider, ScoredMemoryData, MemoryOperations } from '../../storage/types';
import { MemoryConnectionManager } from '../intelligence/connections/MemoryConnectionManager';
import { EmbeddingService } from '../intelligence/embeddings/EmbeddingService';
import { IntelligenceLayerConfig } from '../intelligence/types';
import { CostTracker } from '../tracking/CostTracker';
import { MemoryType } from '../types/common';
import { EpisodicMemory } from '../types/episodic/EpisodicMemory';
import { ProceduralMemory } from '../types/procedural/ProceduralMemory';
import { SemanticMemory } from '../types/semantic/SemanticMemory';
import { WorkingMemory } from '../types/working/WorkingMemory';
import {
  HybridSearchResult,
  RecallConfig,
  RecallMetrics,
  RecallQuery,
  RecallResult,
  UnifiedMemoryResult
} from './RecallServiceTypes';
import {
  calculateCombinedRelevance,
  calculateTemporalRelevance,
  calculateTextRelevance,
  findMemoryRelationships,
  mergeHybridResults,
  optimizeQuery,
  validateRecallQuery
} from './RecallServiceUtils';

/**
 * RecallService provides unified cross-memory search and retrieval.
 * It orchestrates searches across all memory types and provides
 * intelligent ranking and relationship discovery.
 *
 * Features:
 * - Hybrid search across all memory types
 * - Intelligent relevance scoring
 * - Related memory discovery
 * - Performance optimization with caching
 * - Search analytics and metrics
 *
 * @example Basic usage with manual setup
 * ```typescript
 * const storage = new SQLiteAdapter(dbPath);
 * const memoryManager = new MemoryManager(storage, memoryConfig);
 * const recallService = new RecallService(
 *   memoryManager.working,
 *   memoryManager.episodic,
 *   memoryManager.semantic,
 *   memoryManager.procedural,
 *   recallConfig
 * );
 * ```
 *
 * @todo Add convenience factory for easier setup
 * ```typescript
 * // SUGGESTED: Add createRecallService factory function
 * export function createRecallService(options: {
 *   storage?: StorageProvider | 'sqlite' | 'memory' | 'postgresql';
 *   dbPath?: string;
 *   vectorSearch?: boolean;
 *   caching?: boolean;
 *   customConfig?: Partial<RecallConfig>;
 * }): Promise<RecallService> {
 *   // Factory implementation would:
 *   // 1. Create storage provider based on options.storage
 *   // 2. Create memory manager with sensible defaults
 *   // 3. Instantiate RecallService with optimized config
 *   // 4. Return ready-to-use RecallService instance
 * }
 *
 * // Usage examples:
 * const quickRecall = await createRecallService({ vectorSearch: false });
 * const productionRecall = await createRecallService({
 *   storage: 'postgresql',
 *   vectorSearch: true
 * });
 * ```
 */
export class RecallService {
  private cache = new Map<
    string,
    { result: RecallResult; timestamp: number }
  >();

  /**
   * Flag to prevent concurrent cache cleanup operations
   * @private
   */
  private cleanupInProgress = false;

  /**
   * Track pending cleanup operation for proper cleanup on destroy
   * @private
   */
  private pendingCleanupId: NodeJS.Immediate | null = null;

  /**
   * Flag to indicate service is being destroyed
   * @private
   */
  private isDestroyed = false;

  /**
   * High water mark for cache size - triggers cleanup
   * @private
   */
  private readonly cacheHighWater = parseInt(
    process.env.RECALL_CACHE_HIGH_WATER || '1000'
  );

  /**
   * Low water mark for cache size - target size after cleanup
   * @private
   */
  private readonly cacheLowWater = parseInt(
    process.env.RECALL_CACHE_LOW_WATER || '900'
  );

  /**
   * Counter for tracking cleanup frequency (for monitoring)
   * @private
   */
  private cleanupCount = 0;

  private metrics: RecallMetrics = {
    totalQueries: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
    memoryTypeDistribution: {
      [MemoryType.WORKING]: 0,
      [MemoryType.EPISODIC]: 0,
      [MemoryType.SEMANTIC]: 0,
      [MemoryType.PROCEDURAL]: 0
    },
    popularQueries: []
  };

  private connectionManager?: MemoryConnectionManager;
  private embeddingConfig?: {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
  };
  private embeddingService?: EmbeddingService;

  constructor(
    private workingMemory: WorkingMemory,
    private episodicMemory: EpisodicMemory,
    private semanticMemory: SemanticMemory,
    private proceduralMemory: ProceduralMemory,
    private config: RecallConfig,
    private intelligenceConfig?: IntelligenceLayerConfig,
    private storage?: StorageProvider
  ) {
    // Initialize connection manager if intelligence config enables it
    if (intelligenceConfig?.connectionDetection && storage) {
      const costTracker = new CostTracker(storage);
      this.connectionManager = new MemoryConnectionManager(
        storage,
        intelligenceConfig,
        costTracker
      );

      logger.info(
        LogCategory.STORAGE,
        'RecallService',
        'Connection graph enhancement enabled for recall',
        {
          connectionDetectionEnabled:
            intelligenceConfig.connectionDetection.enabled,
          maxCandidates:
            intelligenceConfig.connectionDetection.maxCandidates || 20
        }
      );
    }

    // Store embedding config for lazy initialization
    if (this.intelligenceConfig?.embedding?.enabled) {
      this.embeddingConfig = {
        provider: this.intelligenceConfig.embedding.provider || 'openai',
        model: this.intelligenceConfig.embedding.model || 'text-embedding-3-small'
        // Note: dimensions are determined by the model
      };

      logger.info(
        LogCategory.STORAGE,
        'RecallService',
        'Embedding service configuration stored for hybrid search',
        {
          provider: this.embeddingConfig.provider,
          model: this.embeddingConfig.model
        }
      );
    }
  }

  /**
   * Main recall method - searches across all memory types
   */
  async recall(query: RecallQuery): Promise<RecallResult> {
    const startTime = Date.now();
    const searchErrors: MemoryError[] = [];

    if (!validateRecallQuery(query)) {
      throw new Error('Invalid recall query');
    }

    const optimizedQuery = optimizeQuery(query.query);
    const cacheKey = this.generateCacheKey(query);

    // Check cache first
    if (this.config.cacheResults) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.updateMetrics(startTime, true);
        return cached;
      }
    }

    // Determine which memory types to search
    const memoryTypes = query.memoryTypes || [
      MemoryType.WORKING,
      MemoryType.EPISODIC,
      MemoryType.SEMANTIC,
      MemoryType.PROCEDURAL
    ];

    // Execute parallel searches with error collection
    const searchPromises = memoryTypes.map(async (type) => {
      const result = await this.searchMemoryType(type, query);
      // Check if this search had errors
      if ('error' in result && result.error) {
        searchErrors.push(result.error);
      }
      return result;
    });

    const searchResults = await Promise.all(searchPromises);
    const allMemories = searchResults.flat().filter((m) => m.id); // Filter out error markers

    // Apply hybrid scoring
    const rankedMemories = this.applyHybridScoring(allMemories, query);

    // Enhance with stored connections from database
    let enhancedMemories = await this.enhanceWithStoredConnections(
      rankedMemories,
      query.userId
    );

    // NEW: Enrich with graph traversal to discover additional memories
    if (this.intelligenceConfig?.connectionDetection) {
      enhancedMemories = await this.enrichWithConnections(
        enhancedMemories,
        query
      );
      enhancedMemories = await this.applyCentralityBoost(
        enhancedMemories,
        query
      );
    }

    // TEMPORAL FIX: Extract conversation date context for AgentNode-style injection
    const conversationContext =
      this.extractConversationDateContext(enhancedMemories);

    // Add relationships if requested
    if (query.includeRelated !== false && this.config.enableRelatedMemories) {
      for (const memory of enhancedMemories.slice(0, 10)) {
        // Only for top 10
        memory.relationships = findMemoryRelationships(
          memory,
          enhancedMemories,
          this.config.maxRelatedDepth
        );
      }
    }

    // Filter by relevance threshold
    const filteredMemories = enhancedMemories.filter(
      (memory) =>
        memory.relevance >=
        (query.minRelevance ?? this.config.minRelevanceThreshold)
    );

    // Apply limit
    const limitedMemories = filteredMemories.slice(
      0,
      query.limit || this.config.defaultLimit
    );

    // Check if all searches failed
    if (limitedMemories.length === 0 && searchErrors.length > 0) {
      const errorMessage = searchErrors.map((e) => e.message).join('; ');
      throw new Error(`All memory searches failed: ${errorMessage}`);
    }

    // Track memory access events
    if (this.storage?.evolution?.trackEventBatch && limitedMemories.length > 0) {
      const accessEvents = limitedMemories.map(memory => ({
        memoryId: memory.id,
        userId: query.userId,
        agentId: query.agentId,
        type: 'accessed' as const,
        timestamp: Date.now(),
        metadata: {
          query: query.query,
          relevance: memory.relevance,
          memoryType: memory.type
        }
      }));
      
      this.storage.evolution.trackEventBatch(accessEvents).catch(error => {
        logger.warn(
          LogCategory.STORAGE,
          'RecallService',
          'Failed to track memory access events',
          { error: error instanceof Error ? error.message : String(error) }
        );
      });
    }

    // Cache result
    const result: RecallResult = {
      memories: limitedMemories,
      totalRelevance: limitedMemories.reduce((sum, m) => sum + m.relevance, 0),
      searchStrategy: this.determineSearchStrategy(query),
      executionTime: Date.now() - startTime,
      sources: this.calculateSourceDistribution(limitedMemories),
      // NEW: Include conversation temporal context for AgentNode-style injection
      conversationContext: conversationContext
    };

    if (this.config.cacheResults) {
      this.cacheResult(cacheKey, result);
    }

    this.updateMetrics(startTime, false);
    return result;
  }

  /**
   * NATURAL TEMPORAL CONTEXT: Extract conversation date context from memories
   * This provides temporal context naturally without directing the LLM's reasoning
   */
  private extractConversationDateContext(
    memories: UnifiedMemoryResult[]
  ): string | undefined {
    // Find memories with original conversation dates
    const conversationDates = memories
      .map((memory) => memory.context?.originalConversationDate)
      .filter((date) => date) as string[];

    if (conversationDates.length === 0) return undefined;

    // Use the earliest conversation date found
    const earliestDate = conversationDates.sort()[0];
    const conversationDate = new Date(earliestDate);

    // NATURAL APPROACH: Just provide context like AgentNode does with current date
    // Let the LLM use its intelligence for temporal reasoning
    return `
Original conversation: ${conversationDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${conversationDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
  }

  /**
   * Search specific memory type
   */
  private async searchMemoryType(
    type: MemoryType,
    query: RecallQuery
  ): Promise<
    UnifiedMemoryResult[] | (UnifiedMemoryResult[] & { error: MemoryError })
  > {
    const results: UnifiedMemoryResult[] = [];

    try {
      // Check if storage supports hybrid search and embedding is enabled
      if (
        this.storage?.memory &&
        this.hasHybridSearch(this.storage.memory) &&
        this.embeddingConfig &&
        this.config.enableVectorSearch !== false
      ) {
        // Initialize embedding service if needed
        await this.ensureEmbeddingService();

        // Generate query embedding
        const queryEmbedding = await this.embeddingService!.generateEmbedding(
          query.query
        );

        logger.debug(
          LogCategory.STORAGE,
          'RecallService',
          'Executing hybrid search',
          {
            userId: query.userId.substring(0, 8),
            agentId: query.agentId.substring(0, 8),
            memoryType: type,
            queryLength: query.query.length,
            embeddingDimensions: queryEmbedding.embedding.length
          }
        );

        // Execute hybrid search
        const hybridResults = await this.storage.memory!.hybridSearch(
          query.userId,
          query.agentId,
          query.query,
          queryEmbedding.embedding,
          {
            limit: query.limit || this.config.defaultLimit,
            filter: { type },
            vectorWeight: this.config.hybridSearchWeights?.vector || 0.7,
            textWeight: this.config.hybridSearchWeights?.text || 0.3,
            threshold: query.minRelevance || this.config.minRelevanceThreshold
          }
        );

        // Convert hybrid results to unified format
        for (const memory of hybridResults) {
          // Extract relevance score from result
          // Note: Using any here because different storage adapters may return 
          // score under different field names (score, hybrid_score, relevance_score)
          const relevanceScore = 
            (memory as any).score || 
            (memory as any).hybrid_score || 
            (memory as any).relevance_score || 
            0.5;

          results.push(this.convertToUnifiedResult(memory, type, relevanceScore, true));
        }

        logger.info(
          LogCategory.STORAGE,
          'RecallService',
          'Hybrid search completed',
          {
            userId: query.userId.substring(0, 8),
            agentId: query.agentId.substring(0, 8),
            memoryType: type,
            resultsFound: results.length,
            usingProvider: this.embeddingConfig.provider
          }
        );

        return results;
      }

      // Fallback to text-based search for each memory type
      switch (type) {
        case MemoryType.WORKING: {
          const workingResults = await this.workingMemory.recall(
            query.userId,
            query.agentId,
            query.query,
            Math.ceil((query.limit || this.config.defaultLimit) / 4)
          );

          for (const memory of workingResults) {
            const relevance = calculateTextRelevance(
              memory.content,
              query.query
            );
            if (relevance > 0.1) {
              results.push(this.convertToUnifiedResult(memory, type, relevance));
            }
          }
          break;
        }

        case MemoryType.EPISODIC: {
          const episodicResults = await this.episodicMemory.recall(
            query.userId,
            query.agentId,
            query.query,
            {
              limit: Math.ceil((query.limit || this.config.defaultLimit) / 2),
              timeRange: query.timeRange
                ? {
                    start: new Date(query.timeRange.start),
                    end: new Date(query.timeRange.end)
                  }
                : undefined
            }
          );

          for (const memory of episodicResults) {
            const textRelevance = calculateTextRelevance(
              memory.content,
              query.query,
              memory.tags
            );
            const temporalRelevance = calculateTemporalRelevance(
              memory.createdAt,
              Date.now(),
              query.timeRange
            );
            const combinedRelevance =
              textRelevance * 0.7 + temporalRelevance * 0.3;

            if (combinedRelevance > 0.1) {
              results.push(this.convertToUnifiedResult(memory, type, combinedRelevance));
            }
          }
          break;
        }

        case MemoryType.SEMANTIC: {
          const semanticResults = await this.semanticMemory.search(
            query.userId,
            query.agentId,
            query.query
          );

          for (const memory of semanticResults) {
            const textRelevance = calculateTextRelevance(
              memory.content,
              query.query,
              memory.keywords
            );
            const confidenceBoost = memory.confidence * 0.2;
            const combinedRelevance = Math.min(
              1.0,
              textRelevance + confidenceBoost
            );

            if (combinedRelevance > 0.1) {
              results.push(this.convertToUnifiedResult(memory, type, combinedRelevance));
            }
          }
          break;
        }

        case MemoryType.PROCEDURAL: {
          const proceduralResults =
            await this.proceduralMemory.getRecommendedActions(
              query.userId,
              query.agentId,
              query.query,
              query.context || {}
            );

          for (const matchResult of proceduralResults) {
            const memory = matchResult.pattern;
            const proceduralRelevance =
              (matchResult.confidence + matchResult.contextMatch) / 2;

            if (proceduralRelevance > 0.1) {
              results.push(this.convertToUnifiedResult(memory, type, proceduralRelevance));
            }
          }
          break;
        }
      }
    } catch (error) {
      const searchError = new MemoryError(
        `Failed to search ${type} memory`,
        'SEARCH_ERROR',
        {
          type,
          userId: query.userId,
          query: query.query,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      logger.error(
        LogCategory.STORAGE,
        'RecallService',
        'Memory search failed',
        {
          type,
          userId: query.userId,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      // Return empty array with error marker for the main method to handle
      return Object.assign([], {
        error: searchError
      }) as UnifiedMemoryResult[] & { error: MemoryError };
    }

    return results;
  }

  /**
   * Apply hybrid scoring to combine different relevance signals
   */
  private applyHybridScoring(
    memories: UnifiedMemoryResult[],
    query: RecallQuery
  ): UnifiedMemoryResult[] {
    const weights = this.config.hybridSearchWeights;

    return memories
      .map((memory) => {
        // Check if this memory already has scores from hybrid search
        if (memory.metadata?.fromHybridSearch === true) {
          return memory; // Keep existing score from hybrid search
        }

        // For text-only search results, compute relevance scores
        const textScore = calculateTextRelevance(memory.content, query.query);
        const temporalScore = calculateTemporalRelevance(
          memory.timestamp,
          Date.now(),
          query.timeRange
        );

        // Vector score is 0 for text-only search (no vector component)
        const vectorScore = 0;

        // Procedural score based on pattern match and usage
        const proceduralScore =
          memory.type === MemoryType.PROCEDURAL
            ? (Number(memory.context?.usageCount) || 0) / 100 // Normalize usage count
            : 0;

        const combinedRelevance = calculateCombinedRelevance(
          vectorScore,
          textScore,
          temporalScore,
          proceduralScore,
          weights
        );

        return {
          ...memory,
          relevance: Math.max(memory.relevance, combinedRelevance)
        };
      })
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Enhance memories with stored connections from the database
   */
  private async enhanceWithStoredConnections(
    memories: UnifiedMemoryResult[],
    userId: string
  ): Promise<UnifiedMemoryResult[]> {
    if (memories.length === 0) return memories;

    // Get all connections for these memories if storage supports it
    const memoryIds = memories.map((m) => m.id);

    // Access storage through one of the memory types (they all share the same storage)
    const storage = (this.workingMemory as any).storage;

    // Check if storage has the getConnectionsForMemories method
    if (storage?.memory?.getConnectionsForMemories) {
      try {
        const connections = await storage.memory.getConnectionsForMemories(
          userId,
          memoryIds
        );

        // Create a map for quick lookup
        const connectionMap = new Map<string, any[]>();

        for (const conn of connections) {
          // Add to source memory
          if (!connectionMap.has(conn.sourceMemoryId)) {
            connectionMap.set(conn.sourceMemoryId, []);
          }
          connectionMap.get(conn.sourceMemoryId)!.push({
            ...conn,
            direction: 'outgoing'
          });

          // Add to target memory
          if (!connectionMap.has(conn.targetMemoryId)) {
            connectionMap.set(conn.targetMemoryId, []);
          }
          connectionMap.get(conn.targetMemoryId)!.push({
            ...conn,
            direction: 'incoming'
          });
        }

        // Attach connections to memories and boost relevance
        return memories.map((memory) => {
          const memoryConnections = connectionMap.get(memory.id) || [];
          const connectionBoost = Math.min(memoryConnections.length * 0.1, 0.3);

          return {
            ...memory,
            connections: memoryConnections,
            relevance: memory.relevance + connectionBoost
          };
        });
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'RecallService',
          'Failed to fetch stored connections',
          {
            userId,
            memoryCount: memories.length,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        // Return memories without connection enhancement
        return memories;
      }
    }

    return memories;
  }

  /**
   * Enrich memories with connected memories using graph traversal
   * This discovers NEW memories that weren't in the original search results
   */
  private async enrichWithConnections(
    memories: UnifiedMemoryResult[],
    query: RecallQuery
  ): Promise<UnifiedMemoryResult[]> {
    if (
      !this.connectionManager ||
      !this.intelligenceConfig?.connectionDetection
    ) {
      return memories;
    }

    // Check if user wants to use connections
    const useConnections = query.useConnections ?? true;
    if (!useConnections) {
      return memories;
    }

    const enriched = new Map<string, UnifiedMemoryResult>();
    const processed = new Set<string>();

    // Add original memories to the result set
    memories.forEach((m) => enriched.set(m.id, m));

    // Determine how many top memories to traverse from
    const connectionHops = query.connectionHops || this.config.defaultConnectionHops || 1;
    const topMemoriesToTraverse = Math.min(memories.length, 5);

    // For top-ranked memories, discover connected memories
    for (const memory of memories.slice(0, topMemoriesToTraverse)) {
      if (processed.has(memory.id)) continue;
      processed.add(memory.id);

      try {
        // Use the connection manager to find connected memories
        const { memories: connectedMemories, connections } =
          await this.connectionManager.findConnectedMemories(
            query.userId,
            memory.id,
            connectionHops
          );

        // Add connected memories with decayed relevance based on distance
        for (const connectedMemory of connectedMemories) {
          if (!enriched.has(connectedMemory.id)) {
            // Find the connection to determine strength
            const connection = connections.find(
              (c) =>
                c.targetMemoryId === connectedMemory.id ||
                c.sourceMemoryId === connectedMemory.id
            );

            // Apply connection type filter if specified
            if (
              query.connectionTypes &&
              connection &&
              !query.connectionTypes.includes(connection.connectionType)
            ) {
              continue;
            }

            // Convert to UnifiedMemoryResult with decayed relevance
            const decayFactor = 0.7; // Each hop reduces relevance by 30%
            const connectionStrength = connection?.strength || 0.5;

            enriched.set(connectedMemory.id, {
              id: connectedMemory.id,
              type: connectedMemory.type,
              content: connectedMemory.content,
              relevance: memory.relevance * decayFactor * connectionStrength,
              confidence: 0.8, // Default confidence for connected memories
              timestamp: connectedMemory.createdAt,
              context: connectedMemory.metadata || {},
              relationships: [],
              metadata: {
                ...connectedMemory.metadata,
                connectionSource: memory.id,
                connectionType: connection?.connectionType,
                connectionStrength: connectionStrength,
                hopsFromQuery: 1 // TODO: Calculate actual hop distance
              }
            });
          }
        }
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'RecallService',
          'Failed to get connected memories',
          {
            memoryId: memory.id,
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }

    logger.info(
      LogCategory.STORAGE,
      'RecallService',
      'Connection graph enrichment completed',
      {
        originalCount: memories.length,
        enrichedCount: enriched.size,
        newMemoriesFound: enriched.size - memories.length,
        connectionHops
      }
    );

    return Array.from(enriched.values());
  }

  /**
   * Apply centrality boosting to memories based on their importance in the graph
   */
  private async applyCentralityBoost(
    memories: UnifiedMemoryResult[],
    query: RecallQuery
  ): Promise<UnifiedMemoryResult[]> {
    if (!this.connectionManager || !query.boostCentralMemories) {
      return memories;
    }

    try {
      // Get the most central memories from the connection manager
      const centralMemories =
        await this.connectionManager.getCentralMemories(10);
      const centralityMap = new Map(
        centralMemories.map((c) => [c.memoryId, c.centrality])
      );

      // Apply centrality boost to memories
      return memories.map((memory) => {
        const centrality = centralityMap.get(memory.id) || 0;
        if (centrality > 0) {
          // Boost relevance based on centrality (max 20% boost)
          const boostFactor = 1 + centrality * 0.2;
          return {
            ...memory,
            relevance: Math.min(1.0, memory.relevance * boostFactor),
            metadata: {
              ...memory.metadata,
              centrality,
              centralityBoostApplied: true
            }
          };
        }
        return memory;
      });
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'RecallService',
        'Failed to apply centrality boost',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return memories;
    }
  }

  /**
   * Get metrics for monitoring and optimization
   *
   * @todo Add comprehensive traceability system for preset performance monitoring:
   * - Track query response times by preset type
   * - Monitor relevance score distributions per preset
   * - Log preset effectiveness metrics (success rates, user satisfaction)
   * - Add preset recommendation engine based on query patterns
   * - Implement A/B testing framework for preset optimization
   * - Add telemetry for preset adoption rates and configuration overrides
   */
  getMetrics(): RecallMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; cleanupCount: number } {
    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      cleanupCount: this.cleanupCount
    };
  }

  /**
   * Private helper methods
   */
  private generateCacheKey(query: RecallQuery): string {
    return JSON.stringify({
      userId: query.userId,
      agentId: query.agentId,
      query: query.query,
      memoryTypes: query.memoryTypes?.sort(),
      timeRange: query.timeRange,
      limit: query.limit,
      minRelevance: query.minRelevance
    });
  }

  private getCachedResult(cacheKey: string): RecallResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Caches a recall result with automatic cleanup when cache exceeds limits
   *
   * @param cacheKey - The cache key for the result
   * @param result - The recall result to cache
   * @private
   */
  private cacheResult(cacheKey: string, result: RecallResult): void {
    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });

    // Prevent concurrent cleanup operations
    if (
      this.cache.size > this.cacheHighWater &&
      !this.cleanupInProgress &&
      !this.isDestroyed
    ) {
      this.cleanupInProgress = true;

      // Clear any existing cleanup operation
      if (this.pendingCleanupId) {
        clearImmediate(this.pendingCleanupId);
      }

      // Use setImmediate to avoid blocking current operation
      this.pendingCleanupId = setImmediate(() => {
        try {
          // Check if service was destroyed while waiting
          if (this.isDestroyed) {
            return;
          }

          // Calculate how many entries to remove (at least 100 or down to low water mark)
          const toDelete = Math.max(100, this.cache.size - this.cacheLowWater);
          const entries = Array.from(this.cache.keys());

          // Remove oldest entries (Map maintains insertion order)
          entries.slice(0, toDelete).forEach((key) => this.cache.delete(key));

          // Log cleanup for monitoring
          this.cleanupCount++;
          console.debug('RecallService cache cleanup completed', {
            removed: toDelete,
            newSize: this.cache.size,
            cleanupCount: this.cleanupCount
          });
        } finally {
          this.cleanupInProgress = false;
          this.pendingCleanupId = null;
        }
      });
    }
  }

  private determineSearchStrategy(query: RecallQuery): string {
    const strategies: string[] = [];

    if (this.config.enableVectorSearch) strategies.push('vector');
    strategies.push('text');
    if (query.timeRange) strategies.push('temporal');
    if (query.memoryTypes?.includes(MemoryType.PROCEDURAL))
      strategies.push('procedural');

    return strategies.join('+');
  }

  private calculateSourceDistribution(
    memories: UnifiedMemoryResult[]
  ): RecallResult['sources'] {
    const sources = {
      working: 0,
      episodic: 0,
      semantic: 0,
      procedural: 0
    };

    for (const memory of memories) {
      sources[memory.type]++;
    }

    return sources;
  }

  private updateMetrics(startTime: number, cacheHit: boolean): void {
    this.metrics.totalQueries++;

    const executionTime = Date.now() - startTime;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.totalQueries - 1) +
        executionTime) /
      this.metrics.totalQueries;

    if (cacheHit) {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1) + 1) /
        this.metrics.totalQueries;
    } else {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * (this.metrics.totalQueries - 1)) /
        this.metrics.totalQueries;
    }
  }

  private updateQueryStats(query: string, relevance: number): void {
    const existing = this.metrics.popularQueries.find((q) => q.query === query);

    if (existing) {
      existing.count++;
      existing.avgRelevance = (existing.avgRelevance + relevance) / 2;
    } else {
      this.metrics.popularQueries.push({
        query,
        count: 1,
        avgRelevance: relevance
      });
    }

    // Keep only top 100 queries
    this.metrics.popularQueries = this.metrics.popularQueries
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);
  }

  /**
   * Clean up resources and cancel pending operations
   * Should be called when the RecallService is no longer needed
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;

    // Cancel any pending cache cleanup
    if (this.pendingCleanupId) {
      clearImmediate(this.pendingCleanupId);
      this.pendingCleanupId = null;
    }

    // Clear the cache
    this.cache.clear();

    // Reset cleanup flag
    this.cleanupInProgress = false;
  }

  /**
   * Type guard to check if storage has hybrid search capability
   */
  private hasHybridSearch(
    operations: MemoryOperations
  ): operations is MemoryOperations & {
    hybridSearch: NonNullable<MemoryOperations['hybridSearch']>
  } {
    return typeof operations?.hybridSearch === 'function';
  }

  /**
   * Ensure embedding service is initialized
   */
  private async ensureEmbeddingService(): Promise<void> {
    if (!this.embeddingService && this.embeddingConfig) {
      const { createEmbedding } = await import('../../llm/create-embedding');
      
      const provider = this.embeddingConfig.provider;
      const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];

      if (!apiKey) {
        throw new Error(
          `${provider} API key required for embedding operations. ` +
          `Set ${provider.toUpperCase()}_API_KEY environment variable.`
        );
      }

      const embeddingModel = createEmbedding({
        provider: provider as any,
        apiKey,
        model: this.embeddingConfig.model
      });

      this.embeddingService = new EmbeddingService(
        embeddingModel,
        this.embeddingConfig
      );

      logger.info(
        LogCategory.STORAGE,
        'RecallService',
        'Embedding service initialized for hybrid search',
        {
          provider: this.embeddingConfig.provider,
          model: this.embeddingConfig.model
        }
      );
    }
  }

  /**
   * Apply temporal boost based on memory's temporal patterns
   */
  private applyTemporalBoost(relevance: number, metadata: any): number {
    if (!metadata?.temporalInsights?.patterns) {
      return relevance;
    }

    const patterns = metadata.temporalInsights.patterns;
    const currentHour = new Date().getHours();
    
    // Check for daily patterns matching current hour
    const dailyPattern = patterns.find((p: any) => 
      p.type === 'daily' && 
      p.peakHours?.includes(currentHour)
    );
    
    if (dailyPattern) {
      // Apply boost based on pattern confidence (up to 30% boost)
      const boost = 1.0 + (dailyPattern.confidence * 0.3);
      return Math.min(relevance * boost, 1.0); // Cap at 1.0
    }
    
    // Check for burst patterns (always relevant during active periods)
    const burstPattern = patterns.find((p: any) => p.type === 'burst');
    if (burstPattern) {
      // Apply smaller boost for burst memories (up to 15% boost)
      const boost = 1.0 + (burstPattern.confidence * 0.15);
      return Math.min(relevance * boost, 1.0);
    }
    
    return relevance;
  }

  /**
   * Convert memory data from storage to unified result format
   */
  private convertToUnifiedResult(
    memory: any, // Different memory types have different structures, any is appropriate here
    type: MemoryType,
    relevance: number,
    fromHybridSearch: boolean = false
  ): UnifiedMemoryResult {
    // Apply temporal boost to relevance
    const boostedRelevance = this.applyTemporalBoost(relevance, memory.metadata);
    
    return {
      id: memory.id,
      type,
      content: memory.content,
      relevance: boostedRelevance,
      confidence: (memory as any).confidence || 0.8,
      timestamp: memory.createdAt || Date.now(),
      context: memory.metadata || {},
      relationships: [],
      metadata: {
        ...(memory.metadata || {}),
        fromHybridSearch,
        temporalBoostApplied: boostedRelevance !== relevance
      }
    };
  }
}

/**
 * @todo SUGGESTED: Default RecallConfig options for convenience factory
 *
 * Factory function could provide sensible defaults for different use cases:
 *
 * ```typescript
 * export const RECALL_CONFIG_OPTIONS = {
 *   // Minimal features, maximum performance
 *   minimal: {
 *     defaultLimit: 5,
 *     minRelevanceThreshold: 0.2,
 *     enableVectorSearch: false,
 *     enableRelatedMemories: false,
 *     cacheResults: true,
 *     cacheTTL: 60000 // 1 minute
 *   } as RecallConfig,
 *
 *   // Standard configuration for most use cases
 *   standard: {
 *     defaultLimit: 15,
 *     minRelevanceThreshold: 0.1,
 *     enableVectorSearch: true,
 *     enableRelatedMemories: true,
 *     maxRelatedDepth: 3,
 *     cacheResults: true,
 *     cacheTTL: 900000 // 15 minutes
 *   } as RecallConfig
 * };
 * ```
 */
