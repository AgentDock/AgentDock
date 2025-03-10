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
import { AnthropicLLM } from './anthropic-llm';
import { OpenAI } from './openai-llm';
import { LLMBase } from './llm-base';
import { logger, LogCategory } from '../logging';
import { createError, ErrorCode } from '../errors';
import { LLMConfig, AnthropicConfig, OpenAIConfig } from './types';
import { maskSensitiveData } from '../utils/security-utils';

// Export all types from types.ts
export * from './types';

// Export the LLM base class and interfaces
export * from './llm-base';

// Export the Anthropic LLM implementation
export * from './anthropic-llm';

/**
 * Create an LLM instance based on the provider
 */
export function createLLM(config: any): LLMBase {
  // Log creation once with comprehensive information
  logger.debug(
    LogCategory.LLM,
    'LLMFactory',
    'Creating LLM instance',
    {
      provider: config.provider,
      model: config.model,
      apiKeyPrefix: maskSensitiveData(config.apiKey, 5)
    }
  );
  
  const llmConfig: LLMConfig = {
    apiKey: config.apiKey,
    model: config.model,
    ...config.options
  };

  // Create the appropriate LLM instance based on the provider
  if (config.provider === 'anthropic') {
    return new AnthropicLLM(llmConfig as AnthropicConfig);
  } else if (config.provider === 'openai') {
    return new OpenAI(llmConfig as OpenAIConfig);
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