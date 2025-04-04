/**
 * @fileoverview Core LLM implementation that works with any model from the Vercel AI SDK.
 * This is a unified implementation that replaces provider-specific classes.
 */

import { 
  CoreMessage, 
  LanguageModel, 
  generateText, 
  generateObject, 
  streamText, 
  streamObject,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult as VercelStreamTextResult,
  StreamObjectResult,
  smoothStream,
  StepResult,
  StreamTextOnStepFinishCallback,
  FinishReason,
  ToolSet
} from 'ai';
import { z, ZodType, ZodTypeDef } from 'zod';
import { logger, LogCategory } from '../logging';
import { TokenUsage, LLMConfig } from './types';
import { createError, ErrorCode } from '../errors';
import { maskSensitiveData } from '../utils/security-utils';
import { parseProviderError } from '../errors/llm-errors';

// --- TYPE DEFINITIONS based on Vercel AI SDK Docs ---

// Type for the argument passed to the streamText onFinish callback
// Define it here for use in the streamText method signature
type StreamTextOnFinishResult = {
  finishReason: FinishReason;
  usage: TokenUsage;
  providerMetadata?: Record<string, Record<string, unknown>> | undefined;
  text: string;
  reasoning?: string | undefined;
  response?: { messages?: CoreMessage[] };
};

// --- TYPE DEFINITIONS ---

/**
 * AgentDock's extended version of Vercel AI SDK's StreamTextResult.
 * Adds orchestration state tracking and error handling capabilities.
 */
export interface AgentDockStreamResult<T extends ToolSet = ToolSet, R = unknown> extends VercelStreamTextResult<T, R> {
  /** Orchestration state data added by AgentNode */
  _orchestrationState?: {
    recentlyUsedTools?: string[];
    cumulativeTokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    [key: string]: unknown;
  } | null;
  
  /** Flag indicating if there was an error during streaming */
  _hasStreamingError?: boolean;
  
  /** Error message if streaming failed */
  _streamingErrorMessage?: string;
}

// Backward compatibility alias - export both types
export type StreamTextResult<T extends ToolSet = ToolSet, R = unknown> = AgentDockStreamResult<T, R>;

/**
 * Core LLM implementation that works with any model from the Vercel AI SDK.
 * 
 * This class provides a unified interface for text generation, streaming, and object generation.
 * It also includes a mechanism for reporting token usage back to the caller via a request-scoped callback.
 * Callers like AgentNode should use `setCurrentUsageCallback` before invoking methods like `streamText`
 * or `generateText` to ensure usage is captured for state updates or other tracking purposes.
 */
export class CoreLLM {
  private model: LanguageModel;
  private config: LLMConfig;
  private lastTokenUsage: TokenUsage | null = null;
  
  constructor({ model, config }: { model: LanguageModel; config: LLMConfig }) {
    this.model = model;
    this.config = config;
    
    logger.debug(
      LogCategory.LLM,
      'CoreLLM',
      'Created LLM instance',
      {
        provider: this.getProvider(),
        modelId: this.getModelId(),
        apiKeyPrefix: maskSensitiveData(config.apiKey, 5)
      }
    );
  }

  // Core methods that work across all providers
  getProvider(): string {
    return this.model.provider;
  }

  getModelId(): string {
    return this.model.modelId;
  }

  getModel(): LanguageModel {
    return this.model;
  }

  getLastTokenUsage(): TokenUsage | null {
    return this.lastTokenUsage;
  }

  // Implementation of methods using the model directly
  async generateText(options: {
    messages: CoreMessage[];
    tools?: Record<string, any>;
    onFinish?: (result: string) => void;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxRetries?: number;
    stopSequences?: string[];
  }): Promise<GenerateTextResult<any, any>> {
    try {
      // Extract and log all LLM parameters to trace what's being used
      const llmParams = {
        provider: this.getProvider(),
        modelId: this.getModelId(),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        maxRetries: options.maxRetries,
        stopSequences: options.stopSequences,
        messageCount: options.messages.length,
        hasTools: !!options.tools && Object.keys(options.tools).length > 0
      };
      
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Generating text with parameters',
        llmParams
      );
      
      // Generate text using the model
      const result = await generateText({
        model: this.model,
        ...options
      });
      
      // Log that the call was successfully made with these parameters
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Successfully generated text with parameters',
        {
          ...llmParams,
          totalTokens: result.usage?.totalTokens,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens
        }
      );
      
      // Track token usage
      if (result.usage) {
        this.lastTokenUsage = {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          provider: this.getProvider()
        };
        
        console.log(`[Token Usage] ${this.getProvider()} - ${this.getModelId()}: Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens}, Total: ${result.usage.totalTokens}`);
      }
      
      // Call onFinish callback if provided
      if (options.onFinish) {
        options.onFinish(result.text);
      }
      
      return result;
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'CoreLLM',
        'Error generating text',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw createError(
        'llm',
        `Error generating text with ${this.getProvider()}/${this.getModelId()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.LLM_EXECUTION
      );
    }
  }

  async streamText(options: {
    messages: CoreMessage[];
    tools?: Record<string, any>;
    onFinish?: (result: StreamTextOnFinishResult) => void;
    onStepFinish?: (stepData: any) => void;
    maxSteps?: number;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxRetries?: number;
    stopSequences?: string[];
    experimental_forceComplete?: boolean;
    experimental_streamToolCall?: boolean;
  }): Promise<StreamTextResult<any, any>> {
    try {
      // Extract and log all LLM parameters to trace what's being used
      const llmParams = {
        provider: this.getProvider(),
        modelId: this.getModelId(),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        topK: options.topK,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        maxRetries: options.maxRetries,
        stopSequences: options.stopSequences,
        messageCount: options.messages.length,
        hasTools: !!options.tools && Object.keys(options.tools).length > 0,
        enableToolCallStreaming: true,
        forceFinalResponse: !!options.experimental_forceComplete,
        maxSteps: options.maxSteps
      };
      
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Streaming text with parameters',
        llmParams
      );
      
      // Wrap onFinish to track token usage AND use internal callback
      const wrappedOnFinish = (completion: any) => {
        let usage: TokenUsage | null = null;
        // Ensure completion and completion.usage exist
        if (completion?.usage) {
          usage = {
            promptTokens: completion.usage.prompt_tokens || completion.usage.promptTokens,
            completionTokens: completion.usage.completion_tokens || completion.usage.completionTokens,
            totalTokens: completion.usage.total_tokens || completion.usage.totalTokens,
            provider: this.getProvider()
          };
          this.lastTokenUsage = usage;
          console.log(`[Token Usage] ${this.getProvider()} - ${this.getModelId()}: Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Total: ${usage.totalTokens}`);
        } else {
            logger.warn(LogCategory.LLM, 'CoreLLM', '[streamText] wrappedOnFinish called without usage data in completion object', {
                completionKeys: completion ? Object.keys(completion) : 'completion is null/undefined'
            });
        }
        
        // Call original onFinish if provided, PASSING THE FULL COMPLETION OBJECT
        if (options.onFinish) {
          // Pass the entire completion object, not just text
          // The 'completion' object structure should match StreamTextOnFinishResult
          options.onFinish!(completion as StreamTextOnFinishResult);
        }

        // --- BEGIN Added Debugging ---
        logger.debug(LogCategory.LLM, 'CoreLLM', '[streamText] Inside wrappedOnFinish', {
          usageProvided: !!usage,
          usageValue: usage,
          // Remove reference to removed onUsageAvailable
          // onUsageAvailableType: typeof options.onUsageAvailable
        });
        // --- END Added Debugging ---
      };
      
      // Wrap onStepFinish to standardize tool call format across providers
      const wrappedStepFinish = options.onStepFinish
        ? (stepData: any) => {
            // Standardize tool call format
            if (stepData.toolCalls && Array.isArray(stepData.toolCalls) && stepData.toolCalls.length > 0) {
              // Track tool calls for easier extraction
              const toolNames: string[] = [];
              
              // Log raw tool calls for debugging
              logger.debug(
                LogCategory.LLM,
                'CoreLLM',
                'Raw tool calls received',
                { 
                  provider: this.getProvider(),
                  toolCallCount: stepData.toolCalls.length,
                  firstToolCall: JSON.stringify(stepData.toolCalls[0])
                }
              );
              
              // Process each tool call to ensure standard format
              for (const toolCall of stepData.toolCalls) {
                if (toolCall && typeof toolCall === 'object') {
                  let toolName: string | undefined;
                  
                  // Simple extraction of tool name - no numeric conversion
                  if ('toolName' in toolCall && typeof toolCall.toolName === 'string') {
                    toolName = toolCall.toolName;
                  }
                  else if ('name' in toolCall && typeof toolCall.name === 'string') {
                    toolName = toolCall.name;
                  }
                  // Handle OpenAI format
                  else if (
                    toolCall.function && 
                    typeof toolCall.function === 'object' && 
                    'name' in toolCall.function && 
                    typeof toolCall.function.name === 'string'
                  ) {
                    toolName = toolCall.function.name;
                  }
                  
                  // If we found a tool name, standardize and track it
                  if (toolName) {
                    // Add standardized name property to the tool call
                    (toolCall as any).name = toolName;
                    // Also add toolName property for consistency with AI SDK
                    (toolCall as any).toolName = toolName;
                    
                    // Add to tracking array if not already present
                    if (!toolNames.includes(toolName)) {
                      toolNames.push(toolName);
                    }
                  } else {
                    // Log warning if we couldn't identify the tool name
                    logger.warn(
                      LogCategory.LLM,
                      'CoreLLM',
                      'Could not identify tool name from tool call',
                      { toolCall: JSON.stringify(toolCall) }
                    );
                  }
                }
              }
              
              // Add consolidated toolNames array for easier access
              (stepData as any).toolNames = toolNames;
              
              // Log standardized tool calls
              if (toolNames.length > 0) {
                logger.debug(
                  LogCategory.LLM,
                  'CoreLLM',
                  'Standardized tool calls',
                  { 
                    toolCount: toolNames.length,
                    toolNames: toolNames.join(', '),
                    provider: this.getProvider(),
                    model: this.getModelId()
                  }
                );
              }
            }
            
            // Call the original callback with the standardized data
            if (options.onStepFinish) {
              options.onStepFinish(stepData);
            }
          }
        : undefined;
      
      // Stream text using the model with tool call streaming enabled
      const streamResult = streamText({
        model: this.model,
        ...options,
        onFinish: wrappedOnFinish,
        onStepFinish: wrappedStepFinish,
        toolCallStreaming: true,
        experimental_transform: smoothStream({ chunking: 'word' })
      });
      
      // Create our enhanced result with error handling capabilities
      const enhancedResult: StreamTextResult<any, any> = {
        ...streamResult,
        _orchestrationState: null,
        _hasStreamingError: false,
        _streamingErrorMessage: '',
        
        // Override toDataStreamResponse to include error information
        toDataStreamResponse(options: { getErrorMessage?: (error: unknown) => string } = {}) {
          // If we detected a streaming error, inject it directly
          if (enhancedResult._hasStreamingError) {
            console.log('CoreLLM: Streaming error detected, passing to response', enhancedResult._streamingErrorMessage);
            
            const error = new Error(enhancedResult._streamingErrorMessage);
            // Explicitly pass the error to the stream
            return streamResult.toDataStreamResponse({
              ...options,
              getErrorMessage: (err) => {
                // If options has getErrorMessage, use it first
                if (options.getErrorMessage) {
                  return options.getErrorMessage(err);
                }
                // Otherwise, use our error message
                return enhancedResult._streamingErrorMessage || String(err);
              }
            });
          }
          
          // No error, just pass through
          return streamResult.toDataStreamResponse(options);
        },
        
        text: streamResult.text,
        textStream: streamResult.textStream,
        fullStream: streamResult.fullStream,
      };
      
      // Set up error monitoring for the full stream
      (async () => {
        try {
          // Process error parts from the full stream
          for await (const part of streamResult.fullStream) {
            if (part.type === 'error') {
              enhancedResult._hasStreamingError = true;
              
              // Use the existing error handling system instead of duplicating
              const parsedError = parseProviderError(part.error, this.getProvider() as any);
              enhancedResult._streamingErrorMessage = parsedError.message;
              
              logger.error(
                LogCategory.LLM,
                'CoreLLM',
                'Error part detected in stream',
                {
                  provider: this.getProvider(),
                  modelId: this.getModelId(),
                  error: parsedError.message,
                  code: parsedError.code
                }
              );
            }
          }
        } catch (fullStreamError) {
          // If we can't process the full stream, log the error but don't break the main stream
          logger.error(
            LogCategory.LLM,
            'CoreLLM',
            'Error processing full stream',
            {
              provider: this.getProvider(),
              modelId: this.getModelId(),
              error: fullStreamError instanceof Error ? fullStreamError.message : String(fullStreamError)
            }
          );
        }
      })();
      
      return enhancedResult;
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'CoreLLM',
        'Error streaming text',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw createError(
        'llm',
        `Error streaming text with ${this.getProvider()}/${this.getModelId()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.LLM_EXECUTION
      );
    }
  }

  async generateObject<T extends ZodType<any, ZodTypeDef, any>>(options: {
    messages: CoreMessage[];
    schema: T;
    onFinish?: (result: any) => void;
    temperature?: number;
  }): Promise<GenerateObjectResult<any>> {
    try {
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Generating object',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          messageCount: options.messages.length,
          schema: options.schema.description
        }
      );
      
      // Generate object using the model
      const result = await generateObject({
        model: this.model,
        ...options
      });
      
      // Track token usage
      if (result.usage) {
        this.lastTokenUsage = {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          provider: this.getProvider()
        };
        
        // Add console.log for token usage
        console.log(`[Token Usage] ${this.getProvider()} - ${this.getModelId()}: Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens}, Total: ${result.usage.totalTokens}`);
      }
      
      // Call onFinish callback if provided
      if (options.onFinish) {
        options.onFinish(result.object);
      }
      
      return result;
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'CoreLLM',
        'Error generating object',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw createError(
        'llm',
        `Error generating object with ${this.getProvider()}/${this.getModelId()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.LLM_EXECUTION
      );
    }
  }

  async streamObject<T extends ZodType<any, ZodTypeDef, any>>(options: {
    messages: CoreMessage[];
    schema: T;
    onFinish?: (result: any) => void;
    temperature?: number;
  }): Promise<StreamObjectResult<any, any, any>> {
    try {
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Streaming object',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          messageCount: options.messages.length,
          schema: options.schema.description
        }
      );
      
      // Wrap onFinish to track token usage
      const wrappedOnFinish = options.onFinish 
        ? (completion: any) => {
            let usage: TokenUsage | null = null;
            if (completion.usage) {
              usage = {
                promptTokens: completion.usage.prompt_tokens || completion.usage.promptTokens,
                completionTokens: completion.usage.completion_tokens || completion.usage.completionTokens,
                totalTokens: completion.usage.total_tokens || completion.usage.totalTokens,
                provider: this.getProvider()
              };
              this.lastTokenUsage = usage;
              console.log(`[Token Usage] ${this.getProvider()} - ${this.getModelId()}: Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Total: ${usage.totalTokens}`);
            }
            options.onFinish!(completion.object || completion);
          }
        : (completion: any) => {
            let usage: TokenUsage | null = null;
            // Even if no onFinish is provided, we still want to capture token usage
            if (completion.usage) {
              usage = {
                promptTokens: completion.usage.prompt_tokens || completion.usage.promptTokens,
                completionTokens: completion.usage.completion_tokens || completion.usage.completionTokens,
                totalTokens: completion.usage.total_tokens || completion.usage.totalTokens,
                provider: this.getProvider()
              };
              this.lastTokenUsage = usage;
              console.log(`[Token Usage] ${this.getProvider()} - ${this.getModelId()}: Prompt: ${usage.promptTokens}, Completion: ${usage.completionTokens}, Total: ${usage.totalTokens}`);
            }
          };
      
      // Stream object using the model
      return streamObject({
        model: this.model,
        ...options,
        onFinish: wrappedOnFinish
      });
    } catch (error) {
      logger.error(
        LogCategory.LLM,
        'CoreLLM',
        'Error streaming object',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw createError(
        'llm',
        `Error streaming object with ${this.getProvider()}/${this.getModelId()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.LLM_EXECUTION
      );
    }
  }
} 