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
      // Extract system message if present (first message with role 'system')
      let systemMessage: string | undefined;
      const chatMessages = [...messages];
      
      // Look for a system message and extract it
      const systemIndex = chatMessages.findIndex(msg => msg.role === 'system');
      if (systemIndex >= 0) {
        systemMessage = chatMessages[systemIndex].content;
        chatMessages.splice(systemIndex, 1); // Remove system message from array
      }

      // Log what we're sending to Anthropic
      console.log('Anthropic API call:', {
        model: config.model,
        hasSystemMessage: !!systemMessage,
        messageCount: chatMessages.length
      });

      const stream = await this.anthropic.messages.create({
        model: config.model,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        system: systemMessage, // Add system message here
        messages: chatMessages.map(msg => ({
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
      // Extract system message if present (first message with role 'system')
      let systemMessage: string | undefined;
      const chatMessages = [...messages];
      
      // Look for a system message and extract it
      const systemIndex = chatMessages.findIndex(msg => msg.role === 'system');
      if (systemIndex >= 0) {
        systemMessage = chatMessages[systemIndex].content;
        chatMessages.splice(systemIndex, 1); // Remove system message from array
      }

      const response = await this.anthropic.messages.create({
        model: config.model,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        system: systemMessage, // Add system message here
        messages: chatMessages.map(msg => ({
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