/**
 * @fileoverview Core tool type definitions for AgentDock
 */

import { z } from 'zod';
import { BaseNode, NodeMetadata } from '../nodes/base-node';

// Tool registration types
export interface ToolRegistrationOptions {
  /** Whether this node can act as a tool */
  isTool?: boolean;
  /** Tool parameters schema (if isTool is true) */
  parameters?: z.ZodSchema;
  /** Tool description (if isTool is true) */
  description?: string;
}

// Tool invocation states
export type ToolState = 'partial-call' | 'call' | 'result';

export interface BaseToolInvocation {
  state: ToolState;
  toolName: string;
  toolCallId: string;
}

export interface PartialToolCall extends BaseToolInvocation {
  state: 'partial-call';
}

export interface ToolCall extends BaseToolInvocation {
  state: 'call';
  args?: Record<string, any>;
}

export interface ToolResult extends BaseToolInvocation {
  state: 'result';
  result: any;
  error?: string;
}

export type ToolInvocation = PartialToolCall | ToolCall | ToolResult;

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