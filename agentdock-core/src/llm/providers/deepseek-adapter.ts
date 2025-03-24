/**
 * @fileoverview DeepSeek provider adapter
 * Handles DeepSeek-specific validation and model fetching logic
 */

import { ModelMetadata } from '../types';
import { ModelService } from '../model-service';
import { logger, LogCategory } from '../../logging';
import OpenAI from 'openai';

/**
 * Validate a DeepSeek API key by making a request to the DeepSeek API
 * DeepSeek uses OpenAI-compatible API, so we use the OpenAI client with a custom baseURL
 */
export async function validateDeepSeekApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;
    
    // Create OpenAI client with DeepSeek baseURL
    const deepseek = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
    
    // Try to list models
    const response = await deepseek.models.list();
    return Array.isArray(response.data);
  } catch (error) {
    logger.error(LogCategory.LLM, '[DeepSeekAdapter]', 'Error validating API key:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Fetch models from the DeepSeek API and register them with the model registry
 */
export async function fetchDeepSeekModels(apiKey: string): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Create OpenAI client with DeepSeek baseURL
    const deepseek = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });

    // Fetch available models
    const response = await deepseek.models.list();
    
    // Filter and format models
    const models = response.data
      .map(model => ({
        id: model.id,
        displayName: model.id,
        description: 'DeepSeek language model',
        // Default context window sizes
        contextWindow: model.id.includes('128k') ? 131072 : 32768,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text', 'code']
      }));

    // Register models with the registry
    ModelService.registerModels('deepseek', models);

    logger.debug(LogCategory.LLM, '[DeepSeekAdapter]', `Processed ${models.length} models`);

    return ModelService.getModels('deepseek');
  } catch (error) {
    logger.error(LogCategory.LLM, '[DeepSeekAdapter]', 'Error fetching models:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // If API call fails, provide fallback models
    try {
      const fallbackModels = [
        {
          id: 'deepseek-coder',
          displayName: 'deepseek-coder',
          description: 'DeepSeek Coder model for code generation',
          contextWindow: 32768,
          defaultTemperature: 0.7,
          defaultMaxTokens: 2048,
          capabilities: ['text', 'code']
        },
        {
          id: 'deepseek-chat',
          displayName: 'deepseek-chat',
          description: 'DeepSeek Chat model for general text generation',
          contextWindow: 32768,
          defaultTemperature: 0.7,
          defaultMaxTokens: 2048,
          capabilities: ['text']
        }
      ];
      
      ModelService.registerModels('deepseek', fallbackModels);
      
      logger.warn(
        LogCategory.LLM, 
        '[DeepSeekAdapter]', 
        'Failed to fetch models from API, using fallback models',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      return ModelService.getModels('deepseek');
    } catch {
      throw error;
    }
  }
} 