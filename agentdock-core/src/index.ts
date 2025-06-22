// LLM error utilities are imported directly to avoid circular dependencies

// Re-export the orchestration types
// export * from './orchestration/index'; // This might be redundant or cause issues if index also exports types

//=============================================================================
// Provider-specific imports for re-export
//=============================================================================

/**
 * Re-export provider-specific classes and types
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
// Also re-export from ai core for server components
import type { CoreMessage, LanguageModel } from 'ai';
//=============================================================================
// Client components (Re-exported from AI SDK)
//=============================================================================

/**
 * Re-export client-side components and AI SDK types for React applications
 * These are used in both client and server components
 */
import type { CreateMessage, UseChatHelpers, UseChatOptions } from 'ai/react';

import { normalizeError, parseProviderError } from './errors/llm-errors';
//=============================================================================
// Orchestration system
//=============================================================================

/**
 * Orchestration system
 * For controlling agent behavior in a step-based workflow
 */
import {
  createOrchestrationManager,
  OrchestrationManager,
  OrchestrationStateManager,
  StepSequencer
} from './orchestration/index';

/**
 * @fileoverview Core exports for the AgentDock framework
 * This is the main entry point for the AgentDock Core library.
 */

//=============================================================================
// Core types
//=============================================================================

/**
 * Basic type definitions used throughout the framework
 */
export * from './types/agent-config'; // Agent configuration
export * from './types/messages'; // Message types
export * from './types/node-category';
export * from './types/orchestration'; // Orchestration system
export * from './types/session'; // Session management
export type {
  ToolState,
  BaseToolInvocation,
  ToolCall,
  ToolResult,
  JSONSchema,
  Tool,
  ToolRegistrationOptions
} from './types/tools';

//=============================================================================
// Node system
//=============================================================================

/**
 * Complete node system including BaseNode, AgentNode, and tool registry
 * Import these to work with the node-based architecture
 */
export * from './nodes';

//=============================================================================
// Error handling
//=============================================================================

/**
 * Error handling utilities and error types
 * Use these to create and handle standardized errors
 */
export * from './errors';

export { parseProviderError, normalizeError };

//=============================================================================
// Configuration
//=============================================================================

/**
 * Configuration utilities for loading and managing agent configurations
 */
export { loadAgentConfig } from './config/agent-config';

//=============================================================================
// Storage
//=============================================================================

/**
 * Storage system for persisting data
 * NOTE: Only export client-safe storage types and factories.
 * Node.js-dependent adapters should be imported directly from their paths.
 */
// Export only types and client-safe utilities
export type {
  StorageProvider,
  StorageOptions,
  StorageProviderOptions,
  StorageProviderFactory,
  ListOptions
} from './storage/types';

// Export factory functions that handle dynamic imports
export {
  createStorageProvider,
  getDefaultStorageProvider,
  getStorageFactory
} from './storage/factory';

// Export only Edge-compatible providers
export { MemoryStorageProvider } from './storage/providers/memory-provider';
export { RedisStorageProvider } from './storage/providers/redis-provider';
export { VercelKVProvider } from './storage/providers/vercel-kv-provider';

// Export base adapter for extension (but not Node.js-dependent implementations)
export { BaseStorageAdapter } from './storage/base-adapter';

// Export migration tools
export { StorageMigrator, createMigrator } from './storage/migration';
export type {
  MigrationOptions,
  MigrationProgress,
  MigrationResult
} from './storage/migration';

//=============================================================================
// Logging
//=============================================================================

/**
 * Logging system for consistent logging across the framework
 */
export * from './logging';

//=============================================================================
// LLM system
//=============================================================================

/**
 * Language model implementations and utilities
 * Includes CoreLLM, createLLM, and provider-specific model creation functions
 */
export * from './llm';

//=============================================================================
// Session management
//=============================================================================

/**
 * Session management system
 * For managing isolated state across concurrent users
 */
export * from './session';

// Export all orchestration components explicitly
export {
  // From orchestration/index.ts
  OrchestrationManager,
  createOrchestrationManager,
  OrchestrationStateManager,
  StepSequencer
};

export { GoogleGenerativeAI };

//=============================================================================
// Utility functions
//=============================================================================

/**
 * Message utility functions
 * For converting, processing, and managing messages
 */
export {
  convertCoreToLLMMessage,
  convertCoreToLLMMessages,
  applyHistoryPolicy
} from './utils/message-utils';

/**
 * Prompt utility functions
 * For generating system prompts from agent configs
 */
export {
  createSystemPrompt,
  addOrchestrationToPrompt
} from './utils/prompt-utils';

// Re-export AI SDK base types
export type { UseChatOptions, UseChatHelpers, CreateMessage };

export type { LanguageModel, CoreMessage };

//=============================================================================
// Evaluation System
//=============================================================================
export {
  runEvaluation, // from ./evaluation/runner (via ./evaluation/index.ts)
  // JsonFileStorageProvider, // Commented out: No longer directly exported from ./evaluation
  RuleBasedEvaluator,
  LLMJudgeEvaluator,
  NLPAccuracyEvaluator,
  ToolUsageEvaluator,
  LexicalSimilarityEvaluator,
  KeywordCoverageEvaluator,
  SentimentEvaluator,
  ToxicityEvaluator,
  // Core Types from ./evaluation/types (via ./evaluation/index.ts)
  type EvaluationScale,
  type EvaluationCriteria,
  type EvaluationInput,
  type EvaluationResult,
  type AggregatedEvaluationResult,
  type Evaluator,
  type AgentMessage,
  type MessageContent,
  type TextContent,
  type ImageContent,
  type ToolCallContent,
  type ToolResultContent
} from './evaluation';

// Explicit direct re-exports for problematic types
export type { EvaluationRunConfig } from './evaluation/runner';
export type { LLMJudgeConfig } from './evaluation/evaluators/llm'; // Assumes LLMJudgeConfig is exported by evaluators/llm/index.ts
export type {
  EvaluationRule,
  RuleConfig
} from './evaluation/evaluators/rule-based'; // Assumes these are exported by evaluators/rule-based/index.ts
export type { NLPAccuracyEvaluatorConfig } from './evaluation/evaluators/nlp'; // Added export for NLPAccuracyEvaluatorConfig
export type {
  ToolUsageEvaluatorConfig,
  ToolUsageRule
} from './evaluation/evaluators/tool';
export type { LexicalSimilarityEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { KeywordCoverageEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { SentimentEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { ToxicityEvaluatorConfig } from './evaluation/evaluators/lexical';
