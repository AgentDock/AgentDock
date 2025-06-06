/**
 * @fileoverview Anthropic provider adapter
 * Handles Anthropic-specific validation and model fetching logic
 */

import Anthropic from '@anthropic-ai/sdk';

import { LogCategory, logger } from '../../logging';
import { ModelService } from '../model-service';
import { ModelMetadata } from '../types';

/**
 * Validate an Anthropic API key by making a request to the Anthropic API
 */
export async function validateAnthropicApiKey(
  apiKey: string
): Promise<boolean> {
  try {
    if (!apiKey) return false;

    // Verify API key format
    if (!apiKey.startsWith('sk-ant-')) {
      logger.warn(
        LogCategory.LLM,
        '[AnthropicAdapter]',
        'Invalid API key format',
        {
          keyPrefix: apiKey.substring(0, 6) + '...'
        }
      );
      return false;
    }

    // Create Anthropic client
    const anthropic = new Anthropic({
      apiKey
    });

    // Try to list models
    const response = await anthropic.models.list();
    return Array.isArray(response.data);
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[AnthropicAdapter]',
      'Error validating API key:',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    return false;
  }
}

/**
 * Fetch models from the Anthropic API and register them with the model registry
 */
export async function fetchAnthropicModels(
  apiKey: string
): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Create Anthropic client
    const anthropic = new Anthropic({
      apiKey
    });

    // Fetch available models
    const response = await anthropic.models.list();

    // Filter and format models
    const models = response.data
      .filter((model) => model.id.startsWith('claude'))
      .map((model) => ({
        id: model.id,
        displayName: model.id, // Use id as name since Anthropic doesn't provide a display name
        description: 'Anthropic Claude language model',
        contextWindow: 100000, // Default context window size
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text']
      }));

    // Register models with the registry
    ModelService.registerModels('anthropic', models);

    logger.debug(
      LogCategory.LLM,
      '[AnthropicAdapter]',
      `Processed ${models.length} models`
    );

    return ModelService.getModels('anthropic');
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[AnthropicAdapter]',
      'Error fetching models:',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}
