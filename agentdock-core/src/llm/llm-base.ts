/**
 * @fileoverview Base LLM class for all language model implementations.
 * Provides common functionality and interfaces.
 */

import {
  CoreMessage,
  LanguageModel,
  generateText,
  streamText,
  generateObject,
  streamObject,
  GenerateTextResult,
  StreamTextResult,
  GenerateObjectResult,
  StreamObjectResult
} from 'ai';
import { logger, LogCategory } from '../logging';

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

  constructor(model: LanguageModel, config: Record<string, any>, name: string = 'default') {
    this.model = model;
    this.config = config;
    this.name = name;

    logger.debug(LogCategory.LLM, 'Created LLM instance', JSON.stringify({
      name,
      provider: model.provider,
      modelId: model.modelId
    }));
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
   * Generate text from messages
   */
  async generateText(options: LLMTextOptions): Promise<GenerateTextResult<any, any>> {
    logger.debug(LogCategory.LLM, 'Generating text', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await generateText({
      model: this.model,
      messages: options.messages,
      tools: options.tools
    });

    if (options.onFinish) {
      options.onFinish(result.text);
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

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await streamText({
      model: this.model,
      messages: options.messages,
      tools: options.tools,
      // Add maxSteps parameter for multi-step tool calls
      maxSteps: options.maxSteps,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      onToken: options.onToken
    });

    // Store the onFinish callback to be called when the stream completes
    if (options.onFinish) {
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      result.onFinish().then(options.onFinish);
    }

    return result;
  }

  /**
   * Generate structured output from messages
   */
  async generateObject<T>(options: LLMObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    logger.debug(LogCategory.LLM, 'Generating object', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await generateObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools: options.tools
    });

    if (options.onFinish) {
      options.onFinish(result.object);
    }

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return result;
  }

  /**
   * Stream structured output from messages
   */
  async streamObject<T>(options: LLMObjectOptions<T>): Promise<StreamObjectResult<any, T, any>> {
    logger.debug(LogCategory.LLM, 'Streaming object', JSON.stringify({
      provider: this.provider,
      modelId: this.modelId,
      messageCount: options.messages.length,
      hasTools: !!options.tools
    }));

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    const result = await streamObject({
      model: this.model,
      messages: options.messages,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      schema: options.schema,
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      tools: options.tools
    });

    if (options.onFinish) {
      // @ts-ignore - AI SDK types are not fully compatible with our usage
      result.onFinish = options.onFinish;
    }

    // @ts-ignore - AI SDK types are not fully compatible with our usage
    return result;
  }
} 