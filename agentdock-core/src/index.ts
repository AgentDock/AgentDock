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
/**
 * Basic type definitions used throughout the framework
 *
 * NOTE: Some type names are exported from multiple modules (Tool, ToolResult, TextContent, etc.)
 * This creates linter warnings but does not affect functionality. TypeScript will use the last
 * export in the resolution order.
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
 *
 * NOTE: This exports Tool, ToolResult, ToolRegistrationOptions which conflict with ./types/tools
 * but both are needed for different use cases. Linter warnings can be ignored.
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

/**
 * Configuration factory functions for different deployment scenarios
 * No auto-detection - parent application explicitly chooses configuration
 */
export {
  createLocalConfig,
  createProductionConfig,
  createCustomConfig,
  validateConfig,
  type AgentDockConfig,
  type StorageConfigOptions
} from './config/index';

// Export presets for easy access
export {
  localPreset,
  productionPreset,
  productionAutoScalePreset
} from './config/presets';

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
// Storage System (Browser-safe only)
//=============================================================================

/**
 * Browser-compatible storage providers and utilities
 *
 * For server-only adapters (SQLite, PostgreSQL), import from:
 * import { SQLiteAdapter, PostgreSQLAdapter } from '@agentdock/core/server'
 */

// Browser-safe adapter registration functions are in the server export
// For server-side adapter registration, import from:
// import { registerAgentChatAdapters } from '@agentdock/core/server'

// NOTE: Optional adapter registration functions are NOT exported to prevent bundling.
// To use them, import directly:
// import { registerMongoDBAdapter, registerCloudAdapters, registerVectorAdapters } from 'agentdock-core/storage/adapters/registry';

// Export memory storage types
export type {
  MemoryOperations,
  MemoryData,
  MemoryRecallOptions
} from './storage/types';

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
 *
 * NOTE: This exports CoreMessage, LanguageModel which are also explicitly re-exported below.
 * Linter warnings can be ignored.
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
// Memory system
//=============================================================================

/**
 * Memory system
 * Multi-layered memory architecture for AI agents including:
 * - Working Memory (fast, ephemeral context)
 * - Episodic Memory (time-ordered experiences)
 * - Semantic Memory (long-term knowledge)
 * - Procedural Memory (learned patterns)
 *
 * @todo SUGGESTED: Add top-level convenience exports for easier library usage
 * ```typescript
 * // Export convenience factory functions at top level for better DX:
 * export {
 *   createMemorySystem,     // From ./memory - complete memory system setup
 *   createRecallService,    // From ./memory/services - standalone recall service
 *   createQuickRecall,      // From ./memory - fastest setup for recall
 *   createMemoryManager,    // From ./memory - standalone memory manager
 *   RECALL_CONFIG_PRESETS,  // From ./memory/services - preset configurations
 *   MEMORY_CONFIG_PRESETS   // From ./memory/services - preset configurations
 * } from './memory';
 *
 * // This would enable simple usage like:
 * import { createMemorySystem, createRecallService } from 'agentdock-core';
 *
 * // Instead of current complex setup:
 * import {
 *   MemoryManager,
 *   RecallService,
 *   SQLiteAdapter
 * } from 'agentdock-core';
 * const storage = new SQLiteAdapter('./db');
 * const memoryManager = new MemoryManager(storage, complexConfig);
 * const recallService = new RecallService(...params, moreComplexConfig);
 * ```
 */
// Export memory types with renamed Message to avoid conflicts
export type {
  // Memory interfaces
  Memory,
  MemoryMessage,
  MemoryType,

  // Working Memory
  WorkingMemory,
  WorkingMemoryData,
  WorkingMemoryConfig,
  WorkingMemoryOptions,

  // Episodic Memory
  EpisodicMemory,
  EpisodicMemoryData,
  EpisodicMemoryConfig,
  EpisodicMemoryOptions,
  ConsolidationResult,
  DecayResult,

  // Semantic Memory
  SemanticMemory,
  SemanticMemoryData,
  SemanticMemoryConfig,
  SemanticMemoryOptions,
  VectorSearchResult,

  // Procedural Memory
  ProceduralMemory,
  ProceduralMemoryData,
  ProceduralMemoryConfig,
  ProceduralMemoryOptions,
  ProceduralPattern,
  LearningResult,

  // Configuration
  MemoryManagerConfig
} from './memory';

// Export memory system classes and services
export {
  MemoryManager,
  RecallService,
  // PRIME extraction system
  PRIMEExtractor,
  PRIMEOrchestrator,
  createPRIMEOrchestrator
} from './memory';

/**
 * @todo SUGGESTED: Add these convenience exports after implementing factory functions
 * ```typescript
 * // Would be exported after implementing the factory functions in ./memory:
 * export {
 *   createMemorySystem,      // Complete memory system with all components
 *   createRecallService,     // Standalone RecallService with presets
 *   createQuickRecall,       // Fastest way to get a working RecallService
 *   createMemoryManager,     // Standalone MemoryManager with presets
 *   RECALL_CONFIG_PRESETS,   // Preset configurations for RecallService
 *   MEMORY_CONFIG_PRESETS    // Preset configurations for MemoryManager
 * } from './memory';
 * ```
 */

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

// Re-export AI SDK base types (explicit re-exports for convenience)
export type { UseChatOptions, UseChatHelpers, CreateMessage };
export type { LanguageModel, CoreMessage };

//=============================================================================
// Evaluation System
//=============================================================================
/**
 * NOTE: Evaluation system exports TextContent, ImageContent, MessageContent, etc.
 * which conflict with types/messages exports. Both are needed for their respective use cases.
 * Linter warnings can be ignored.
 */
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
