import { NextRequest } from 'next/server';
import { Message, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { APIError, ErrorCode, logger, LogCategory, loadAgentConfig } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';

// Log runtime configuration
console.log('Route Handler Configuration:', {
  runtime: 'edge',
  path: '/api/chat/[agentId]',
  method: 'POST',
  timestamp: new Date().toISOString()
});

// ============================================================================
// TEMPORARY IMPLEMENTATION FOR V1
// This is a simplified implementation using direct message handling.
// TODO: MIGRATION - This will be replaced with:
// 1. Full CoreMessage type support
// 2. Multi-part message handling
// 3. Provider abstraction
// Reference: plan_refactor.md Phase 1
// ============================================================================

export const runtime = 'edge';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const BACKOFF_FACTOR = 2;

interface RouteContext {
  params: {
    agentId: string;
  }
}

// Helper to delay execution with exponential backoff
const delay = async (attempt: number) => {
  const backoffDelay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, attempt),
    MAX_RETRY_DELAY
  );
  await new Promise(resolve => setTimeout(resolve, backoffDelay));
  return backoffDelay;
};

// Enhanced error type checking
const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  
  const connectionErrors = [
    'ECONNRESET',
    'Failed to fetch',
    'Network error',
    'connection closed',
    'aborted',
    'timeout',
    'network request failed'
  ];
  
  return connectionErrors.some(errMsg => 
    error.message.toLowerCase().includes(errMsg.toLowerCase())
  );
};

// Enhanced retry wrapper with exponential backoff
async function retryStreamText(
  params: Parameters<typeof streamText>[0], 
  retries = MAX_RETRIES,
  attempt = 0
): Promise<ReturnType<typeof streamText>> {
  try {
    return await streamText(params);
  } catch (error) {
    if (isConnectionError(error) && retries > 0) {
      const backoffDelay = await delay(attempt);
      
      await logger.warn(
        LogCategory.API,
        'ChatRoute',
        `Connection error, retrying (${retries} attempts left)`,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          backoffDelay,
          nextAttemptIn: backoffDelay / 1000 + 's'
        }
      );
      
      return retryStreamText(params, retries - 1, attempt + 1);
    }
    
    // Log final retry failure
    if (retries === 0) {
      await logger.error(
        LogCategory.API,
        'ChatRoute',
        'Max retries reached for connection error',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: MAX_RETRIES
        }
      );
    }
    
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Record<string, string | string[]> }
) {
  try {
    // Get agentId from params
    const agentId = context.params.agentId as string;
    if (!agentId) {
      throw new APIError(
        'Agent ID is required',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST'
      );
    }

    // Parse request body
    const { messages, experimental_attachments, id, system } = await request.json();
    
    // Clean agentId and get template
    const cleanAgentId = agentId.split('?')[0] as TemplateId;
    const template = templates[cleanAgentId];
    
    if (!template) {
      throw new APIError(
        'Template not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId: cleanAgentId }
      );
    }
    
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      throw new APIError(
        'API key is required',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST'
      );
    }

    // Validate template and inject API key
    const config = await loadAgentConfig(template, apiKey);
    
    // Get LLM configuration from validated config
    const llmConfig = config.nodeConfigurations?.['llm.anthropic'];
    if (!llmConfig) {
      throw new APIError(
        'LLM configuration not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId: cleanAgentId }
      );
    }

    // Create Anthropic provider with API key
    const anthropicProvider = createAnthropic({ apiKey });

    // Log request
    await logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Processing chat request',
      {
        agentId: cleanAgentId,
        messageCount: messages.length,
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens
      }
    );

    try {
      const result = await retryStreamText({
        model: anthropicProvider(llmConfig.model) as LanguageModelV1,
        messages,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        system: system ?? config.personality,
        ...(experimental_attachments ? { experimental_attachments } : {}),
        async onFinish({ response }) {
          await logger.info(
            LogCategory.API,
            'ChatAPI',
            'Chat completed successfully',
            { 
              id,
              messageCount: response.messages.length,
              hasSystemMessage: !!system
            }
          );
        }
      });

      return result.toDataStreamResponse();
    } catch (error) {
      // Handle connection errors specifically
      if (isConnectionError(error)) {
        await logger.error(
          LogCategory.API,
          'ChatAPI',
          'Connection error during chat after all retries',
          { 
            error: error instanceof Error ? error.message : 'Unknown error',
            agentId: cleanAgentId,
            messageCount: messages.length
          }
        );
        return new Response(
          JSON.stringify({
            error: 'Connection lost. Please check your internet connection and try again.',
            code: 'ECONNRESET',
            retryable: true
          }),
          { status: 503 }
        );
      }
      throw error;
    }
  } catch (error) {
    await logger.error(
      LogCategory.API,
      'ChatAPI',
      'Failed to process chat',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    // Return appropriate error response
    if (error instanceof APIError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          code: error.code,
          retryable: false
        }), 
        { status: error.code === ErrorCode.CONFIG_NOT_FOUND ? 400 : 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your request',
        code: 'INTERNAL_ERROR',
        retryable: false
      }), 
      { status: 500 }
    );
  }
} 