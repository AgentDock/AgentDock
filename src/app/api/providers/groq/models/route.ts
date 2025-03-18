import { NextRequest, NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { ModelRegistry } from '@/lib/models/registry';
import { logger, LogCategory } from 'agentdock-core';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

/**
 * Groq models endpoint
 * This endpoint fetches available models from Groq and registers them
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
      // Fetch models directly from Groq API
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response from Groq API');
      }

      // Map Groq API response to our model format
      const models = data.data.map((model: { id: string; context_window?: number }) => ({
        id: model.id,
        displayName: model.id,
        description: `Context window: ${model.context_window || 'Unknown'}`,
        contextWindow: model.context_window || 8192,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2048,
        capabilities: ['text']
      }));

      // Register models with the registry
      ModelRegistry.registerModels('groq', models);

      logger.debug(LogCategory.API, 'GroqModelsAPI', `Processed ${models.length} models`);

      return NextResponse.json({ 
        valid: true,
        models: ModelRegistry.getModelsForProvider('groq')
      });
    } catch (error) {
      // If the API key is invalid, Groq will throw an error
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