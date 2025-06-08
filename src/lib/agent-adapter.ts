/**
 * @fileoverview Agent adapter functions for processing message streams
 * Provides a unified interface for handling agent operations
 */

import {
  AgentConfig,
  AgentNode,
  createError,
  ErrorCode,
  getToolRegistry,
  LLMProvider,
  loadAgentConfig,
  LogCategory,
  logger,
  type Message
} from 'agentdock-core';
import { v4 as uuidv4 } from 'uuid';

import { getStreamingErrorMessage, hasStreamingError } from '@/lib/error-utils';
import { getOrchestrationManagerInstance } from '@/lib/orchestration-adapter';
import { ensureToolsInitialized } from '@/lib/tools';

/**
 * Initialize the adapter
 * This should be called at startup
 */
export function initializeAdapter() {
  logger.info(
    LogCategory.API,
    'AgentAdapter',
    'Initializing adapter and registering tools...'
  );

  try {
    // Use the lazy initialization utility to ensure tools are registered
    ensureToolsInitialized();

    // Get tool registry to ensure it's initialized
    const toolRegistry = getToolRegistry();

    // Log initialization
    logger.debug(LogCategory.API, 'AgentAdapter', 'Adapter initialized', {
      toolRegistry: !!toolRegistry
    });
  } catch (error) {
    logger.error(
      LogCategory.API,
      'AgentAdapter',
      'Error initializing adapter',
      { error: error instanceof Error ? error.message : String(error) }
    );

    throw createError(
      'node',
      `Error initializing agent adapter: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.NODE_INITIALIZATION
    );
  }
}

// Do not initialize at module load, defer until needed
// This improves page load performance for pages that don't need tools

// Interface for options passed to processAgentMessage
interface HandleMessageOptions {
  agentId: string;
  messages: Message[];
  sessionId?: string;
  apiKey: string;
  provider: string;
  system?: string | string[];
  // This 'config' holds runtime LLM overrides (temperature, maxTokens etc.)
  config?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
  _fallbackApiKey?: string;
  orchestrationState?: any;
  // The full agent configuration loaded from templates
  fullAgentConfig: AgentConfig;
}

/**
 * Main adapter function to process agent messages.
 *
 * Calls AgentNode.handleMessage and returns the result object containing
 * the live stream and usage promise immediately.
 * The API route is responsible for constructing the StreamingTextResponse.
 */
export async function processAgentMessage(options: HandleMessageOptions) {
  initializeAdapter();

  const {
    agentId,
    messages,
    sessionId,
    apiKey,
    provider,
    system,
    // Rename 'config' to 'runtimeOverrides' for clarity
    config: runtimeOverrides,
    _fallbackApiKey,
    orchestrationState,
    // Get the pre-loaded full agent config
    fullAgentConfig
  } = options;

  logger.debug(
    LogCategory.API,
    'AgentAdapter',
    `Processing agent message for ${agentId}`,
    {
      provider,
      hasSessionId: !!sessionId,
      hasOrchestration: !!orchestrationState
    }
  );

  const finalSessionId = sessionId || uuidv4();
  if (!sessionId) {
    logger.warn(
      LogCategory.API,
      'AgentAdapter',
      'No session ID provided, generated:',
      { finalSessionId }
    );
  }

  const manager = getOrchestrationManagerInstance();

  // Ensure state exists before calling handleMessage
  try {
    await manager.ensureStateExists(finalSessionId);
    logger.debug(
      LogCategory.API,
      'AgentAdapter',
      'ensureStateExists call completed',
      { sessionId: finalSessionId?.substring(0, 8) }
    );
  } catch (initStateError) {
    logger.error(
      LogCategory.API,
      'AgentAdapter',
      'Error during ensureStateExists call',
      {
        sessionId: finalSessionId?.substring(0, 8),
        error:
          initStateError instanceof Error
            ? initStateError.message
            : String(initStateError)
      }
    );
    // Decide if this error should prevent proceeding
  }

  const agent = new AgentNode(agentId, {
    // Pass the full, validated config object received in options
    agentConfig: fullAgentConfig,
    apiKey,
    provider: provider as LLMProvider,
    // Pass specific runtime overrides received in options
    options: runtimeOverrides,
    // Pass fallback API key if available
    ...(_fallbackApiKey ? { fallbackApiKey: _fallbackApiKey } : {})
  });

  try {
    // Call AgentNode.handleMessage to get the stream result object
    // This now returns immediately with the live stream
    const result = await agent.handleMessage({
      messages,
      sessionId: finalSessionId,
      orchestrationManager: manager,
      systemOverride: system,
      ...(runtimeOverrides ? { config: runtimeOverrides } : {}),
      ...(orchestrationState ? { orchestrationState } : {})
    });

    // --- NO Stream Processing or Token Update Here ---

    // Construct the result object for the API route
    // This contains the live stream via result.fullStream
    const enhancedResult = {
      ...result,
      _adapterContext: { sessionId: finalSessionId, agentId },
      // Ensure toDataStreamResponse is available
      toDataStreamResponse(options = {}) {
        return result.toDataStreamResponse({
          ...options,
          getErrorMessage: (error: unknown) => {
            // Basic error message handling
            if (error instanceof Error) return error.message;
            return typeof error === 'string'
              ? error
              : 'Unknown streaming error occurred';
          }
        });
      }
    };

    logger.debug(
      LogCategory.API,
      'AgentAdapter',
      'Successfully processed agent message (returning stream result object)',
      { agentId, sessionId: finalSessionId?.substring(0, 8) }
    );

    // Return the result object containing the LIVE stream immediately
    return enhancedResult;
  } catch (error) {
    logger.error(
      LogCategory.API,
      'AgentAdapter',
      'Error processing agent message (before stream handling)',
      {
        error: error instanceof Error ? error.message : String(error),
        agentId,
        sessionId: finalSessionId?.substring(0, 8)
      }
    );
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(
        `Unknown error during agent processing: ${String(error)}`
      );
    }
  }
}
