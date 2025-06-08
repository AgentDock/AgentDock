import { NextRequest, NextResponse } from 'next/server';
import {
  fetchProviderModels,
  LLMProvider,
  LogCategory,
  logger,
  ProviderRegistry,
  validateProviderApiKey
} from 'agentdock-core';

/**
 * Provider-agnostic models endpoint
 * This endpoint validates API keys and fetches models for any supported provider
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    // Resolve the params Promise
    const { providerId } = await params;

    // Validate provider exists
    const provider = ProviderRegistry.getProvider(providerId as LLMProvider);
    if (!provider) {
      logger.warn(
        LogCategory.API,
        '[ProviderAPI]',
        `Provider not found: ${providerId}`
      );
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        {
          valid: false,
          error: 'API key is required'
        },
        { status: 400 }
      );
    }

    try {
      // Validate the API key
      const isValid = await validateProviderApiKey(
        providerId as LLMProvider,
        apiKey
      );

      if (!isValid) {
        logger.warn(
          LogCategory.API,
          '[ProviderAPI]',
          `Invalid API key for provider: ${providerId}`
        );
        return NextResponse.json(
          {
            valid: false,
            error: 'Invalid API key'
          },
          { status: 401 }
        );
      }

      // Fetch models using the provider-agnostic adapter
      const models = await fetchProviderModels(
        providerId as LLMProvider,
        apiKey
      );
      logger.debug(
        LogCategory.API,
        '[ProviderAPI]',
        `Fetched ${models.length} models for provider: ${providerId}`
      );

      return NextResponse.json({
        valid: true,
        models
      });
    } catch (error) {
      logger.error(
        LogCategory.API,
        '[ProviderAPI]',
        `Error processing request for ${providerId}:`,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      );

      return NextResponse.json(
        {
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error(LogCategory.API, '[ProviderAPI]', 'Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        valid: false,
        error: 'Server error'
      },
      { status: 500 }
    );
  }
}
