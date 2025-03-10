/**
 * @fileoverview Chat route handler using the latest Vercel AI SDK patterns.
 */

import { NextRequest } from 'next/server';
import { 
  APIError, 
  ErrorCode, 
  logger, 
  LogCategory, 
  loadAgentConfig,
  AgentNode
} from 'agentdock-core';
import { maskSensitiveData } from 'agentdock-core/utils/security-utils';
import { templates, TemplateId } from '@/generated/templates';

// Import the agent adapter to ensure the tool registry is set
import '@/lib/agent-adapter';

// Import the initialization module to ensure nodes are registered
import '@/nodes/init';

// Log runtime configuration
console.log('Route Handler Initialized:', {
  runtime: 'edge',
  path: '/api/chat/[agentId]',
  timestamp: new Date().toISOString()
});

export const runtime = 'edge';

// Fallback API key (can be configured via environment variable)
const FALLBACK_API_KEY = process.env.FALLBACK_API_KEY || '';

/**
 * POST handler for chat requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Get agentId from params
    const { agentId } = await params;
    console.log(`Processing request for agent: ${agentId}`);
    
    // Validate template
    const template = templates[agentId as TemplateId];
    if (!template) {
      throw new APIError(
        'Template not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId }
      );
    }

    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      throw new APIError(
        'API key is required',
        ErrorCode.LLM_API_KEY,
        request.url,
        'POST'
      );
    }
    
    // Get provider from template
    const isOpenAI = template.nodes?.includes('llm.openai');
    
    // add debug log here
    logger.debug(LogCategory.API, 'ChatRoute', 'Processing chat request x ', {
      agentId,
      isOpenAI
    });

    // Validate API key format based on provider
    if (isOpenAI) {
      // OpenAI API keys must start with 'sk-' and can have various formats
      if (!apiKey.startsWith('sk-')) {
        throw new APIError(
          'Invalid API key format. OpenAI API keys must start with "sk-"',
          ErrorCode.LLM_API_KEY,
          request.url,
          'POST'
        );
      }
    } else {
      // Anthropic API keys must start with 'sk-ant-'
      if (!apiKey.startsWith('sk-ant-')) {
        throw new APIError(
          'Invalid API key format. Anthropic API keys must start with "sk-ant-"',
          ErrorCode.LLM_API_KEY,
          request.url,
          'POST'
        );
      }
    }
    
    // Get fallback API key from request headers or use default
    const fallbackApiKey = request.headers.get('x-fallback-api-key') || FALLBACK_API_KEY;
    
    // Log API key prefix for debugging (safely)
    const apiKeyPrefix = maskSensitiveData(apiKey, 8);
    console.log(`Using API key: ${apiKeyPrefix}... (length: ${apiKey.length})`);
    
    if (fallbackApiKey) {
      const fallbackApiKeyPrefix = maskSensitiveData(fallbackApiKey, 8);
      console.log(`Fallback API key available: ${fallbackApiKeyPrefix}... (length: ${fallbackApiKey.length})`);
    }

    // Load and validate config
    const config = await loadAgentConfig(template, apiKey);
    const llmNode = isOpenAI ? 'llm.openai' : 'llm.anthropic';
    const llmConfig = config.nodeConfigurations?.[llmNode];
    if (!llmConfig) {
      throw new APIError(
        'LLM configuration not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId }
      );
    }

    // Parse request body
    const { messages, system } = await request.json();
    console.log(`Received ${messages.length} messages`);
    
    // Log request details
    await logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Processing chat request',
      {
        agentId,
        messageCount: messages.length,
        model: llmConfig.model,
        apiKeyPrefix,
        apiKeyLength: apiKey.length,
        hasFallback: !!fallbackApiKey
      }
    );

    // Create the AgentNode instance
    console.log('Creating AgentNode instance...');
    const agent = new AgentNode(`agent-${agentId}`, {
      agentConfig: template,
      apiKey,
      fallbackApiKey,
      provider: isOpenAI ? 'openai' : 'anthropic'
    });
    
    // Handle the message
    const result = await agent.handleMessage({
      messages,
      system,
      onStepFinish: (stepData) => {
        console.log('Step finished:', {
          hasText: !!stepData.text,
          hasToolCalls: !!stepData.toolCalls && stepData.toolCalls.length > 0,
          hasToolResults: !!stepData.toolResults && Object.keys(stepData.toolResults).length > 0,
          finishReason: stepData.finishReason
        });
        
        // If this is a step with tool calls, we want to create a separate message for it
        if (stepData.toolCalls && stepData.toolCalls.length > 0) {
          // The tool calls will be included in the response automatically
          console.log('Step has tool calls:', stepData.toolCalls.length);
        }
        
        // If this is a step with text, we want to create a separate message for it
        if (stepData.text && stepData.text.trim()) {
          console.log('Step has text:', maskSensitiveData(stepData.text, 50));
          
          // We can't directly modify the response here, but we can log the text
          // The client will handle creating separate messages
        }
      }
    });
    
    // Get the response
    const response = result.toDataStreamResponse();
    
    // Get token usage directly from the agent
    const tokenUsage = agent.getLastTokenUsage();
    if (tokenUsage) {
      await logger.info(
        LogCategory.API,
        'ChatRoute',
        'Token usage for request',
        {
          agentId,
          ...tokenUsage // Spread the token usage object for cleaner logging
        }
      );
      
      // Add token usage to response headers
      const headers = new Headers(response.headers);
      headers.set('x-token-usage', JSON.stringify(tokenUsage));
      
      // Create a new response with the updated headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    
    return response;

  } catch (error) {
    console.error('Error in chat route:', error);
    
    // Extract error details
    const errorDetails: Record<string, any> = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: error instanceof APIError ? error.code : 'INTERNAL_ERROR'
    };
    
    // Extract Anthropic-specific error details
    if (error && typeof error === 'object') {
      // Extract common error properties
      if ('status' in error) errorDetails.status = (error as any).status;
      if ('type' in error) errorDetails.type = (error as any).type;
      if ('code' in error) errorDetails.code = (error as any).code;
      if ('stack' in error) errorDetails.stack = (error as any).stack;
      
      // Extract response details if available
      if ('response' in error && (error as any).response) {
        const response = (error as any).response;
        errorDetails.responseStatus = response.status;
        errorDetails.responseStatusText = response.statusText;
        
        // Try to extract response data
        if (response.data) {
          try {
            const data = response.data;
            errorDetails.responseData = data;
            
            // Extract Anthropic error details from response data
            if (data.error) {
              if (data.error.type) errorDetails.errorType = data.error.type;
              if (data.error.message) errorDetails.errorMessage = data.error.message;
            }
          } catch (e) {
            errorDetails.responseDataError = 'Could not process response data';
          }
        }
      }
      
      // Extract details from AgentError
      if ('details' in error && (error as any).details) {
        try {
          const details = (error as any).details;
          errorDetails.errorDetails = details;
          
          // Extract nested error details if available
          if (details.error) {
            errorDetails.nestedError = details.error instanceof Error 
              ? details.error.message 
              : String(details.error);
          }
          
          // Extract additional details
          if (details.details) {
            errorDetails.additionalDetails = details.details;
          }
        } catch (e) {
          errorDetails.detailsError = 'Could not process error details';
        }
      }
    }
    
    // Log detailed error
    console.error('Detailed error:', JSON.stringify(errorDetails, null, 2));
    
    await logger.error(
      LogCategory.API,
      'ChatAPI',
      'Failed to process chat',
      errorDetails
    );

    // Determine user-friendly error message
    let userMessage = 'An error occurred';
    let errorCode = errorDetails.code || errorDetails.errorType || 'UNKNOWN_ERROR';
    
    // Handle specific error types
    if (errorDetails.type === 'rate_limit_error') {
      userMessage = 'Rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT';
    } else if (errorDetails.type === 'overloaded_error') {
      userMessage = 'The service is currently overloaded. Please try again later.';
      errorCode = 'SERVICE_OVERLOADED';
    } else if (errorDetails.status >= 500 && errorDetails.status < 600) {
      userMessage = 'The service is experiencing issues. Please try again later.';
      errorCode = 'SERVICE_ERROR';
    } else if (errorDetails.errorMessage) {
      userMessage = errorDetails.errorMessage;
    } else if (errorDetails.message) {
      userMessage = errorDetails.message;
    }
    
    // For streaming response format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`3:${JSON.stringify({ 
          error: userMessage, 
          code: errorCode,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        })}`));
        controller.close();
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1'
      }
    });
  }
} 