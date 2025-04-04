/**
 * @fileoverview Service for handling orchestration logic during LLM streaming.
 * Acts as a bridge between AgentNode and CoreLLM.
 */

import { CoreLLM } from './core-llm';
import { OrchestrationManager } from '../orchestration';
import { SessionId } from '../types/session';
import { AIOrchestrationState } from '../types/orchestration';
import { 
  AgentDockStreamResult, 
  CoreMessage, 
  CoreTool, 
  LanguageModelUsage,
  FinishReason,
  ToolResultPart,
  TextPart,
  ToolCallPart
} from './index';
import { logger, LogCategory } from '../logging';

// --- BEGIN TYPE DEFINITIONS from Vercel AI SDK Docs ---

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
  stepType: "initial" | "continue" | "tool-result";
  finishReason: FinishReason;
  usage: TokenUsage;
  text: string;
  reasoning?: string | undefined;
  // Represent toolCalls/toolResults based on typical structure
  toolCalls?: Array<ToolCallPart> | undefined;
  toolResults?: Array<ToolResultPart> | undefined;
  // IMPORTANT: toolNames is added by our CoreLLM wrapper, not native to SDK
  toolNames?: string[];
};

// Combined type for the event passed to our handleStepFinish, including CoreLLM additions
type HandleStepFinishEvent = OnStepFinishResult & { 
    toolNames?: string[]; 
    // Include 'type' as SDK might pass other event types (like 'text-delta') through onStepFinish
    type?: string; 
};

// --- END TYPE DEFINITIONS ---

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
        throw new Error('LLMOrchestrationService requires llm, orchestrationManager, and sessionId');
    }
    logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'Created instance', { sessionId: sessionId?.substring(0, 8) });
  }

  /**
   * Calls CoreLLM.streamText and injects orchestration logic into callbacks.
   */
  async streamWithOrchestration(
    options: StreamWithOrchestrationOptions
  ): Promise<AgentDockStreamResult<Record<string, CoreTool>, any>> {
    
    logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'Calling CoreLLM streamText via service', { 
      sessionId: this.sessionId?.substring(0, 8), 
      options: { ...options, messages: `[${options.messages.length} messages]` } 
    });

    // Prepare callbacks
    const handleFinish = async (event: OnFinishResult) => {
      // Expect usage directly on the event object now
      const usage = event?.usage;
      
      logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'onFinish triggered', {
        sessionId: this.sessionId?.substring(0, 8),
        finishReason: event?.finishReason,
        usage: !!usage // Log if usage object is present
      });
      
      // Update orchestration state using the usage object from the event
      await this.updateTokenUsage(usage);
      
      // Call original onFinish if provided
      if (options.onFinish) {
        try { await options.onFinish(event); } catch (callbackError) {
            logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error in provided onFinish callback', { 
              sessionId: this.sessionId?.substring(0, 8),
              error: callbackError instanceof Error ? callbackError.message : String(callbackError)
            });
        }
      }
    };
    
    const handleStepFinish = async (event: HandleStepFinishEvent) => {
        // Check if the event contains standardized toolNames from CoreLLM
        const toolNamesFound = Array.isArray(event?.toolNames) && event.toolNames.length > 0;
        
        if (toolNamesFound) {
            logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'onStepFinish triggered (found toolNames)', { 
              sessionId: this.sessionId?.substring(0, 8),
              // Use non-null assertion as toolNamesFound guarantees it exists
              toolNames: event.toolNames!.join(', ') 
            });

            // ---> BEGIN TOOL TRACKING (Revised) <----
            try {
              // Fetch current state once before the loop
              const currentState = await this.orchestrationManager.getState(this.sessionId);
              let currentTools = currentState?.recentlyUsedTools || [];
              let updated = false;

              // Iterate through all tools found in this step
              // Use non-null assertion as toolNamesFound guarantees it exists
              for (const toolName of event.toolNames!) {
                if (toolName && typeof toolName === 'string' && !currentTools.includes(toolName)) {
                  currentTools = [...currentTools, toolName]; // Update local copy
                  updated = true;
                  logger.info(LogCategory.LLM, 'LLMOrchestrationService', 'Tracking new tool from onStepFinish', {
                    sessionId: this.sessionId?.substring(0, 8),
                    toolName: toolName
                  });
                }
              }
              
              // If any new tools were added, update the state in storage
              if (updated) {
                await this.orchestrationManager.updateState(this.sessionId, { recentlyUsedTools: currentTools });
                logger.info(LogCategory.LLM, 'LLMOrchestrationService', 'Updated recentlyUsedTools in storage', {
                  sessionId: this.sessionId?.substring(0, 8),
                  updatedToolList: currentTools
                });
              }
            } catch (error) {
              logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error tracking executed tools in onStepFinish', { 
                sessionId: this.sessionId?.substring(0, 8),
                // Use non-null assertion as toolNamesFound guarantees it exists
                toolNames: event.toolNames!.join(', '),
                error: error instanceof Error ? error.message : String(error)
              });
            }
            // ---> END TOOL TRACKING (Revised) <----
        } else {
            // Log other step types if needed for debugging
            logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'onStepFinish triggered (no toolNames found)', { 
              sessionId: this.sessionId?.substring(0, 8),
              eventType: event?.type ?? 'unknown',
              eventKeys: event ? Object.keys(event) : 'N/A' // Log keys for inspection
            });
        }
        
        // Call original onStepFinish regardless of event content,
        // as the consumer might need other event types
        if (options.onStepFinish) {
          try { await options.onStepFinish(event); } catch (callbackError) {
              logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error in provided onStepFinish callback', { 
                sessionId: this.sessionId?.substring(0, 8),
                error: callbackError instanceof Error ? callbackError.message : String(callbackError)
              });
          }
        }
    };

    // Call the CoreLLM streamText method with injected callbacks
    try {
      const result = await this.llm.streamText({
        ...options,
        // Remove model property - CoreLLM knows its model
        onFinish: handleFinish,
        onStepFinish: handleStepFinish, 
      });
      // Keep cast to any for the return type for now, as StreamTextResult structure is complex
      return result as any; 
    } catch (error) {
       logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error calling CoreLLM.streamText', { 
          sessionId: this.sessionId?.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        });
       throw error;
    }
  }

  /**
   * Updates token usage in the session state.
   * Called from the onFinish callback.
   */
  private async updateTokenUsage(usage?: TokenUsage): Promise<void> {
    if (!usage) return;

    logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'updateTokenUsage called', { 
      sessionId: this.sessionId?.substring(0, 8), 
      usage 
    });
    
    // Logic to get current state and update cumulativeTokenUsage
    // using this.orchestrationManager and this.sessionId
    // (Moved from AgentNode.handleMessage onFinish)
    try {
      const currentState = await this.orchestrationManager.getState(this.sessionId);
      const currentUsage = currentState?.cumulativeTokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      // Ensure usage properties are treated as numbers
      const promptTokensToAdd = typeof usage.promptTokens === 'number' ? usage.promptTokens : 0;
      const completionTokensToAdd = typeof usage.completionTokens === 'number' ? usage.completionTokens : 0;
      const totalTokensToAdd = typeof usage.totalTokens === 'number' ? usage.totalTokens : 0;
      
      const newUsage = {
        promptTokens: (currentUsage.promptTokens || 0) + promptTokensToAdd,
        completionTokens: (currentUsage.completionTokens || 0) + completionTokensToAdd,
        totalTokens: (currentUsage.totalTokens || 0) + totalTokensToAdd,
      };
      await this.orchestrationManager.updateState(this.sessionId, { cumulativeTokenUsage: newUsage });
      logger.info(LogCategory.LLM, 'LLMOrchestrationService', 'Token usage updated', {
        sessionId: this.sessionId?.substring(0, 8),
        newTotals: newUsage
      });
    } catch (error) {
       logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error updating token usage', { 
        sessionId: this.sessionId?.substring(0, 8),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // REMOVED: Unreliable tool tracking logic
  /*
  private async trackExecutedTools(messages?: CoreMessage[]): Promise<void> {
    if (!messages || !Array.isArray(messages)) return;

    logger.debug(LogCategory.LLM, 'LLMOrchestrationService', 'trackExecutedTools called', { 
      sessionId: this.sessionId?.substring(0, 8), 
      messageCount: messages.length 
    });

    // Logic to extract tool calls from messages and update recentlyUsedTools
    // using this.orchestrationManager and this.sessionId
    // (Moved from AgentNode.handleMessage onFinish)
    try {
        const executedToolNames: string[] = [];
        for (const message of messages) {
            if (message.role === 'assistant' && Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (part.type === 'tool-call') {
                        executedToolNames.push(part.toolName);
                    }
                }
            }
        }
        
        if (executedToolNames.length > 0) {
            const currentState = await this.orchestrationManager.getState(this.sessionId);
            const currentTools = currentState?.recentlyUsedTools || [];
            const newTools = [...new Set([...currentTools, ...executedToolNames])];
            await this.orchestrationManager.updateState(this.sessionId, { recentlyUsedTools: newTools });
            logger.info(LogCategory.LLM, 'LLMOrchestrationService', 'Executed tools tracked', {
              sessionId: this.sessionId?.substring(0, 8),
              tools: newTools
            });
        }
    } catch (error) {
        logger.error(LogCategory.LLM, 'LLMOrchestrationService', 'Error tracking executed tools', { 
          sessionId: this.sessionId?.substring(0, 8),
          error: error instanceof Error ? error.message : String(error)
        });
    }
  }
  */
  
  // Potential future method for onStepFinish logic
  // private async handleStepFinish(event: ToolCallFinishedEvent): Promise<void> { ... }
}

// Helper types if needed
type StreamTextOptions = Parameters<typeof CoreLLM.prototype.streamText>[0]; 