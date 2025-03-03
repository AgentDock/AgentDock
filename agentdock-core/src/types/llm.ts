/**
 * @fileoverview Edge-compatible LLM type definitions
 */

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
  generateStream(messages: LLMMessage[], config: LLMConfig): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], config: LLMConfig): Promise<string>;
}

export interface LLMAdapter {
  provider: LLMProvider;
  config: LLMConfig;
  generateStream(messages: LLMMessage[]): Promise<ReadableStream>;
  generateText(messages: LLMMessage[]): Promise<string>;
} 