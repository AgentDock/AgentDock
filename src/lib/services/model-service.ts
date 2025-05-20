/**
 * @fileoverview Next.js implementation of the ModelService
 * Extends the core ModelService with Next.js-specific features
 */

import {
  LLMProvider,
  ModelMetadata,
  ModelService as CoreModelService,
  logger,
  LogCategory,
} from 'agentdock-core';

/**
 * Next.js implementation of the ModelService
 * Extends the core ModelService with web fetch capabilities
 */
export class ModelService extends CoreModelService {
  /**
   * Fetch models from the provider API and register them
   * This makes a single API call to the provider-specific endpoint
   */
  static async fetchAndRegisterModels(
    provider: LLMProvider,
    apiKey: string,
  ): Promise<ModelMetadata[]> {
    try {
      // Call the provider-specific endpoint to fetch and register models
      const response = await fetch(`/api/providers/${provider}/models`, {
        headers: {
          'x-api-key': apiKey,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.valid) {
        throw new Error(data.error || `Invalid ${provider} API key`);
      }

      // Return the models from the registry after they've been registered
      return CoreModelService.getModels(provider);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error fetching models for ${provider}:`, {
        error,
      });
      return [];
    }
  }

  /**
   * Validate an API key for a provider
   * This makes a single API call to the provider-specific endpoint
   */
  static async validateApiKey(provider: LLMProvider, apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/providers/${provider}/models`, {
        headers: {
          'x-api-key': apiKey,
        },
        cache: 'no-store',
      });

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error validating API key for ${provider}:`, {
        error,
      });
      return false;
    }
  }
}
