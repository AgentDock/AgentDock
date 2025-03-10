/**
 * @fileoverview OpenAI LLM implementation using Vercel AI SDK.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { 
  CoreMessage, 
  GenerateObjectResult, 
  StreamObjectResult,
  StreamTextResult
} from 'ai';
import { logger, LogCategory } from '../logging';
import { ZodType, ZodTypeDef } from 'zod';
import { createError, ErrorCode } from '../errors';
import { LLMBase, LLMStreamOptions, LLMObjectOptions } from './llm-base';
import { OpenAIConfig } from './types';
import { maskSensitiveData } from '../utils/security-utils';

/**
 * OpenAI LLM implementation
 */
export class OpenAI extends LLMBase {
  protected config: OpenAIConfig;

  /**
   * Create a new OpenAI instance
   */
  constructor(config: OpenAIConfig) {
    // Validate API key
    if (!config.apiKey) {
      const error = 'Missing API key in OpenAI configuration';
      logger.error(LogCategory.LLM, 'OpenAI', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    // Validate API key format
    if (!config.apiKey.startsWith('sk-')) {
      const error = 'Invalid API key format. OpenAI API keys should start with "sk-"';
      logger.error(LogCategory.LLM, 'OpenAI', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    // Validate model
    if (!config.model) {
      const error = 'Missing model in OpenAI configuration';
      logger.error(LogCategory.LLM, 'OpenAI', error);
      throw createError('llm', error, ErrorCode.LLM_API_KEY);
    }
    
    try {
      // Create OpenAI provider
      const openaiProvider = createOpenAI({
        apiKey: config.apiKey
      });
      
      // Create the model with the provider
      const model = openaiProvider(config.model);
      
      // Call parent constructor
      super(model, config, 'OpenAI');
      
      // Store config
      this.config = config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        LogCategory.LLM, 
        'OpenAI', 
        `Failed to create OpenAI LLM: ${errorMessage}`
      );
      throw createError(
        'llm',
        `Failed to create OpenAI LLM: ${errorMessage}`,
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
      onFinish: (_result) => {
        logger.debug(
          LogCategory.LLM, 
          'OpenAI', 
          'Successfully generated text from OpenAI', 
          {
            model: this.config.model,
            apiKeyPrefix: maskSensitiveData(this.config.apiKey, 8)
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
        'OpenAI',
        'Successfully streamed text from OpenAI',
        { 
          model: this.config.model,
          apiKeyPrefix: maskSensitiveData(this.config.apiKey, 8)
        }
      );
      
      return result;
    } catch (error) {
      // Handle error and rethrow
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        LogCategory.LLM, 
        'OpenAI', 
        `Failed to stream text from OpenAI: ${errorMessage}`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Generate structured output from messages
   */
  async generateObject<T extends ZodType<any, ZodTypeDef, any>>(options: LLMObjectOptions<T>): Promise<GenerateObjectResult<any>> {
    logger.debug(LogCategory.LLM, 'Generating object with OpenAI', JSON.stringify({
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
    logger.debug(LogCategory.LLM, 'Streaming object with OpenAI', JSON.stringify({
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