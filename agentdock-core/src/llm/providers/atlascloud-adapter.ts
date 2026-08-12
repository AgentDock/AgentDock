/**
 * @fileoverview Atlas Cloud provider adapter.
 * Handles API key validation and model discovery through the OpenAI-compatible API.
 */

import { LogCategory, logger } from '../../logging';
import { ModelService } from '../model-service';
import { ModelMetadata } from '../types';

const ATLASCLOUD_MODELS_URL = 'https://api.atlascloud.ai/v1/models';

interface AtlasCloudModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  max_output_length?: number;
  output_modalities?: string[];
  supported_features?: string[];
}

async function requestModels(apiKey: string): Promise<AtlasCloudModel[]> {
  const response = await fetch(ATLASCLOUD_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.data)) {
    throw new Error('Invalid response from Atlas Cloud API');
  }

  return payload.data;
}

export async function validateAtlasCloudApiKey(
  apiKey: string
): Promise<boolean> {
  try {
    if (!apiKey) return false;
    await requestModels(apiKey);
    return true;
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[AtlasCloudAdapter]',
      'Error validating API key:',
      { error: error instanceof Error ? error.message : String(error) }
    );
    return false;
  }
}

export async function fetchAtlasCloudModels(
  apiKey: string
): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const models = (await requestModels(apiKey))
      .filter((model) => model.output_modalities?.includes('text'))
      .map((model) => ({
        id: model.id,
        displayName: model.name || model.id,
        description: model.description || 'Atlas Cloud language model',
        contextWindow: model.context_length || 131072,
        defaultTemperature: 0.7,
        defaultMaxTokens: model.max_output_length || 4096,
        capabilities: [
          'text',
          ...(model.supported_features?.includes('tools') ? ['tools'] : [])
        ]
      }));

    ModelService.registerModels('atlascloud', models);
    logger.debug(
      LogCategory.LLM,
      '[AtlasCloudAdapter]',
      `Processed ${models.length} models`
    );

    return ModelService.getModels('atlascloud');
  } catch (error) {
    logger.error(
      LogCategory.LLM,
      '[AtlasCloudAdapter]',
      'Error fetching models:',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}
