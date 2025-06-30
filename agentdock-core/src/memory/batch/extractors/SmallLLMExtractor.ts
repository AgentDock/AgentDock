/**
 * @fileoverview SmallLLMExtractor - Cost-effective memory extraction
 * Uses small, fast models for budget-conscious processing.
 *
 * @example
 * ```typescript
 * const config = {
 *   type: 'small-llm' as const,
 *   enabled: true,
 *   provider: 'your-provider',        // anthropic, openai, mistral, groq
 *   model: 'your-small-model',        // your fast, cheap model
 *   apiKey: process.env.YOUR_API_KEY,
 *   costPerMemory: 0.0               // User configures pricing
 * };
 *
 * const costTracker = new CostTracker(storage);
 * const extractor = new SmallLLMExtractor(config, costTracker);
 * const memories = await extractor.extract(message, context);
 * ```
 *
 * @author AgentDock Core Team
 */

import { MemoryMessage } from '../../types';
import { CostTracker } from '../tracking/CostTracker';
import { ExtractorConfig } from '../types';
import { LLMExtractor } from './LLMExtractor';

/**
 * Small LLM extractor for cost-effective memory extraction.
 * Best for high-volume processing with budget constraints.
 */
export class SmallLLMExtractor extends LLMExtractor {
  constructor(config: ExtractorConfig, costTracker: CostTracker) {
    super(config, costTracker);
  }

  getType(): string {
    return 'small-llm';
  }

  /** Estimates cost based on message count and configured rate. */
  async estimateCost(messages: MemoryMessage[]): Promise<number> {
    return this.config.costPerMemory * messages.length;
  }
}
