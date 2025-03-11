import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

interface OpenAIModel {
  id: string;
  name: string;
  description?: string;
  context_window: number;
  created: number;
}

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
        .map(model => {
          const formatted: OpenAIModel = {
            id: model.id,
            name: model.id,
            description: 'OpenAI language model',
            context_window: getContextWindowSize(model.id), // Helper function to determine context window
            created: model.created
          };
          return formatted;
        });

      return NextResponse.json({ 
        valid: true,
        models
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
