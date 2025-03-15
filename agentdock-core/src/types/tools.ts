/**
 * @fileoverview Core tool type definitions for AgentDock
 */

import { z } from 'zod';
import { BaseNode, NodeMetadata } from '../nodes/base-node';
import { CoreLLM } from '../llm';

// Tool registration types
export interface ToolRegistrationOptions {
  /** Whether this node can act as a tool */
  isTool?: boolean;
  /** Tool parameters schema (if isTool is true) */
  parameters?: z.ZodSchema;
  /** Tool description (if isTool is true) */
  description?: string;
}

// Tool state enum
export type ToolState = 'call' | 'result' | 'error';

// Base tool invocation interface
export interface BaseToolInvocation {
  state: ToolState;
  toolName: string;
  toolCallId: string;
}

// Tool call interface
export interface ToolCall extends BaseToolInvocation {
  state: 'call';
  args?: Record<string, any>;
}

// Tool result interface
export interface ToolResult<T = unknown> {
  toolCallId: string;
  result: T;
  error?: string;
}

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
  llm?: CoreLLM;
}

/**
 * Tool execution options
 * These are passed to tools when they are executed
 */
export interface ToolExecutionOptions {
  /** Tool call ID for tracking */
  toolCallId: string;
  /** Messages in the conversation (optional) */
  messages?: any[];
  /** LLM context for tool execution (optional) */
  llmContext?: LLMContext;
}

// Tool interface types
export type JSONSchema = {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  default?: unknown;
};

/**
 * Tool interface with JSON Schema parameters for type-safe tool execution
 * Extends BaseNode to provide core node functionality while adding tool-specific features
 */
export interface Tool<TParams = unknown, TResult = unknown> extends BaseNode {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: TParams): Promise<ToolResult>;
} 