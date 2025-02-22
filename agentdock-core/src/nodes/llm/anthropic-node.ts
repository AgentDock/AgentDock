/**
 * @fileoverview Anthropic LLM node implementation using Vercel AI SDK.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { LLMNode, LLMConfig } from './llm-node';
import { LLMMessage } from '../../types/llm';
import { createError, ErrorCode } from '../../errors';

/**
 * Anthropic-specific configuration
 */
interface AnthropicConfig extends LLMConfig {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  apiKey: string;
}

/**
 * Anthropic implementation of LLM node
 */
export class AnthropicNode extends LLMNode {
  readonly type = 'llm.anthropic';
  private anthropicClient: Anthropic | null = null;

  constructor(id: string, config: AnthropicConfig) {
    super(id, config);
  }

  /**
   * Get static node metadata
   */
  static getNodeMetadata() {
    return {
      category: 'core' as const,
      label: 'Anthropic',
      description: 'Anthropic Claude language model integration',
      inputs: [{
        id: 'messages',
        type: 'array',
        label: 'Messages',
        required: true
      }],
      outputs: [{
        id: 'response',
        type: 'stream',
        label: 'Response Stream'
      }],
      version: '1.0.0',
      compatibility: {
        core: true,
        pro: true,
        custom: false
      }
    };
  }

  protected getLabel(): string {
    return 'Anthropic';
  }

  protected getDescription(): string {
    return 'Anthropic Claude language model integration';
  }

  protected getProvider(): string {
    return 'anthropic';
  }

  protected async generateConfig(messages: LLMMessage[], apiKey: string): Promise<AnthropicConfig> {
    return {
      model: this.config.model || 'claude-3-opus-20240229',
      messages,
      temperature: this.config.temperature ?? 0.7,
      maxTokens: this.config.maxTokens ?? 4096,
      apiKey
    };
  }

  protected get llmProvider() {
    const self = this;
    return {
      async generate(config: AnthropicConfig, messages: LLMMessage[]): Promise<ReadableStream<string>> {
        if (!self.anthropicClient || self.anthropicClient.apiKey !== config.apiKey) {
          self.anthropicClient = new Anthropic({ apiKey: config.apiKey });
        }

        try {
          // Convert messages to Anthropic format
          const anthropicMessages = messages.map(msg => {
            if (msg.role === 'system') {
              // Prepend system message to first user message
              return {
                role: 'user' as const,
                content: `${msg.content}\n\nUser: `
              };
            }
            return {
              role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
              content: msg.content
            };
          });

          const response = await self.anthropicClient.messages.create({
            model: config.model,
            messages: anthropicMessages,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 4096,
            stream: true
          });

          return new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of response) {
                  if (chunk.type === 'content_block_delta') {
                    const delta = chunk.delta;
                    if ('text' in delta) {
                      controller.enqueue(delta.text);
                    }
                  }
                }
                controller.close();
              } catch (error) {
                controller.error(error);
              }
            }
          });
        } catch (error) {
          throw createError('llm', 'Anthropic API request failed', ErrorCode.LLM_REQUEST, {
            cause: error
          });
        }
      }
    };
  }
} 