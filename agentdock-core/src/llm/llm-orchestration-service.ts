/**
 * @fileoverview Service for handling orchestration logic during LLM streaming.
 * Acts as a bridge between AgentNode and CoreLLM.
 */

import { LogCategory, logger } from '../logging';
import { OrchestrationManager } from '../orchestration';
import { AIOrchestrationState } from '../types/orchestration';
import { SessionId } from '../types/session';
import { CoreLLM } from './core-llm';
import {
  AgentDockStreamResult,
  CoreMessage,
  CoreTool,
  FinishReason,
  LanguageModelUsage,
  TextPart,
  ToolCallPart,
  ToolResultPart
} from './index';

// Define a type for the waitUntil function
type WaitUntilFn = (promise: Promise<any>) => void;

// Try to dynamically load Vercel's waitUntil function
let waitUntilFn: WaitUntilFn | null = null;
try {
  // Dynamically try to import Vercel's waitUntil if available (in production)
  // This way we don't add a dependency to agentdock-core
  // @ts-ignore - Ignore TS errors for dynamic require
  const vercelModule = require('@vercel/functions');
  if (vercelModule && typeof vercelModule.waitUntil === 'function') {
    waitUntilFn = vercelModule.waitUntil;
    logger.info(
      LogCategory.LLM,
      'LLMOrchestrationService',
      'Vercel waitUntil function available for background tasks'
    );
  }
} catch (e) {
  // Not in a Vercel environment according to the env variable
  // Only log this in development mode and when not in browser environment
  if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    logger.debug(
      LogCategory.LLM,
      'LLMOrchestrationService',
      `AGENTDOCK_EXECUTION_ENV=${process.env.AGENTDOCK_EXECUTION_ENV || 'not set'}, using fallback for background tasks`
    );
  }
}

/**
 * Safely runs a promise with waitUntil when available, falls back gracefully otherwise
 */
function runBackgroundTask(promise: Promise<any>): void {
  if (waitUntilFn) {
    // Use Vercel's waitUntil if available
    waitUntilFn(promise);
  } else {
    // Fallback for local/non-Vercel: at least start the promise but don't block
    promise.catch((error) => {
      logger.error(
        LogCategory.LLM,
        'LLMOrchestrationService',
        'Background task error',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
    });
  }
}

/**
 * Type definitions based on Vercel AI SDK documentation
 */

// Common TokenUsage type (matches LanguageModelUsage)
type TokenUsage = LanguageModelUsage;

// Type for the argument passed to the streamText onFinish callback
type OnFinishResult = {
  finishReason: FinishReason;
  usage: TokenUsage;
  providerMetadata?: Record<string, Record<string, unknown>> | undefined;
  text: string;
  reasoning?: string | undefined;
  response?: { messages?: CoreMessage[] };
};

// Type for the argument passed to the streamText onStepFinish callback
type OnStepFinishResult = {
  stepType: 'initial' | 'continue' | 'tool-result';
  finishReason: FinishReason;
  usage: TokenUsage;
  text: string;
  reasoning?: string | undefined;
  // Represent toolCalls/toolResults based on typical structure
  toolCalls?: Array<ToolCallPart> | undefined;
  toolResults?: Array<ToolResultPart> | undefined;
  // Additional property added by our CoreLLM wrapper, not native to SDK
  toolNames?: string[];
};

// Combined type for the event passed to our handleStepFinish, including CoreLLM additions
type HandleStepFinishEvent = OnStepFinishResult & {
  toolNames?: string[];
  // Include 'type' as SDK might pass other event types (like 'text-delta') through onStepFinish
  type?: string;
};

/**
 * Options for the streamWithOrchestration method.
 */
interface StreamWithOrchestrationOptions {
  messages: CoreMessage[];
  tools?: Record<string, CoreTool>;
  system?: string;
  model?: any; // Allow passing the model instance if needed by CoreLLM.streamText
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  // Add any other parameters CoreLLM.streamText might accept

  // Optional original callbacks - Use the derived types
  onFinish?: (event: OnFinishResult) => Promise<void> | void;
  onStepFinish?: (event: HandleStepFinishEvent) => Promise<void> | void;
}

/**
 * Service to manage orchestration state updates during an LLM stream.
 */
export class LLMOrchestrationService {
  constructor(
    private llm: CoreLLM,
    private orchestrationManager: OrchestrationManager,
    private sessionId: SessionId
  ) {
    if (!llm || !orchestrationManager || !sessionId) {
      throw new Error(
        'LLMOrchestrationService requires llm, orchestrationManager, and sessionId'
      );
    }
    logger.debug(
      LogCategory.LLM,
      'LLMOrchestrationService',
      'Created instance',
      { sessionId: sessionId?.substring(0, 8) }
    );
  }

  /**
   * Calls CoreLLM.streamText and injects orchestration logic into callbacks.
   */
  async streamWithOrchestration(
    options: StreamWithOrchestrationOptions
  ): Promise<AgentDockStreamResult<Record<string, CoreTool>, any>> {
    logger.debug(
      LogCategory.LLM,
      'LLMOrchestrationService',
      'Calling CoreLLM streamText via service',
      {
        sessionId: this.sessionId?.substring(0, 8),
        options: {
          ...options,
          messages: `[${options.messages.length} messages]`
        }
      }
    );

    // Prepare callbacks
    const handleFinish = async (event: OnFinishResult) => {
      // Expect usage directly on the event object now
      const usage = event?.usage;

      logger.debug(
        LogCategory.LLM,
        'LLMOrchestrationService',
        'onFinish triggered',
        {
          sessionId: this.sessionId?.substring(0, 8),
          finishReason: event?.finishReason,
          usage: !!usage // Log if usage object is present
        }
      );

      // Use waitUntil for token updates if it's available
      // This makes sure the updates complete even after response streaming
      if (usage) {
        this.updateTokenUsage(usage);
      }

      // Call original onFinish if provided
      if (options.onFinish) {
        try {
          await options.onFinish(event);
        } catch (callbackError) {
          logger.error(
            LogCategory.LLM,
            'LLMOrchestrationService',
            'Error in provided onFinish callback',
            {
              sessionId: this.sessionId?.substring(0, 8),
              error:
                callbackError instanceof Error
                  ? callbackError.message
                  : String(callbackError)
            }
          );
        }
      }
    };

    const handleStepFinish = async (event: HandleStepFinishEvent) => {
      // Check if the event contains standardized toolNames from CoreLLM
      const toolNamesFound =
        Array.isArray(event?.toolNames) && event.toolNames.length > 0;

      if (toolNamesFound) {
        logger.debug(
          LogCategory.LLM,
          'LLMOrchestrationService',
          'onStepFinish triggered (found toolNames)',
          {
            sessionId: this.sessionId?.substring(0, 8),
            // Use non-null assertion as toolNamesFound guarantees it exists
            toolNames: event.toolNames!.join(', ')
          }
        );

        // Tool tracking logic
        try {
          // Fetch current state once before the loop
          const currentState = await this.orchestrationManager.getState(
            this.sessionId
          );
          let currentTools = currentState?.recentlyUsedTools || [];
          let updated = false;

          // Iterate through all tools found in this step
          // Use non-null assertion as toolNamesFound guarantees it exists
          for (const toolName of event.toolNames!) {
            if (
              toolName &&
              typeof toolName === 'string' &&
              !currentTools.includes(toolName)
            ) {
              currentTools = [...currentTools, toolName]; // Update local copy
              updated = true;
              logger.info(
                LogCategory.LLM,
                'LLMOrchestrationService',
                'Tracking new tool from onStepFinish',
                {
                  sessionId: this.sessionId?.substring(0, 8),
                  toolName: toolName
                }
              );
            }
          }

          // If any new tools were added, update the state in storage
          if (updated) {
            await this.orchestrationManager.updateState(this.sessionId, {
              recentlyUsedTools: currentTools
            });
            logger.info(
              LogCategory.LLM,
              'LLMOrchestrationService',
              'Updated recentlyUsedTools in storage',
              {
                sessionId: this.sessionId?.substring(0, 8),
                updatedToolList: currentTools
              }
            );
          }
        } catch (error) {
          logger.error(
            LogCategory.LLM,
            'LLMOrchestrationService',
            'Error tracking executed tools in onStepFinish',
            {
              sessionId: this.sessionId?.substring(0, 8),
              // Use non-null assertion as toolNamesFound guarantees it exists
              toolNames: event.toolNames!.join(', '),
              error: error instanceof Error ? error.message : String(error)
            }
          );
        }
      } else {
        // Log other step types if needed for debugging
        logger.debug(
          LogCategory.LLM,
          'LLMOrchestrationService',
          'onStepFinish triggered (no toolNames found)',
          {
            sessionId: this.sessionId?.substring(0, 8),
            eventType: event?.type ?? 'unknown',
            eventKeys: event ? Object.keys(event) : 'N/A' // Log keys for inspection
          }
        );
      }

      // Call original onStepFinish regardless of event content,
      // as the consumer might need other event types
      if (options.onStepFinish) {
        try {
          await options.onStepFinish(event);
        } catch (callbackError) {
          logger.error(
            LogCategory.LLM,
            'LLMOrchestrationService',
            'Error in provided onStepFinish callback',
            {
              sessionId: this.sessionId?.substring(0, 8),
              error:
                callbackError instanceof Error
                  ? callbackError.message
                  : String(callbackError)
            }
          );
        }
      }
    };

    // Call the CoreLLM streamText method with injected callbacks
    try {
      // Clone options to avoid modifying the original
      const enhancedOptions = { ...options };

      // Add LLM context to tools if they exist
      if (enhancedOptions.tools && typeof enhancedOptions.tools === 'object') {
        // Create a new tools object to avoid modifying the original
        const wrappedTools: Record<string, any> = {};

        // Process each tool
        Object.entries(enhancedOptions.tools).forEach(([name, tool]) => {
          if (tool) {
            // Create wrapped tool with enhanced execute function
            wrappedTools[name] = {
              ...tool,
              execute: async (params: any, execOptions: any) => {
                // Add LLM context to execution options
                const enhancedExecOptions = {
                  ...execOptions,
                  llmContext: {
                    ...(execOptions.llmContext || {}),
                    llm: this.llm, // Provide the CoreLLM instance
                    provider: this.llm.getProvider(),
                    model: this.llm.getModelId()
                  }
                };

                // Call original execute with enhanced options
                // Add type guard to ensure execute exists and is a function
                if (tool.execute && typeof tool.execute === 'function') {
                  return tool.execute(params, enhancedExecOptions);
                }

                // Fallback in case execute is not a function
                throw new Error(
                  `Tool ${name} does not have a valid execute function`
                );
              }
            };
          }
        });

        // Replace tools with wrapped version
        enhancedOptions.tools = wrappedTools;
      }

      const result = await this.llm.streamText({
        ...enhancedOptions,
        onFinish: handleFinish,
        onStepFinish: handleStepFinish
      });
      // Keep cast to any for the return type for now, as StreamTextResult structure is complex
      return result as any;
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'LLMOrchestrationService',
        'Error calling CoreLLM.streamText',
        {
          sessionId: this.sessionId?.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Updates token usage in the session state.
   * Uses waitUntil when available to ensure the update completes.
   */
  private updateTokenUsage(usage: TokenUsage): void {
    // Create the token update promise
    const updatePromise = this.performTokenUsageUpdate(usage);

    // Use the background task runner which will use waitUntil if available
    runBackgroundTask(updatePromise);

    logger.debug(
      LogCategory.LLM,
      'LLMOrchestrationService',
      'Token usage update started',
      {
        sessionId: this.sessionId?.substring(0, 8),
        usingWaitUntil: !!waitUntilFn
      }
    );
  }

  /**
   * Performs the actual token usage update operation.
   */
  private async performTokenUsageUpdate(usage: TokenUsage): Promise<void> {
    try {
      // Get current state
      const currentState = await this.orchestrationManager.getState(
        this.sessionId
      );
      const currentUsage = currentState?.cumulativeTokenUsage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };

      // Calculate new totals
      const promptTokensToAdd =
        typeof usage.promptTokens === 'number' ? usage.promptTokens : 0;
      const completionTokensToAdd =
        typeof usage.completionTokens === 'number' ? usage.completionTokens : 0;
      const totalTokensToAdd =
        typeof usage.totalTokens === 'number' ? usage.totalTokens : 0;

      const newUsage = {
        promptTokens: (currentUsage.promptTokens || 0) + promptTokensToAdd,
        completionTokens:
          (currentUsage.completionTokens || 0) + completionTokensToAdd,
        totalTokens: (currentUsage.totalTokens || 0) + totalTokensToAdd
      };

      // Update the state with new token usage
      await this.orchestrationManager.updateState(this.sessionId, {
        cumulativeTokenUsage: newUsage
      });

      logger.info(
        LogCategory.LLM,
        'LLMOrchestrationService',
        'Token usage updated successfully',
        {
          sessionId: this.sessionId?.substring(0, 8),
          newTotals: newUsage
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'LLMOrchestrationService',
        'Error updating token usage',
        {
          sessionId: this.sessionId?.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
}

// Helper type for streamText options
type StreamTextOptions = Parameters<typeof CoreLLM.prototype.streamText>[0];
