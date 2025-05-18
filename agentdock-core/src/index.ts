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
  ToolRegistrationOptions,
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

// LLM error utilities are imported directly to avoid circular dependencies
import { parseProviderError, normalizeError } from './errors/llm-errors';
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
 */
export * from './storage';
export { RedisStorageProvider } from './storage/providers/redis-provider';

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

//=============================================================================
// Orchestration system
//=============================================================================

/**
 * Orchestration system
 * For controlling agent behavior in a step-based workflow
 */
import {
  OrchestrationManager,
  createOrchestrationManager,
  OrchestrationStateManager,
  StepSequencer,
} from './orchestration/index';

// Export all orchestration components explicitly
export {
  // From orchestration/index.ts
  OrchestrationManager,
  createOrchestrationManager,
  OrchestrationStateManager,
  StepSequencer,
};

// Re-export the orchestration types
// export * from './orchestration/index'; // This might be redundant or cause issues if index also exports types

//=============================================================================
// Provider-specific imports for re-export
//=============================================================================

/**
 * Re-export provider-specific classes and types
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  applyHistoryPolicy,
} from './utils/message-utils';

/**
 * Prompt utility functions
 * For generating system prompts from agent configs
 */
export { createSystemPrompt, addOrchestrationToPrompt } from './utils/prompt-utils';

//=============================================================================
// Client components (Re-exported from AI SDK)
//=============================================================================

/**
 * Re-export client-side components and AI SDK types for React applications
 * These are used in both client and server components
 */
import type { UseChatOptions, UseChatHelpers, CreateMessage } from 'ai/react';

// Re-export AI SDK base types
export type { UseChatOptions, UseChatHelpers, CreateMessage };

// Also re-export from ai core for server components
import type { LanguageModel, CoreMessage } from 'ai';

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
  type ToolResultContent,
} from './evaluation';

// Explicit direct re-exports for problematic types
export type { EvaluationRunConfig } from './evaluation/runner';
export type { LLMJudgeConfig } from './evaluation/evaluators/llm'; // Assumes LLMJudgeConfig is exported by evaluators/llm/index.ts
export type { EvaluationRule, RuleConfig } from './evaluation/evaluators/rule-based'; // Assumes these are exported by evaluators/rule-based/index.ts
export type { NLPAccuracyEvaluatorConfig } from './evaluation/evaluators/nlp'; // Added export for NLPAccuracyEvaluatorConfig
export type { ToolUsageEvaluatorConfig, ToolUsageRule } from './evaluation/evaluators/tool';
export type { LexicalSimilarityEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { KeywordCoverageEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { SentimentEvaluatorConfig } from './evaluation/evaluators/lexical';
export type { ToxicityEvaluatorConfig } from './evaluation/evaluators/lexical';
