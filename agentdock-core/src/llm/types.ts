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
  options?: Record<string, any>;
  [key: string]: any;
}

/**
 * LLM message interface
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  createdAt?: number;
}

/**
 * Data provided to the onStepFinish callback
 */
export interface StepData {
  /** The text generated in this step */
  text?: string;
  /** Tool calls made in this step */
  toolCalls?: any[];
  /** Results of tool calls from this step */
  toolResults?: Record<string, any>;
  /** Reason why this step finished */
  finishReason?: string;
  /** Token usage information for this step */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Provider-specific configurations
export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
}

export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
}

export type ProviderConfig = AnthropicConfig | OpenAIConfig;

/**
 * LLM provider interface
 */
export interface LLMProviderInterface {
  generateStream(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<string>;
}

export interface LLMAdapter {
  provider: LLMProviderInterface;
  config: LLMConfig;
  generateStream(messages: LLMMessage[], tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], tools?: any): Promise<string>;
}

/**
 * Model metadata interface
 */
export interface ModelMetadata {
  id: string;
  displayName: string;
  description?: string;
  contextWindow?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  capabilities?: string[];
}

/**
 * Provider metadata interface
 */
export interface ProviderMetadata {
  id: LLMProvider;
  displayName: string;
  description?: string;
  validateApiKey: (key: string) => boolean;
  defaultModel: string;
} 