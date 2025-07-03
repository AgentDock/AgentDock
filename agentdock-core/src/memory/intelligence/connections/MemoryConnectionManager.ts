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

    // Initialize embedding service with OpenAI model
    const embeddingModel = openai.embedding('text-embedding-3-small');
    const embeddingConfig = {
      provider: 'openai',
      model: config.embedding.model || 'text-embedding-3-small',
      dimensions: 1536,
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
   * Discover connections for a new memory using progressive enhancement
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
          this.config.connectionDetection.llmEnhancement!.temperature || 0.2
      });

      // Track costs using configured pricing (following batch processing pattern)
      const cost = this.calculateCost(usage);
      await this.costTracker.trackExtraction(memory1.agentId, {
        extractorType: 'connection-detection',
        cost: cost,
        memoriesExtracted: 1,
        messagesProcessed: 2,
        metadata: {
          provider: this.config.connectionDetection.llmEnhancement!.provider,
          model: this.config.connectionDetection.llmEnhancement!.model,
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
   * Create connections in storage with proper userId security
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

    const config = this.config.connectionDetection.llmEnhancement!;

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
   * Get memory by ID for connection discovery
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
   * Enqueue connection discovery (async, non-blocking)
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
