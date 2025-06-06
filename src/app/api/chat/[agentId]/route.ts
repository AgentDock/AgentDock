/**
 * Vercel AI SDK 4.x API Endpoint
 *
 * This file handles chat API requests using Vercel AI SDK 4.x.
 * We've updated our tooling to work with the new message parts format
 * and client-side tool processing, ensuring compatibility with the latest SDK.
 *
 * Key changes:
 * - Tool calls are now handled through the onToolCall callback on the client
 * - The client makes separate API requests to tools through /api/chat/[agentId]/tools
 * - Messages with tool results are rendered as parts in the UI
 *
 * Security:
 * - Tool endpoint verifies each request has a valid session ID
 * - Requests are validated against allowed origins/referers
 * - Tool calls require authentication tokens in production
 * - Restricted tool categories (file system, shell, etc.) are blocked
 */

/**
 * @fileoverview Chat route handler using the latest Vercel AI SDK patterns.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  APIError,
  ErrorCode,
  LLMProvider,
  loadAgentConfig,
  LogCategory,
  logger,
  Message,
  normalizeError,
  parseProviderError,
  ProviderRegistry
} from 'agentdock-core';
import { streamText } from 'ai';

import { TemplateId, templates } from '@/generated/templates';
// Import and initialize the agent adapter - this ensures all components are properly set up
import { processAgentMessage } from '@/lib/agent-adapter';
import { captureEvent } from '@/lib/analytics';
// Import helpers and adapter from orchestration adapter
import {
  OrchestrationAdapter,
  toMutableConfig
} from '@/lib/orchestration-adapter';
// Import the lazy initialization utility instead
import { ensureToolsInitialized } from '@/lib/tools';
import { getLLMInfo } from '@/lib/utils';
import { getProviderApiKey } from '@/types/env';

// Initialize a simple storage for API keys
const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      // In the future, this could be replaced with a proper storage implementation
      return null;
    } catch (error) {
      console.error(`Error getting storage key ${key}:`, error);
      return null;
    }
  }
};

// Simple utility function to mask sensitive data
function maskSensitiveData(key: string, visibleChars: number = 5): string {
  if (!key) return '';
  return `${key.substring(0, visibleChars)}...`;
}

// Set runtime to Node.js for reliable background processing
export const runtime = 'nodejs';

// Keep dynamic property
export const dynamic = 'force-dynamic';

// For Next.js Edge runtime configuration, we need to export a static value
// The actual value used in the code will be determined by the environment variable
export const maxDuration = 300;

// Check if we're in development mode for extra logging
const isDevelopment = process.env.NODE_ENV === 'development';

// Log runtime configuration
logger.debug(LogCategory.API, 'ChatRoute', 'Route handler initialized', {
  runtime: 'nodejs',
  path: '/api/chat/[agentId]',
  maxDuration: process.env.MAX_DURATION
    ? parseInt(process.env.MAX_DURATION, 10)
    : 300,
  timestamp: new Date().toISOString()
});

// Fallback API key (can be configured via environment variable)
const FALLBACK_API_KEY = process.env.FALLBACK_API_KEY || '';

/**
 * Resolves the API key from various sources in order of priority
 */
async function resolveApiKey(
  request: NextRequest,
  provider: string,
  isByokOnly: boolean
) {
  // Try to get API key from request headers
  let apiKey = request.headers.get('x-api-key');

  // Try to get global settings for API keys
  let globalSettings = null;
  try {
    globalSettings = await storage.get<{
      apiKeys: Record<string, string>;
    }>('global_settings');
  } catch (error) {
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'No global settings found for API keys',
      {
        provider: provider
      }
    );

    if (isDevelopment) {
      console.log('[API KEY DEBUG] No global settings found for API keys');
    }
  }

  // If no per-agent custom API key, try to get from global settings
  if (!apiKey && globalSettings?.apiKeys) {
    apiKey = globalSettings.apiKeys[provider];
    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Using API key from global settings',
      {
        provider: provider,
        hasKey: !!apiKey
      }
    );

    if (isDevelopment) {
      console.log(
        `[API KEY DEBUG] ${apiKey ? 'Found' : 'No'} API key in global settings for ${provider}`
      );
    }
  }

  // If BYOK only mode is enabled and we don't have an API key yet, throw an error
  if (isByokOnly && !apiKey) {
    logger.error(
      LogCategory.API,
      'ChatRoute',
      'API key required (BYOK Only mode is enabled)',
      {
        provider: provider
      }
    );

    if (isDevelopment) {
      console.error(
        '[BYOK ERROR] API key required in BYOK mode, cannot use environment variables'
      );
    }

    throw new APIError(
      'API key is required. In "Bring Your Own Keys Mode", you must provide your own API key in settings.',
      ErrorCode.LLM_API_KEY,
      request.url,
      'POST'
    );
  }

  // If still no API key and BYOK only mode is disabled, try to get from environment variables
  if (!apiKey && !isByokOnly) {
    // Get provider name without the 'llm.' prefix
    const providerName = provider.replace('llm.', '') as LLMProvider;

    // Get API key directly from environment variables
    const envVarMap: Record<string, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      groq: process.env.GROQ_API_KEY
    };

    apiKey = envVarMap[providerName] || null;

    // Log the result (safely)
    if (apiKey) {
      const apiKeyPrefix = apiKey.substring(0, 4);
      const apiKeyLength = apiKey.length;

      logger.debug(
        LogCategory.API,
        'ChatRoute',
        'Using API key from environment variables',
        {
          provider: provider,
          hasKey: true,
          keyPrefix: apiKeyPrefix,
          keyLength: apiKeyLength
        }
      );

      if (isDevelopment) {
        console.log(
          `[API KEY DEBUG] Falling back to environment variable for ${providerName} API key`
        );
      }
    } else {
      // Log more details about environment vars for debugging
      logger.error(
        LogCategory.API,
        'ChatRoute',
        'API key not found in environment variables',
        {
          provider: provider,
          searchedKey: `${providerName.toUpperCase()}_API_KEY`
        }
      );

      if (isDevelopment) {
        console.error(
          `[API KEY DEBUG] No API key found in environment variable ${providerName.toUpperCase()}_API_KEY`
        );
      }
    }
  }

  return apiKey;
}

/**
 * Creates a response from the agent result, adding necessary headers
 */
async function createAgentResponse(
  result: any,
  finalSessionId: string,
  requestStartTime: number,
  agentId: string,
  llmInfo: any,
  llmConfig: any
) {
  // Get data stream response - the error handling is now handled by the agent adapter
  const response = result.toDataStreamResponse();

  // Add token usage headers if available
  const tokenUsage = result.getLastTokenUsage?.();
  if (tokenUsage) {
    response.headers.set('x-token-usage', JSON.stringify(tokenUsage));

    // Add debug log in development
    if (isDevelopment) {
      console.log('[TOKEN DEBUG] Setting token usage header:', tokenUsage);
    }
  }

  // ---- ADD Log and Capture Chat Completion ----
  try {
    const durationMs = Date.now() - requestStartTime;
    // Attempt to get token usage from result.usage (common pattern)
    const tokenUsage = result.usage;

    const properties = {
      agentId,
      sessionId: finalSessionId || 'none',
      durationMs,
      provider: llmInfo.provider,
      model: llmConfig.model
    };

    // Log locally
    logger.info(
      LogCategory.API,
      'ChatRoute',
      'Chat completion successful',
      properties
    );

    // Send analytics event using the analytics module
    if (finalSessionId) {
      captureEvent(
        'chat_completion_successful',
        properties,
        finalSessionId // Use sessionId as the distinct user ID
      );
    } else {
      logger.warn(
        LogCategory.API,
        'ChatRoute',
        'Skipping analytics event capture (no session ID)'
      );
    }
  } catch (logError) {
    // Prevent logging/capture errors from breaking the main response
    console.error('Failed to log/capture chat completion event:', logError);
    logger.error(
      LogCategory.API,
      'ChatRoute',
      'Failed to log/capture chat completion',
      {
        error: logError instanceof Error ? logError.message : String(logError)
      }
    );
  }
  // ---- END Log and Capture ----

  // Add orchestration state from adapter
  const { addOrchestrationHeaders } = await import(
    '@/lib/orchestration-adapter'
  );
  await addOrchestrationHeaders(response, finalSessionId);

  // Ensure streaming isn't terminated early
  response.headers.set('Cache-Control', 'no-cache');
  response.headers.set('Connection', 'keep-alive');

  return response;
}

/**
 * Function to handle direct tool execution
 */
async function handleDirectToolExecution(
  request: NextRequest,
  body: any,
  agentId: string
) {
  try {
    // Extract tool information
    const { toolName, toolCallId, args } = body.executeToolDirectly;

    logger.debug(LogCategory.API, 'ChatRoute', 'Direct tool execution', {
      agentId,
      toolName,
      toolCallId,
      argsKeys: Object.keys(args || {})
    });

    // Get the tool from the registry
    const template = templates[agentId as TemplateId];
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${agentId}` },
        { status: 404 }
      );
    }

    // Get tools for this agent from the nodes array in the template
    const { getToolsForAgent } = await import('@/nodes/registry');
    const nodes = [...template.nodes]; // Convert readonly array to mutable array
    const tools = getToolsForAgent(nodes);
    const tool = tools[toolName];

    if (!tool) {
      logger.error(
        LogCategory.API,
        'ChatRoute',
        `Tool not found: ${toolName}`,
        { agentId }
      );
      return NextResponse.json(
        { error: `Tool '${toolName}' not found` },
        { status: 404 }
      );
    }

    // Execute the tool with provided arguments
    const sessionIdHeader = request.headers.get('x-session-id');
    const result = await tool.execute(args || {}, {
      toolCallId: toolCallId || `call-${Date.now()}`,
      sessionId: sessionIdHeader || 'unknown-session'
    });

    // Track tool usage for orchestration if session ID is available
    if (sessionIdHeader && template && 'orchestration' in template) {
      try {
        // Import the orchestration adapter
        const { trackToolUsage } = await import('@/lib/orchestration-adapter');

        // Convert readonly config to mutable
        const mutableConfig = toMutableConfig(template.orchestration);

        // Track tool usage and get updated state
        await trackToolUsage(sessionIdHeader, toolName, mutableConfig);

        logger.debug(
          LogCategory.API,
          'ChatRoute',
          'Tracked tool usage for orchestration',
          {
            agentId,
            toolName,
            sessionId: sessionIdHeader.substring(0, 8) + '...'
          }
        );
      } catch (error) {
        logger.warn(
          LogCategory.API,
          'ChatRoute',
          'Failed to track tool usage',
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    // Log success
    logger.debug(LogCategory.API, 'ChatRoute', 'Tool execution complete', {
      agentId,
      toolName,
      toolCallId,
      resultType: typeof result
    });

    // Create the response with the tool execution result
    const response = NextResponse.json(result);

    // Add orchestration headers to the response
    if (sessionIdHeader) {
      // Use the orchestration adapter to add headers consistently
      const { addOrchestrationHeaders } = await import(
        '@/lib/orchestration-adapter'
      );
      await addOrchestrationHeaders(response, sessionIdHeader);
    }

    return response;
  } catch (error) {
    // Log error
    logger.error(LogCategory.API, 'ChatRoute', 'Tool execution error', {
      agentId,
      error: error instanceof Error ? error.message : String(error)
    });

    // Return error response
    return NextResponse.json(
      {
        type: 'error',
        content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for chat requests
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  const requestStartTime = Date.now();
  try {
    // Ensure tools are initialized lazily when needed
    ensureToolsInitialized();

    // Get agentId from params (properly awaited)
    const { agentId } = await context.params;
    logger.debug(LogCategory.API, 'ChatRoute', 'Processing chat request', {
      agentId
    });

    // Read the request body only once
    const body = await request.json();

    // Check if this is a direct tool execution request
    if (body.executeToolDirectly) {
      return await handleDirectToolExecution(request, body, agentId);
    }

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

    // Add debug log here
    logger.debug(LogCategory.API, 'ChatRoute', 'Processing chat request', {
      agentId,
      provider: llmInfo.provider
    });

    // Check BYOK mode from request header (set by client from localStorage)
    const byokHeader = request.headers.get('x-byok-mode');
    const byokOnly = byokHeader === 'true';

    if (byokOnly) {
      logger.info(
        LogCategory.API,
        'ChatRoute',
        'BYOK Only mode ENABLED - Will ignore environment variables',
        {
          provider: llmInfo.provider
        }
      );
    }

    // Resolve the API key
    const apiKey = await resolveApiKey(request, llmInfo.provider, byokOnly);

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
    const fallbackApiKey =
      request.headers.get('x-fallback-api-key') || FALLBACK_API_KEY;

    // Log API key prefix for debugging (safely)
    const apiKeyPrefix = maskSensitiveData(apiKey, 8);
    logger.debug(LogCategory.API, 'ChatRoute', 'API key prefix', {
      apiKeyPrefix,
      apiKeyLength: apiKey.length
    });

    if (fallbackApiKey) {
      const fallbackApiKeyPrefix = maskSensitiveData(fallbackApiKey, 8);
      logger.debug(LogCategory.API, 'ChatRoute', 'Fallback API key prefix', {
        fallbackApiKeyPrefix,
        fallbackApiKeyLength: fallbackApiKey.length
      });
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

      logger.debug(
        LogCategory.API,
        'ChatRoute',
        'Created default node configuration',
        {
          provider: llmInfo.provider,
          nodeType,
          config: mutableTemplate.nodeConfigurations[nodeType]
        }
      );
    }

    const config = await loadAgentConfig(mutableTemplate, apiKey);

    // Check if the node configuration exists for the provider
    const llmConfig = config.nodeConfigurations?.[nodeType];
    if (!llmConfig) {
      logger.error(
        LogCategory.API,
        'ChatRoute',
        'LLM configuration not found',
        {
          provider: llmInfo.provider,
          nodeType,
          availableConfigs: Object.keys(config.nodeConfigurations || {})
        }
      );

      throw new APIError(
        'LLM configuration not found',
        ErrorCode.CONFIG_NOT_FOUND,
        request.url,
        'POST',
        { agentId }
      );
    }

    // Parse request body - use the already parsed body
    const {
      messages,
      system,
      sessionId: requestSessionId,
      config: runtimeOverrides
    } = body;

    logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Received messages and runtime overrides',
      {
        messageCount: messages.length,
        hasSessionId: !!requestSessionId,
        hasOverrides: !!runtimeOverrides
      }
    );

    // Get session ID from headers or request body
    const clientSessionId =
      request.headers.get('x-session-id') || requestSessionId;
    const finalSessionId =
      clientSessionId ||
      `session-${agentId}-${Date.now()}-${crypto.randomUUID()}`;

    // Log request details
    const sessionIdDisplay = finalSessionId
      ? `${finalSessionId.substring(0, 12)}...`
      : 'none';
    await logger.debug(
      LogCategory.API,
      'ChatRoute',
      'Processing chat request with final details',
      {
        agentId,
        messageCount: messages.length,
        model: llmConfig.model,
        apiKeyPrefix: maskSensitiveData(apiKey, 8),
        apiKeyLength: apiKey.length,
        hasFallback: !!fallbackApiKey,
        provider: llmInfo.provider,
        sessionId: sessionIdDisplay,
        isNewSession: !clientSessionId
      }
    );

    // Lazy initialize orchestration manager only if the agent uses orchestration
    let orchestrationState = null;
    if (template && 'orchestration' in template && template.orchestration) {
      logger.debug(
        LogCategory.API,
        'ChatRoute',
        'Initializing orchestration for agent with orchestration',
        {
          agentId,
          orchestrationType: typeof template.orchestration,
          hasSteps: !!template.orchestration?.steps?.length
        }
      );

      // Ensure orchestration state is only created if needed
      if (finalSessionId) {
        // Convert readonly config to mutable
        const mutableConfig = toMutableConfig(template.orchestration);

        // Get orchestration state
        orchestrationState = await import('@/lib/orchestration-adapter').then(
          (module) =>
            module.getOrchestrationState(finalSessionId, mutableConfig)
        );

        logger.debug(
          LogCategory.API,
          'ChatRoute',
          'Retrieved orchestration state',
          {
            agentId,
            sessionId: finalSessionId?.substring(0, 8) + '...',
            hasState: !!orchestrationState,
            activeStep: orchestrationState?.activeStep || 'none',
            stateDetails: JSON.stringify(orchestrationState)
          }
        );
      }
    } else {
      // Debug log if template doesn't have orchestration
      logger.debug(
        LogCategory.API,
        'ChatRoute',
        'Agent does not have orchestration configuration',
        {
          agentId,
          hasTemplate: !!template,
          hasOrchestrationProperty: !!(template && 'orchestration' in template)
        }
      );
    }

    try {
      // Process the message using the adapter
      const result = await processAgentMessage({
        agentId,
        messages: messages as Message[],
        sessionId: finalSessionId,
        apiKey,
        provider: llmInfo.provider,
        system,
        config: runtimeOverrides,
        _fallbackApiKey: fallbackApiKey,
        fullAgentConfig: config,
        orchestrationState: orchestrationState
      });

      // Create and return the response with proper headers
      return await createAgentResponse(
        result,
        finalSessionId,
        requestStartTime,
        agentId,
        llmInfo,
        llmConfig
      );
    } catch (error) {
      // Log session-related errors specifically
      if (error instanceof Error && error.message.includes('Session ID')) {
        logger.error(LogCategory.API, 'ChatRoute', 'Session ID error', {
          errorMessage: error.message,
          sessionIdProvided: !!finalSessionId
        });
      }

      // Re-throw for the main error handler
      throw error;
    }
  } catch (error) {
    // Log the error
    logger.error(
      LogCategory.API,
      'ChatRoute',
      'Error processing chat request',
      {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : typeof error
      }
    );

    // Try to parse provider-specific errors if we can identify the provider
    let parsedError = error;
    if (typeof context === 'object' && context.params) {
      try {
        const { agentId } = await context.params;
        const template = templates[agentId as TemplateId];
        if (template) {
          const llmInfo = getLLMInfo(template);
          if (llmInfo && llmInfo.provider) {
            const provider = llmInfo.provider.replace(
              'llm.',
              ''
            ) as LLMProvider;
            const byokHeader = request.headers.get('x-byok-mode');
            parsedError = parseProviderError(
              error,
              provider,
              byokHeader === 'true'
            );
          }
        }
      } catch (parseError) {
        // Just continue with original error if parsing fails
      }
    }

    // Return error response using agentdock-core's normalizeError
    return new Response(JSON.stringify(normalizeError(parsedError)), {
      status: parsedError instanceof APIError ? parsedError.httpStatus : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
