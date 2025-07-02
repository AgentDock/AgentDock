/**
 * @fileoverview MemoryConnectionManager - Language-agnostic memory connection discovery
 *
 * Uses progressive enhancement: embeddings (free) -> user rules (free) -> LLM (configurable)
 * Following AgentDock's proven batch processing cost optimization patterns.
 *
 * @author AgentDock Core Team
 */

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

/**
 * Language-agnostic memory connection manager using progressive enhancement
 */
export class MemoryConnectionManager {
  private llm?: CoreLLM;
  private costTracker: CostTracker;
  private embeddingService: EmbeddingService;

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

      // Get recent memories for comparison
      const recentMemories = await this.getRecentMemories(userId, agentId, 50);
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
      const ruleResult = this.applyUserRules(memory1, memory2);
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
   * Apply user-defined rules (language-agnostic, user-configurable)
   */
  private applyUserRules(
    memory1: Memory,
    memory2: Memory
  ): ConnectionAnalysis | null {
    const rules = this.config.connectionDetection.userRules?.patterns || [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const content1 = memory1.content.toLowerCase();
      const content2 = memory2.content.toLowerCase();

      // Simple pattern matching - user configures for their language
      const regex = new RegExp(rule.pattern, rule.caseSensitive ? 'g' : 'gi');

      if (regex.test(content1) && regex.test(content2)) {
        return {
          connectionType: rule.connectionType,
          confidence: rule.confidence,
          reasoning: `Matched user rule: ${rule.name}`
        };
      }
    }

    return null;
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
}
