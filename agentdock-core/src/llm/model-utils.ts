import { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LLMConfig, GeminiConfig, DeepSeekConfig } from './types';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { ProviderRegistry } from './provider-registry';

// Add structuredClone polyfill if it doesn't exist
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = function structuredClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  };
}

/**
 * Create an Anthropic model
 */
export function createAnthropicModel(config: LLMConfig): LanguageModel {
  // Validate API key
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  // Validate API key format
  if (!config.apiKey.startsWith('sk-ant-')) {
    throw createError('llm', 'Invalid Anthropic API key format', ErrorCode.LLM_API_KEY);
  }

  return createAnthropic({ 
    apiKey: config.apiKey
    // Note: Temperature is passed at the request level, not at model creation
  })(config.model);
}

/**
 * Create an OpenAI model
 */
export function createOpenAIModel(config: LLMConfig): LanguageModel {
  // Validate API key
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  return createOpenAI({ 
    apiKey: config.apiKey
    // Note: Temperature is passed at the request level, not at model creation
  })(config.model);
}

/**
 * Create a Gemini model
 */
export function createGeminiModel(config: LLMConfig): LanguageModel {
  // Validate API key
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const geminiConfig = config as GeminiConfig;
  
  // Create the Gemini provider
  const provider = createGoogleGenerativeAI({
    apiKey: config.apiKey
  });
  
  // Create model options
  const modelOptions: any = {};
  
  // Add search grounding if enabled
  // Note: Search grounding and tool calling are mutually exclusive
  // If useSearchGrounding is explicitly set to false, don't enable it
  if (geminiConfig.useSearchGrounding === true) {
    logger.debug(
      LogCategory.LLM,
      'createGeminiModel',
      'Enabling search grounding for Gemini model',
      { model: config.model }
    );
    modelOptions.useSearchGrounding = true;
  } else {
    logger.debug(
      LogCategory.LLM,
      'createGeminiModel',
      'Search grounding disabled for Gemini model',
      { model: config.model, useSearchGrounding: geminiConfig.useSearchGrounding }
    );
  }
  
  // Add safety settings if provided
  if (geminiConfig.safetySettings) {
    modelOptions.safetySettings = geminiConfig.safetySettings;
  }
  
  // Add dynamic retrieval config if provided
  if (geminiConfig.dynamicRetrievalConfig) {
    modelOptions.dynamicRetrievalConfig = geminiConfig.dynamicRetrievalConfig;
  }
  
  // Create and return the model with options
  return provider(config.model, modelOptions);
}

/**
 * Create a DeepSeek model
 * DeepSeek's API is compatible with OpenAI's format, so we can use the OpenAI client
 * with a custom baseURL
 */
export function createDeepSeekModel(config: LLMConfig): LanguageModel {
  // Validate API key
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const deepseekConfig = config as DeepSeekConfig;
  
  try {
    // Create the DeepSeek provider using OpenAI's client with DeepSeek's baseURL
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
    
    // Create model options
    const modelOptions: any = {};
    
    // Add safety settings if provided
    if (deepseekConfig.safetySettings) {
      logger.debug(
        LogCategory.LLM,
        'createDeepSeekModel',
        'Adding safety settings for DeepSeek model',
        { model: config.model }
      );
      modelOptions.safetySettings = deepseekConfig.safetySettings;
    }
    
    // Create and return the model with options
    return provider(config.model, modelOptions);
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      'createDeepSeekModel',
      'Error creating DeepSeek model',
      { error: (error as Error).message, model: config.model }
    );
    throw createError('llm', `Error creating DeepSeek model: ${(error as Error).message}`, ErrorCode.LLM_EXECUTION);
  }
} 