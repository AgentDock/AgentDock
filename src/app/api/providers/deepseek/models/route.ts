import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ModelRegistry } from '@/lib/models/registry';
import { logger, LogCategory } from 'agentdock-core';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

/**
 * DeepSeek models endpoint
 * This endpoint registers DeepSeek models
 * Since DeepSeek doesn't have a models list endpoint, we hardcode the available models
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

    // Create OpenAI client with DeepSeek base URL
    const deepseek = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });

    try {
      // Validate API key by making a simple request
      // We'll use the models.list endpoint instead of retrieve
      const response = await deepseek.models.list();
      
      // If we get here, the API key is valid
      // Define available DeepSeek models based on the actual response
      const models = response.data.map(model => ({
        id: model.id,
        displayName: model.id === 'deepseek-chat' ? 'DeepSeek Chat' : 'DeepSeek Reasoner',
        description: `DeepSeek ${model.id === 'deepseek-chat' ? 'Chat' : 'Reasoner'} language model`,
        contextWindow: 128000,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text']
      }));

      // Register models with the registry
      ModelRegistry.registerModels('deepseek', models);

      logger.debug(LogCategory.API, 'DeepSeekModelsAPI', `Processed ${models.length} models`);

      return NextResponse.json({ 
        valid: true,
        models: ModelRegistry.getModelsForProvider('deepseek')
      });
    } catch (error) {
      // If the API key is invalid, the request will throw an error
      return NextResponse.json({ 
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ 
      valid: false,
      error: 'Invalid request' 
    }, { status: 400 });
  }
} 