/**
 * @fileoverview Edge-compatible LLM type definitions
 */

// Import tool types
import { Tool } from './tools';

// Define ToolRegistry type for core
export type ToolRegistry = Record<string, Tool>;

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  createdAt?: number;
}

export interface LLMConfig {
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Maximum number of steps for multi-step tool calls.
   * When > 1, enables the LLM to make multiple tool calls in sequence
   * before returning a final response.
   * @default 1
   */
  maxSteps?: number;
}

// Provider-specific configurations
export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
}

export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
  // frequencyPenalty?: number;
  // presencePenalty?: number;
}

export type ProviderConfig = AnthropicConfig | OpenAIConfig;

export interface LLMProvider {
  generateStream(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<string>;
}

export interface LLMAdapter {
  provider: LLMProvider;
  config: LLMConfig;
  generateStream(messages: LLMMessage[], tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], tools?: any): Promise<string>;
} 