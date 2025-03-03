/**
 * @fileoverview Chat route handler with Vercel AI SDK tool integration.
 * Implements streaming responses, tool execution, and error handling.
 */

import { LLMAdapter, LLMConfig, LLMMessage, LLMProvider } from '../types';

// Error handler that logs errors and returns void
function handleError(error: unknown) {
  console.error('Error in Vercel AI Adapter:', error);
  return;
}

export class ThinVercelAIAdapter implements LLMAdapter {
  provider: LLMProvider;
  config: LLMConfig;

  constructor(provider: LLMProvider, config: LLMConfig) {
    this.provider = provider;
    this.config = config;
  }

  generateStream(messages: LLMMessage[]): Promise<ReadableStream> {
    return this.provider.generateStream(messages, this.config);
  }

  generateText(messages: LLMMessage[]): Promise<string> {
    return this.provider.generateText(messages, this.config);
  }
}
