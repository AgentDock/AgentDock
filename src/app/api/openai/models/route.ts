import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ModelRegistry } from '@/lib/models/registry';
import { logger, LogCategory } from 'agentdock-core';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

interface OpenAIModel {
  id: string;
  name: string;
  description?: string;
  context_window: number;
  created: number;
}

/**
 * OpenAI models endpoint
 * This endpoint fetches models from OpenAI API and registers them
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

    const openai = new OpenAI({
      apiKey
    });

    try {
      // Fetch available models
      const response = await openai.models.list();
      
      // Filter and format models
      const models = response.data
        .filter(model => 
          // Filter for GPT models
          model.id.includes('gpt') || 
          // Include other relevant models as needed
          model.id.includes('text-embedding')
        )
        .map(model => ({
          id: model.id,
          displayName: model.id,
          description: 'OpenAI language model',
          contextWindow: getContextWindowSize(model.id),
          defaultTemperature: 0.7,
          defaultMaxTokens: 2048,
          capabilities: ['text']
        }));

      // Register models with the registry
      ModelRegistry.registerModels('openai', models);

      logger.debug(LogCategory.API, 'OpenAIModelsAPI', `Processed ${models.length} models`);

      return NextResponse.json({ 
        valid: true,
        models: ModelRegistry.getModelsForProvider('openai')
      });
    } catch (error) {
      // If the API key is invalid, OpenAI will throw an error
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

// Helper function to determine context window size based on model ID
function getContextWindowSize(modelId: string): number {
  if (modelId.includes('gpt-4-turbo')) return 128000;
  if (modelId.includes('gpt-4-32k')) return 32768;
  if (modelId.includes('gpt-4')) return 8192;
  if (modelId.includes('gpt-3.5-turbo-16k')) return 16384;
  if (modelId.includes('gpt-3.5-turbo')) return 4096;
  return 4096; // Default fallback
}
