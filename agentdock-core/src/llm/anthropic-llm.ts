/**
 * @fileoverview Anthropic LLM implementation using Vercel AI SDK.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { CoreMessage } from 'ai';
import { logger, LogCategory } from '../logging';
import { ZodType, ZodTypeDef } from 'zod';

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
export class AnthropicLLM {
  private model: any;
  private config: AnthropicConfig;

  /**
   * Create a new AnthropicLLM instance
   */
  constructor(config: AnthropicConfig) {
    this.config = config;
    
    // Create a custom Anthropic provider with the API key
    const anthropicProvider = createAnthropic({
      apiKey: config.apiKey
    });
    
    // Create the model with the provider
    this.model = anthropicProvider(config.model);
    
    logger.debug(LogCategory.LLM, 'Created Anthropic LLM', JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens
    }));
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
    logger.debug(LogCategory.LLM, 'Generating text with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: messages.length,
      hasTools: !!tools
    }));

    const { generateText } = await import('ai');
    
    return generateText({
      model: this.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools
    });
  }

  /**
   * Stream text from messages
   */
  async streamText({ 
    messages, 
    tools 
  }: { 
    messages: CoreMessage[]; 
    tools?: Record<string, any>;
  }) {
    logger.debug(LogCategory.LLM, 'Streaming text with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: messages.length,
      hasTools: !!tools,
      maxSteps: this.config.maxSteps
    }));

    const { streamText } = await import('ai');
    
    return streamText({
      model: this.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools,
      maxSteps: this.config.maxSteps
    });
  }

  /**
   * Generate structured output from messages
   */
  async generateObject<T>({ 
    messages, 
    schema,
    tools 
  }: { 
    messages: CoreMessage[]; 
    schema: ZodType<T, ZodTypeDef, any>;
    tools?: Record<string, any>;
  }) {
    logger.debug(LogCategory.LLM, 'Generating object with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: messages.length,
      hasTools: !!tools
    }));

    const { generateObject } = await import('ai');
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return generateObject({
      model: this.model,
      messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools
    });
  }

  /**
   * Stream structured output from messages
   */
  async streamObject<T>({ 
    messages, 
    schema,
    tools 
  }: { 
    messages: CoreMessage[]; 
    schema: ZodType<T, ZodTypeDef, any>;
    tools?: Record<string, any>;
  }) {
    logger.debug(LogCategory.LLM, 'Streaming object with Anthropic', JSON.stringify({
      model: this.config.model,
      messageCount: messages.length,
      hasTools: !!tools
    }));

    const { streamObject } = await import('ai');
    
    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return streamObject({
      model: this.model,
      messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      output: 'object',
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools
    });
  }
} 