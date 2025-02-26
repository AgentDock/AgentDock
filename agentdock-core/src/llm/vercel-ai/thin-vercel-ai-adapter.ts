/**
 * @fileoverview A thin adapter for the Vercel AI SDK
 * This adapter provides a lightweight implementation that converts between
 * AgentDock message types and Vercel AI SDK message types.
 */

import { LLMAdapter, LLMAdapterOptions, LLMAdapterResponse } from '../llm-adapter';
import { Message } from '../../types/messages';
import { toVercelMessages, fromVercelMessages } from './message-types';
import { AIStream, StreamingTextResponse } from 'ai';
import { ReadableStream } from 'stream/web';

/**
 * Options for the ThinVercelAIAdapter
 */
export interface ThinVercelAIAdapterOptions extends LLMAdapterOptions {
  /**
   * The base URL for the API
   */
  baseUrl?: string;

  /**
   * The API key for authentication
   */
  apiKey?: string;

  /**
   * The model to use for the API
   */
  model?: string;

  /**
   * The temperature to use for generation (0-1)
   */
  temperature?: number;

  /**
   * The maximum number of tokens to generate
   */
  maxTokens?: number;

  /**
   * Additional headers to include in the request
   */
  headers?: Record<string, string>;
}

/**
 * A thin adapter for the Vercel AI SDK
 * This adapter provides a lightweight implementation that converts between
 * AgentDock message types and Vercel AI SDK message types.
 */
export class ThinVercelAIAdapter implements LLMAdapter {
  private options: ThinVercelAIAdapterOptions;

  /**
   * Creates a new ThinVercelAIAdapter
   * @param options The options for the adapter
   */
  constructor(options: ThinVercelAIAdapterOptions) {
    this.options = options;
  }

  /**
   * Generates a completion for the given messages
   * @param messages The messages to generate a completion for
   * @returns A promise that resolves to the completion
   */
  async generateCompletion(messages: Message[]): Promise<LLMAdapterResponse> {
    // Convert AgentDock messages to Vercel AI SDK messages
    const vercelMessages = toVercelMessages(messages);

    // Prepare the request body
    const body = {
      messages: vercelMessages,
      model: this.options.model,
      temperature: this.options.temperature,
      max_tokens: this.options.maxTokens,
      stream: false,
    };

    // Prepare the request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers,
    };

    // Add the API key if provided
    if (this.options.apiKey) {
      headers['Authorization'] = `Bearer ${this.options.apiKey}`;
    }

    // Determine the API URL
    const apiUrl = this.options.baseUrl || 'https://api.openai.com/v1/chat/completions';

    try {
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      // Parse the response
      const data = await response.json();

      // Convert the Vercel AI SDK message to an AgentDock message
      const completionMessage = fromVercelMessages([data.choices[0].message])[0];

      return {
        message: completionMessage,
        usage: data.usage,
      };
    } catch (error) {
      throw new Error(`Failed to generate completion: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a streaming completion for the given messages
   * @param messages The messages to generate a completion for
   * @returns A promise that resolves to a ReadableStream of the completion
   */
  async generateCompletionStream(messages: Message[]): Promise<ReadableStream<Uint8Array>> {
    // Convert AgentDock messages to Vercel AI SDK messages
    const vercelMessages = toVercelMessages(messages);

    // Prepare the request body
    const body = {
      messages: vercelMessages,
      model: this.options.model,
      temperature: this.options.temperature,
      max_tokens: this.options.maxTokens,
      stream: true,
    };

    // Prepare the request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers,
    };

    // Add the API key if provided
    if (this.options.apiKey) {
      headers['Authorization'] = `Bearer ${this.options.apiKey}`;
    }

    // Determine the API URL
    const apiUrl = this.options.baseUrl || 'https://api.openai.com/v1/chat/completions';

    try {
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData}`);
      }

      // Create an AI stream from the response
      const stream = AIStream(response);
      
      // Return the stream
      return stream;
    } catch (error) {
      throw new Error(`Failed to generate streaming completion: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a StreamingTextResponse from a ReadableStream
   * @param stream The stream to create a response from
   * @returns A StreamingTextResponse
   */
  createStreamingResponse(stream: ReadableStream<Uint8Array>): StreamingTextResponse {
    return new StreamingTextResponse(stream);
  }
} 