/**
 * @fileoverview PRIMEExtractor - Priority Rules Intelligent Memory Extraction
 *
 * PRIME (Priority Rules Intelligent Memory Extraction) provides intelligent memory
 * extraction with embedded rule guidance and smart model selection.
 *
 * Features:
 * - Optimized prompts: 50-200 tokens typical, up to 450 for complex extractions
 * - Smart tier selection: standard/advanced based on content complexity
 * - Embedded rule guidance: Natural language rule integration
 * - Clean architecture: Single extraction path
 * - Configurable models: Support for multiple LLM providers
 *
 * @example
 * ```typescript
 * const extractor = new PRIMEExtractor(config, costTracker);
 * const memories = await extractor.extract(message, context);
 * ```
 */

import { z } from 'zod';

import { CoreLLM } from '../../llm/core-llm';
import { createLLM } from '../../llm/create-llm';
import { LLMConfig, LLMProvider } from '../../llm/types';
import { LogCategory, logger } from '../../logging';
import { CostTracker } from '../tracking/CostTracker';
import { Memory, MemoryMessage, MemoryType } from '../types/common';

// Configuration validation error class
class ConfigValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Configuration error for ${field}: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

// PRIME extraction schema for generateObject validation
const PRIMEExtractionSchema = z.object({
  memories: z.array(
    z.object({
      content: z.string(),
      type: z.enum(['working', 'episodic', 'semantic', 'procedural']),
      importance: z.number().min(0).max(1),
      reasoning: z.string().optional()
    })
  )
});

// Define type based on Zod schema for type safety
type ExtractedMemoryData = {
  content: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  importance: number;
  reasoning?: string;
};

// PRIME-specific types
export interface PRIMEConfig {
  // LLM Configuration - REQUIRED
  provider: LLMProvider; // e.g., 'anthropic', 'openai'
  apiKey: string; // API key for the provider
  maxTokens: number; // Default: 4000

  // 2-TIER MODEL SYSTEM ONLY
  standardModel: string; // Default: provider's efficient model
  advancedModel: string; // Default: provider's powerful model

  // Smart tier selection
  autoTierSelection: boolean; // Default: true
  defaultTier: 'standard' | 'advanced'; // Default: 'standard'

  // Tier thresholds
  tierThresholds?: {
    advancedMinChars: number; // Default: 500
    advancedMinRules: number; // Default: 5
  };

  // Core settings
  defaultImportanceThreshold: number; // Default: 0.7
  temperature: number; // Default: 0.3

  // Internal settings
  maxRetries?: number; // Default: 2
  fallbackEnabled?: boolean; // Default: true
  fallbackThreshold?: number; // Default: 0.5
}

export interface PRIMERule {
  id: string;
  guidance: string; // Example: "Extract meds/doses for tracking"
  type: MemoryType;
  importance: number;
  threshold?: number;
  isActive?: boolean;

  // LAZY DECAY PREVENTION FIELDS
  neverDecay?: boolean; // Memories extracted by this rule never decay
  customHalfLife?: number; // Custom decay rate in days for this rule
  reinforceable?: boolean; // Memories from this rule can be strengthened
}

export interface PRIMEExtractionContext {
  userId: string;
  agentId: string;
  userRules: PRIMERule[];
  importanceThreshold?: number;
  tier?: 'standard' | 'advanced'; // Allow override of auto-selection
  message?: MemoryMessage;
}

export interface PRIMEExtractionMetrics {
  agentId: string;
  tier: string;
  tokenCount: number;
  memoriesExtracted: number;
  processingTimeMs: number;
  cost: number;
}

/**
 * PRIMEExtractor - Intelligent memory extractor
 *
 * Provides efficient memory extraction with smart model selection
 * and embedded rule guidance for high-quality results.
 */
export class PRIMEExtractor {
  private config: PRIMEConfig;
  private costTracker: CostTracker;

  constructor(config: PRIMEConfig, costTracker: CostTracker) {
    this.config = this.validateAndSetDefaults(config);
    this.costTracker = costTracker;

    logger.info(LogCategory.STORAGE, 'PRIMEExtractor', 'PRIME initialized', {
      autoTierSelection: this.config.autoTierSelection,
      defaultTier: this.config.defaultTier
    });
  }

  /**
   * Extract memories using PRIME approach
   *
   * Single extraction path with embedded rule guidance.
   * Target: 50-200 tokens typical, up to 450 for complex extractions.
   */
  async extract(
    message: MemoryMessage,
    context: PRIMEExtractionContext
  ): Promise<Memory[]> {
    try {
      const { userRules, agentId, userId } = context;

      // Step 1: Smart tier selection based on content complexity
      const tier =
        context.tier ||
        (this.config.autoTierSelection
          ? this.selectOptimalTier(message, userRules)
          : this.config.defaultTier);

      // Step 2: Build optimized prompt with embedded rules
      const prompt = this.buildOptimizedPrompt(message, userRules, context);

      // Step 3: Single extraction call with message context for timestamp preservation
      const startTime = Date.now();
      const contextWithMessage = { ...context, message };
      const memories = await this.extractWithSingleCall(
        prompt,
        tier,
        contextWithMessage
      );
      const processingTime = Date.now() - startTime;

      // Step 4: Track metrics
      await this.trackExtractionMetrics({
        agentId,
        tier,
        tokenCount: this.estimateTokens(prompt),
        memoriesExtracted: memories.length,
        processingTimeMs: processingTime,
        cost: this.calculateCost(tier, prompt)
      });

      // Step 5: Validate and enrich memories
      return this.validateAndEnrich(memories, message, context);
    } catch (error) {
      if (this.config.fallbackEnabled) {
        return this.fallbackExtraction(message, context);
      }

      logger.error(
        LogCategory.STORAGE,
        'PRIMEExtractor',
        'PRIME extraction failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          agentId: context.agentId,
          messageLength: message.content.length
        }
      );

      // Only throw errors in production environments
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `PRIME extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Return empty array for development/test environments
      return [];
    }
  }

  /**
   * Build PRIME prompt for efficient extraction
   * Target: 50-200 tokens typical, up to 450 for complex extractions
   */
  private buildOptimizedPrompt(
    message: MemoryMessage,
    rules: PRIMERule[],
    context: PRIMEExtractionContext
  ): string {
    const focusAreas = 'Personal facts, Goals, Events, Problems, Skills';

    const rulesEmbedding =
      rules?.length > 0
        ? rules
            .filter((rule) => rule.isActive !== false)
            .map((rule) => rule.guidance)
            .join(', ')
        : '';

    const threshold =
      context.importanceThreshold || this.config.defaultImportanceThreshold;

    return `Extract memories: "${message.content}"

Focus: ${focusAreas}
${rulesEmbedding ? `Rules: ${rulesEmbedding}` : ''}

Requirements:
- Only importance ≥ ${threshold}
- Quality over quantity

JSON: [{content, type, importance, reasoning}]`;
  }

  /**
   * Smart tier selection based on content complexity
   * Used when autoTierSelection is enabled
   */
  private selectOptimalTier(
    message: MemoryMessage,
    rules: PRIMERule[]
  ): 'standard' | 'advanced' {
    if (!this.config.tierThresholds) {
      return this.config.defaultTier;
    }

    const contentLength = message.content.length;
    const ruleComplexity = rules?.length || 0;

    const { advancedMinChars, advancedMinRules } = this.config.tierThresholds;

    // Advanced tier: Complex content or many rules
    if (contentLength > advancedMinChars || ruleComplexity > advancedMinRules) {
      return 'advanced';
    }

    // Standard tier: Default for most scenarios
    return 'standard';
  }

  /**
   * Perform extraction call with proper error handling
   */
  private async extractWithSingleCall(
    prompt: string,
    tier: 'standard' | 'advanced',
    context: PRIMEExtractionContext
  ): Promise<Memory[]> {
    const llmConfig: LLMConfig = {
      provider: this.config.provider,
      model:
        tier === 'advanced'
          ? this.config.advancedModel
          : this.config.standardModel,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKey: this.config.apiKey
    };

    const llm = createLLM(llmConfig);

    try {
      const { object: result, usage } = await llm.generateObject({
        schema: PRIMEExtractionSchema,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature
      });

      const memoriesData = result.memories || [];

      return memoriesData.map((memory: ExtractedMemoryData) => {
        // Get message timestamp for temporal preservation
        const messageTime =
          context.message?.timestamp instanceof Date
            ? context.message.timestamp.getTime()
            : context.message?.timestamp || Date.now();

        // Find matching rule for decay settings
        const matchingRule = context.userRules.find(
          (rule) => rule.type === memory.type && rule.isActive !== false
        );

        return {
          id: this.generateMemoryId(),
          userId: context.userId,
          agentId: context.agentId,
          content: memory.content,
          type: memory.type as MemoryType,
          importance: memory.importance,

          // Required fields with proper timestamp preservation
          resonance: 1.0,
          accessCount: 0,
          createdAt: messageTime,
          updatedAt: Date.now(),
          lastAccessedAt: messageTime,

          // LAZY DECAY FIELDS from matching rule
          neverDecay: matchingRule?.neverDecay,
          customHalfLife: matchingRule?.customHalfLife,
          reinforceable: matchingRule?.reinforceable,
          status: 'active',

          // Optional metadata
          metadata: {
            extractionMethod: 'prime',
            reasoning: memory.reasoning,
            tier: tier,
            tokenCount: this.estimateTokens(prompt),
            originalMessageTime: messageTime,
            extractionTime: Date.now(),
            ruleId: matchingRule?.id
          }
        };
      });
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PRIMEExtractor',
        'LLM extraction failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tier,
          agentId: context.agentId
        }
      );
      throw error;
    }
  }

  /**
   * Validate configuration with sensible defaults
   * Environment variables provide overrides
   */
  private validateAndSetDefaults(config: PRIMEConfig): PRIMEConfig {
    // Validate critical fields first
    const apiKey = process.env.PRIME_API_KEY || config.apiKey;
    if (!apiKey) {
      throw new ConfigValidationError(
        'apiKey',
        'PRIME apiKey is required. Provide via config.apiKey or PRIME_API_KEY env var'
      );
    }

    const provider = (process.env.PRIME_PROVIDER ||
      config.provider ||
      'openai') as LLMProvider;
    const validProviders: LLMProvider[] = [
      'openai',
      'anthropic',
      'cerebras',
      'deepseek',
      'gemini',
      'groq'
    ];
    if (!validProviders.includes(provider)) {
      throw new ConfigValidationError(
        'provider',
        `Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}`
      );
    }

    // 2-TIER MODEL CONFIGURATION WITH PROPER CASCADE
    // Priority: PRIME_MODEL (both) > Tier-specific > Config > Provider defaults
    const singleModelOverride = process.env.PRIME_MODEL;

    return {
      // LLM Configuration - Validated fields
      provider,
      apiKey,
      maxTokens: process.env.PRIME_MAX_TOKENS
        ? Number(process.env.PRIME_MAX_TOKENS)
        : config.maxTokens || 4000,

      // 2-TIER MODEL CONFIGURATION
      standardModel:
        singleModelOverride ||
        process.env.PRIME_STANDARD_MODEL ||
        config.standardModel ||
        this.getStandardModel(provider),

      advancedModel:
        singleModelOverride ||
        process.env.PRIME_ADVANCED_MODEL ||
        config.advancedModel ||
        this.getAdvancedModel(provider),

      // Tier selection
      autoTierSelection: config.autoTierSelection ?? true,
      defaultTier:
        (process.env.PRIME_DEFAULT_TIER === 'advanced'
          ? 'advanced'
          : process.env.PRIME_DEFAULT_TIER === 'standard'
            ? 'standard'
            : config.defaultTier) || 'standard',

      // Smart tier thresholds
      tierThresholds:
        config.autoTierSelection !== false
          ? {
              advancedMinChars:
                config.tierThresholds?.advancedMinChars ||
                Number(process.env.PRIME_ADVANCED_MIN_CHARS) ||
                500,
              advancedMinRules:
                config.tierThresholds?.advancedMinRules ||
                Number(process.env.PRIME_ADVANCED_MIN_RULES) ||
                5
            }
          : undefined,

      // Core settings with sensible defaults
      defaultImportanceThreshold: config.defaultImportanceThreshold || 0.7,
      temperature: config.temperature || 0.3,

      // Internal settings
      maxRetries: config.maxRetries || 2,
      fallbackEnabled: config.fallbackEnabled ?? true,
      fallbackThreshold: config.fallbackThreshold || 0.5
    };
  }

  private getStandardModel(provider: string): string {
    const models: Record<string, string> = {
      openai: 'gpt-4.1-mini',
      anthropic: 'claude-3-haiku-20240307',
      gemini: 'gemini-1.5-flash',
      azure: 'gpt-4.1-mini',
      bedrock: 'claude-3-haiku-20240307'
    };
    return models[provider] || 'gpt-4.1-mini';
  }

  private getAdvancedModel(provider: string): string {
    const models: Record<string, string> = {
      openai: 'gpt-4.1',
      anthropic: 'claude-3-sonnet-20240229',
      gemini: 'gemini-1.5-pro',
      azure: 'gpt-4.1',
      bedrock: 'claude-3-sonnet-20240229'
    };
    return models[provider] || 'gpt-4.1';
  }

  // Helper methods
  private async trackExtractionMetrics(
    metrics: PRIMEExtractionMetrics
  ): Promise<void> {
    await this.costTracker.trackExtraction(metrics.agentId, {
      extractorType: 'prime',
      cost: metrics.cost,
      memoriesExtracted: metrics.memoriesExtracted,
      messagesProcessed: 1,
      metadata: {
        tier: metrics.tier,
        tokenCount: metrics.tokenCount,
        processingTimeMs: metrics.processingTimeMs
      }
    });
  }

  private estimateTokens(prompt: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(prompt.length / 4);
  }

  private calculateCost(tier: string, prompt: string): number {
    const tokenCount = this.estimateTokens(prompt);
    const costPerToken = tier === 'advanced' ? 0.001 : 0.0001;
    return tokenCount * costPerToken;
  }

  private validateAndEnrich(
    memories: Memory[],
    message: MemoryMessage,
    context: PRIMEExtractionContext
  ): Memory[] {
    return memories.filter(
      (memory) =>
        memory.content &&
        memory.importance >=
          (context.importanceThreshold ||
            this.config.defaultImportanceThreshold)
    );
  }

  private async fallbackExtraction(
    message: MemoryMessage,
    context: PRIMEExtractionContext
  ): Promise<Memory[]> {
    const fallbackContext = {
      ...context,
      importanceThreshold: this.config.fallbackThreshold,
      userRules: [],
      message
    };

    try {
      const fallbackPrompt = this.buildOptimizedPrompt(
        message,
        [],
        fallbackContext
      );
      return await this.extractWithSingleCall(
        fallbackPrompt,
        'standard',
        fallbackContext
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'PRIMEExtractor',
        'Fallback extraction failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          agentId: context.agentId,
          stack: error instanceof Error ? error.stack : 'No stack trace'
        }
      );

      // Only throw errors in production environments
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Fallback extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Return empty array for development/test environments
      return [];
    }
  }

  private generateMemoryId(): string {
    return `prime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
