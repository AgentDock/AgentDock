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
    
    if (!provider || (provider !== 'anthropic' && provider !== 'openai')) {
      return NextResponse.json({ 
        error: 'Invalid provider. Must be "anthropic" or "openai".' 
      }, { status: 400 });
    }
    
    // Get models directly from the registry - no fetching
    const models = ModelService.getModels(provider);
    logger.debug(LogCategory.API, '[ModelsAPI]', `Provider: ${provider}, Models: ${models.length}`);
    
    return NextResponse.json({ 
      provider,
      count: models.length,
      models
    });
  } catch (error) {
    logger.error(LogCategory.API, '[ModelsAPI]', 'Error getting models:', { error });
    return NextResponse.json({ 
      error: 'Failed to get models' 
    }, { status: 500 });
  }
} 