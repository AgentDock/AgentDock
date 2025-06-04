/**
 * @fileoverview OpenAI provider adapter
 * Handles OpenAI-specific validation and model fetching logic
 */

import OpenAI from 'openai';

import { LogCategory, logger } from '../../logging';
import { ModelService } from '../model-service';
import { ModelMetadata } from '../types';

/**
 * Validate an OpenAI API key by making a request to the OpenAI API
 */
export async function validateOpenAIApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey
    });

    // Try to list models
    const response = await openai.models.list();
    return Array.isArray(response.data);
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[OpenAIAdapter]',
      'Error validating API key:',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    return false;
  }
}

/**
 * Fetch models from the OpenAI API and register them with the model registry
 */
export async function fetchOpenAIModels(
  apiKey: string
): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey
    });

    // Fetch available models
    const response = await openai.models.list();

    // Filter and format models
    const models = response.data
      .filter(
        (model) =>
          // Filter for GPT models
          model.id.includes('gpt') ||
          // Include other relevant models as needed
          model.id.includes('text-embedding')
      )
      .map((model) => ({
        id: model.id,
        displayName: model.id,
        description: 'OpenAI language model',
        contextWindow: getContextWindowSize(model.id),
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text']
      }));

    // Register models with the registry
    ModelService.registerModels('openai', models);

    logger.debug(
      LogCategory.LLM,
      '[OpenAIAdapter]',
      `Processed ${models.length} models`
    );

    return ModelService.getModels('openai');
  } catch (error) {
    logger.error(LogCategory.LLM, '[OpenAIAdapter]', 'Error fetching models:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Helper function to determine context window size based on model ID
function getContextWindowSize(modelId: string): number {
  if (modelId.includes('gpt-4-turbo')) return 128000;
  if (modelId.includes('gpt-4-32k')) return 32768;
  if (modelId.includes('gpt-4')) return 8192;
  if (modelId.includes('gpt-3.5-turbo-16k')) return 16384;
  if (modelId.includes('gpt-3.5-turbo')) return 4096;
  return 4096; // Default fallback
}
