/**
 * @fileoverview Google Gemini provider adapter
 * Handles Gemini-specific validation and model fetching logic
 */

import { ModelMetadata } from '../types';
import { ModelService } from '../model-service';
import { logger, LogCategory } from '../../logging';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Validate a Gemini API key by making a request to the Google API
 */
export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    if (!apiKey) return false;
    
    // Try a direct API call to models endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (response.ok) {
      return true;
    }
    
    // If that fails, try using the SDK with a test model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    // Make a simple request to validate the API key
    await model.generateContent('Test');
    return true;
  } catch (error) {
    logger.error(LogCategory.LLM, '[GeminiAdapter]', 'Error validating API key:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Fetch models from the Gemini API and register them with the model registry
 */
export async function fetchGeminiModels(apiKey: string): Promise<ModelMetadata[]> {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    try {
      // Fetch models directly from Google AI API using native fetch
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract models from response
      const googleModels = data.models || [];
      
      // Filter for Gemini models only
      const geminiModels = googleModels.filter((model: any) => 
        model.name.includes('gemini')
      );

      // Map to our model format
      const models = geminiModels.map((model: any) => {
        const modelId = model.name.split('/').pop();
        
        // Determine capabilities based on model name
        const capabilities = ['text'];
        if (modelId.includes('pro') || modelId.includes('flash')) {
          capabilities.push('code', 'reasoning');
        }
        if (modelId.includes('vision') || modelId.includes('pro') || modelId.includes('flash')) {
          capabilities.push('image');
        }
        
        // Determine context window based on model version
        let contextWindow = 32768; // Default
        if (modelId.includes('1.5')) {
          contextWindow = modelId.includes('pro') ? 2000000 : 1000000;
        } else if (modelId.includes('2.0')) {
          contextWindow = 1048576;
        }
        
        return {
          id: modelId,
          displayName: modelId, // Use exact model ID as display name
          description: model.description || `Google ${modelId} model`,
          contextWindow: contextWindow,
          defaultTemperature: 1.0,
          defaultMaxTokens: 8192,
          capabilities: capabilities
        };
      });

      // Register models with the registry
      ModelService.registerModels('gemini', models);

      logger.debug(LogCategory.LLM, '[GeminiAdapter]', `Fetched and processed ${models.length} models from Google AI API`);

      return ModelService.getModels('gemini');
    } catch (error) {
      logger.error(LogCategory.LLM, '[GeminiAdapter]', 'Error fetching models from API', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If API call fails, provide fallback models
      const fallbackModels = [
        {
          id: 'gemini-1.5-pro-latest',
          displayName: 'gemini-1.5-pro-latest',
          description: 'Latest version of Gemini 1.5 Pro',
          contextWindow: 2000000,
          defaultTemperature: 1.0,
          defaultMaxTokens: 8192,
          capabilities: ['text', 'image', 'code', 'reasoning']
        },
        {
          id: 'gemini-2.0-flash-exp',
          displayName: 'gemini-2.0-flash-exp',
          description: 'Experimental version of Gemini 2.0 Flash',
          contextWindow: 1048576,
          defaultTemperature: 1.0,
          defaultMaxTokens: 8192,
          capabilities: ['text', 'image', 'code', 'reasoning']
        }
      ];
      
      ModelService.registerModels('gemini', fallbackModels);
      
      logger.warn(
        LogCategory.LLM, 
        '[GeminiAdapter]', 
        'Failed to fetch models from API, using fallback models',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      return ModelService.getModels('gemini');
    }
  } catch (error) {
    logger.error(LogCategory.LLM, '[GeminiAdapter]', 'Error fetching models:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
} 