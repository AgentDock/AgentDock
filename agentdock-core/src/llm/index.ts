/**
 * @fileoverview LLM module exports.
 * Provides language model interfaces and implementations.
 */

import { 
  CoreMessage, 
  CoreSystemMessage, 
  CoreUserMessage, 
  CoreAssistantMessage, 
  CoreToolMessage,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult,
  smoothStream,
  streamText,
  streamObject,
  generateText,
  generateObject,
  createDataStreamResponse
} from 'ai';

// Export the unified LLM implementation
export { CoreLLM } from './core-llm';
export { createLLM } from './create-llm';
export { createAnthropicModel, createOpenAIModel, createGeminiModel, createDeepSeekModel, createGroqModel } from './model-utils';

// Export all types from types.ts
export * from './types';

// Export the Provider Registry
export * from './provider-registry';

// Re-export directly from Vercel AI SDK
export {
  smoothStream,
  streamText,
  streamObject,
  generateText,
  generateObject,
  createDataStreamResponse
}

// Re-export types from Vercel AI SDK
export type {
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult
}; 