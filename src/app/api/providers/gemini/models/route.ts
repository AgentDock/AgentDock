import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ModelRegistry } from '@/lib/models/registry';
import { logger, LogCategory } from 'agentdock-core';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

/**
 * Gemini models endpoint
 * This endpoint fetches models from Google Generative AI API programmatically
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ 
        valid: false,
        error: 'API key is required' 
      }, { status: 400 });
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
      ModelRegistry.registerModels('gemini', models);

      logger.debug(LogCategory.API, 'GeminiModelsAPI', `Fetched and processed ${models.length} models from Google AI API`);

      return NextResponse.json({ 
        valid: true,
        models: ModelRegistry.getModelsForProvider('gemini')
      });
    } catch (error) {
      console.error('Error fetching models:', error);
      
      // If API call fails, try validating with a single model call
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
        await model.generateContent('Test');
        
        // If validation succeeds but API call failed, return a minimal set of models
        const fallbackModels = [
          {
            id: 'gemini-1.5-pro-latest',
            displayName: 'gemini-1.5-pro-latest', // Use exact model ID
            description: 'Latest version of Gemini 1.5 Pro',
            contextWindow: 2000000,
            defaultTemperature: 1.0,
            defaultMaxTokens: 8192,
            capabilities: ['text', 'image', 'code', 'reasoning']
          },
          {
            id: 'gemini-2.0-flash-exp',
            displayName: 'gemini-2.0-flash-exp', // Use exact model ID
            description: 'Experimental version of Gemini 2.0 Flash',
            contextWindow: 1048576,
            defaultTemperature: 1.0,
            defaultMaxTokens: 8192,
            capabilities: ['text', 'image', 'code', 'reasoning']
          }
        ];
        
        ModelRegistry.registerModels('gemini', fallbackModels);
        
        logger.warn(
          LogCategory.API, 
          'GeminiModelsAPI', 
          'Failed to fetch models from API, using fallback models',
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
        
        return NextResponse.json({ 
          valid: true,
          models: ModelRegistry.getModelsForProvider('gemini'),
          warning: 'Using fallback models due to API error'
        });
      } catch (validationError) {
        // If validation also fails, the API key is likely invalid
        return NextResponse.json({ 
          valid: false,
          error: validationError instanceof Error ? validationError.message : 'Invalid API key'
        }, { status: 401 });
      }
    }
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ 
      valid: false,
      error: 'Invalid request' 
    }, { status: 400 });
  }
} 