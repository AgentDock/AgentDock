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
  StreamTextResult,
  StreamObjectResult
} from 'ai';
import { z, ZodType, ZodTypeDef } from 'zod';
import { logger, LogCategory } from '../logging';
import { TokenUsage, LLMConfig } from './types';
import { createError, ErrorCode } from '../errors';
import { maskSensitiveData } from '../utils/security-utils';

/**
 * Core LLM implementation that works with any model from the Vercel AI SDK
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
  }): Promise<GenerateTextResult<any, any>> {
    try {
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Generating text',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          messageCount: options.messages.length,
          hasTools: !!options.tools && Object.keys(options.tools).length > 0
        }
      );
      
      // Generate text using the model
      const result = await generateText({
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
    onFinish?: (result: string) => void;
    onStepFinish?: (stepData: any) => void;
    maxSteps?: number;
    temperature?: number;
  }): Promise<StreamTextResult<any, any>> {
    try {
      logger.debug(
        LogCategory.LLM,
        'CoreLLM',
        'Streaming text',
        {
          provider: this.getProvider(),
          modelId: this.getModelId(),
          messageCount: options.messages.length,
          hasTools: !!options.tools && Object.keys(options.tools).length > 0
        }
      );
      
      // Wrap onFinish to track token usage
      const wrappedOnFinish = options.onFinish 
        ? (completion: any) => {
            if (completion.usage) {
              this.lastTokenUsage = {
                promptTokens: completion.usage.promptTokens,
                completionTokens: completion.usage.completionTokens,
                totalTokens: completion.usage.totalTokens,
                provider: this.getProvider()
              };
            }
            options.onFinish!(completion.text || completion);
          }
        : undefined;
      
      // Stream text using the model
      return streamText({
        model: this.model,
        ...options,
        onFinish: wrappedOnFinish
      });
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
            if (completion.usage) {
              this.lastTokenUsage = {
                promptTokens: completion.usage.promptTokens,
                completionTokens: completion.usage.completionTokens,
                totalTokens: completion.usage.totalTokens,
                provider: this.getProvider()
              };
            }
            options.onFinish!(completion.object || completion);
          }
        : undefined;
      
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