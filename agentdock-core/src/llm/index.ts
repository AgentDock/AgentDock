/**
 * @fileoverview LLM module exports.
 * Provides language model interfaces and implementations.
 */

import { 
  CoreMessage, 
  CoreSystemMessage, 
  CoreUserMessage, 
  CoreAssistantMessage, 
  CoreToolMessage,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult
} from 'ai';
import { AnthropicLLM, AnthropicConfig } from './anthropic-llm';
import { LLMBase } from './llm-base';
import { logger, LogCategory } from '../logging';
import { createError, ErrorCode } from '../errors';
import { LLMConfig, LLMProvider, TokenUsage } from './types';

// Export the LLM base class and interfaces
export * from './llm-base';

// Export the Anthropic LLM implementation
export * from './anthropic-llm';

// Export types
export * from './types';

/**
 * Create an LLM instance based on the provider
 */
export function createLLM(config: LLMConfig): LLMBase {
  // Log creation once with comprehensive information
  logger.debug(
    LogCategory.LLM,
    'LLMFactory',
    'Creating LLM instance',
    {
      provider: config.provider,
      model: config.model,
      apiKeyPrefix: config.apiKey.substring(0, 5) + '...'
    }
  );
  
  // Create the appropriate LLM instance based on the provider
  if (config.provider === 'anthropic') {
    return new AnthropicLLM({
      apiKey: config.apiKey,
      model: config.model,
      ...config.options
    });
  }
  
  // Log error and throw for unsupported providers
  const error = `Unsupported LLM provider: ${config.provider}`;
  logger.error(LogCategory.LLM, 'LLMFactory', error);
  throw createError('llm', error, ErrorCode.LLM_EXECUTION);
}

// Re-export types from Vercel AI SDK
export type {
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult
}; 