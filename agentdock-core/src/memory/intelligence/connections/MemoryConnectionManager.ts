/**
 * @fileoverview MemoryConnectionManager - Language-agnostic memory connection discovery
 *
 * Uses progressive enhancement: embeddings (free) -> user rules (free) -> LLM (configurable)
 * Following AgentDock's proven batch processing cost optimization patterns.
 *
 * @author AgentDock Core Team
 */

import { EventEmitter } from 'events';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import {
  createEmbedding,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions
} from '../../../llm';
import { CoreLLM } from '../../../llm/core-llm';
import { createLLM } from '../../../llm/create-llm';
import { LogCategory, logger } from '../../../logging';
import { ConnectionType, MemoryConnection } from '../../../storage/types';
import { generateId } from '../../../storage/utils';
import { CostTracker } from '../../tracking/CostTracker';
import { Memory } from '../../types/common';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { ConnectionRule, IntelligenceLayerConfig } from '../types';

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

    const task = this.queue.shift()!;

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
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 10);
      }
    }
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
  private embeddingService: EmbeddingService;
  private queue: ConnectionDiscoveryQueue;

  constructor(
    private storage: any,
    private config: IntelligenceLayerConfig,
    costTracker: CostTracker
  ) {
    // Only create LLM if enhancement is enabled and required fields are provided
    if (
      config.connectionDetection.llmEnhancement?.enabled &&
      config.connectionDetection.llmEnhancement.provider &&
      config.connectionDetection.llmEnhancement.model
    ) {
      this.llm = createLLM({
        provider: config.connectionDetection.llmEnhancement.provider as any,
        model: config.connectionDetection.llmEnhancement.model,
        apiKey:
          config.connectionDetection.llmEnhancement.apiKey ||
          process.env[
            `${config.connectionDetection.llmEnhancement.provider.toUpperCase()}_API_KEY`
          ] ||
          ''
      });
    }

    // Initialize embedding service with configurable provider
    const embeddingProvider =
      config.embedding.provider || process.env.EMBEDDING_PROVIDER || 'openai';
    const embeddingModel = createEmbedding({
      provider: embeddingProvider as
        | 'openai'
        | 'google'
        | 'mistral'
        | 'voyage'
        | 'cohere',
      apiKey: process.env[`${embeddingProvider.toUpperCase()}_API_KEY`] || '',
      model:
        config.embedding.model || getDefaultEmbeddingModel(embeddingProvider),
      dimensions: getEmbeddingDimensions(
        embeddingProvider,
        config.embedding.model || getDefaultEmbeddingModel(embeddingProvider)
      )
    });
    const embeddingConfig = {
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
    this.embeddingService = new EmbeddingService(
      embeddingModel,
      embeddingConfig
    );

    // Use provided cost tracker
    this.costTracker = costTracker;

    this.queue = new ConnectionDiscoveryQueue();
    this.queue.setManager(this);

    logger.debug(
      LogCategory.STORAGE,
      'MemoryConnectionManager',
      'Initialized with progressive enhancement',
      {
        method: config.connectionDetection.method,
        llmEnabled: !!this.llm,
        userRulesEnabled: config.connectionDetection.userRules?.enabled
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
    newMemory: Memory
  ): Promise<MemoryConnection[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for connection discovery operations');
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
          method: this.config.connectionDetection.method
        }
      );

      // Get recent memories for comparison (configurable limit)
      const limit = this.config.connectionDetection.maxRecentMemories || 50;
      const recentMemories = await this.getRecentMemories(
        userId,
        agentId,
        limit
      );
      const connections: MemoryConnection[] = [];

      // Generate embedding for new memory (always done - base layer)
      const newEmbedding = await this.generateEmbedding(newMemory.content);

      for (const existingMemory of recentMemories) {
        if (existingMemory.id === newMemory.id) continue;

        // Level 1: Embedding similarity (always calculated)
        const existingEmbedding = await this.generateEmbedding(
          existingMemory.content
        );
        const similarity = this.calculateCosineSimilarity(
          newEmbedding,
          existingEmbedding
        );

        if (similarity < this.config.embedding.similarityThreshold) {
          continue; // Skip if below base threshold
        }

        // Level 2: Progressive enhancement to determine connection type
        const connectionAnalysis = await this.analyzeConnectionType(
          newMemory,
          existingMemory,
          similarity
        );

        if (
          connectionAnalysis.connectionType !== 'similar' ||
          similarity > this.config.embedding.similarityThreshold
        ) {
          connections.push({
            id: generateId(),
            sourceMemoryId: newMemory.id,
            targetMemoryId: existingMemory.id,
            connectionType: connectionAnalysis.connectionType,
            strength: Math.max(similarity, connectionAnalysis.confidence),
            reason:
              connectionAnalysis.reasoning || 'Similarity-based connection',
            createdAt: Date.now(),
            metadata: {
              method: this.config.connectionDetection.method as
                | 'embedding'
                | 'user-rules'
                | 'small-llm'
                | 'hybrid',
              confidence: connectionAnalysis.confidence,
              algorithm: 'progressive_enhancement',
              embeddingSimilarity: similarity,
              llmUsed:
                this.config.connectionDetection.llmEnhancement?.enabled &&
                similarity < 0.9
            }
          });
        }
      }

      // Limit connections and sort by strength
      const limitedConnections = connections
        .sort((a, b) => b.strength - a.strength)
        .slice(0, this.config.costControl.maxLLMCallsPerBatch || 10);

      logger.info(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Progressive enhancement completed',
        {
          userId: userId.substring(0, 8),
          agentId: agentId.substring(0, 8),
          memoryId: newMemory.id,
          totalFound: connections.length,
          kept: limitedConnections.length,
          method: this.config.connectionDetection.method
        }
      );

      return limitedConnections;
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
   * Progressive enhancement: embedding -> user rules -> LLM -> fallback
   */
  private async analyzeConnectionType(
    memory1: Memory,
    memory2: Memory,
    embeddingSimilarity: number
  ): Promise<ConnectionAnalysis> {
    // Optimization: Skip expensive analysis for very similar content
    if (
      this.config.costControl.preferEmbeddingWhenSimilar &&
      embeddingSimilarity > 0.9
    ) {
      return {
        connectionType: 'similar',
        confidence: embeddingSimilarity,
        reasoning: 'High embedding similarity'
      };
    }

    // Level 1: Try user-defined rules (free)
    if (this.config.connectionDetection.userRules?.enabled) {
      const ruleResult = await this.applyUserRules(memory1, memory2);
      if (ruleResult) {
        return ruleResult;
      }
    }

    // Level 2: Try LLM enhancement (if enabled and within budget)
    if (this.config.connectionDetection.llmEnhancement?.enabled && this.llm) {
      const withinBudget = await this.costTracker.checkBudget(
        memory1.agentId,
        this.config.costControl.monthlyBudget || Infinity
      );

      if (withinBudget) {
        const llmResult = await this.analyzeConnectionTypeLLM(memory1, memory2);
        if (llmResult) {
          return llmResult;
        }
      }
    }

    // Level 3: Fallback to embedding-based heuristics
    return this.analyzeConnectionTypeByEmbedding(
      memory1,
      memory2,
      embeddingSimilarity
    );
  }

  /**
   * Apply user-defined rules using semantic understanding (no regex patterns)
   */
  private async applyUserRules(
    memory1: Memory,
    memory2: Memory
  ): Promise<ConnectionAnalysis | null> {
    const rules = this.config.connectionDetection.userRules?.patterns || [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Semantic-only approach - no legacy support
      if (!rule.semanticDescription) {
        throw new Error(
          `Connection rule '${rule.name}' missing semantic description. Regex patterns not supported.`
        );
      }

      // Semantic approach - understand meaning instead of matching patterns
      const isMatch = await this.evaluateSemanticRule(rule, memory1, memory2);

      if (isMatch) {
        return {
          connectionType: rule.connectionType,
          confidence: rule.confidence,
          reasoning: `Semantic match: ${rule.name} - ${rule.description}`
        };
      }
    }

    return null;
  }

  /**
   * Evaluate semantic rule using embedding similarity (language-agnostic)
   */
  private async evaluateSemanticRule(
    rule: ConnectionRule,
    memory1: Memory,
    memory2: Memory
  ): Promise<boolean> {
    try {
      // Get or generate semantic embedding for the rule
      let ruleEmbedding = rule.semanticEmbedding;
      if (!ruleEmbedding) {
        ruleEmbedding = await this.generateEmbedding(rule.semanticDescription);
      }

      // Generate embeddings for memory content
      const memory1Embedding = await this.generateEmbedding(memory1.content);
      const memory2Embedding = await this.generateEmbedding(memory2.content);

      // Calculate semantic similarities
      const similarity1 = this.calculateCosineSimilarity(
        ruleEmbedding,
        memory1Embedding
      );
      const similarity2 = this.calculateCosineSimilarity(
        ruleEmbedding,
        memory2Embedding
      );

      const threshold = rule.semanticThreshold || 0.75;
      const requiresBoth = rule.requiresBothMemories !== false; // Default true

      // Determine if rule matches based on configuration
      if (requiresBoth) {
        // Both memories must match the semantic description
        return similarity1 >= threshold && similarity2 >= threshold;
      } else {
        // At least one memory must match the semantic description
        return similarity1 >= threshold || similarity2 >= threshold;
      }
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'Semantic rule evaluation failed',
        {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return false;
    }
  }

  /**
   * LLM-based connection analysis with Zod validation
   */
  private async analyzeConnectionTypeLLM(
    memory1: Memory,
    memory2: Memory
  ): Promise<ConnectionAnalysis | null> {
    if (!this.llm) return null;

    const startTime = Date.now();

    try {
      const { object: result, usage } = await this.llm.generateObject({
        schema: ConnectionAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: `Analyze the relationship between these two pieces of information:

Memory 1: "${memory1.content}"
Memory 2: "${memory2.content}"

Determine the connection type:
- similar: Content is semantically similar
- causes: One caused or led to the other
- related: General relationship or reference
- part_of: One is part of a larger concept
- opposite: Information conflicts or contradicts

Provide confidence score (0-1) and brief reasoning.`
          }
        ],
        temperature:
          this.config.connectionDetection.llmEnhancement?.temperature || 0.2
      });

      // Track costs using configured pricing (following batch processing pattern)
      const cost = this.calculateCost(usage);
      await this.costTracker.trackExtraction(memory1.agentId, {
        extractorType: 'connection-detection',
        cost: cost,
        memoriesExtracted: 1,
        messagesProcessed: 2,
        metadata: {
          provider:
            this.config.connectionDetection.llmEnhancement?.provider ||
            'unknown',
          model:
            this.config.connectionDetection.llmEnhancement?.model || 'unknown',
          tokensUsed: usage?.totalTokens || 0,
          responseTimeMs: Date.now() - startTime,
          connectionType: result.connectionType
        }
      });

      // TODO: Replace with AgentDock observability integration
      // Refer to AgentDock observability documentation when available

      return result;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'MemoryConnectionManager',
        'LLM analysis failed, using fallback',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null;
    }
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
      throw new Error('userId is required for connection creation operations');
    }

    if (connections.length === 0) return;

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
   * Calculate cost based on user-configured pricing (following batch processing pattern)
   */
  private calculateCost(usage?: any): number {
    if (!usage) return 0;

    const config = this.config.connectionDetection.llmEnhancement;
    if (!config) {
      // No LLM config means no cost
      return 0;
    }

    // Option 1: Cost per token (user configures based on their provider)
    if (config.costPerToken) {
      const totalTokens = usage.totalTokens || 0;
      return totalTokens * config.costPerToken;
    }

    // Option 2: Flat rate per operation
    if (config.costPerOperation) {
      return config.costPerOperation;
    }

    // Fallback: zero cost (user should configure)
    logger.warn(
      LogCategory.STORAGE,
      'MemoryConnectionManager',
      'No cost configuration provided - using zero cost'
    );
    return 0;
  }

  /**
   * Generate embedding using AgentDock's infrastructure
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    const result = await this.embeddingService.generateEmbedding(content);
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
   * Get recent memories for comparison
   */
  private async getRecentMemories(
    userId: string,
    agentId: string,
    limit: number
  ): Promise<Memory[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory retrieval operations');
    }

    // Use storage memory operations if available
    if (this.storage.memory?.recall) {
      try {
        const memories = await this.storage.memory.recall(userId, agentId, '', {
          limit,
          includeMetadata: true
        });
        return memories;
      } catch (error) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryConnectionManager',
          'Memory recall failed, returning empty array',
          {
            error: error instanceof Error ? error.message : String(error),
            userId: userId.substring(0, 8),
            agentId: agentId.substring(0, 8)
          }
        );
        return [];
      }
    }

    // Fallback if storage doesn't support recall
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
      throw new Error('userId is required for memory retrieval operations');
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
}
