/**
 * @fileoverview LLMExtractor - Base class for LLM-powered memory extraction
 * Extend this class to create custom LLM extractors with your own models.
 *
 * @example
 * ```typescript
 * class CustomLLMExtractor extends LLMExtractor {
 *   getType(): string { return 'custom-llm'; }
 *   async estimateCost(messages: MemoryMessage[]): Promise<number> {
 *     return messages.length * this.config.costPerMemory;
 *   }
 * }
 *
 * const config = {
 *   type: 'custom-llm',
 *   enabled: true,
 *   provider: 'your-provider',
 *   model: 'your-model',
 *   apiKey: process.env.YOUR_API_KEY,
 *   costPerMemory: 0.005
 * };
 *
 * const extractor = new CustomLLMExtractor(config, costTracker);
 * ```
 *
 * @author AgentDock Core Team
 */

import { CoreLLM, createLLM } from '../../../llm';
import { LogCategory, logger } from '../../../logging';
import { generateId } from '../../../storage/utils';
import { Memory, MemoryMessage } from '../../types';
import { CostTracker } from '../tracking/CostTracker';
import { ExtractionContext, ExtractorConfig, IExtractor } from '../types';

/**
 * Abstract base class for LLM-based memory extraction.
 *
 * Provides common functionality for all LLM extractors:
 * - LLM initialization and configuration validation
 * - Prompt building with user rules as examples
 * - Response parsing into Memory objects
 * - Cost tracking integration
 * - Error handling and logging
 *
 * @abstract
 */
export abstract class LLMExtractor implements IExtractor {
  protected config: ExtractorConfig;
  protected costTracker: CostTracker;
  protected llm: CoreLLM;

  /**
   * Creates a new LLMExtractor instance.
   * Validates configuration and initializes the underlying LLM.
   *
   * @param config - Extractor configuration with provider, model, apiKey
   * @param costTracker - Cost tracking service for monitoring expenses
   * @throws Error if required configuration is missing
   */
  constructor(config: ExtractorConfig, costTracker: CostTracker) {
    this.config = config;
    this.costTracker = costTracker;
    if (!config.provider || !config.model || !config.apiKey) {
      throw new Error(
        'LLMExtractor requires provider, model, and apiKey configuration'
      );
    }
    this.llm = createLLM({
      provider: config.provider as any,
      model: config.model,
      apiKey: config.apiKey
    });
  }

  /**
   * Returns the extractor type identifier.
   * Must be implemented by subclasses.
   *
   * @returns Unique string identifying this extractor type
   */
  abstract getType(): string;

  /**
   * Extract memories from a message using LLM.
   *
   * Process:
   * 1. Build extraction prompt with user rules as examples
   * 2. Call LLM via AgentDock Core's infrastructure
   * 3. Track costs in real-time
   * 4. Parse response into Memory objects
   * 5. Handle errors gracefully
   *
   * @param message - Message to extract memories from
   * @param context - Extraction context with user rules, config, budget
   * @returns Promise resolving to array of extracted memories
   */
  async extract(
    message: MemoryMessage,
    context: ExtractionContext
  ): Promise<Memory[]> {
    try {
      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(message, context);

      // Call LLM with cost tracking
      const startTime = Date.now();
      const result = await this.llm.streamText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxRetries: 1
      });

      // Get full response
      const response = await result.text;

      const elapsedMs = Date.now() - startTime;

      // Get usage information
      const usage = await result.usage;

      // Track costs
      await this.costTracker.trackExtraction(context.agentId, {
        extractorType: this.getType(),
        cost: this.estimateCostFromUsage(usage),
        memoriesExtracted: 0, // Will update after parsing
        messagesProcessed: 1,
        metadata: {
          model: this.config.model,
          provider: this.config.provider,
          tokensUsed: usage?.totalTokens || 0,
          responseTimeMs: elapsedMs
        }
      });

      // Parse response into memories
      const memories = await this.parseMemoriesFromResponse(
        response,
        message,
        context
      );

      return memories;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'LLMExtractor.extract',
        'Extraction failed',
        { error }
      );
      return [];
    }
  }

  /**
   * Build extraction prompt including user rules as examples.
   *
   * Creates a structured prompt that:
   * - Shows the message content to analyze
   * - Includes user-defined rules as extraction examples
   * - Requests JSON output with specific fields
   * - Handles cases where no important information exists
   *
   * @param message - Message to extract from
   * @param context - Context with user rules to include as examples
   * @returns Formatted prompt string ready for LLM
   * @protected
   */
  protected buildExtractionPrompt(
    message: MemoryMessage,
    context: ExtractionContext
  ): string {
    const rulesExamples = context.userRules
      .slice(0, 5) // Include up to 5 example rules
      .map(
        (rule) =>
          `- Pattern: "${rule.pattern}" extracts ${rule.type} memories with importance ${rule.importance}`
      )
      .join('\n');

    return `Extract memories from: "${message.content}"
${rulesExamples ? `\nPatterns:\n${rulesExamples}` : ''}
Return JSON array: [{"content": "...", "type": "working|episodic|semantic|procedural", "importance": 0.0-1.0}]
Empty array if nothing important: []`;
  }

  /**
   * Parse LLM response into Memory objects.
   *
   * Expects LLM to return JSON array with objects containing:
   * - content: The extracted information
   * - type: Memory type (working/episodic/semantic/procedural)
   * - importance: Score from 0.0 to 1.0
   *
   * @param response - Raw LLM response string
   * @param message - Original message being processed
   * @param context - Extraction context
   * @returns Array of parsed Memory objects
   * @protected
   */
  protected async parseMemoriesFromResponse(
    response: string,
    message: MemoryMessage,
    context: ExtractionContext
  ): Promise<Memory[]> {
    try {
      const parsed = JSON.parse(response);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item) => {
        const now = Date.now();
        return {
          id: generateId(),
          agentId: context.agentId,
          content: item.content,
          type: item.type || 'episodic',
          importance: item.importance || 0.5,
          resonance: 1.0,
          accessCount: 0,
          createdAt: now,
          updatedAt: now,
          lastAccessedAt: now,
          metadata: {
            ...item.metadata,
            sourceMessageId: message.id,
            extractedBy: this.getType(),
            extractedAt: new Date(),
            extractionMethod: 'llm'
          },
          keywords: [],
          connections: []
        };
      });
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'LLMExtractor.parseMemories',
        'Failed to parse response'
      );
      return [];
    }
  }

  /**
   * Estimate cost from actual token usage after LLM call.
   * Subclasses should override with provider-specific pricing logic.
   *
   * @param usage - Token usage object from LLM response
   * @returns Cost in USD
   * @protected
   */
  protected estimateCostFromUsage(usage?: any): number {
    if (!usage) return 0;
    const totalTokens = usage.totalTokens || 0;
    return totalTokens * this.config.costPerMemory;
  }

  /**
   * Estimate the cost of extracting memories from given messages.
   * Required by IExtractor interface. Uses rough token estimation.
   *
   * @param messages - Messages to estimate cost for
   * @returns Promise resolving to estimated cost in USD
   */
  async estimateCost(messages: MemoryMessage[]): Promise<number> {
    // Estimate based on average message length and model pricing
    const totalChars = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const estimatedTokens = totalChars / 4; // Rough estimate: 1 token = 4 chars
    return estimatedTokens * this.config.costPerMemory;
  }
}
