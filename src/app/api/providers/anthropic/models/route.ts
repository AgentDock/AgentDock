import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ModelRegistry } from '@/lib/models/registry';
import { logger, LogCategory } from 'agentdock-core';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

interface AnthropicModel {
  id: string;
  name: string;
  description?: string;
  context_window: number;
  created: number;
}

/**
 * Anthropic models endpoint
 * This endpoint fetches models from Anthropic API and registers them
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

    const anthropic = new Anthropic({
      apiKey
    });

    try {
      // Fetch available models
      const response = await anthropic.models.list();
      
      // Filter and format models
      const models = response.data
        .filter(model => model.id.startsWith('claude'))
        .map(model => ({
          id: model.id,
          displayName: model.id, // Use id as name since Anthropic doesn't provide a display name
          description: 'Anthropic Claude language model',
          contextWindow: 100000, // Default context window size
          defaultTemperature: 0.7,
          defaultMaxTokens: 2048,
          capabilities: ['text']
        }));

      // Register models with the registry
      ModelRegistry.registerModels('anthropic', models);

      logger.debug(LogCategory.API, 'AnthropicModelsAPI', `Processed ${models.length} models`);

      return NextResponse.json({ 
        valid: true,
        models: ModelRegistry.getModelsForProvider('anthropic')
      });
    } catch (error) {
      // If the API key is invalid, Anthropic will throw an error
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