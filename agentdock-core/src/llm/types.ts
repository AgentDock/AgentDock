/**
 * @fileoverview Type definitions for LLM module.
 */

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider?: string;
}

/**
 * LLM provider types
 */
export type LLMProvider = 'anthropic' | 'openai';

/**
 * LLM configuration
 */
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
} 