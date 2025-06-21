import { LogCategory, logger } from '../../logging';
import { LLMProvider, ModelMetadata } from '../types';
import {
  fetchAnthropicModels,
  validateAnthropicApiKey
} from './anthropic-adapter';
import {
  fetchCerebrasModels,
  validateCerebrasApiKey
} from './cerebras-adapter';
import {
  fetchDeepSeekModels,
  validateDeepSeekApiKey
} from './deepseek-adapter';
import { fetchGeminiModels, validateGeminiApiKey } from './gemini-adapter';
import { fetchGroqModels, validateGroqApiKey } from './groq-adapter';
import { fetchOpenAIModels, validateOpenAIApiKey } from './openai-adapter';

/**
 * @fileoverview Provider adapters for LLM providers
 * These adapters abstract the provider-specific logic for validation and model fetching
 */

// Re-export all provider adapters
export * from './anthropic-adapter';
export * from './cerebras-adapter';
export * from './deepseek-adapter';
export * from './openai-adapter';
export * from './gemini-adapter';
export * from './groq-adapter';

/**
 * Validate an API key for the specified provider
 */
export async function validateProviderApiKey(
  providerId: LLMProvider,
  apiKey: string
): Promise<boolean> {
  try {
    logger.debug(
      LogCategory.LLM,
      'ProviderAdapter',
      `Validating API key for provider: ${providerId}`
    );

    switch (providerId) {
      case 'anthropic':
        return validateAnthropicApiKey(apiKey);
      case 'openai':
        return validateOpenAIApiKey(apiKey);
      case 'gemini':
        return validateGeminiApiKey(apiKey);
      case 'deepseek':
        return validateDeepSeekApiKey(apiKey);
      case 'groq':
        return validateGroqApiKey(apiKey);
      case 'cerebras':
        return validateCerebrasApiKey(apiKey);
      default:
        logger.warn(
          LogCategory.LLM,
          'ProviderAdapter',
          `Unsupported provider: ${providerId}`
        );
        return false;
    }
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      'ProviderAdapter',
      `Error validating API key for ${providerId}:`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

/**
 * Fetch models for the specified provider
 */
export async function fetchProviderModels(
  providerId: LLMProvider,
  apiKey: string
): Promise<ModelMetadata[]> {
  try {
    logger.debug(
      LogCategory.LLM,
      'ProviderAdapter',
      `Fetching models for provider: ${providerId}`
    );

    switch (providerId) {
      case 'anthropic':
        return fetchAnthropicModels(apiKey);
      case 'openai':
        return fetchOpenAIModels(apiKey);
      case 'gemini':
        return fetchGeminiModels(apiKey);
      case 'deepseek':
        return fetchDeepSeekModels(apiKey);
      case 'groq':
        return fetchGroqModels(apiKey);
      case 'cerebras':
        return fetchCerebrasModels(apiKey);
      default:
        logger.warn(
          LogCategory.LLM,
          'ProviderAdapter',
          `Unsupported provider: ${providerId}`
        );
        return [];
    }
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      'ProviderAdapter',
      `Error fetching models for ${providerId}:`,
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}
