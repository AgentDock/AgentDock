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
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'groq' | 'cerebras';

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
 * This interface is designed to be compatible with CoreMessage from the AI SDK
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  id?: string;
  createdAt?: number;
  experimental_attachments?: any[];
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

/**
 * Google Gemini configuration
 */
export interface GeminiConfig extends LLMConfig {
  /** Provider must be 'gemini' */
  provider: 'gemini';
  /** Enable Google Search for grounding responses in web search results */
  useSearchGrounding?: boolean;
  /** Dynamic retrieval configuration for Google Gemini */
  dynamicRetrievalConfig?: {
    /** Mode for dynamic retrieval */
    mode: 'MODE_DYNAMIC' | 'MODE_UNSPECIFIED';
    /** Dynamic threshold for retrieval */
    dynamicThreshold?: number;
  };
  /** Safety settings for Google Gemini */
  safetySettings?: Array<{
    /** Category for the safety setting */
    category: string;
    /** Threshold for the safety setting */
    threshold: string;
  }>;
  /** Enable structured outputs for object generation */
  structuredOutputs?: boolean;
}

/**
 * DeepSeek configuration
 */
export interface DeepSeekConfig extends LLMConfig {
  /** Provider must be 'deepseek' */
  provider: 'deepseek';
  /** Safety settings for DeepSeek */
  safetySettings?: Array<{
    /** Category for the safety setting */
    category: string;
    /** Threshold for the safety setting */
    threshold: string;
  }>;
  /** Enable reasoning extraction for DeepSeek-R1 */
  extractReasoning?: boolean;
}

/**
 * Groq configuration
 */
export interface GroqConfig extends LLMConfig {
  /** Provider must be 'groq' */
  provider: 'groq';
  /** Enable reasoning extraction for models that support it */
  extractReasoning?: boolean;
}

/**
 * Cerebras configuration
 */
export interface CerebrasConfig extends LLMConfig {
  /** Provider must be 'cerebras' */
  provider: "cerebras";
  /** Future custom settings (optional) */
  extractReasoning?: boolean; // If you plan to support it
}

export type ProviderConfig = AnthropicConfig | OpenAIConfig | GeminiConfig | DeepSeekConfig | GroqConfig | CerebrasConfig;

/**
 * LLM provider interface
 */
export interface LLMProviderInterface {
  generateStream(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], config: LLMConfig, tools?: any): Promise<string>;
}

import type { LanguageModel } from 'ai';

export interface LLMAdapter {
  provider: LLMProviderInterface;
  config: LLMConfig;
  generateStream(messages: LLMMessage[], tools?: any): Promise<ReadableStream>;
  generateText(messages: LLMMessage[], tools?: any): Promise<string>;
  getSdkLanguageModel(): LanguageModel;
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
  /** Apply provider-specific configurations to the base config */
  applyConfig?: (baseConfig: any, modelConfig: any, options?: any) => void;
  /** Fetch available models for this provider */
  fetchModels?: (apiKey: string) => Promise<ModelMetadata[]>;
}