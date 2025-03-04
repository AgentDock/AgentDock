/**
 * @fileoverview Provider-agnostic adapter for AI SDK integration.
 * Implements streaming responses, tool execution, and error handling.
 */

import { LLMAdapter, LLMConfig, LLMMessage, LLMProvider } from '../types';

// Error handler that logs errors and returns void
function handleError(error: unknown) {
  console.error('Error in AI SDK Adapter:', error);
  return;
}

export class AISDKAdapter implements LLMAdapter {
  provider: LLMProvider;
  config: LLMConfig;

  constructor(provider: LLMProvider, config: LLMConfig) {
    console.log('🔄 AISDKAdapter: Initializing with provider and config', {
      provider: provider.constructor.name,
      model: config.model
    });
    this.provider = provider;
    this.config = config;
  }

  async generateStream(messages: LLMMessage[]): Promise<ReadableStream> {
    console.log('🔄 AISDKAdapter: Generating stream with messages', {
      messageCount: messages.length,
      firstMessageRole: messages[0]?.role,
      model: this.config.model
    });
    return this.provider.generateStream(messages, this.config);
  }

  async generateText(messages: LLMMessage[]): Promise<string> {
    console.log('🔄 AISDKAdapter: Generating text with messages', {
      messageCount: messages.length,
      firstMessageRole: messages[0]?.role,
      model: this.config.model
    });
    return this.provider.generateText(messages, this.config);
  }
} 