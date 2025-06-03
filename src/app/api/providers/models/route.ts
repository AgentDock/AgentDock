import { NextRequest, NextResponse } from 'next/server';
import { LLMProvider, logger, LogCategory } from 'agentdock-core';
import { ModelService } from '@/lib/services/model-service';

// Do NOT use edge runtime for this route
// export const runtime = 'edge';

/**
 * Generic models endpoint
 * This endpoint ONLY returns models from the registry
 * It does NOT fetch models from provider APIs
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider') as LLMProvider | null;
    
    if (!provider || (provider !== 'anthropic' && provider !== 'openai' && provider !== 'gemini' && provider !== 'deepseek' && provider !== 'groq' && provider !== 'cerebras')) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Invalid provider. Must be "anthropic", "openai", "gemini", "deepseek", "groq" or "cerebras."' 
        }), 
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, must-revalidate'
          }
        }
      );
    }
    
    // Get models directly from the registry - no fetching
    const models = ModelService.getModels(provider);
    logger.debug(LogCategory.API, '[ModelsAPI]', `Provider: ${provider}, Models: ${models.length}`);
    
    return new NextResponse(
      JSON.stringify({ 
        provider,
        count: models.length,
        models
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate'
        }
      }
    );
  } catch (error) {
    logger.error(LogCategory.API, '[ModelsAPI]', 'Error getting models:', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to get models',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate'
        }
      }
    );
  }
} 