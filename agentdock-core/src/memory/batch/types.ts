/**
 * @fileoverview Batch Processing System Types
 *
 * Core type definitions for the AgentDock batch processing memory system.
 * Provides configurable extraction strategies with cost optimization.
 *
 * @author AgentDock Core Team
 */

import { Memory, MemoryMessage, MemoryType } from '../types';

/**
 * Configuration for the batch processing system.
 * Defines extraction strategies, cost budgets, and processing parameters.
 *
 * @interface BatchProcessorConfig
 * @example
 * ```typescript
 * const config: BatchProcessorConfig = {
 *   extractors: [
 *     { type: 'rules', enabled: true, costPerMemory: 0 },
 *     { type: 'small-llm', enabled: true, costPerMemory: 0.001 }
 *   ],
 *   costBudget: 0.50,
 *   targetCoverage: 0.8
 * };
 * ```
 */
export interface BatchProcessorConfig {
  /** Array of extraction strategies to use */
  extractors: ExtractorConfig[];

  /** ADVANCED BATCH PROCESSING CORE FIELDS - REQUIRED FOR 5X COST REDUCTION */

  /** Process after N messages (required for advanced processing) */
  maxBatchSize: number;

  /** Or after N minutes timeout (required for advanced processing) */
  timeoutMinutes: number;

  /** Need at least N messages to process (required for advanced processing) */
  minBatchSize: number;

  /** 0.2 = 20% of batches get processed for 5X cost reduction (core feature) */
  extractionRate: number;

  /** Enable small/fast model tier (advanced tier system) */
  enableSmallModel?: boolean;

  /** Enable premium/large model tier (advanced tier system) */
  enablePremiumModel?: boolean;

  /** ENHANCED NOISE FILTERING - INDUSTRY BEST PRACTICES */
  noiseFiltering?: {
    /** Use ML classifier for noise detection */
    classifierBased?: boolean;

    /** Use statistical measures */
    heuristicBased?: boolean;

    /** LLM-based filtering for any language */
    languageAgnostic?: boolean;

    /** User-defined noise patterns */
    customPatterns?: string[];

    /** Text repetitiveness threshold (higher = more repetitive) */
    perplexityThreshold?: number;

    /** Skip messages shorter than this character count */
    minMessageLength?: number;

    /** LLM provider for noise detection (anthropic, openai, etc) */
    llmProvider?: string;

    /** LLM model for noise detection */
    llmModel?: string;
  };

  /** ENHANCED BATCHING STRATEGIES */

  /** Use continuous vs static batching */
  enableContinuousBatching?: boolean;

  /** Dynamic batch sizing based on memory constraints */
  memoryAwareBatching?: boolean;

  /** OPTIONAL FIELDS */

  /** Maximum cost budget in USD for processing this batch */
  costBudget?: number;

  /** Target coverage percentage (0.0 to 1.0) for memory extraction */
  targetCoverage?: number;

  /** Number of messages to process in a single batch */
  batchSize?: number;

  /** Maximum parallel extraction operations */
  parallelism?: number;

  /** Monitoring and tracking configuration */
  monitoring?: MonitoringConfig;
}

/**
 * Configuration for individual extraction methods.
 * Allows fine-tuning of each extraction strategy.
 *
 * @interface ExtractorConfig
 */
export interface ExtractorConfig {
  /** Type of extractor: rules (free), small-llm (cheap), large-llm (expensive) */
  type: 'rules' | 'small-llm' | 'large-llm';

  /** Whether this extractor is enabled */
  enabled: boolean;

  /** Cost per memory extracted in USD */
  costPerMemory: number;

  /** LLM provider for AI extractors */
  provider?: string;

  /** Specific model name */
  model?: string;

  /** API key for LLM provider */
  apiKey?: string;

  /** Custom function to load user-defined extraction rules */
  customRulesLoader?: (agentId: string) => Promise<ExtractionRule[]>;

  /** Maximum cost this extractor can spend */
  maxCost?: number;

  /** Quality threshold for this extractor (0.0 to 1.0) */
  qualityThreshold?: number;
}

/**
 * User-defined extraction rule for pattern-based memory creation.
 * Completely configurable by end users - no hardcoded patterns.
 *
 * @interface ExtractionRule
 * @example
 * ```typescript
 * const rule: ExtractionRule = {
 *   id: 'user-preferences',
 *   pattern: 'I (prefer|like|want|need) (.+)',
 *   type: 'semantic',
 *   importance: 0.8,
 *   metadata: { category: 'preference' },
 *   createdBy: 'user123',
 *   createdAt: new Date()
 * };
 * ```
 */
export interface ExtractionRule {
  /** Unique identifier for this rule */
  id: string;

  /** Regular expression pattern to match */
  pattern: string;

  /** Type of memory to create when pattern matches */
  type: MemoryType;

  /** Importance score for extracted memories (0.0 to 1.0) */
  importance: number;

  /** Additional metadata to attach to extracted memories */
  metadata?: Record<string, any>;

  /** User ID who created this rule */
  createdBy: string;

  /** When this rule was created */
  createdAt: Date;

  /** Optional tags for organizing rules */
  tags?: string[];

  /** Whether this rule is currently active */
  isActive?: boolean;
}

/**
 * Result of batch processing operation.
 * Contains extracted memories, costs, and performance metrics.
 *
 * @interface BatchResult
 */
export interface BatchResult {
  /** Successfully extracted memories */
  memories: Memory[];

  /** Total cost incurred in USD */
  cost: number;

  /** Coverage achieved (0.0 to 1.0) */
  coverage: number;

  /** Detailed processing metrics */
  metrics: ExtractionMetrics;

  /** Any errors encountered during processing */
  errors?: ExtractionError[];
}

/**
 * Detailed metrics for extraction performance analysis.
 * Helps users optimize their extraction configurations.
 *
 * @interface ExtractionMetrics
 */
export interface ExtractionMetrics {
  /** Number of messages processed */
  messagesProcessed: number;

  /** Number of memories successfully extracted */
  memoriesExtracted: number;

  /** Breakdown by extractor type */
  extractorBreakdown: Record<string, ExtractorMetrics>;

  /** Total processing time in milliseconds */
  processingTimeMs: number;

  /** Time when processing started */
  startTime: Date;

  /** Time when processing completed */
  endTime: Date;
}

/**
 * Metrics for individual extractor performance.
 *
 * @interface ExtractorMetrics
 */
export interface ExtractorMetrics {
  /** Memories extracted by this extractor */
  memoriesExtracted: number;

  /** Cost incurred by this extractor */
  cost: number;

  /** Processing time for this extractor */
  timeMs: number;

  /** Success rate (0.0 to 1.0) */
  successRate: number;
}

/**
 * Configuration for monitoring and tracking.
 *
 * @interface MonitoringConfig
 */
export interface MonitoringConfig {
  /** Whether to track costs in real-time */
  trackCosts: boolean;

  /** Whether to collect performance metrics */
  collectMetrics: boolean;

  /** Whether to log extraction details */
  enableLogging: boolean;

  /** Custom metrics collector function */
  metricsCollector?: (metrics: ExtractionMetrics) => Promise<void>;
}

/**
 * Error that occurred during extraction.
 *
 * @interface ExtractionError
 */
export interface ExtractionError {
  /** Error message */
  message: string;

  /** Extractor type that caused the error */
  extractorType: string;

  /** Message that caused the error */
  messageId?: string;

  /** Detailed error information */
  details?: any;
}

/**
 * Interface that all extractors must implement.
 * Provides standard contract for extraction strategies.
 *
 * @interface IExtractor
 */
export interface IExtractor {
  /**
   * Extract memories from a message using this extraction strategy.
   *
   * @param message - The message to extract memories from
   * @param context - Extraction context including user rules
   * @returns Promise resolving to extracted memories
   */
  extract(
    message: MemoryMessage,
    context: ExtractionContext
  ): Promise<Memory[]>;

  /**
   * Estimate the cost of extracting memories from given messages.
   *
   * @param messages - Messages to estimate cost for
   * @returns Promise resolving to estimated cost in USD
   */
  estimateCost(messages: MemoryMessage[]): Promise<number>;

  /**
   * Get the type identifier for this extractor.
   *
   * @returns Extractor type string
   */
  getType(): string;
}

/**
 * Context provided to extractors during extraction.
 * Contains user-defined rules and configuration.
 *
 * @interface ExtractionContext
 */
export interface ExtractionContext {
  /** Agent ID for this extraction */
  agentId: string;

  /** User-defined extraction rules */
  userRules: ExtractionRule[];

  /** Configuration for this extraction */
  config: ExtractorConfig;

  /** Available cost budget */
  availableBudget: number;
}

/**
 * ADVANCED BATCH METADATA TRACKING
 * Tracks comprehensive metadata for each batch processed according to advanced memory specification.
 *
 * @interface BatchMetadata
 */
export interface BatchMetadata {
  /** Unique batch identifier */
  batchId: string;

  /** Source message IDs that were processed in this batch */
  sourceMessageIds: string[];

  /** Detailed processing statistics */
  processingStats: {
    /** When processing started */
    startTime: Date;

    /** When processing completed */
    endTime: Date;

    /** Number of messages processed */
    messagesProcessed: number;

    /** Number of memories created */
    memoriesCreated: number;

    /** Extraction methods used */
    extractionMethods: string[];

    /** Total tokens used (optional) */
    tokensUsed?: number;

    /** Error message if processing failed */
    error?: string;
  };
}
