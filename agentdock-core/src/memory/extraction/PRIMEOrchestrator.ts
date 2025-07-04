/**
 * @fileoverview PRIMEOrchestrator - Simplified Memory Extraction Orchestration
 *
 * PRIMEOrchestrator provides straightforward orchestration for memory extraction
 * using the PRIME system. Features direct processing without complex buffering,
 * deduplication, or multi-tier orchestration.
 *
 * Key Features:
 * - Direct message processing through PRIMEExtractor
 * - Simple rule loading and storage patterns
 * - Comprehensive metrics tracking
 * - Clean error handling and fallbacks
 *
 * @example
 * ```typescript
 * const orchestrator = new PRIMEOrchestrator(storage, config);
 * const result = await orchestrator.processMessages(userId, agentId, messages);
 * ```
 */

import { LogCategory, logger } from '../../logging';
import { MemoryData, StorageProvider } from '../../storage/types';
import { CostTracker } from '../tracking/CostTracker';
import { Memory, MemoryMessage } from '../types/common';
import { PRIMEConfig, PRIMEExtractor, PRIMERule } from './PRIMEExtractor';

// Temporal metadata interface
export interface TemporalMetadata {
  originalConversationDate?: string;
}

// PRIMEOrchestrator-specific types
export interface PRIMEOrchestratorConfig {
  primeConfig: PRIMEConfig;
  batchSize?: number; // Default: 10
  maxRetries?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms
  enableMetrics?: boolean; // Default: true
  enableTemporalContext?: boolean; // Default: true - Adds conversation date for display context
}

export interface PRIMEExtractionResult {
  memories: Memory[];
  metrics: {
    processed: number;
    extracted: number;
    processingTimeMs: number;
    avgTokensPerMessage: number;
    totalCost: number;
  };
}

export interface PRIMEProcessingMetrics {
  totalMessages: number;
  successfulExtractions: number;
  failedExtractions: number;
  totalTokens: number;
  totalCost: number;
  processingTimeMs: number;
  avgTokensPerMessage: number;
}

/**
 * PRIMEOrchestrator - Simple memory extraction orchestration
 *
 * Provides direct processing through PRIMEExtractor with individual
 * message timestamp preservation and conversation date context.
 */
export class PRIMEOrchestrator {
  private extractor: PRIMEExtractor;
  private storage: StorageProvider;
  private config: PRIMEOrchestratorConfig;

  constructor(storage: StorageProvider, config: PRIMEOrchestratorConfig) {
    // Validate storage provider has required memory operations
    if (!storage.memory) {
      throw new Error(
        'Storage provider must support memory operations. ' +
          'Ensure your storage provider implements the memory interface.'
      );
    }

    this.storage = storage;
    this.config = this.validateAndSetDefaults(config);

    // Initialize PRIMEExtractor with CostTracker
    this.extractor = new PRIMEExtractor(
      this.config.primeConfig,
      new CostTracker(storage)
    );

    logger.info(
      LogCategory.STORAGE,
      'PRIMEOrchestrator',
      'PRIME orchestrator initialized',
      {
        batchSize: this.config.batchSize,
        enableMetrics: this.config.enableMetrics
      }
    );
  }

  /**
   * Process messages through PRIME extraction system
   *
   * Each message is processed individually with preserved timestamps:
   * 1. Load user rules
   * 2. Process each message through PRIMEExtractor
   * 3. Store memories with original message timestamps
   * 4. Track metrics
   * 5. Return results
   */
  async processMessages(
    userId: string,
    agentId: string,
    messages: MemoryMessage[]
  ): Promise<PRIMEExtractionResult> {
    const startTime = Date.now();
    const metrics: PRIMEProcessingMetrics = {
      totalMessages: messages.length,
      successfulExtractions: 0,
      failedExtractions: 0,
      totalTokens: 0,
      totalCost: 0,
      processingTimeMs: 0,
      avgTokensPerMessage: 0
    };

    logger.info(
      LogCategory.STORAGE,
      'PRIMEOrchestrator',
      'Starting message processing',
      {
        userId,
        agentId,
        messageCount: messages.length
      }
    );

    try {
      // Step 1: Load user rules
      const userRules = await this.loadUserRules(userId, agentId);

      // Step 2: Process messages in batches for efficiency
      const allMemories: Memory[] = [];
      const batchSize = this.config.batchSize || 10;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const batchMemories = await this.processBatch(
          userId,
          agentId,
          batch,
          userRules,
          metrics
        );
        allMemories.push(...batchMemories);
      }

      // Step 3: Calculate final metrics
      const processingTime = Date.now() - startTime;
      metrics.processingTimeMs = processingTime;
      metrics.avgTokensPerMessage =
        metrics.totalMessages > 0
          ? metrics.totalTokens / metrics.totalMessages
          : 0;

      logger.info(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Message processing completed',
        {
          processed: metrics.totalMessages,
          extracted: allMemories.length,
          processingTimeMs: processingTime,
          avgTokensPerMessage: metrics.avgTokensPerMessage
        }
      );

      return {
        memories: allMemories,
        metrics: {
          processed: metrics.totalMessages,
          extracted: allMemories.length,
          processingTimeMs: processingTime,
          avgTokensPerMessage: metrics.avgTokensPerMessage,
          totalCost: metrics.totalCost
        }
      };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Message processing failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          agentId,
          messageCount: messages.length
        }
      );

      // Return empty result on failure
      return {
        memories: [],
        metrics: {
          processed: 0,
          extracted: 0,
          processingTimeMs: Date.now() - startTime,
          avgTokensPerMessage: 0,
          totalCost: 0
        }
      };
    }
  }

  /**
   * Process a batch of messages
   * Direct processing with conversation date context for display
   */
  private async processBatch(
    userId: string,
    agentId: string,
    messages: MemoryMessage[],
    userRules: PRIMERule[],
    metrics: PRIMEProcessingMetrics
  ): Promise<Memory[]> {
    const batchMemories: Memory[] = [];

    // Extract conversation date for display context if needed
    const conversationContext =
      this.config.enableTemporalContext && messages.length > 0
        ? this.extractConversationDate(messages)
        : {};

    for (const message of messages) {
      try {
        // Process message through PRIMEExtractor
        const memories = await this.extractor.extract(message, {
          userId,
          agentId,
          userRules,
          importanceThreshold:
            this.config.primeConfig.defaultImportanceThreshold
        });

        // Add conversation date context for display purposes if available
        const enhancedMemories = memories.map((memory) => ({
          ...memory,
          metadata: {
            ...memory.metadata,
            ...(conversationContext.originalConversationDate && {
              originalConversationDate:
                conversationContext.originalConversationDate
            })
          }
        }));

        // Store each memory individually
        for (const memory of enhancedMemories) {
          await this.storeMemory(userId, agentId, memory);
          batchMemories.push(memory);
        }

        // Track success metrics
        metrics.successfulExtractions++;

        // Estimate tokens for metrics (rough calculation)
        const estimatedTokens = Math.ceil(message.content.length / 4);
        metrics.totalTokens += estimatedTokens;

        // Estimate cost (simple calculation)
        metrics.totalCost += estimatedTokens * 0.0005; // Rough cost estimate
      } catch (error) {
        logger.error(
          LogCategory.STORAGE,
          'PRIMEOrchestrator',
          'Failed to process message',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            messageLength: message.content.length,
            userId,
            agentId
          }
        );

        metrics.failedExtractions++;

        // Continue processing other messages
        continue;
      }
    }

    return batchMemories;
  }

  /**
   * Load user rules for extraction guidance
   * Simple storage pattern without complex caching
   */
  private async loadUserRules(
    userId: string,
    agentId: string
  ): Promise<PRIMERule[]> {
    try {
      const rulesKey = `extraction-rules:${userId}:${agentId}`;
      const rules = await this.storage.get<PRIMERule[]>(rulesKey);

      const activeRules = (rules || []).filter(
        (rule: PRIMERule) => rule.isActive !== false
      );

      logger.debug(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Loaded user rules',
        {
          userId,
          agentId,
          totalRules: rules?.length || 0,
          activeRules: activeRules.length
        }
      );

      return activeRules;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Failed to load user rules, using defaults',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          agentId
        }
      );
      return [];
    }
  }

  /**
   * Store individual memory
   * Direct storage without complex deduplication
   */
  private async storeMemory(
    userId: string,
    agentId: string,
    memory: Memory
  ): Promise<void> {
    try {
      if (!this.storage.memory) {
        throw new Error('Storage provider does not support memory operations');
      }

      // Convert Memory to MemoryData for storage
      const memoryData: MemoryData = memory as MemoryData;
      await this.storage.memory.store(userId, agentId, memoryData);
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Failed to store memory',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          memoryId: memory.id,
          userId,
          agentId
        }
      );

      // Re-throw to allow retry logic if needed
      throw error;
    }
  }

  /**
   * Extract conversation date for display context
   */
  private extractConversationDate(messages: MemoryMessage[]): TemporalMetadata {
    if (!messages || messages.length === 0) {
      return {};
    }

    // Get the earliest message timestamp for conversation date context
    const firstMessage = messages[0];
    if (!firstMessage?.timestamp) {
      return {};
    }

    const conversationTime =
      firstMessage.timestamp instanceof Date
        ? firstMessage.timestamp.getTime()
        : typeof firstMessage.timestamp === 'number'
          ? firstMessage.timestamp
          : Date.now();

    return {
      originalConversationDate: new Date(conversationTime).toISOString()
    };
  }

  /**
   * Validate configuration with sensible defaults
   */
  private validateAndSetDefaults(
    config: PRIMEOrchestratorConfig
  ): PRIMEOrchestratorConfig {
    return {
      primeConfig: config.primeConfig,
      batchSize: config.batchSize || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      enableMetrics: config.enableMetrics ?? true,
      enableTemporalContext: config.enableTemporalContext ?? true
    };
  }

  /**
   * Get orchestrator metrics
   * Simple metrics without complex tracking
   */
  async getMetrics(userId: string, agentId: string): Promise<any> {
    try {
      const metricsKey = `prime-metrics:${userId}:${agentId}`;
      return (await this.storage.get(metricsKey)) || {};
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PRIMEOrchestrator',
        'Failed to get metrics',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          agentId
        }
      );
      return {};
    }
  }
}
