/**
 * @fileoverview Anthropic LLM implementation using Vercel AI SDK.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { 
  CoreMessage, 
  GenerateObjectResult, 
  StreamObjectResult,
  StreamTextResult
} from 'ai';
import { logger, LogCategory } from '../logging';
import { ZodType, ZodTypeDef } from 'zod';
import { createError, ErrorCode } from '../errors';
import { LLMBase, LLMTextOptions, LLMStreamOptions, LLMObjectOptions } from './llm-base';
import { TokenUsage } from './types';

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  maxSteps?: number;
  [key: string]: any;
}

/**
 * Anthropic LLM implementation
 */
export class AnthropicLLM extends LLMBase {
  protected config: AnthropicConfig;

  /**
   * Create a new AnthropicLLM instance
   */
  constructor(config: AnthropicConfig) {
    // Validate API key
    if (!config.apiKey) {
      const error = 'Missing API key in Anthropic configuration';
      logger.error(LogCategory.LLM, 'AnthropicLLM', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    // Validate API key format
    if (!config.apiKey.startsWith('sk-ant-')) {
      const error = 'Invalid API key format. Anthropic API keys should start with "sk-ant-"';
      logger.error(LogCategory.LLM, 'AnthropicLLM', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    // Validate model
    if (!config.model) {
      const error = 'Missing model in Anthropic configuration';
      logger.error(LogCategory.LLM, 'AnthropicLLM', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    try {
      // Create Anthropic provider
      const anthropicProvider = createAnthropic({
        apiKey: config.apiKey
      });
      
      // Create the model with the provider
      const model = anthropicProvider(config.model);
      
      // Call parent constructor
      super(model, config, 'AnthropicLLM');
      
      // Store config
      this.config = config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        LogCategory.LLM, 
        'AnthropicLLM', 
        `Failed to create Anthropic LLM: ${errorMessage}`
      );
      throw createError(
        'llm',
        `Failed to create Anthropic LLM: ${errorMessage}`,
        ErrorCode.LLM_EXECUTION
      );
    }
  }

  /**
   * Generate text from messages
   */
  async generateText({ 
    messages, 
    tools 
  }: { 
    messages: CoreMessage[]; 
    tools?: Record<string, any>;
  }) {
    return super.generateText({
      messages,
      tools,
      onFinish: (result) => {
        logger.debug(
          LogCategory.LLM, 
          'AnthropicLLM', 
          'Successfully generated text from Anthropic', 
          {
            model: this.config.model,
            apiKeyPrefix: this.config.apiKey.substring(0, 8) + '...'
          }
        );
      }
    });
  }

  /**
   * Stream text from messages
   */
  async streamText(options: LLMStreamOptions): Promise<StreamTextResult<any, any>> {
    try {
      // Call the parent streamText method which handles token usage tracking
      const result = await super.streamText(options);
      
      // Log successful streaming without duplicating token usage information
      logger.debug(
        LogCategory.LLM,
        'AnthropicLLM',
        'Successfully streamed text from Anthropic',
        { 
          model: this.config.model,
          apiKeyPrefix: this.config.apiKey.substring(0, 8) + '...'
        }
      );
      
      return result;
    } catch (error) {
      // Handle error and rethrow
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        LogCategory.LLM, 
        'AnthropicLLM', 
        `Failed to stream text from Anthropic: ${errorMessage}`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // Network errors are generally retryable
    if (error instanceof Error) {
      // Check for common network error messages
      if (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('network error') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('socket hang up')
      ) {
        return true;
      }
      
      // Check for rate limiting or overloaded errors
      if (
        error.message.includes('rate limit') ||
        error.message.includes('too many requests') ||
        error.message.includes('overloaded') ||
        error.message.includes('capacity') ||
        error.message.includes('try again')
      ) {
        return true;
      }
      
      // Check for 5xx errors
      if (
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')
      ) {
        return true;
      }
    }
    
    // Check for Anthropic-specific error types
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      
      // Check for rate limit or overloaded errors
      if (
        errorObj.type === 'rate_limit_error' ||
        errorObj.type === 'overloaded_error' ||
        errorObj.status === 429 ||
        errorObj.status === 500 ||
        errorObj.status === 502 ||
        errorObj.status === 503 ||
        errorObj.status === 504
      ) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate structured output from messages
   */
  async generateObject<T extends ZodType<any, ZodTypeDef, any>>(options: LLMObjectOptions<T>): Promise<GenerateObjectResult<any>> {
    logger.debug(LogCategory.LLM, 'Generating object with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    const { generateObject } = await import('ai');
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return generateObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools: options.tools
    });
  }

  /**
   * Stream structured output from messages
   */
  async streamObject<T extends ZodType<any, ZodTypeDef, any>>(options: LLMObjectOptions<T>): Promise<StreamObjectResult<any, any, any>> {
    logger.debug(LogCategory.LLM, 'Streaming object with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    const { streamObject } = await import('ai');
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return streamObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools: options.tools
    });
  }
} 