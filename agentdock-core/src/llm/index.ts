/**
 * @fileoverview LLM module exports.
 * Provides language model interfaces and implementations.
 */

// Consolidated Imports from 'ai'
import {
  // Functions used internally or re-exported
  smoothStream,
  streamText,
  streamObject,
  generateText,
  generateObject,
  createDataStreamResponse,
  embed,
  embedMany,
} from 'ai';

import type {
  // Types used internally or re-exported
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
  CoreTool,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult as VercelStreamTextResult,
  StreamObjectResult,
  LanguageModelUsage,
  FinishReason,
  ToolCallPart,
  ToolResultPart,
  TextPart,
} from 'ai';

// Internal Module Exports
// Export the unified LLM implementation
export { CoreLLM } from './core-llm';
// Export our extended result types with clear, distinct naming
export type {
  AgentDockStreamResult,
  StreamTextResult, // Backward compatibility type alias
} from './core-llm';
export { createLLM } from './create-llm';
export {
  createAnthropicModel,
  createOpenAIModel,
  createGeminiModel,
  createDeepSeekModel,
  createGroqModel,
} from './model-utils';
export { ModelRegistry } from './model-registry';
export { ModelService } from './model-service';
export * from './providers'; // Includes adapters and validation functions
export * from './types'; // Internal LLM types (LLMConfig, TokenUsage etc.)
export * from './provider-registry';
export { LLMOrchestrationService } from './llm-orchestration-service';

// Re-export AI SDK Functions
export {
  smoothStream,
  streamText,
  streamObject,
  generateText,
  generateObject,
  createDataStreamResponse,
  embed,
  embedMany,
};

// Re-export AI SDK Types
export type {
  CoreMessage,
  CoreSystemMessage,
  CoreUserMessage,
  CoreAssistantMessage,
  CoreToolMessage,
  CoreTool,
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  // StreamTextResult, // Removed to avoid conflict with CoreLLMStreamTextResult
  StreamObjectResult,
  LanguageModelUsage,
  FinishReason,
  ToolCallPart,
  ToolResultPart,
  TextPart,
};
