/**
 * @fileoverview Function for creating LLM instances.
 */

import { createError, ErrorCode } from '../errors';
import { LogCategory, logger } from '../logging';
import { CoreLLM } from './core-llm';
import {
  createAnthropicModel,
  createCerebrasModel,
  createDeepSeekModel,
  createGeminiModel,
  createGroqModel,
  createOpenAIModel
} from './model-utils';
import { LLMConfig } from './types';

/**
 * Create an LLM instance for the specified configuration
 */
export function createLLM(config: LLMConfig): CoreLLM {
  logger.debug(LogCategory.LLM, 'createLLM', 'Creating LLM instance', {
    provider: config.provider,
    model: config.model
  });

  // Create the appropriate model based on the provider
  let model;
  switch (config.provider) {
    case 'anthropic':
      model = createAnthropicModel(config);
      break;
    case 'openai':
      model = createOpenAIModel(config);
      break;
    case 'gemini':
      model = createGeminiModel(config);
      break;
    case 'deepseek':
      model = createDeepSeekModel(config);
      break;
    case 'groq':
      model = createGroqModel(config);
      break;
    case 'cerebras':
      model = createCerebrasModel(config);
      break;
    default:
      throw createError(
        'llm',
        `Unsupported provider: ${config.provider}`,
        ErrorCode.LLM_EXECUTION
      );
  }

  // Create and return the CoreLLM instance
  return new CoreLLM({ model, config });
}
