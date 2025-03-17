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
  StreamObjectResult
} from 'ai';

// Export the unified LLM implementation
export { CoreLLM } from './core-llm';
export { createLLM } from './create-llm';
export { createAnthropicModel, createOpenAIModel, createGeminiModel, createDeepSeekModel } from './model-utils';

// Export all types from types.ts
export * from './types';

// Export the Provider Registry
export * from './provider-registry';

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