/**
 * @fileoverview LLM module exports.
 * Provides language model interfaces and implementations.
 */

// Consolidated Imports from 'ai'
import {
  createDataStreamResponse,
  embed,
  embedMany,
  generateObject,
  generateText,
  // Functions used internally or re-exported
  smoothStream,
  streamObject,
  streamText
} from 'ai';
import type {
  CoreAssistantMessage,
  // Types used internally or re-exported
  CoreMessage,
  CoreSystemMessage,
  CoreTool,
  CoreToolMessage,
  CoreUserMessage,
  FinishReason,
  GenerateObjectResult,
  GenerateTextResult,
  LanguageModel,
  LanguageModelUsage,
  StreamObjectResult,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  StreamTextResult as VercelStreamTextResult
} from 'ai';

// Internal Module Exports
// Export the unified LLM implementation
export { CoreLLM } from './core-llm';
// Export our extended result types with clear, distinct naming
export type {
  AgentDockStreamResult,
  StreamTextResult // Backward compatibility type alias
} from './core-llm';
export { createLLM } from './create-llm';
export {
  createAnthropicModel,
  createOpenAIModel,
  createGeminiModel,
  createDeepSeekModel,
  createGroqModel
} from './model-utils';
export { ModelRegistry } from './model-registry';
export { ModelService } from './model-service';
export * from './providers'; // Includes adapters and validation functions
export * from './types'; // Internal LLM types (LLMConfig, TokenUsage etc.)
export * from './provider-registry';
export { LLMOrchestrationService } from './llm-orchestration-service';
export {
  createEmbedding,
  getDefaultEmbeddingModel,
  getEmbeddingDimensions
} from './create-embedding';
export type { EmbeddingConfig } from './create-embedding';

// Re-export AI SDK Functions
export {
  smoothStream,
  streamText,
  streamObject,
  generateText,
  generateObject,
  createDataStreamResponse,
  embed,
  embedMany
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
  TextPart
};
