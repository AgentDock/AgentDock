import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

interface AnthropicModel {
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

    const anthropic = new Anthropic({
      apiKey
    });

    try {
      // Fetch available models
      const response = await anthropic.models.list();
      
      // Filter and format models
      const models = response.data
        .filter(model => model.id.startsWith('claude'))
        .map(model => {
          const formatted: AnthropicModel = {
            id: model.id,
            name: model.id, // Use id as name since Anthropic doesn't provide a display name
            description: 'Anthropic Claude language model',
            context_window: 100000, // Default context window size
            created: Math.floor(Date.now() / 1000) // Current timestamp since Anthropic doesn't provide creation date
          };
          return formatted;
        });

      return NextResponse.json({ 
        valid: true,
        models
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