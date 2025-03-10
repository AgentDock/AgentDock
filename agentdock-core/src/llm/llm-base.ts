/**
 * @fileoverview Base LLM class for all language model implementations.
 * Provides common functionality and interfaces.
 */

import {
  CoreMessage,
  LanguageModel,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject as aiGenerateObject,
  streamObject as aiStreamObject,
  GenerateTextResult,
  StreamTextResult,
  GenerateObjectResult,
  StreamObjectResult
} from 'ai';
import { logger, LogCategory } from '../logging';
import { ZodType, ZodTypeDef } from 'zod';
import { TokenUsage } from './types';

/**
 * Options for text generation
 */
export interface LLMTextOptions {
  messages: CoreMessage[];
  tools?: Record<string, any>;
  onFinish?: (result: string) => void;
}

/**
 * Options for streaming text
 */
export interface LLMStreamOptions {
  messages: CoreMessage[];
  tools?: Record<string, any>;
  maxSteps?: number;
  onToken?: (token: string) => void;
  onFinish?: (result: string) => void;
}

/**
 * Options for structured output generation
 */
export interface LLMObjectOptions<T> {
  messages: CoreMessage[];
  schema: T;
  tools?: Record<string, any>;
  onFinish?: (result: any) => void;
}

/**
 * Base class for all LLM implementations
 */
export class LLMBase {
  protected model: LanguageModel;
  protected config: Record<string, any>;
  protected name: string;
  protected lastTokenUsage: TokenUsage | null = null;

  constructor(model: LanguageModel, config: Record<string, any>, name: string = 'default') {
    this.model = model;
    this.config = config;
    this.name = name;
    
    // Log creation once with comprehensive information
    logger.debug(
      LogCategory.LLM,
      name,
      'Created LLM instance',
      {
        provider: this.provider,
        modelId: this.modelId
      }
    );
  }

  /**
   * Get the provider name
   */
  get provider(): string {
    return this.model.provider;
  }

  /**
   * Get the model ID
   */
  get modelId(): string {
    return this.model.modelId;
  }

  /**
   * Get the underlying language model
   */
  get languageModel(): LanguageModel {
    return this.model;
  }

  /**
   * Get the last token usage information
   */
  getLastTokenUsage(): TokenUsage | null {
    return this.lastTokenUsage;
  }

  /**
   * Generate text from messages
   */
  async generateText(options: LLMTextOptions): Promise<GenerateTextResult<any, any>> {
    logger.debug(LogCategory.LLM, 'Generating text', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // Reset token usage
    this.lastTokenUsage = null;

    // Create a wrapper for the onFinish callback
    const originalOnFinish = options.onFinish;
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await aiGenerateText({
      model: this.model,
      messages: options.messages,
      tools: options.tools
    });
    
    // Capture token usage if available
    if (result.usage) {
      this.lastTokenUsage = {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.promptTokens + result.usage.completionTokens,
        provider: this.provider
      };
      
      logger.debug(
        LogCategory.LLM,
        this.name,
        'Token usage information',
        { ...this.lastTokenUsage } // Convert to Record<string, unknown>
      );
    }
    
    // Call the original onFinish callback if provided
    if (originalOnFinish) {
      originalOnFinish(result.text);
    }

    return result;
  }

  /**
   * Stream text from messages
   */
  async streamText(options: LLMStreamOptions): Promise<StreamTextResult<any, any>> {
    logger.debug(LogCategory.LLM, 'Streaming text', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools,
      maxSteps: options.maxSteps
    }));

    // Reset token usage
    this.lastTokenUsage = null;

    // Create a wrapper for the onFinish callback
    const originalOnFinish = options.onFinish;
    
    // Create a custom onFinish callback that captures token usage
    const wrappedOnFinish = (completion: any) => {
      // Capture token usage if available
      if (completion.usage) {
        this.lastTokenUsage = {
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          totalTokens: completion.usage.promptTokens + completion.usage.completionTokens,
          provider: this.provider
        };
        
        // Log token usage once with all relevant information
        logger.debug(
          LogCategory.LLM,
          this.name,
          'Token usage information',
          { ...this.lastTokenUsage } // Convert to Record<string, unknown>
        );
      }
      
      // Call the original onFinish callback if provided
      if (originalOnFinish) {
        originalOnFinish(completion.text);
      }
    };
    
    // Call the Vercel AI SDK's streamText function with our wrapped callback
    return await aiStreamText({
      model: this.model,
      messages: options.messages,
      tools: options.tools,
      maxSteps: options.maxSteps,
      onFinish: wrappedOnFinish
    });
  }

  /**
   * Generate structured output from messages
   */
  async generateObject<T extends ZodType<any, ZodTypeDef, any>>(options: LLMObjectOptions<T>): Promise<GenerateObjectResult<any>> {
    logger.debug(LogCategory.LLM, 'Generating object', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // Reset token usage
    this.lastTokenUsage = null;

    // Create a wrapper for the onFinish callback
    const originalOnFinish = options.onFinish;
    
    // Create a custom onFinish callback that captures token usage
    const wrappedOnFinish = (completion: any) => {
      // Capture token usage if available
      if (completion.usage) {
        this.lastTokenUsage = {
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          totalTokens: completion.usage.promptTokens + completion.usage.completionTokens,
          provider: this.provider
        };
        
        // Log token usage once with all relevant information
        logger.debug(
          LogCategory.LLM,
          this.name,
          'Token usage information',
          { ...this.lastTokenUsage } // Convert to Record<string, unknown>
        );
      }
      
      // Call the original onFinish callback if provided
      if (originalOnFinish) {
        originalOnFinish(completion.object);
      }
    };
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await aiGenerateObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      tools: options.tools,
      onFinish: wrappedOnFinish
    });
    
    return result;
  }

  /**
   * Stream structured output from messages
   */
  async streamObject<T extends ZodType<any, ZodTypeDef, any>>(options: LLMObjectOptions<T>): Promise<StreamObjectResult<any, any, any>> {
    logger.debug(LogCategory.LLM, 'Streaming object', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // Reset token usage
    this.lastTokenUsage = null;

    // Create a wrapper for the onFinish callback
    const originalOnFinish = options.onFinish;
    
    // Create a custom onFinish callback that captures token usage
    const wrappedOnFinish = (completion: any) => {
      // Capture token usage if available
      if (completion.usage) {
        this.lastTokenUsage = {
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          totalTokens: completion.usage.promptTokens + completion.usage.completionTokens,
          provider: this.provider
        };
        
        // Log token usage once with all relevant information
        logger.debug(
          LogCategory.LLM,
          this.name,
          'Token usage information',
          { ...this.lastTokenUsage } // Convert to Record<string, unknown>
        );
      }
      
      // Call the original onFinish callback if provided
      if (originalOnFinish) {
        originalOnFinish(completion.object);
      }
    };
    
    // Call the Vercel AI SDK's streamObject function with our wrapped callback
    return await aiStreamObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      onFinish: wrappedOnFinish
    });
  }
} 