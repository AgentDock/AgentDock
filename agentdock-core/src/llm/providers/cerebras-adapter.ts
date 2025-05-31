/**
 * @fileoverview Cerebras provider adapter
 * Handles Cerebras-specific validation and model fetching logic
 */

import { LLMProvider, ModelMetadata } from '../types';
import { ModelService } from '../model-service';
import { logger, LogCategory } from '../../logging';

/**
 * Validate a Cerebras API key by making a request to the Cerebras API
 */
export async function validateCerebrasApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;
    
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    logger.error(LogCategory.LLM, '[CerebrasAdapter]', 'Error validating API key:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Fetch models from the Cerebras API and register them with the model registry
 */
export async function fetchCerebrasModels(apiKey: string): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Fetch models directly from Cerebras API
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response from Cerebras API');
    }

    // Map Cerebras API response to our model format
    const models = data.data.map((model: { id: string; context_window?: number }) => ({
      id: model.id,
      displayName: model.id,
      description: `Context window: ${model.context_window || 'Unknown'}`,
      contextWindow: model.context_window || 16384,
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
      capabilities: ['text']
    }));

    // Register models with the registry
    ModelService.registerModels('cerebras', models);

    logger.debug(LogCategory.LLM, '[CerebrasAdapter]', `Processed ${models.length} models`);

    return ModelService.getModels('cerebras');
  } catch (error) {
    logger.error(LogCategory.LLM, '[CerebrasAdapter]', 'Error fetching models:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
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
