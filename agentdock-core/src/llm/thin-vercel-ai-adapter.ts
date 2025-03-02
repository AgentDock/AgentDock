/**
 * @fileoverview Chat route handler with Vercel AI SDK tool integration.
 * Implements streaming responses, tool execution, and error handling.
 */

import { streamText, StreamTextResult } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { LLMAdapter, LLMAdapterOptions, LLMProvider } from './types';

// Error handler that logs errors and returns void
function handleError(error: unknown) {
  console.error('Error in Vercel AI Adapter:', error);
  return;
}

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

export class ThinVercelAIAdapter { // implements LLMAdapter {
  // private options: LLMAdapterOptions;
  // private provider: LLMProvider;
  // private providerConfig: ProviderConfig;
  // private anthropicProvider?: AnthropicProvider;

  getStream(
    model: LanguageModelV1,
    messages: any,
    llmConfig: any,
    system: any,
    tools: any,
    experimental_attachments: any,
    maxSteps = 5,
    toolCallStreaming: boolean,
    onError: (error: unknown) => void = handleError
  ): StreamTextResult<any, never> {
    const stream = streamText({
      model: model,
      messages: messages,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens,
      system: system,
      tools,
      ...(experimental_attachments ? { experimental_attachments } : {}),
      maxSteps: maxSteps,
      toolCallStreaming: toolCallStreaming,
      onError
    });
    return stream;
  }
}
