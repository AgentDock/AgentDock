/**
 * @fileoverview A thin adapter for the Vercel AI SDK
 * This adapter provides a lightweight implementation that converts between
 * AgentDock message types and Vercel AI SDK message types.
 */

import { LLMAdapter, LLMConfig, LLMMessage, LLMProvider } from '../../types/llm';
import { Message } from '../../types/messages';
import { toVercelMessages, fromVercelMessages } from './message-types';
import { createParser } from 'eventsource-parser';

// Helper function to convert LLMMessage[] to Message[]
function convertLLMMessagesToMessages(messages: LLMMessage[]): Message[] {
  return messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt
  })) as Message[];
}

// Helper function to extract string content from Message
function extractTextContent(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  } else if (Array.isArray(message.content)) {
    // Extract text content from array of content parts
    return message.content
      .filter(part => typeof part === 'object' && part.type === 'text')
      .map(part => (part as any).text)
      .join('');
  }
  return '';
}

/**
 * Options for the ThinVercelAIAdapter
 */
export interface ThinVercelAIAdapterOptions {
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
  model: string;

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
  public provider: LLMProvider;
  public config: LLMConfig;

  /**
   * Creates a new ThinVercelAIAdapter
   * @param options The options for the adapter
   */
  constructor(options: ThinVercelAIAdapterOptions) {
    this.options = options;
    this.config = {
      apiKey: options.apiKey,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    };
    this.provider = {
      generateStream: this.generateStream.bind(this),
      generateText: this.generateText.bind(this)
    };
  }

  /**
   * Generates text for the given messages
   * @param messages The messages to generate text for
   * @returns A promise that resolves to the generated text
   */
  async generateText(messages: LLMMessage[]): Promise<string> {
    // Convert LLMMessage[] to Message[] before using toVercelMessages
    const agentDockMessages = convertLLMMessagesToMessages(messages);
    
    // Convert AgentDock messages to Vercel AI SDK messages
    const vercelMessages = toVercelMessages(agentDockMessages);

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
      const completionMessages = fromVercelMessages([data.choices[0].message]);
      
      // Extract text content from the message
      return extractTextContent(completionMessages[0]);
    } catch (error) {
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a streaming response for the given messages
   * @param messages The messages to generate a stream for
   * @returns A promise that resolves to a ReadableStream
   */
  async generateStream(messages: LLMMessage[]): Promise<ReadableStream> {
    // Convert LLMMessage[] to Message[] before using toVercelMessages
    const agentDockMessages = convertLLMMessagesToMessages(messages);
    
    // Convert AgentDock messages to Vercel AI SDK messages
    const vercelMessages = toVercelMessages(agentDockMessages);

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

      // Create a stream from the response
      return new ReadableStream({
        async start(controller) {
          const parser = createParser({
            onEvent(event) {
              if (event.event === 'message') {
                try {
                  const data = JSON.parse(event.data);
                  const text = data.choices[0]?.delta?.content || '';
                  if (text) {
                    controller.enqueue(new TextEncoder().encode(text));
                  }
                } catch (e) {
                  console.error('Error parsing SSE message:', e);
                }
              }
            }
          });

          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              parser.feed(new TextDecoder().decode(value));
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          } finally {
            reader.releaseLock();
          }
        }
      });
    } catch (error) {
      throw new Error(`Failed to generate stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 