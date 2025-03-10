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
export * from './types/agent-config';  // Agent configuration
export * from './types/messages';      // Message types
export * from './types/node-category';
export type {
  ToolState,
  BaseToolInvocation,
  PartialToolCall,
  ToolCall,
  ToolResult,
  ToolInvocation,
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
 * Includes LLMBase, AnthropicLLM, and related types
 */
export * from './llm';