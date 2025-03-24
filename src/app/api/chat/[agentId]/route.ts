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
  AgentNode,
  LLMProvider,
  SecureStorage,
  ProviderRegistry
} from 'agentdock-core';
import { maskSensitiveData } from 'agentdock-core/utils/security-utils';
import { templates, TemplateId } from '@/generated/templates';
import { getLLMInfo } from '@/lib/utils';
import { getProviderApiKey } from '@/types/env';

// Import the agent adapter to ensure the tool registry is set
import '@/lib/agent-adapter';

// Import the initialization module to ensure nodes are registered
import '@/nodes/init';

// Set the runtime to edge
export const runtime = 'edge';

// For Next.js Edge runtime configuration, we need to export a static value
// The actual value used in the code will be determined by the environment variable
export const maxDuration = 300;

// Log runtime configuration
logger.debug(
  LogCategory.API,
  'ChatRoute',
  'Route handler initialized',
  {
    runtime: 'edge',
    path: '/api/chat/[agentId]',
    maxDuration: process.env.MAX_DURATION ? parseInt(process.env.MAX_DURATION, 10) : 300,
    timestamp: new Date().toISOString()
  }
);

// Fallback API key (can be configured via environment variable)
const FALLBACK_API_KEY = process.env.FALLBACK_API_KEY || '';
const storage = SecureStorage.getInstance('agentdock');

/**
 * POST handler for chat requests
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  // Get the actual maxDuration from environment variable if available
  // This is the dynamic approach shown in your example
  const maxDurationValue = process.env.MAX_DURATION 
    ? parseInt(process.env.MAX_DURATION, 10) 
    : 300;
    
  try {
    // Get agentId from params
    const { agentId } = await params;
    logger.debug(LogCategory.API, 'ChatRoute', 'Processing chat request', { agentId });
    
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

    // Get LLM info from template
    const llmInfo = getLLMInfo(template);
    
    // add debug log here
    logger.debug(LogCategory.API, 'ChatRoute', 'Processing chat request', {
      agentId,
      provider: llmInfo.provider
    });

    // =====================================================================
    // API KEY RESOLUTION - Priority order:
    // 1. Per-agent custom API key (from agent settings)
    // 2. Global settings API key
    // 3. Environment variable as fallback
    // =====================================================================
    
    // Try to get API key from request headers (these are set by the client when custom per-agent keys are configured)
    let apiKey = request.headers.get('x-api-key');
    
    // If no per-agent custom API key, try to get from global settings
    if (!apiKey) {
      try {
        const globalSettings = await storage.get<{ apiKeys: Record<string, string> }>("global_settings");
        if (globalSettings?.apiKeys) {
          apiKey = globalSettings.apiKeys[llmInfo.provider];
          logger.debug(LogCategory.API, 'ChatRoute', 'Using API key from global settings', {
            provider: llmInfo.provider,
            hasKey: !!apiKey
          });
        }
      } catch (error) {
        logger.error(LogCategory.API, 'ChatRoute', 'Failed to load global settings', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // If still no API key, try to get from environment variables
    if (!apiKey) {
      // Get provider name without the 'llm.' prefix
      const providerName = llmInfo.provider.replace('llm.', '') as LLMProvider;
      apiKey = getProviderApiKey(providerName);
      
      // Log the result (safely)
      if (apiKey) {
        const apiKeyPrefix = apiKey.substring(0, 4);
        const apiKeyLength = apiKey.length;
        
        logger.debug(LogCategory.API, 'ChatRoute', 'Using API key from environment variables', {
          provider: llmInfo.provider,
          hasKey: true,
          keyPrefix: apiKeyPrefix,
          keyLength: apiKeyLength
        });
      } else {
        // Log more details about environment vars for debugging
        logger.error(LogCategory.API, 'ChatRoute', 'API key not found in environment variables', {
          provider: llmInfo.provider,
          searchedKey: `${providerName.toUpperCase()}_API_KEY`
        });
      }
    }

    // If still no API key, throw error
    if (!apiKey) {
      throw new APIError(
        'API key is required. Please add your API key in settings.',
        ErrorCode.LLM_API_KEY,
        request.url,
        'POST'
      );
    }

    // Validate API key format
    if (!llmInfo.validateApiKey(apiKey)) {
      throw new APIError(
        `Invalid API key format for ${llmInfo.displayName}`,
        ErrorCode.LLM_API_KEY,
        request.url,
        'POST'
      );
    }
    
    // Get fallback API key from request headers or use default
    const fallbackApiKey = request.headers.get('x-fallback-api-key') || FALLBACK_API_KEY;
    
    // Log API key prefix for debugging (safely)
    const apiKeyPrefix = maskSensitiveData(apiKey, 8);
    logger.debug(LogCategory.API, 'ChatRoute', 'API key prefix', { apiKeyPrefix, apiKeyLength: apiKey.length });
    
    if (fallbackApiKey) {
      const fallbackApiKeyPrefix = maskSensitiveData(fallbackApiKey, 8);
      logger.debug(LogCategory.API, 'ChatRoute', 'Fallback API key prefix', { fallbackApiKeyPrefix, fallbackApiKeyLength: fallbackApiKey.length });
    }

    // Load and validate config
    // Create a mutable copy of the template with proper node configurations
    const mutableTemplate = JSON.parse(JSON.stringify(template));
    
    // Get the correct node type from the provider
    const nodeType = ProviderRegistry.getNodeTypeFromProvider(llmInfo.provider);
    
    // Ensure the node configuration exists for the provider
    if (!mutableTemplate.nodeConfigurations) {
      mutableTemplate.nodeConfigurations = {};
    }
    
    if (!mutableTemplate.nodeConfigurations[nodeType]) {
      // Get provider metadata to use default model
      const providerMetadata = ProviderRegistry.getProvider(llmInfo.provider);
      
      mutableTemplate.nodeConfigurations[nodeType] = {
        model: providerMetadata ? providerMetadata.defaultModel : 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048
      };
      
      logger.debug(LogCategory.API, 'ChatRoute', 'Created default node configuration', {
        provider: llmInfo.provider,
        nodeType,
        config: mutableTemplate.nodeConfigurations[nodeType]
      });
    }
    
    const config = await loadAgentConfig(mutableTemplate, apiKey);
    
    // Check if the node configuration exists for the provider
    const llmConfig = config.nodeConfigurations?.[nodeType];
    if (!llmConfig) {
      logger.error(LogCategory.API, 'ChatRoute', 'LLM configuration not found', { 
        provider: llmInfo.provider,
        nodeType,
        availableConfigs: Object.keys(config.nodeConfigurations || {})
      });
      
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
    logger.debug(LogCategory.API, 'ChatRoute', 'Received messages', { messageCount: messages.length });
    
    // No need to filter images - they are now URLs instead of base64 data
    
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
        hasFallback: !!fallbackApiKey,
        provider: llmInfo.provider
      }
    );

    // Create the AgentNode instance
    logger.debug(LogCategory.API, 'ChatRoute', 'Creating AgentNode instance', { agentId });
    const agent = new AgentNode(`agent-${agentId}`, {
      agentConfig: config,
      apiKey,
      fallbackApiKey,
      provider: llmInfo.provider.replace('llm.', '') as LLMProvider // Remove 'llm.' prefix
    });
    
    // Handle the message with the original messages
    const result = await agent.handleMessage({
      messages,
      system,
      onStepFinish: (stepData) => {
        // Check if this is a tool-internal error (from deep research or other tools using LLM)
        if (stepData.finishReason === 'error' && stepData.metadata?.isToolInternalCall) {
          // This is an expected error from a tool using LLM internally
          logger.debug(LogCategory.API, 'ChatRoute', 'Tool internal LLM call completed', {
            toolName: stepData.metadata?.toolName,
            operation: stepData.metadata?.operation
          });
          return; // Skip normal error handling
        }
        
        logger.debug(LogCategory.API, 'ChatRoute', 'Step finished', {
          hasText: !!stepData.text,
          hasToolCalls: !!stepData.toolCalls && stepData.toolCalls.length > 0,
          hasToolResults: !!stepData.toolResults && Object.keys(stepData.toolResults).length > 0,
          finishReason: stepData.finishReason
        });
        
        // If this is a step with tool calls, we want to create a separate message for it
        if (stepData.toolCalls && stepData.toolCalls.length > 0) {
          // The tool calls will be included in the response automatically
          logger.debug(LogCategory.API, 'ChatRoute', 'Step has tool calls', { toolCallCount: stepData.toolCalls.length });
        }
        
        // If this is a step with text, we want to create a separate message for it
        if (stepData.text && stepData.text.trim()) {
          logger.debug(LogCategory.API, 'ChatRoute', 'Step has text', { text: maskSensitiveData(stepData.text, 50) });
          
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
          } catch (parseError) {
              logger.debug(LogCategory.API, 'ChatRoute', 'Failed to parse error response', { error: parseError });
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
        } catch (parseError) {
          logger.debug(LogCategory.API, 'ChatRoute', 'Failed to parse error details', { error: parseError });
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