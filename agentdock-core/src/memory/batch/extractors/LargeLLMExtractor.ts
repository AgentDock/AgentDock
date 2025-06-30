/**
 * @fileoverview LargeLLMExtractor - High-quality memory extraction
 * Uses large, sophisticated models for complex reasoning and critical information.
 * 
 * @example
 * ```typescript
 * const config = {
 *   type: 'large-llm' as const,
 *   enabled: true,
 *   provider: 'your-provider',        // anthropic, openai, mistral
 *   model: 'your-large-model',        // your sophisticated model
 *   apiKey: process.env.YOUR_API_KEY,
 *   costPerMemory: 0.0               // User configures pricing
 * };
 * 
 * const costTracker = new CostTracker(storage);
 * const extractor = new LargeLLMExtractor(config, costTracker);
 * const memories = await extractor.extract(complexMessage, context);
 * ```
 * 
 * @author AgentDock Core Team
 */

import { MemoryMessage } from '../../types';
import { ExtractorConfig } from '../types';
import { CostTracker } from '../tracking/CostTracker';
import { LLMExtractor } from './LLMExtractor';

/**
 * Large LLM extractor for high-quality memory extraction.
 * Best for complex reasoning when quality matters more than cost.
 */
export class LargeLLMExtractor extends LLMExtractor {
  
  constructor(config: ExtractorConfig, costTracker: CostTracker) {
    super(config, costTracker);
  }

  getType(): string { 
    return 'large-llm'; 
  }

  /** Estimates cost based on message count and configured rate. */
  async estimateCost(messages: MemoryMessage[]): Promise<number> {
    return this.config.costPerMemory * messages.length;
  }
} 