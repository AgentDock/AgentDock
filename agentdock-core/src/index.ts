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
 * Includes CoreLLM, createLLM, and provider-specific model creation functions
 */
export * from './llm';

//=============================================================================
// Provider-specific imports for re-export
//=============================================================================

/**
 * Re-export provider-specific classes and types
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
export { GoogleGenerativeAI };

//=============================================================================
// Client components (Re-exported from AI SDK)
//=============================================================================

/**
 * Re-export client-side components and AI SDK types for React applications
 * These are used in both client and server components
 */
import type {
  UseChatOptions,
  UseChatHelpers,
  Message as AISdkMessage,
  CreateMessage
} from 'ai/react';

// Re-export AI SDK base types
export type { 
  AISdkMessage, // Re-export as AISdkMessage to avoid naming conflicts
  UseChatOptions,
  UseChatHelpers,
  CreateMessage
};

// Also re-export from ai core for server components
import type {
  LanguageModel,
  CoreMessage
} from 'ai';

export type {
  LanguageModel,
  CoreMessage
};