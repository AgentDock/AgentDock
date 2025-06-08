/**
 * @fileoverview Provider registry for LLM providers.
 * Provides a centralized registry for provider metadata.
 */

import { LogCategory, logger } from '../logging';
import { LLMProvider, ProviderMetadata } from './types';

// Default provider metadata
const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderMetadata> = {
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models by Anthropic',
    defaultModel: 'claude-3-7-sonnet-20250219',
    validateApiKey: (key: string) => key.startsWith('sk-ant-'),
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply Anthropic-specific configurations
      // Currently no special configurations needed
    }
  },
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models by OpenAI',
    defaultModel: 'gpt-4',
    validateApiKey: (key: string) =>
      key.startsWith('sk-') && !key.startsWith('sk-ant-'),
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply OpenAI-specific configurations
      // Currently no special configurations needed
    }
  },
  gemini: {
    id: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini models by Google',
    defaultModel: 'gemini-2.0-flash-exp',
    validateApiKey: (key: string) => key.length > 0, // Google API keys don't have a specific format to validate
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply Gemini-specific configurations

      // First check options (highest priority)
      if (options) {
        // Add search grounding if specified in options
        if (options.useSearchGrounding !== undefined) {
          baseConfig.useSearchGrounding = options.useSearchGrounding;
        }

        // Add safety settings if specified in options
        if (options.safetySettings) {
          baseConfig.safetySettings = options.safetySettings;
        }

        // Add dynamic retrieval config if specified in options
        if (options.dynamicRetrievalConfig) {
          baseConfig.dynamicRetrievalConfig = options.dynamicRetrievalConfig;
        }
      }

      // Then check model config (lower priority, only if not already set)
      // Add search grounding if enabled and not already set
      if (
        modelConfig?.useSearchGrounding !== undefined &&
        baseConfig.useSearchGrounding === undefined
      ) {
        baseConfig.useSearchGrounding = modelConfig.useSearchGrounding;
      }

      // Add dynamic retrieval config if provided and not already set
      if (
        modelConfig?.dynamicRetrievalConfig &&
        !baseConfig.dynamicRetrievalConfig
      ) {
        baseConfig.dynamicRetrievalConfig = modelConfig.dynamicRetrievalConfig;
      }

      // Add safety settings if provided and not already set
      if (modelConfig?.safetySettings && !baseConfig.safetySettings) {
        baseConfig.safetySettings = modelConfig.safetySettings;
      }

      // Default to true for search grounding if not specified anywhere
      if (baseConfig.useSearchGrounding === undefined) {
        baseConfig.useSearchGrounding = true;
      }
    }
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    description: 'DeepSeek models including DeepSeek-V3 and DeepSeek-R1',
    defaultModel: 'deepseek-chat',
    validateApiKey: (key: string) => key.length > 0, // DeepSeek API keys don't have a specific format to validate
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply DeepSeek-specific configurations

      // Add safety settings if provided in options
      if (options?.safetySettings) {
        baseConfig.safetySettings = options.safetySettings;
      }

      // Add safety settings from model config if not already set
      if (modelConfig?.safetySettings && !baseConfig.safetySettings) {
        baseConfig.safetySettings = modelConfig.safetySettings;
      }

      // Add reasoning extraction if enabled
      if (modelConfig?.extractReasoning !== undefined) {
        baseConfig.extractReasoning = modelConfig.extractReasoning;
      }
    }
  },
  groq: {
    id: 'groq',
    displayName: 'Groq',
    description:
      'Groq API for ultra-fast LLM inference with models like Llama 3',
    defaultModel: 'llama-3.1-8b-instant',
    validateApiKey: (key: string) => key.startsWith('gsk_') || key.length > 25, // Groq API keys start with gsk_
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply Groq-specific configurations

      // Add reasoning extraction if enabled
      if (modelConfig?.extractReasoning !== undefined) {
        baseConfig.extractReasoning = modelConfig.extractReasoning;
      }

      // Add reasoning extraction from options if provided
      if (options?.extractReasoning !== undefined) {
        baseConfig.extractReasoning = options.extractReasoning;
      }
    }
  },
  cerebras: {
    id: 'cerebras',
    displayName: 'Cerebras',
    description:
      'Run Llama models on Cerebras high-performance inference endpoint.',
    defaultModel: 'llama-4-scout-17b-16e-instruct',
    validateApiKey: (key: string) =>
      (key.startsWith('csk_') || key.startsWith('csk-')) && key.length >= 36,
    applyConfig: (baseConfig, modelConfig, options) => {
      // Apply Cerebras-specific configurations

      // Add reasoning extraction if enabled
      if (modelConfig?.extractReasoning !== undefined) {
        baseConfig.extractReasoning = modelConfig.extractReasoning;
      }

      // Add reasoning extraction from options if provided
      if (options?.extractReasoning !== undefined) {
        baseConfig.extractReasoning = options.extractReasoning;
      }
    }
  }
};

/**
 * Provider registry for accessing provider metadata
 * This is a lightweight registry that doesn't store model information
 * Models are configured by the application at runtime
 */
export class ProviderRegistry {
  private static providers: Map<LLMProvider, ProviderMetadata> = new Map(
    Object.entries(DEFAULT_PROVIDERS) as [LLMProvider, ProviderMetadata][]
  );

  /**
   * Register a provider with the registry
   * This allows applications to override default provider metadata
   */
  static registerProvider(provider: ProviderMetadata): void {
    logger.debug(
      LogCategory.LLM,
      'ProviderRegistry',
      `Registering provider: ${provider.id}`
    );
    this.providers.set(provider.id, provider);
  }

  /**
   * Get provider metadata by ID
   */
  static getProvider(id: LLMProvider): ProviderMetadata | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): ProviderMetadata[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider from node type
   */
  static getProviderFromNodeType(nodeType: string): LLMProvider {
    if (nodeType === 'llm.openai') {
      return 'openai';
    }
    if (nodeType === 'llm.gemini') {
      return 'gemini';
    }
    if (nodeType === 'llm.deepseek') {
      return 'deepseek';
    }
    if (nodeType === 'llm.groq') {
      return 'groq';
    }
    if (nodeType === 'llm.cerebras') {
      return 'cerebras';
    }
    return 'anthropic';
  }

  /**
   * Get node type from provider
   */
  static getNodeTypeFromProvider(provider: LLMProvider): string {
    if (provider === 'openai') {
      return 'llm.openai';
    }
    if (provider === 'gemini') {
      return 'llm.gemini';
    }
    if (provider === 'deepseek') {
      return 'llm.deepseek';
    }
    if (provider === 'groq') {
      return 'llm.groq';
    }
    if (provider === 'cerebras') {
      return 'llm.cerebras';
    }
    return 'llm.anthropic';
  }

  /**
   * Get provider from node list
   */
  static getProviderFromNodes(nodes: string[]): LLMProvider {
    if (nodes.includes('llm.openai')) {
      return 'openai';
    }
    if (nodes.includes('llm.gemini')) {
      return 'gemini';
    }
    if (nodes.includes('llm.deepseek')) {
      return 'deepseek';
    }
    if (nodes.includes('llm.groq')) {
      return 'groq';
    }
    if (nodes.includes('llm.cerebras')) {
      return 'cerebras';
    }
    return 'anthropic';
  }

  /**
   * Validate API key for provider
   */
  static validateApiKey(provider: LLMProvider, apiKey: string): boolean {
    const providerMetadata = this.getProvider(provider);
    if (!providerMetadata) {
      logger.warn(
        LogCategory.LLM,
        'ProviderRegistry',
        `Provider not found: ${provider}`
      );
      return false;
    }
    return providerMetadata.validateApiKey(apiKey);
  }
}
