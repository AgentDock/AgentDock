/**
 * @fileoverview Groq provider adapter
 * Handles Groq-specific validation and model fetching logic
 */

import { LogCategory, logger } from '../../logging';
import { ModelService } from '../model-service';
import { LLMProvider, ModelMetadata } from '../types';

/**
 * Validate a Groq API key by making a request to the Groq API
 */
export async function validateGroqApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[GroqAdapter]',
      'Error validating API key:',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    return false;
  }
}

/**
 * Fetch models from the Groq API and register them with the model registry
 */
export async function fetchGroqModels(
  apiKey: string
): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Fetch models directly from Groq API
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response from Groq API');
    }

    // Map Groq API response to our model format
    const models = data.data.map(
      (model: { id: string; context_window?: number }) => ({
        id: model.id,
        displayName: model.id,
        description: `Context window: ${model.context_window || 'Unknown'}`,
        contextWindow: model.context_window || 8192,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text']
      })
    );

    // Register models with the registry
    ModelService.registerModels('groq', models);

    logger.debug(
      LogCategory.LLM,
      '[GroqAdapter]',
      `Processed ${models.length} models`
    );

    return ModelService.getModels('groq');
  } catch (error) {
    logger.error(LogCategory.LLM, '[GroqAdapter]', 'Error fetching models:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
