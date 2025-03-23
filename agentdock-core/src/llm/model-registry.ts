/**
 * @fileoverview Model registry for LLM models.
 * Provides a centralized registry for model metadata.
 */

import { LLMProvider, ModelMetadata } from './types';
import { logger, LogCategory } from '../logging';

/**
 * Model registry for the application
 * Centralized registry for model metadata
 */
export class ModelRegistry {
  private static _models: Map<string, ModelMetadata> | null = null;
  private static _modelsByProvider: Map<LLMProvider, string[]> | null = null;

  // Lazy initialization of maps
  private static get models(): Map<string, ModelMetadata> {
    if (!this._models) {
      this._models = new Map();
    }
    return this._models;
  }

  private static get modelsByProvider(): Map<LLMProvider, string[]> {
    if (!this._modelsByProvider) {
      this._modelsByProvider = new Map([
        ['anthropic', []],
        ['openai', []],
        ['gemini', []],
        ['deepseek', []],
        ['groq', []]
      ]);
    }
    return this._modelsByProvider;
  }

  /**
   * Register models with the registry
   * Only updates if models are different from existing ones
   */
  static registerModels(provider: LLMProvider, newModels: ModelMetadata[]): void {
    const currentModels = this.getModelsForProvider(provider);
    
    // If models are the same, skip registration
    if (this.areModelsEqual(currentModels, newModels)) {
      logger.debug(LogCategory.LLM, 'ModelRegistry', `Models unchanged for provider: ${provider}`);
      return;
    }
    
    // Clear existing models only if we have new ones to register
    if (newModels.length > 0) {
      this.clearModelsForProvider(provider);
      
      // Register new models
      newModels.forEach(model => {
        this.models.set(model.id, model);
        const providerModels = this.modelsByProvider.get(provider) || [];
        if (!providerModels.includes(model.id)) {
          providerModels.push(model.id);
          this.modelsByProvider.set(provider, providerModels);
        }
      });
      
      logger.debug(LogCategory.LLM, 'ModelRegistry', `Registered ${newModels.length} models for provider: ${provider}`);
    }
  }

  /**
   * Compare two arrays of models for equality
   */
  private static areModelsEqual(models1: ModelMetadata[], models2: ModelMetadata[]): boolean {
    if (models1.length !== models2.length) return false;
    
    const sortedModels1 = [...models1].sort((a, b) => a.id.localeCompare(b.id));
    const sortedModels2 = [...models2].sort((a, b) => a.id.localeCompare(b.id));
    
    return sortedModels1.every((model, index) => 
      model.id === sortedModels2[index].id &&
      model.displayName === sortedModels2[index].displayName &&
      model.contextWindow === sortedModels2[index].contextWindow
    );
  }

  /**
   * Get model metadata by ID
   */
  static getModel(id: string): ModelMetadata | undefined {
    return this.models.get(id);
  }

  /**
   * Get all models for a provider
   */
  static getModelsForProvider(provider: LLMProvider): ModelMetadata[] {
    const modelIds = this.modelsByProvider.get(provider) || [];
    return modelIds
      .map(id => this.models.get(id))
      .filter(Boolean) as ModelMetadata[];
  }

  /**
   * Get all registered models
   */
  static getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  /**
   * Reset models for specified providers
   * This is the public API for clearing models, which will trigger a re-fetch
   * @param providers Array of providers to reset, or undefined for all providers
   */
  static resetModels(providers?: LLMProvider[]): void {
    const providersToReset = providers || Array.from(this.modelsByProvider.keys());
    
    providersToReset.forEach(provider => {
      this.clearModelsForProvider(provider);
      logger.debug(LogCategory.LLM, 'ModelRegistry', `Reset models for provider: ${provider}`);
    });
  }

  /**
   * Clear all models for a provider
   * @private - Should only be used internally by registerModels and resetModels
   */
  private static clearModelsForProvider(provider: LLMProvider): void {
    const modelIds = this.modelsByProvider.get(provider) || [];
    
    // Remove models from the models map
    modelIds.forEach(id => {
      this.models.delete(id);
    });
    
    // Clear the provider's model list
    this.modelsByProvider.set(provider, []);
    
    logger.debug(LogCategory.LLM, 'ModelRegistry', `Cleared ${modelIds.length} models for provider: ${provider}`);
  }
} 