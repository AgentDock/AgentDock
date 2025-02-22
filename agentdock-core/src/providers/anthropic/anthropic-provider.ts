/**
 * @fileoverview Anthropic provider implementation
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMConfig } from '../../types/llm';
import { createError, ErrorCode } from '../../errors';

export class AnthropicProvider implements LLMProvider {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });
  }

  async generateStream(messages: LLMMessage[], config: LLMConfig): Promise<ReadableStream> {
    try {
      const stream = await this.anthropic.messages.create({
        model: config.model,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        stream: true
      });

      // Create a text encoder for proper streaming
      const encoder = new TextEncoder();

      return new ReadableStream({
        async start(controller) {
          try {
            let content = '';

            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
                content += chunk.delta.text;
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
            
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });
    } catch (error) {
      throw createError('llm', 'Stream generation failed', ErrorCode.LLM_EXECUTION, { error });
    }
  }

  async generateText(messages: LLMMessage[], config: LLMConfig): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: config.model,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      });

      // Handle content block type
      const content = response.content[0];
      if ('text' in content) {
        return content.text;
      }
      throw createError('llm', 'Invalid content block type', ErrorCode.LLM_EXECUTION);
    } catch (error) {
      throw createError('llm', 'Text generation failed', ErrorCode.LLM_EXECUTION, { error });
    }
  }
} 