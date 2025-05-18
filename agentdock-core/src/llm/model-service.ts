/**
 * @fileoverview Centralized service for model management
 * Provides a single point of access for model operations
 */

import { LLMProvider, ModelMetadata } from './types';
import { ModelRegistry } from './model-registry';
import { logger, LogCategory } from '../logging';

/**
 * ModelService provides a centralized way to manage models
 * This is designed to be framework-agnostic
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
      logger.error(LogCategory.LLM, '[ModelService]', `Error getting models for ${provider}:`, {
        error,
      });
      return [];
    }
  }

  /**
   * Register models for a provider
   * This is used by implementations to register models fetched from the API
   */
  static registerModels(provider: LLMProvider, models: ModelMetadata[]): void {
    try {
      ModelRegistry.registerModels(provider, models);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error registering models for ${provider}:`, {
        error,
      });
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
      logger.error(LogCategory.LLM, '[ModelService]', `Error resetting models for ${provider}:`, {
        error,
      });
    }
  }

  /**
   * Get a model by ID
   */
  static getModel(modelId: string): ModelMetadata | undefined {
    try {
      return ModelRegistry.getModel(modelId);
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', `Error getting model ${modelId}:`, { error });
      return undefined;
    }
  }

  /**
   * Get all registered models
   */
  static getAllModels(): ModelMetadata[] {
    try {
      return ModelRegistry.getAllModels();
    } catch (error) {
      logger.error(LogCategory.LLM, '[ModelService]', 'Error getting all models:', { error });
      return [];
    }
  }
}
