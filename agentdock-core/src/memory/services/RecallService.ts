import { Pool } from 'pg';

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
  convertToUnifiedResult,
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
 *   preset?: 'fast' | 'accurate' | 'balanced' | 'production';
 *   vectorSearch?: boolean;
 *   caching?: boolean;
 *   customConfig?: Partial<RecallConfig>;
 * }): Promise<RecallService> {
 *   // Factory implementation would:
 *   // 1. Create storage provider based on options.storage
 *   // 2. Apply preset configurations (fast/accurate/balanced/production)
 *   // 3. Create memory manager with sensible defaults
 *   // 4. Instantiate RecallService with optimized config
 *   // 5. Return ready-to-use RecallService instance
 * }
 *
 * // Usage examples:
 * const quickRecall = await createRecallService({ preset: 'fast' });
 * const productionRecall = await createRecallService({
 *   storage: 'postgresql',
 *   preset: 'production',
 *   vectorSearch: true
 * });
 * ```
 */
export class RecallService {
  private cache = new Map<
    string,
    { result: RecallResult; timestamp: number }
  >();
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

  constructor(
    private workingMemory: WorkingMemory,
    private episodicMemory: EpisodicMemory,
    private semanticMemory: SemanticMemory,
    private proceduralMemory: ProceduralMemory,
    private config: RecallConfig
  ) {}

  /**
   * Main recall method - searches across all memory types
   */
  async recall(query: RecallQuery): Promise<RecallResult> {
    const startTime = Date.now();

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

    // Execute parallel searches
    const searchPromises = memoryTypes.map((type) =>
      this.searchMemoryType(type, query)
    );

    const searchResults = await Promise.all(searchPromises);
    const allMemories = searchResults.flat();

    // Apply hybrid scoring
    const rankedMemories = this.applyHybridScoring(allMemories, query);

    // Enhance with stored connections from database
    const enhancedMemories = await this.enhanceWithStoredConnections(
      rankedMemories,
      query.userId
    );

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
        (query.minRelevance || this.config.minRelevanceThreshold)
    );

    // Apply limit
    const limitedMemories = filteredMemories.slice(
      0,
      query.limit || this.config.defaultLimit
    );

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
  ): Promise<UnifiedMemoryResult[]> {
    const results: UnifiedMemoryResult[] = [];

    try {
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
              results.push(convertToUnifiedResult(memory, type, relevance));
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
              results.push(
                convertToUnifiedResult(memory, type, combinedRelevance)
              );
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
              results.push(
                convertToUnifiedResult(memory, type, combinedRelevance)
              );
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
              results.push(
                convertToUnifiedResult(memory, type, proceduralRelevance)
              );
            }
          }
          break;
        }
      }
    } catch (error) {
      console.warn(`Error searching ${type} memory:`, error);
      // Continue with other memory types
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
        const textScore = calculateTextRelevance(memory.content, query.query);
        const temporalScore = calculateTemporalRelevance(
          memory.timestamp,
          Date.now(),
          query.timeRange
        );

        // Vector score would come from embedding similarity
        const vectorScore = this.config.enableVectorSearch ? 0.5 : 0;

        // Procedural score based on pattern match and usage
        const proceduralScore =
          memory.type === MemoryType.PROCEDURAL
            ? memory.context.usageCount || 0 / 100 // Normalize usage count
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
        console.warn('Failed to fetch stored connections:', error);
        return memories;
      }
    }

    return memories;
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
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate
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

  private cacheResult(cacheKey: string, result: RecallResult): void {
    this.cache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });

    // Cleanup old entries
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
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
}

/**
 * @todo SUGGESTED: Default RecallConfig presets for convenience factory
 *
 * These preset configurations would provide sensible defaults for different use cases:
 *
 * ```typescript
 * export const RECALL_CONFIG_PRESETS = {
 *   // Fast preset: Minimal features, maximum performance
 *   fast: {
 *     defaultLimit: 5,
 *     minRelevanceThreshold: 0.2,
 *     hybridSearchWeights: { vector: 0, text: 0.8, temporal: 0.2, procedural: 0 },
 *     enableVectorSearch: false,
 *     enableRelatedMemories: false,
 *     maxRelatedDepth: 0,
 *     cacheResults: true,
 *     cacheTTL: 60000 // 1 minute
 *   } as RecallConfig,
 *
 *   // Balanced preset: Good performance with moderate features
 *   balanced: {
 *     defaultLimit: 10,
 *     minRelevanceThreshold: 0.1,
 *     hybridSearchWeights: { vector: 0.3, text: 0.4, temporal: 0.2, procedural: 0.1 },
 *     enableVectorSearch: true,
 *     enableRelatedMemories: true,
 *     maxRelatedDepth: 2,
 *     cacheResults: true,
 *     cacheTTL: 300000 // 5 minutes
 *   } as RecallConfig,
 *
 *   // Accurate preset: Maximum features, thorough search
 *   accurate: {
 *     defaultLimit: 20,
 *     minRelevanceThreshold: 0.05,
 *     hybridSearchWeights: { vector: 0.4, text: 0.3, temporal: 0.2, procedural: 0.1 },
 *     enableVectorSearch: true,
 *     enableRelatedMemories: true,
 *     maxRelatedDepth: 5,
 *     cacheResults: true,
 *     cacheTTL: 600000 // 10 minutes
 *   } as RecallConfig,
 *
 *   // Production preset: Enterprise-ready configuration
 *   production: {
 *     defaultLimit: 15,
 *     minRelevanceThreshold: 0.1,
 *     hybridSearchWeights: { vector: 0.4, text: 0.3, temporal: 0.2, procedural: 0.1 },
 *     enableVectorSearch: true,
 *     enableRelatedMemories: true,
 *     maxRelatedDepth: 3,
 *     cacheResults: true,
 *     cacheTTL: 900000 // 15 minutes
 *   } as RecallConfig
 * };
 *
 * export const MEMORY_CONFIG_PRESETS = {
 *   fast: {
 *     working: { maxContextItems: 20, ttlSeconds: 1800 },
 *     episodic: { importance: { threshold: 0.2 } },
 *     semantic: { importance: { threshold: 0.3 } },
 *     procedural: { actionExtraction: { enabled: false } }
 *   },
 *   balanced: {
 *     working: { maxContextItems: 50, ttlSeconds: 3600 },
 *     episodic: { importance: { threshold: 0.1 } },
 *     semantic: { importance: { threshold: 0.2 } },
 *     procedural: { actionExtraction: { enabled: true } }
 *   },
 *   accurate: {
 *     working: { maxContextItems: 100, ttlSeconds: 7200 },
 *     episodic: { importance: { threshold: 0.05 } },
 *     semantic: { importance: { threshold: 0.1 } },
 *     procedural: { actionExtraction: { enabled: true } }
 *   },
 *   production: {
 *     working: { maxContextItems: 75, ttlSeconds: 5400 },
 *     episodic: { importance: { threshold: 0.1 } },
 *     semantic: { importance: { threshold: 0.15 } },
 *     procedural: { actionExtraction: { enabled: true } }
 *   }
 * };
 * ```
 */
