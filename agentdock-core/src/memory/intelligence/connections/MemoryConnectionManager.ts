/**
 * @fileoverview MemoryConnectionManager - Language-agnostic memory connection discovery
 *
 * Uses progressive enhancement: embeddings (free) -> user rules (free) -> LLM (configurable)
 * Following AgentDock's proven batch processing cost optimization patterns.
 *
 * @author AgentDock Core Team
 */

import { EventEmitter } from 'events';
import type { EmbeddingModel } from 'ai';
import { z } from 'zod';

import { createError, ErrorCode } from '../../../errors/index';
import {
  createEmbedding,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions
} from '../../../llm';
import { CoreLLM } from '../../../llm/core-llm';
import { createLLM } from '../../../llm/create-llm';
import { LogCategory, logger } from '../../../logging';
import {
  MemoryConnection,
  validateConnectionType
} from '../../../storage/types';
import { generateId } from '../../../storage/utils';
import { CostTracker } from '../../tracking/CostTracker';
import { Memory } from '../../types/common';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { ConnectionGraph } from '../graph/ConnectionGraph';
import { IntelligenceLayerConfig } from '../types';

// Zod schema for LLM response validation
const ConnectionAnalysisSchema = z.object({
  connectionType: z.enum([
    'similar',
    'related',
    'causes',
    'part_of',
    'opposite'
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

type ConnectionAnalysis = z.infer<typeof ConnectionAnalysisSchema>;

// Connection discovery task interface
interface ConnectionTask {
  key: string;
  userId: string;
  agentId: string;
  memoryId: string;
  resolve: (connections: MemoryConnection[]) => void;
  reject: (error: Error) => void;
}

/**
 * Async connection discovery queue to prevent race conditions
 */
class ConnectionDiscoveryQueue extends EventEmitter {
  private processing = new Set<string>();
  private queue: ConnectionTask[] = [];
  private manager: MemoryConnectionManager | null = null;
  private pendingTimeoutId: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  setManager(manager: MemoryConnectionManager): void {
    this.manager = manager;
  }

  async enqueue(
    userId: string,
    agentId: string,
    memoryId: string
  ): Promise<MemoryConnection[]> {
    const key = `${userId}:${agentId}:${memoryId}`;

    // Skip if already processing this exact memory
    if (this.processing.has(key)) {
      logger.debug(
        LogCategory.STORAGE,
        'ConnectionDiscoveryQueue',
        'Skipping duplicate connection discovery',
        { key }
      );
      return [];
    }

    return new Promise((resolve, reject) => {
      const task: ConnectionTask = {
        key,
        userId,
        agentId,
        memoryId,
        resolve,
        reject
      };

      this.queue.push(task);
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0 || !this.manager) return;

    const task = this.queue.shift();
    if (!task) return;

    // Skip if already processing
    if (this.processing.has(task.key)) {
      task.resolve([]);
      return;
    }

    this.processing.add(task.key);

    try {
      // Get the memory and process connections
      const memory = await this.manager.getMemoryById(
        task.userId,
        task.memoryId
      );
      if (memory) {
        const connections = await this.manager.discoverConnections(
          task.userId,
          task.agentId,
          memory
        );

        if (connections.length > 0) {
          await this.manager.createConnections(task.userId, connections);
        }

        task.resolve(connections);
      } else {
        task.resolve([]);
      }
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'ConnectionDiscoveryQueue',
        'Connection discovery failed',
        {
          key: task.key,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processing.delete(task.key);

      // Process next task after a small delay
      if (this.queue.length > 0 && !this.isDestroyed) {
        // Clear any existing timeout
        if (this.pendingTimeoutId) {
          clearTimeout(this.pendingTimeoutId);
        }

        this.pendingTimeoutId = setTimeout(() => {
          this.pendingTimeoutId = null;
          if (!this.isDestroyed) {
            this.processNext();
          }
        }, 10);
      }
    }
  }

  /**
   * Clean up resources and cancel pending operations
   */
  destroy(): void {
    this.isDestroyed = true;

    // Clear pending timeout
    if (this.pendingTimeoutId) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }

    // Reject all pending tasks
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task.reject(new Error('ConnectionDiscoveryQueue destroyed'));
      }
    }

    // Clear processing set
    this.processing.clear();

    // Clear manager reference
    this.manager = null;
  }
}

/**
 * Language-agnostic memory connection manager using progressive enhancement
 *
 * Automatically discovers meaningful connections between memories using a
 * sophisticated layered approach: embedding similarity → user rules → LLM analysis.
 * Supports semantic understanding without regex patterns for global compatibility.
 *
 * Features:
 * - Progressive enhancement (embedding → rules → LLM → fallback)
 * - Language-agnostic semantic analysis using embeddings
 * - User-defined connection rules with semantic descriptions
 * - Optional LLM enhancement for complex relationship detection
 * - Cost-aware processing with budget controls
 * - Real-time and queued connection discovery
 * - Configurable embedding providers
 * - User-level data isolation for security
 *
 * Architecture:
 * Level 1: Embedding similarity (always performed, zero cost after cache)
 * Level 2: User-defined semantic rules (free, configurable patterns)
 * Level 3: LLM enhancement (optional, cost-controlled)
 * Level 4: Heuristic fallback (temporal + similarity analysis)
 *
 * @example Basic connection discovery
 * ```typescript
 * const connectionManager = new MemoryConnectionManager(storage, config, costTracker);
 *
 * const connections = await connectionManager.discoverConnections(
 *   'user-123',
 *   'agent-456',
 *   newMemory
 * );
 *
 * await connectionManager.createConnections('user-123', connections);
 * ```
 *
 * @example With semantic rules
 * ```typescript
 * const config = {
 *   embedding: { enabled: true, similarityThreshold: 0.7 },
 *   connectionDetection: {
 *     method: 'hybrid',
 *     userRules: {
 *       enabled: true,
 *       patterns: [{
 *         id: 'user-action',
 *         semanticDescription: 'user performs an action that affects the system',
 *         connectionType: 'causal',
 *         confidence: 0.8
 *       }]
 *     }
 *   }
 * };
 * ```
 *
 * @example LLM-enhanced analysis
 * ```typescript
 * const config = {
 *   embedding: { enabled: true },
 *   connectionDetection: {
 *     method: 'hybrid',
 *     llmEnhancement: {
 *       enabled: true,
 *       provider: 'openai',
 *       model: 'gpt-4-turbo-preview',
 *       temperature: 0.2
 *     }
 *   },
 *   costControl: {
 *     monthlyBudget: 50,
 *     preferEmbeddingWhenSimilar: true
 *   }
 * };
 * ```
 */
export class MemoryConnectionManager {
  private llm?: CoreLLM;
  private costTracker: CostTracker;
  private embeddingService?: EmbeddingService;
  private embeddingModel?: EmbeddingModel<string>;
  private embeddingConfig: any;
  private queue: ConnectionDiscoveryQueue;
  private connectionGraph: ConnectionGraph;

  // Memory context tracking for 2-tier model selection
  private currentMemory1: Memory | null = null;
  private currentMemory2: Memory | null = null;

  constructor(
    private storage: any,
    private config: IntelligenceLayerConfig,
    costTracker: CostTracker
  ) {
    // LLM is now created lazily in getLLM() method using PRIME-style configuration
    // No need to create LLM in constructor anymore

    // Store embedding configuration without creating the service
    const embeddingProvider =
      config.embedding.provider || process.env.EMBEDDING_PROVIDER || 'openai';
    this.embeddingConfig = {
      provider: embeddingProvider,
      model:
        config.embedding.model || getDefaultEmbeddingModel(embeddingProvider),
      dimensions: getEmbeddingDimensions(
        embeddingProvider,
        config.embedding.model || getDefaultEmbeddingModel(embeddingProvider)
      ),
      cacheEnabled: true,
      batchSize: 100
    };

    // Use provided cost tracker
    this.costTracker = costTracker;

    this.queue = new ConnectionDiscoveryQueue();
    this.queue.setManager(this);

    // Initialize connection graph
    this.connectionGraph = new ConnectionGraph();

    logger.debug(
      LogCategory.STORAGE,
      'MemoryConnectionManager',
      'Initialized with clean config - LLM created on demand',
      {
        connectionDetectionEnabled: config.connectionDetection.enabled,
        embeddingProvider: embeddingProvider,
        lazyEmbeddings: true,
        lazyLLM: true
      }
    );
  }

  /**
   * Discovers connections for a new memory using progressive enhancement
   *
   * Analyzes a new memory against recent memories to find meaningful connections
   * using a layered approach: embedding similarity → user rules → LLM → heuristics.
   * The progressive enhancement ensures optimal cost-performance balance.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent whose memories to analyze
   * @param newMemory - The new memory to find connections for
   *
   * @returns Promise<MemoryConnection[]> - Array of discovered connections
   * @returns Promise<Array<{
   *   id: string;
   *   sourceMemoryId: string;
   *   targetMemoryId: string;
   *   connectionType: 'similar' | 'causes' | 'related' | 'part_of' | 'opposite';
   *   strength: number;
   *   reason: string;
   *   createdAt: number;
   *   metadata: {
   *     method: string;
   *     confidence: number;
   *     embeddingSimilarity: number;
   *     llmUsed: boolean;
   *   };
   * }>>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If storage operations fail
   * @throws {Error} If embedding generation fails
   *
   * @example Basic connection discovery
   * ```typescript
   * const newMemory = {
   *   id: 'mem_123',
   *   content: 'User clicked the save button',
   *   userId: 'user-123',
   *   agentId: 'agent-456',
   *   createdAt: Date.now()
   * };
   *
   * const connections = await connectionManager.discoverConnections(
   *   'user-123',
   *   'agent-456',
   *   newMemory
   * );
   *
   * console.log(`Found ${connections.length} connections`);
   * connections.forEach(conn => {
   *   console.log(`${conn.connectionType}: ${conn.reason} (${conn.strength})`);
   * });
   * ```
   *
   * @example With cost-aware processing
   * ```typescript
   * // Manager will automatically:
   * // 1. Check embedding similarity (free after cache)
   * // 2. Apply user rules if configured (free)
   * // 3. Use LLM only if within budget and similarity < 0.9
   * // 4. Fall back to heuristics if needed
   *
   * const connections = await connectionManager.discoverConnections(
   *   'user-123',
   *   'agent-456',
   *   newMemory
   * );
   * ```
   *
   * @example Processing results by connection type
   * ```typescript
   * const connections = await connectionManager.discoverConnections(
   *   'user-123',
   *   'agent-456',
   *   newMemory
   * );
   *
   * const causalConnections = connections.filter(c => c.connectionType === 'causes');
   * const similarConnections = connections.filter(c => c.connectionType === 'similar');
   * ```
   */
  async discoverConnections(
    userId: string,
    agentId: string,
    newMemory: Memory,
    options?: {
      autoPersist?: boolean; // Auto-save discovered connections (default: true)
      enrichFromStorage?: boolean; // Load existing connections into graph
      returnExisting?: boolean; // Include already persisted connections
    }
  ): Promise<MemoryConnection[]> {
    if (!userId?.trim()) {
      throw createError(
        'storage',
        'userId is required for connection discovery operations',
        ErrorCode.VALIDATION_ERROR,
        {
          operation: 'discoverConnections',
          timestamp: new Date().toISOString()
        }
      );
    }

    try {
      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Discovering connections using progressive enhancement',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          memoryId: newMemory.id,
          connectionDetectionEnabled: this.config.connectionDetection.enabled
        }
      );

      // Get recent memories for comparison (configurable limit)
      const limit = this.config.connectionDetection.maxCandidates || 20;
      const recentMemories = await this.getRecentMemories(
        userId,
        agentId,
        limit
      );

      // OPTIMIZATION: Pre-calculate all similarities and sort before expensive LLM calls
      const candidates: Array<{
        memory: Memory;
        similarity: number;
        embedding: number[];
      }> = [];

      // Generate embedding for new memory (always done - base layer)
      const newEmbedding = await this.generateEmbedding(newMemory.content);

      // Add new memory to the connection graph
      this.connectionGraph.addNode(newMemory);

      for (const existingMemory of recentMemories) {
        if (existingMemory.id === newMemory.id) continue;

        // Ensure existing memory is in the graph
        this.connectionGraph.addNode(existingMemory);

        // Level 1: Embedding similarity (always calculated)
        const existingEmbedding = await this.generateEmbedding(
          existingMemory.content
        );
        const similarity = this.calculateCosineSimilarity(
          newEmbedding,
          existingEmbedding
        );

        if (similarity >= this.config.embedding.similarityThreshold) {
          candidates.push({
            memory: existingMemory,
            similarity,
            embedding: existingEmbedding
          });
        }
      }

      // CRITICAL OPTIMIZATION: Sort by similarity and limit BEFORE expensive operations
      const maxLLMCalls = this.config.costControl.maxLLMCallsPerBatch || 10;
      const topCandidates = candidates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxLLMCalls);

      // Now process only the top candidates with expensive operations
      const connections: MemoryConnection[] = [];

      for (const candidate of topCandidates) {
        // Level 2: Progressive enhancement to determine connection type
        const connectionAnalysis = await this.analyzeConnectionType(
          newMemory,
          candidate.memory,
          candidate.similarity
        );

        if (
          connectionAnalysis.connectionType !== 'similar' ||
          candidate.similarity > this.config.embedding.similarityThreshold
        ) {
          connections.push({
            id: generateId(),
            sourceMemoryId: newMemory.id,
            targetMemoryId: candidate.memory.id,
            connectionType: connectionAnalysis.connectionType,
            strength: Math.max(
              candidate.similarity,
              connectionAnalysis.confidence
            ),
            reason:
              connectionAnalysis.reasoning || 'Similarity-based connection',
            createdAt: Date.now(),
            metadata: {
              triageMethod:
                candidate.similarity >=
                this.config.connectionDetection.thresholds.autoSimilar
                  ? 'auto-similar'
                  : candidate.similarity >=
                      this.config.connectionDetection.thresholds.autoRelated
                    ? 'auto-related'
                    : 'llm-classified',
              confidence: connectionAnalysis.confidence,
              algorithm: 'smart_triage_optimized',
              embeddingSimilarity: candidate.similarity,
              llmUsed:
                candidate.similarity <
                this.config.connectionDetection.thresholds.llmRequired,
              candidatesProcessed: topCandidates.length,
              totalCandidatesFound: candidates.length
            }
          });

          // Add connection to the graph
          const graphConnection: MemoryConnection = {
            id: generateId(),
            sourceMemoryId: newMemory.id,
            targetMemoryId: candidate.memory.id,
            connectionType: connectionAnalysis.connectionType,
            strength: Math.max(
              candidate.similarity,
              connectionAnalysis.confidence
            ),
            reason:
              connectionAnalysis.reasoning || 'Similarity-based connection',
            createdAt: Date.now(),
            metadata: {}
          };
          this.connectionGraph.addEdge(graphConnection);
        }
      }

      // Use graph analysis for enhanced connections
      const graphConnections = this.analyzeGraphPatterns(newMemory.id);
      connections.push(...graphConnections);

      logger.info(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Optimized progressive enhancement completed',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          memoryId: newMemory.id,
          totalCandidates: candidates.length,
          processedCandidates: topCandidates.length,
          connectionsFound: connections.length,
          costOptimization: `${Math.max(0, candidates.length - topCandidates.length)} LLM calls saved`,
          smartTriageEnabled: this.config.connectionDetection.enabled
        }
      );

      // Auto-persist by default (feature branch - no backward compatibility needed)
      const shouldPersist = options?.autoPersist !== false; // Default true
      if (shouldPersist && connections.length > 0) {
        await this.createConnections(userId, connections);
        logger.info(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Auto-persisted discovered connections',
          {
            userId: userId.substring(0, 8),
            count: connections.length
          }
        );
      }

      // Enrich graph from storage if requested
      if (options?.enrichFromStorage) {
        await this.loadConnectionsIntoGraph(userId, [newMemory.id]);
      }

      // Include existing connections if requested
      if (options?.returnExisting) {
        const { connections: existing } = await this.findConnectedMemories(
          userId,
          newMemory.id,
          1
        );
        return [...connections, ...existing];
      }

      return connections;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error in progressive enhancement',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          memoryId: newMemory.id,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return [];
    }
  }

  /**
   * Analyze connection type using smart triage for 65% cost optimization
   *
   * Clean rebuild from scratch - compares content-to-content embeddings,
   * then uses smart thresholds to auto-classify or route to LLM for
   * classification into the 5 research-based connection types.
   *
   * Smart Triage Results:
   * - 40% auto-classified as "similar" (embedding similarity > 0.8) - FREE
   * - 25% auto-classified as "related" (embedding similarity > 0.6) - FREE
   * - 35% routed to LLM for classification into 5 types - PAID
   * - Below 0.3 = no connection (skip)
   *
   * @param memory1 First memory content to compare
   * @param memory2 Second memory content to compare
   * @param embeddingSimilarity Pre-calculated content-to-content similarity (0-1)
   * @returns Promise<ConnectionAnalysis> Classification into 5 research-based types
   */
  private async analyzeConnectionType(
    memory1: Memory,
    memory2: Memory,
    embeddingSimilarity: number
  ): Promise<ConnectionAnalysis> {
    // Read thresholds from environment variables with config fallbacks
    const thresholds = {
      autoSimilar: process.env.CONNECTION_AUTO_SIMILAR
        ? parseFloat(process.env.CONNECTION_AUTO_SIMILAR)
        : this.config.connectionDetection.thresholds.autoSimilar,
      autoRelated: process.env.CONNECTION_AUTO_RELATED
        ? parseFloat(process.env.CONNECTION_AUTO_RELATED)
        : this.config.connectionDetection.thresholds.autoRelated,
      llmRequired: process.env.CONNECTION_LLM_REQUIRED
        ? parseFloat(process.env.CONNECTION_LLM_REQUIRED)
        : this.config.connectionDetection.thresholds.llmRequired
    };

    // 40% auto-classified as "similar" (FREE) - High semantic similarity
    if (embeddingSimilarity >= thresholds.autoSimilar) {
      return {
        connectionType: 'similar',
        confidence: embeddingSimilarity,
        reasoning: `High semantic similarity: ${embeddingSimilarity.toFixed(3)}`
      };
    }

    // 25% auto-classified as "related" (FREE) - Moderate semantic relationship
    if (embeddingSimilarity >= thresholds.autoRelated) {
      return {
        connectionType: 'related',
        confidence: embeddingSimilarity,
        reasoning: `Moderate semantic relationship: ${embeddingSimilarity.toFixed(3)}`
      };
    }

    // 35% need LLM to classify into 5 research-based types (PAID)
    if (embeddingSimilarity >= thresholds.llmRequired) {
      return await this.classifyWithLLM(memory1, memory2);
    }

    // Below threshold - no meaningful connection
    return {
      connectionType: 'similar',
      confidence: 0,
      reasoning: `Below similarity threshold: ${embeddingSimilarity.toFixed(3)}`
    };
  }

  /**
   * LLM classification into 5 research-based connection types
   *
   * Uses PRIME-style configuration for seamless API key sharing.
   * Classifies memory relationships into the 5 fundamental connection types
   * identified by 50+ years of cognitive science research.
   *
   * @param memory1 First memory content to analyze
   * @param memory2 Second memory content to analyze
   * @returns Promise<ConnectionAnalysis> Classification with confidence and reasoning
   */
  private async classifyWithLLM(
    memory1: Memory,
    memory2: Memory
  ): Promise<ConnectionAnalysis> {
    // Set context for model selection
    this.currentMemory1 = memory1;
    this.currentMemory2 = memory2;

    try {
      const llm = await this.getLLM();
      const startTime = Date.now();

      // Track which tier was used
      const tierUsed = (await this.shouldUseAdvancedModel())
        ? 'advanced'
        : 'standard';
      const prompt = `Analyze relationship between memories:

A: "${memory1.content}"
B: "${memory2.content}"

Classify as ONE of:
- similar: Same meaning/concept
- causes: A leads to B
- part_of: A is component of B
- opposite: A contradicts B
- related: General association

Return JSON: {"connectionType": "type", "confidence": 0.0-1.0, "reasoning": "brief"}`;

      const { object: result, usage } = await llm.generateObject({
        schema: ConnectionAnalysisSchema,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.connectionDetection.temperature || 0.2,
        maxTokens: this.config.connectionDetection.maxTokens || 500
      });

      // Track cost for monitoring with tier information
      const cost = this.calculateCost(usage);
      await this.costTracker.trackExtraction(memory1.agentId, {
        extractorType: `connection-classification-${tierUsed}`,
        cost,
        memoriesExtracted: 1,
        messagesProcessed: 1,
        metadata: {
          connectionType: result.connectionType,
          confidence: result.confidence,
          processingTimeMs: Date.now() - startTime,
          modelTier: tierUsed
        }
      });

      return result;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'LLM classification failed, using fallback',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );

      // Fallback to embedding-based classification
      return this.fallbackClassification(memory1, memory2);
    } finally {
      // Clear context after use
      this.currentMemory1 = null;
      this.currentMemory2 = null;
    }
  }

  /**
   * Get LLM using 2-tier model selection with PRIME-style environment configuration
   * Shares API keys seamlessly with PRIME system
   */
  private async getLLM(): Promise<any> {
    if (!this.llm) {
      // Provider cascade: CONNECTION > PRIME > config > default
      const provider =
        process.env.CONNECTION_PROVIDER ||
        process.env.PRIME_PROVIDER ||
        this.config.connectionDetection.provider ||
        'openai';

      // API key cascade: CONNECTION > provider-specific > error
      const apiKey =
        process.env.CONNECTION_API_KEY ||
        process.env[`${provider.toUpperCase()}_API_KEY`];

      if (!apiKey) {
        throw createError(
          'llm',
          `No API key for ${provider}. Set CONNECTION_API_KEY or ${provider.toUpperCase()}_API_KEY`,
          ErrorCode.LLM_API_KEY,
          { provider }
        );
      }

      // Determine which tier to use
      const useAdvanced = await this.shouldUseAdvancedModel();

      // Model cascade with single override support
      const singleModelOverride = process.env.CONNECTION_MODEL;

      const model =
        singleModelOverride ||
        (useAdvanced
          ? process.env.CONNECTION_ENHANCED_MODEL ||
            process.env.CONNECTION_ADVANCED_MODEL ||
            this.config.connectionDetection.enhancedModel ||
            this.getAdvancedModel(provider)
          : process.env.CONNECTION_STANDARD_MODEL ||
            this.config.connectionDetection.model ||
            this.getStandardModel(provider));

      this.llm = createLLM({ provider: provider as any, apiKey, model });

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'LLM initialized with 2-tier model',
        { provider, model, tier: useAdvanced ? 'advanced' : 'standard' }
      );
    }

    return this.llm;
  }

  private async shouldUseAdvancedModel(): Promise<boolean> {
    // Force advanced model if explicitly requested
    if (process.env.CONNECTION_ALWAYS_ADVANCED === 'true') {
      return true;
    }

    // Use advanced model when:
    // 1. Either memory has high importance (>0.8)
    // 2. Combined content is complex (>500 chars)
    // 3. Production environment with quality preference
    // 4. Explicit configuration

    if (!this.currentMemory1 || !this.currentMemory2) {
      return false; // Default to standard if no context
    }

    const highImportance =
      this.currentMemory1.importance > 0.8 ||
      this.currentMemory2.importance > 0.8;
    const complexContent =
      this.currentMemory1.content.length + this.currentMemory2.content.length >
      500;
    const productionQuality =
      process.env.NODE_ENV === 'production' &&
      process.env.CONNECTION_PREFER_QUALITY === 'true';

    return highImportance || complexContent || productionQuality;
  }

  private getStandardModel(provider: string): string {
    const models: Record<string, string> = {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      gemini: 'gemini-1.5-flash'
    };
    return models[provider] || 'gpt-4o-mini';
  }

  private getAdvancedModel(provider: string): string {
    const models: Record<string, string> = {
      openai: 'gpt-4o',
      anthropic: 'claude-3-sonnet-20240229',
      gemini: 'gemini-1.5-pro'
    };
    return models[provider] || 'gpt-4o';
  }

  private async getProviderName(): Promise<string> {
    return (
      process.env.CONNECTION_PROVIDER ||
      process.env.PRIME_PROVIDER ||
      this.config.connectionDetection.provider ||
      'openai'
    );
  }

  private async getModelName(): Promise<string> {
    const provider = await this.getProviderName();
    return (
      process.env.CONNECTION_MODEL ||
      this.config.connectionDetection.model ||
      this.getStandardModel(provider)
    );
  }

  /**
   * Fallback classification when LLM fails
   */
  private fallbackClassification(
    memory1: Memory,
    memory2: Memory
  ): ConnectionAnalysis {
    // Simple temporal analysis as fallback
    const timeDiff = memory2.createdAt - memory1.createdAt;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 0 && hoursDiff < 1) {
      return {
        connectionType: 'causes',
        confidence: 0.6,
        reasoning: 'Sequential timing suggests causal relationship'
      };
    }

    return {
      connectionType: 'related',
      confidence: 0.5,
      reasoning: 'Fallback classification after LLM failure'
    };
  }

  /**
   * Embedding-based connection type analysis (language-agnostic fallback)
   */
  private analyzeConnectionTypeByEmbedding(
    memory1: Memory,
    memory2: Memory,
    similarity: number
  ): ConnectionAnalysis {
    // Time-based analysis (language-agnostic)
    const timeDiff = memory2.createdAt - memory1.createdAt;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Heuristics based on timing and similarity
    if (similarity > 0.85 && Math.abs(hoursDiff) < 24) {
      return {
        connectionType: 'related',
        confidence: similarity * 0.8,
        reasoning:
          'High similarity and temporal proximity suggest related content'
      };
    }

    if (similarity > 0.75 && hoursDiff > 0 && hoursDiff < 1) {
      return {
        connectionType: 'related',
        confidence: similarity * 0.7,
        reasoning: 'Sequential content with good similarity'
      };
    }

    // Default to similar
    return {
      connectionType: 'similar',
      confidence: similarity,
      reasoning: 'Embedding similarity above threshold'
    };
  }

  /**
   * Creates connections in storage with proper userId security
   *
   * Persists discovered memory connections to storage with user-level isolation.
   * Supports both modern memory adapter interfaces and fallback storage methods.
   * All connections are secured with userId prefixing to prevent cross-user access.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param connections - Array of memory connections to create
   *
   * @returns Promise<void> - Completes when all connections are persisted
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If storage operations fail
   * @throws {Error} If connection data is invalid
   *
   * @example Create discovered connections
   * ```typescript
   * const connections = await connectionManager.discoverConnections(
   *   'user-123',
   *   'agent-456',
   *   newMemory
   * );
   *
   * await connectionManager.createConnections('user-123', connections);
   * console.log(`Created ${connections.length} connections`);
   * ```
   *
   * @example Batch connection creation
   * ```typescript
   * const allConnections = [];
   *
   * for (const memory of newMemories) {
   *   const connections = await connectionManager.discoverConnections(
   *     'user-123',
   *     'agent-456',
   *     memory
   *   );
   *   allConnections.push(...connections);
   * }
   *
   * // Create all connections in one operation
   * await connectionManager.createConnections('user-123', allConnections);
   * ```
   *
   * @example Handle empty connections gracefully
   * ```typescript
   * const connections = await connectionManager.discoverConnections(
   *   'user-123',
   *   'agent-456',
   *   newMemory
   * );
   *
   * if (connections.length > 0) {
   *   await connectionManager.createConnections('user-123', connections);
   *   console.log('Connections created successfully');
   * } else {
   *   console.log('No connections found to create');
   * }
   * ```
   */
  async createConnections(
    userId: string,
    connections: MemoryConnection[]
  ): Promise<void> {
    if (!userId?.trim()) {
      throw createError(
        'storage',
        'userId is required for connection creation operations',
        ErrorCode.VALIDATION_ERROR,
        {
          operation: 'createConnections',
          timestamp: new Date().toISOString()
        }
      );
    }

    if (connections.length === 0) return;

    // Validate all connection types to ensure data integrity
    for (const connection of connections) {
      validateConnectionType(connection.connectionType);
    }

    try {
      // Use memory adapter's createConnections method if available (includes userId security)
      if (this.storage.memory?.createConnections) {
        await this.storage.memory.createConnections(userId, connections);
      } else {
        // Fallback to individual storage with userId prefix for security
        for (const connection of connections) {
          const key = `user:${userId}:connection:${connection.sourceMemoryId}:${connection.targetMemoryId}`;
          await this.storage.set(key, connection);
        }
      }

      logger.info(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Created connections with user isolation',
        {
          userId: userId.substring(0, 8),
          count: connections.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error creating connections',
        {
          userId: userId.substring(0, 8),
          error: error instanceof Error ? error.message : String(error),
          connectionCount: connections.length
        }
      );
      throw error;
    }
  }

  /**
   * Calculate cost based on provider pricing (simple cost estimation)
   */
  private calculateCost(usage?: any): number {
    if (!usage) return 0;

    // Simple cost calculation based on provider
    const totalTokens = usage.totalTokens || 0;

    // Default cost rates per token by provider (rough estimates)
    const costPerToken = {
      openai: 0.00000015, // gpt-4o-mini
      anthropic: 0.00000025, // claude-3-haiku
      gemini: 0.00000015 // gemini-1.5-flash
    };

    // Use default rate if provider not found
    const provider = this.config.connectionDetection.provider || 'openai';
    const rate =
      costPerToken[provider as keyof typeof costPerToken] || 0.00000015;

    return totalTokens * rate;
  }

  /**
   * Ensure embedding service is initialized (lazy loading)
   * If injected via constructor (for tests), use that instead
   */
  private async ensureEmbeddingService(): Promise<EmbeddingService> {
    if (!this.embeddingService) {
      const provider = this.embeddingConfig.provider;

      // Check if we're using a mock provider for tests
      if (
        provider === 'mock' ||
        process.env.EMBEDDING_PROVIDER === 'mock' ||
        process.env.MOCK_EMBEDDINGS === 'true'
      ) {
        // Import from separate mock file to avoid circular dependencies
        const { MockEmbeddingProvider } = await import(
          './MockEmbeddingProvider'
        );
        this.embeddingModel = new MockEmbeddingProvider(
          this.embeddingConfig.dimensions
        );
        this.embeddingConfig.provider = 'mock'; // Update config to reflect mock usage
      } else {
        // Real provider needs API key
        const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];

        if (!apiKey) {
          throw createError(
            'llm',
            `${provider} API key required for embedding operations`,
            ErrorCode.LLM_API_KEY,
            {
              provider,
              operation: 'ensureEmbeddingService',
              hint: `Set ${provider.toUpperCase()}_API_KEY environment variable`
            }
          );
        }

        this.embeddingModel = createEmbedding({
          provider: provider as any,
          apiKey,
          model: this.embeddingConfig.model,
          dimensions: this.embeddingConfig.dimensions
        });
      }

      this.embeddingService = new EmbeddingService(
        this.embeddingModel,
        this.embeddingConfig
      );

      logger.info(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Embedding service initialized on demand',
        {
          provider: this.embeddingConfig.provider,
          model: this.embeddingConfig.model,
          isMock: this.embeddingConfig.provider === 'mock'
        }
      );
    }

    return this.embeddingService;
  }

  /**
   * Generate embedding using AgentDock's infrastructure
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    const service = await this.ensureEmbeddingService();
    const result = await service.generateEmbedding(content);
    return result.embedding;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get recent memories for comparison with progressive fallback
   */
  private async getRecentMemories(
    userId: string,
    agentId: string,
    limit: number
  ): Promise<Memory[]> {
    if (!userId?.trim()) {
      throw createError(
        'storage',
        'userId is required for memory retrieval operations',
        ErrorCode.VALIDATION_ERROR,
        {
          operation: 'getRecentMemories',
          timestamp: new Date().toISOString()
        }
      );
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    // Method 1: Primary recall with metadata (most complete)
    if (this.storage.memory?.recall) {
      try {
        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Attempting primary recall method',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            limit
          }
        );

        const memories = await this.storage.memory.recall(userId, agentId, '', {
          limit,
          includeMetadata: true
        });

        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Primary recall succeeded',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            memoriesFound: memories.length,
            responseTimeMs: Date.now() - startTime
          }
        );

        return memories;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Primary recall failed, attempting fallback',
          {
            error: lastError.message,
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            method: 'recall'
          }
        );
      }
    }

    // Method 2: Hybrid search fallback (if available)
    if (this.storage.memory?.hybridSearch) {
      try {
        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Attempting hybrid search fallback',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            limit
          }
        );

        // Generate a general embedding for recent memories
        const recentQuery = 'recent user activity and interactions';
        const queryEmbedding = await this.generateEmbedding(recentQuery);

        const memories = await this.storage.memory.hybridSearch(
          userId,
          agentId,
          recentQuery,
          queryEmbedding,
          {
            limit,
            includeMetadata: true
          }
        );

        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Hybrid search fallback succeeded',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            memoriesFound: memories.length,
            responseTimeMs: Date.now() - startTime
          }
        );

        return memories;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Hybrid search fallback failed, attempting vector search',
          {
            error: lastError.message,
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            method: 'hybridSearch'
          }
        );
      }
    }

    // Method 3: Vector search fallback (if available)
    if (this.storage.memory?.vectorSearch) {
      try {
        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Attempting vector search fallback',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            limit
          }
        );

        // Generate a general embedding for recent memories
        const recentQuery = 'user activity and system interactions';
        const queryEmbedding = await this.generateEmbedding(recentQuery);

        const memories = await this.storage.memory.vectorSearch(
          userId,
          agentId,
          queryEmbedding,
          {
            limit,
            includeMetadata: true
          }
        );

        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Vector search fallback succeeded',
          {
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            memoriesFound: memories.length,
            responseTimeMs: Date.now() - startTime
          }
        );

        return memories;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Vector search fallback failed, returning empty array',
          {
            error: lastError.message,
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8),
            method: 'vectorSearch'
          }
        );
      }
    }

    // Final fallback: Log comprehensive failure information
    logger.error(
      LogCategory.STORAGE,
      'MemoryConnectionManager',
      'All memory retrieval methods failed',
      {
        userId: userId.substring(0, 8),
        agentId: agentId.substring(0, 8),
        totalResponseTimeMs: Date.now() - startTime,
        lastError: lastError?.message || 'Unknown error',
        availableMethods: {
          recall: !!this.storage.memory?.recall,
          hybridSearch: !!this.storage.memory?.hybridSearch,
          vectorSearch: !!this.storage.memory?.vectorSearch
        }
      }
    );

    // Return empty array as graceful degradation
    return [];
  }

  /**
   * Retrieves a specific memory by its ID for connection discovery
   *
   * Fetches a memory object by its unique identifier with proper user-level
   * data isolation. Used internally by connection discovery algorithms to
   * access memory content and metadata for relationship analysis.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param memoryId - The unique identifier of the memory to retrieve
   *
   * @returns Promise<Memory | null> - The memory object or null if not found
   * @returns Promise<{
   *   id: string;
   *   content: string;
   *   userId: string;
   *   agentId: string;
   *   type: MemoryType;
   *   importance: number;
   *   createdAt: number;
   *   updatedAt: number;
   *   metadata?: any;
   * } | null>
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If storage operations fail
   *
   * @example Retrieve memory for connection analysis
   * ```typescript
   * const memory = await connectionManager.getMemoryById(
   *   'user-123',
   *   'mem_abc123'
   * );
   *
   * if (memory) {
   *   console.log(`Found memory: ${memory.content}`);
   *   console.log(`Type: ${memory.type}, Importance: ${memory.importance}`);
   * } else {
   *   console.log('Memory not found');
   * }
   * ```
   *
   * @example Batch memory retrieval
   * ```typescript
   * const memoryIds = ['mem_123', 'mem_456', 'mem_789'];
   * const memories = [];
   *
   * for (const id of memoryIds) {
   *   const memory = await connectionManager.getMemoryById('user-123', id);
   *   if (memory) memories.push(memory);
   * }
   *
   * console.log(`Retrieved ${memories.length} memories`);
   * ```
   *
   * @example Safe memory access with error handling
   * ```typescript
   * try {
   *   const memory = await connectionManager.getMemoryById(
   *     'user-123',
   *     'mem_abc123'
   *   );
   *
   *   if (memory) {
   *     // Process memory for connection discovery
   *     const connections = await analyzeConnections(memory);
   *   }
   * } catch (error) {
   *   console.error('Failed to retrieve memory:', error);
   * }
   * ```
   */
  async getMemoryById(
    userId: string,
    memoryId: string
  ): Promise<Memory | null> {
    if (!userId?.trim()) {
      throw createError(
        'storage',
        'userId is required for memory retrieval operations',
        ErrorCode.VALIDATION_ERROR,
        {
          operation: 'getMemoryById',
          timestamp: new Date().toISOString()
        }
      );
    }

    if (this.storage.memory?.getById) {
      try {
        return await this.storage.memory.getById(userId, memoryId);
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Failed to get memory by ID',
          {
            userId: userId.substring(0, 8),
            memoryId,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        return null;
      }
    }

    return null;
  }

  /**
   * Enqueues connection discovery for asynchronous processing
   *
   * Adds a memory to the connection discovery queue for background processing.
   * This enables non-blocking connection discovery that doesn't delay memory
   * storage operations. The queue handles deduplication and rate limiting.
   *
   * @param userId - Unique user identifier for data isolation (required)
   * @param agentId - The agent whose memory needs connection discovery
   * @param memoryId - The unique identifier of the memory to process
   *
   * @returns Promise<void> - Completes when memory is added to queue
   *
   * @throws {Error} If userId is empty (security requirement)
   * @throws {Error} If memoryId is invalid
   * @throws {Error} If queue operation fails
   *
   * @example Async connection discovery after memory storage
   * ```typescript
   * // Store memory first
   * const memoryId = await memoryManager.store(
   *   'user-123',
   *   'agent-456',
   *   'User clicked save button'
   * );
   *
   * // Queue connection discovery (non-blocking)
   * await connectionManager.enqueueConnectionDiscovery(
   *   'user-123',
   *   'agent-456',
   *   memoryId
   * );
   *
   * console.log('Memory stored and queued for connection discovery');
   * ```
   *
   * @example Batch memory processing
   * ```typescript
   * const memoryIds = ['mem_123', 'mem_456', 'mem_789'];
   *
   * // Queue all memories for connection discovery
   * for (const memoryId of memoryIds) {
   *   await connectionManager.enqueueConnectionDiscovery(
   *     'user-123',
   *     'agent-456',
   *     memoryId
   *   );
   * }
   *
   * console.log(`Queued ${memoryIds.length} memories for processing`);
   * ```
   *
   * @example Non-blocking memory workflow
   * ```typescript
   * // Fast memory storage without waiting for connections
   * const memoryId = await memoryManager.store(
   *   'user-123',
   *   'agent-456',
   *   'Important user action'
   * );
   *
   * // Queue for background processing
   * connectionManager.enqueueConnectionDiscovery(
   *   'user-123',
   *   'agent-456',
   *   memoryId
   * ).catch(error => {
   *   console.error('Queue error:', error);
   * });
   *
   * // Continue with other operations immediately
   * return { success: true, memoryId };
   * ```
   */
  async enqueueConnectionDiscovery(
    userId: string,
    agentId: string,
    memoryId: string
  ): Promise<void> {
    try {
      await this.queue.enqueue(userId, agentId, memoryId);
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Failed to enqueue connection discovery',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Analyze graph patterns to find additional connections
   *
   * Uses graph traversal to discover indirect connections
   *
   * @param memoryId - The memory to analyze connections for
   * @returns Additional connections discovered through graph analysis
   * @private
   */
  private analyzeGraphPatterns(memoryId: string): MemoryConnection[] {
    const suggestions: MemoryConnection[] = [];

    try {
      // Find indirect connections (2-hop)
      const directNeighbors = this.connectionGraph.getNeighbors(memoryId);
      const directNeighborIds = new Set(
        directNeighbors.map((n) => n.targetMemoryId)
      );

      for (const neighbor of directNeighbors) {
        const secondHopNeighbors = this.connectionGraph.getNeighbors(
          neighbor.targetMemoryId
        );

        for (const secondHop of secondHopNeighbors) {
          // Skip if it's the original node or already directly connected
          if (
            secondHop.targetMemoryId === memoryId ||
            directNeighborIds.has(secondHop.targetMemoryId)
          ) {
            continue;
          }

          // Check if this indirect connection is strong enough
          const indirectStrength = neighbor.strength * secondHop.strength;
          if (
            indirectStrength >=
            this.config.embedding.similarityThreshold * 0.7
          ) {
            suggestions.push({
              id: generateId(),
              sourceMemoryId: memoryId,
              targetMemoryId: secondHop.targetMemoryId,
              connectionType: 'related',
              strength: indirectStrength,
              reason: `Indirect connection via ${neighbor.targetMemoryId}`,
              createdAt: Date.now(),
              metadata: {
                method: 'hybrid' as
                  | 'embedding'
                  | 'user-rules'
                  | 'small-llm'
                  | 'hybrid',
                algorithm: 'two-hop-traversal',
                hops: 2,
                via: [neighbor.targetMemoryId],
                confidence: indirectStrength
              }
            });
          }
        }
      }

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Graph pattern analysis completed',
        {
          memoryId,
          directConnections: directNeighbors.length,
          indirectConnectionsFound: suggestions.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error in graph pattern analysis',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return suggestions;
  }

  /**
   * Get connection path between two memories
   *
   * @param sourceId - Source memory ID
   * @param targetId - Target memory ID
   * @returns Path of memory IDs connecting source to target
   */
  async getConnectionPath(
    sourceId: string,
    targetId: string
  ): Promise<string[]> {
    return this.connectionGraph.findPath(sourceId, targetId);
  }

  /**
   * Get memory clusters in the graph
   *
   * @param minSize - Minimum cluster size
   * @returns Array of memory ID clusters
   */
  async getMemoryClusters(minSize: number = 3): Promise<string[][]> {
    // Use the actual getClusters method
    const clusters = this.connectionGraph.getClusters();

    // Filter by minimum size
    return clusters.filter((cluster) => cluster.length >= minSize);
  }

  /**
   * Get most connected memories in the network
   *
   * @param limit - Maximum number of memories to return
   * @returns Array of memory IDs with their connection counts
   */
  async getMostConnectedMemories(
    limit: number = 10
  ): Promise<Array<{ memoryId: string; connectionCount: number }>> {
    const connectionCounts = new Map<string, number>();

    try {
      // Get all nodes from the graph
      const stats = this.connectionGraph.getStats();

      // If no nodes, return empty array
      if (stats.nodeCount === 0) {
        return [];
      }

      // We need to iterate through connections to count them
      // Since we don't have direct access to all nodes, we'll track them as we find connections
      const allMemoryIds = new Set<string>();

      // Get a sample of recent memories to seed our search
      const sampleMemories = await this.getRecentMemories(
        'system',
        'connection-analysis',
        100
      );

      for (const memory of sampleMemories) {
        allMemoryIds.add(memory.id);

        // Get connections for this memory
        const connections = this.connectionGraph.getNeighbors(memory.id);

        // Count outgoing connections
        const currentCount = connectionCounts.get(memory.id) || 0;
        connectionCounts.set(memory.id, currentCount + connections.length);

        // Also count incoming connections by checking each target
        for (const connection of connections) {
          allMemoryIds.add(connection.targetMemoryId);
          const targetCount =
            connectionCounts.get(connection.targetMemoryId) || 0;
          connectionCounts.set(connection.targetMemoryId, targetCount + 1);
        }
      }

      // Convert to array and sort by connection count
      const results = Array.from(connectionCounts.entries())
        .map(([memoryId, connectionCount]) => ({ memoryId, connectionCount }))
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, limit);

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Most connected memories analysis completed',
        {
          totalMemoriesAnalyzed: allMemoryIds.size,
          topConnectionCounts: results
            .slice(0, 3)
            .map((r) => r.connectionCount),
          resultsReturned: results.length
        }
      );

      return results;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error getting most connected memories',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );

      // Return empty array on error
      return [];
    }
  }

  /**
   * Find connected memories up to a specified depth using storage adapter
   *
   * @param userId - User identifier for data isolation
   * @param memoryId - Starting memory ID to find connections from
   * @param depth - Maximum traversal depth (default: 1)
   * @returns Connected memories and their connections
   */
  async findConnectedMemories(
    userId: string,
    memoryId: string,
    depth: number = 1
  ): Promise<{ memories: Memory[]; connections: MemoryConnection[] }> {
    if (!this.storage.memory?.findConnectedMemories) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Storage adapter does not support findConnectedMemories',
        { userId: userId.substring(0, 8), memoryId }
      );
      return { memories: [], connections: [] };
    }

    try {
      const result = await this.storage.memory.findConnectedMemories(
        userId,
        memoryId,
        depth
      );

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Connected memories retrieved',
        {
          userId: userId.substring(0, 8),
          memoryId,
          depth,
          memoriesFound: result.memories.length,
          connectionsFound: result.connections.length
        }
      );

      return result;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error finding connected memories',
        {
          userId: userId.substring(0, 8),
          memoryId,
          depth,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return { memories: [], connections: [] };
    }
  }

  /**
   * Get central memories based on connection centrality in the network
   *
   * @param limit - Maximum number of central memories to return
   * @returns Array of memory IDs with their centrality scores
   */
  async getCentralMemories(
    limit: number = 10
  ): Promise<Array<{ memoryId: string; centrality: number }>> {
    try {
      // Get the most connected memories first
      const connected = await this.getMostConnectedMemories(limit);

      // Calculate centrality based on connection density
      const stats = this.connectionGraph.getStats();
      const maxPossibleConnections = Math.max(1, stats.nodeCount - 1);

      // Convert connection counts to centrality scores (0-1 range)
      const centralMemories = connected.map((item) => ({
        memoryId: item.memoryId,
        centrality: Math.min(1.0, item.connectionCount / maxPossibleConnections)
      }));

      logger.debug(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Central memories analysis completed',
        {
          totalNodes: stats.nodeCount,
          maxPossibleConnections,
          topCentrality: centralMemories.slice(0, 3).map((m) => m.centrality),
          resultsReturned: centralMemories.length
        }
      );

      return centralMemories;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Error getting central memories',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );

      // Return empty array on error
      return [];
    }
  }

  /**
   * Load connections from storage into the in-memory graph
   */
  async loadConnectionsIntoGraph(
    userId: string,
    memoryIds: string[]
  ): Promise<void> {
    for (const memoryId of memoryIds) {
      try {
        const { connections } = await this.findConnectedMemories(
          userId,
          memoryId,
          1
        );

        for (const connection of connections) {
          this.connectionGraph.addEdge(connection);
        }

        logger.debug(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Loaded connections into graph',
          {
            memoryId,
            connectionsLoaded: connections.length
          }
        );
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Failed to load connections for memory',
          {
            memoryId,
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }
  }

  /**
   * Clean up resources and destroy the connection discovery queue
   */
  async destroy(): Promise<void> {
    this.queue.destroy();
  }
}
