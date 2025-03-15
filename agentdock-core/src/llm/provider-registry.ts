/**
 * @fileoverview Provider registry for LLM providers.
 * Provides a centralized registry for provider metadata.
 */

import { LLMProvider, ProviderMetadata } from './types';
import { logger, LogCategory } from '../logging';

// Default provider metadata
const DEFAULT_PROVIDERS: Record<LLMProvider, ProviderMetadata> = {
  'anthropic': {
    id: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models by Anthropic',
    defaultModel: 'claude-3-7-sonnet-20250219',
    validateApiKey: (key: string) => key.startsWith('sk-ant-')
  },
  'openai': {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models by OpenAI',
    defaultModel: 'gpt-4',
    validateApiKey: (key: string) => key.startsWith('sk-') && !key.startsWith('sk-ant-')
  },
  'gemini': {
    id: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini models by Google',
    defaultModel: 'gemini-2.0-flash-exp',
    validateApiKey: (key: string) => key.length > 0 // Google API keys don't have a specific format to validate
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
    logger.debug(LogCategory.LLM, 'ProviderRegistry', `Registering provider: ${provider.id}`);
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
    return 'anthropic';
  }

  /**
   * Validate API key for provider
   */
  static validateApiKey(provider: LLMProvider, apiKey: string): boolean {
    const providerMetadata = this.getProvider(provider);
    if (!providerMetadata) {
      logger.warn(LogCategory.LLM, 'ProviderRegistry', `Provider not found: ${provider}`);
      return false;
    }
    return providerMetadata.validateApiKey(apiKey);
  }
} 