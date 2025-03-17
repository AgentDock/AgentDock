/**
 * @fileoverview Centralized service for model management
 * Provides a single point of access for model operations
 */

import { LLMProvider, ModelMetadata, logger, LogCategory } from 'agentdock-core';
import { ModelRegistry } from '@/lib/models/registry';

/**
 * ModelService provides a centralized way to manage models
 * This reduces duplicate API calls and simplifies the UI components
 */
export class ModelService {
  /**
   * Get models for a provider from the registry
   * This does NOT fetch models from the API
   */
  static getModels(provider: LLMProvider): ModelMetadata[] {
    try {
      return ModelRegistry.getModelsForProvider(provider);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error getting models for ${provider}:`, { error });
      return [];
    }
  }
  
  /**
   * Fetch models from the provider API and register them
   * This makes a single API call to the provider-specific endpoint
   */
  static async fetchAndRegisterModels(provider: LLMProvider, apiKey: string): Promise<ModelMetadata[]> {
    try {
      // Call the provider-specific endpoint to fetch and register models
      const response = await fetch(`/api/providers/${provider}/models`, {
        headers: {
          'x-api-key': apiKey
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.valid) {
        throw new Error(data.error || `Invalid ${provider} API key`);
      }
      
      // Return the models from the registry after they've been registered
      return ModelRegistry.getModelsForProvider(provider);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error fetching models for ${provider}:`, { error });
      return [];
    }
  }
  
  /**
   * Reset models for a provider
   * This clears the models from the registry without fetching new ones
   */
  static resetModels(provider: LLMProvider | LLMProvider[]): void {
    try {
      ModelRegistry.resetModels(Array.isArray(provider) ? provider : [provider]);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error resetting models for ${provider}:`, { error });
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
          'x-api-key': apiKey
        },
        cache: 'no-store'
      });
      
      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error validating API key for ${provider}:`, { error });
      return false;
    }
  }
} 