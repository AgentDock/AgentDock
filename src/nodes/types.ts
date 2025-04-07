/**
 * @fileoverview Tool types that match both Core and Vercel AI SDK requirements
 * 
 * In AgentDock, tools are a specialized type of node that can be used by AI agents.
 * This file defines the types for these custom tools, ensuring compatibility with
 * both the AgentDock Core framework and the Vercel AI SDK.
 */

import { z } from 'zod';
// Import the proper ToolRegistry interface from agentdock-core
import type { ToolRegistry } from 'agentdock-core';

/**
 * LLM context for tool execution
 * This provides tools with access to LLM capabilities
 */
export interface LLMContext {
  /** API key for LLM access */
  apiKey: string;
  /** LLM provider (e.g., 'anthropic', 'openai') */
  provider: string;
  /** LLM model to use */
  model: string;
  /** LLM instance (if available) */
  llm?: any;
  /** Optional callback for reporting token usage */
  onUsageAvailable?: (usage: import('agentdock-core').TokenUsage) => void;
}

/**
 * Tool execution options as required by Vercel AI SDK
 */
export interface ToolExecutionOptions {
  toolCallId: string;
  sessionId: string;
  messages?: any[];
  /** API key for LLM access (optional, provided by agent) */
  apiKey?: string;
  /** LLM context for tool execution (optional) */
  llmContext?: LLMContext;
  /** Optional handler from AgentNode to update cumulative token usage */
  updateUsageHandler?: (usage: import('agentdock-core').TokenUsage) => Promise<void>;
}

/**
 * Core tool interface that matches both Core and Vercel AI requirements
 */
export interface Tool<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute(params: TParams, options: ToolExecutionOptions): Promise<TResult>;
}

/**
 * Collection of tools indexed by name
 */
export type ToolCollection = Record<string, Tool>;

// Re-export the ToolRegistry interface for use in this package
export type { ToolRegistry };

/**
 * Error handler function type
 */
export function errorHandler(error: unknown): string {
  if (error == null) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

/**
 * Default tool configuration
 */
export const DEFAULT_TOOL_CONFIG = {
  maxSteps: 5,
  toolCallStreaming: true,
  getErrorMessage: errorHandler
}; 