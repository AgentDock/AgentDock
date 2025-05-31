/**
 * @fileoverview Model utils for creating LLM providers.
 */

import { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { LLMConfig, GeminiConfig, DeepSeekConfig, GroqConfig, CerebrasConfig } from './types';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { ProviderRegistry } from './provider-registry';
import { LLMProvider, LLMMessage, ModelMetadata } from './types';
import { ModelService } from './model-service';

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
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }
  if (!config.apiKey.startsWith('sk-ant-')) {
    throw createError('llm', 'Invalid Anthropic API key format', ErrorCode.LLM_API_KEY);
  }
  return createAnthropic({ apiKey: config.apiKey })(config.model);
}

/**
 * Create an OpenAI model
 */
export function createOpenAIModel(config: LLMConfig): LanguageModel {
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }
  return createOpenAI({ apiKey: config.apiKey, compatibility: 'strict' })(config.model);
}

/**
 * Create a Gemini model
 */
export function createGeminiModel(config: LLMConfig): LanguageModel {
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const geminiConfig = config as GeminiConfig;
  const provider = createGoogleGenerativeAI({ apiKey: config.apiKey });
  const modelOptions: any = {};

  if (geminiConfig.useSearchGrounding === true) {
    logger.debug(LogCategory.LLM, 'createGeminiModel', 'Enabling search grounding for Gemini model', {
      model: config.model,
      useSearchGrounding: geminiConfig.useSearchGrounding
    });
    modelOptions.useSearchGrounding = true;
  } else {
    logger.debug(LogCategory.LLM, 'createGeminiModel', `Search grounding explicitly set to: ${geminiConfig.useSearchGrounding} for Gemini model`, {
      model: config.model,
      useSearchGrounding: geminiConfig.useSearchGrounding ?? 'Not Set (defaulting to SDK behavior)'
    });
  }

  if (geminiConfig.safetySettings) {
    modelOptions.safetySettings = geminiConfig.safetySettings;
  }

  if (geminiConfig.dynamicRetrievalConfig) {
    modelOptions.dynamicRetrievalConfig = geminiConfig.dynamicRetrievalConfig;
  }

  return provider(config.model, modelOptions);
}

/**
 * Create a DeepSeek model
 */
export function createDeepSeekModel(config: LLMConfig): LanguageModel {
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const deepseekConfig = config as DeepSeekConfig;

  try {
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      compatibility: 'strict'
    });

    const modelOptions: any = {};

    if (deepseekConfig.safetySettings) {
      logger.debug(LogCategory.LLM, 'createDeepSeekModel', 'Adding safety settings for DeepSeek model', {
        model: config.model
      });
      modelOptions.safetySettings = deepseekConfig.safetySettings;
    }

    return provider(config.model, modelOptions);
  } catch (error) {
    logger.error(LogCategory.LLM, 'createDeepSeekModel', 'Error creating DeepSeek model', {
      error: (error as Error).message,
      model: config.model
    });
    throw createError('llm', `Error creating DeepSeek model: ${(error as Error).message}`, ErrorCode.LLM_EXECUTION);
  }
}

/**
 * Create a Groq model
 */
export function createGroqModel(config: LLMConfig): LanguageModel {
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const groqConfig = config as GroqConfig;

  try {
    const provider = createGroq({ apiKey: config.apiKey });
    const modelOptions: any = {};

    if (groqConfig.extractReasoning) {
      logger.debug(LogCategory.LLM, 'createGroqModel', 'Enabling reasoning extraction for Groq model', {
        model: config.model
      });
      modelOptions.extractReasoning = true;
    }

    return provider(config.model, modelOptions);
  } catch (error) {
    logger.error(LogCategory.LLM, 'createGroqModel', 'Error creating Groq model', {
      error: (error as Error).message,
      model: config.model
    });
    throw createError('llm', `Error creating Groq model: ${(error as Error).message}`, ErrorCode.LLM_EXECUTION);
  }
}

/**
 * Create a Cerebras model
 * Uses OpenAI compatibility mode until Vercel AI SDK adds Cerebras support
 */
export function createCerebrasModel(config: LLMConfig): LanguageModel {
  if (!config.apiKey) {
    throw createError('llm', 'API key is required', ErrorCode.LLM_API_KEY);
  }

  const cerebrasConfig = config as CerebrasConfig;

  try {
    const provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.cerebras.ai/v1',
      compatibility: 'strict'
    });

    const modelOptions: any = {};

    if (cerebrasConfig.extractReasoning) {
      logger.debug(LogCategory.LLM, 'createCerebrasModel', 'Enabling reasoning extraction for Cerebras model', {
        model: config.model
      });
      modelOptions.extractReasoning = true;
    }

    return provider(config.model, modelOptions);
  } catch (error) {
    logger.error(LogCategory.LLM, 'createCerebrasModel', 'Error creating Cerebras model', {
      error: (error as Error).message,
      model: config.model
    });
    throw createError('llm', `Error creating Cerebras model: ${(error as Error).message}`, ErrorCode.LLM_EXECUTION);
  }
}

/**
 * Create a streaming response for Cerebras chat completions
 */
export async function createCerebrasStream(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  } = {}
) {
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cerebras API error: ${response.statusText}`);
  }

  return response;
}

/**
 * Get model metadata for a provider
 */
export function getModelMetadata(provider: LLMProvider, modelId: string): ModelMetadata | undefined {
  try {
    return ModelService.getModel(modelId);
  } catch (error) {
    logger.error(LogCategory.LLM, '[ModelUtils]', `Error getting model metadata for ${provider}/${modelId}:`, { error });
    return undefined;
  }
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(provider: LLMProvider): ModelMetadata[] {
  try {
    return ModelService.getModels(provider);
  } catch (error) {
    logger.error(LogCategory.LLM, '[ModelUtils]', `Error getting models for ${provider}:`, { error });
    return [];
  }
}

/**
 * Get all registered models
 */
export function getAllModels(): ModelMetadata[] {
  try {
    return ModelService.getAllModels();
  } catch (error) {
    logger.error(LogCategory.LLM, '[ModelUtils]', 'Error getting all models:', { error });
    return [];
  }
}
