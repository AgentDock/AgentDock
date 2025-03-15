/**
 * @fileoverview Tool types that match both Core and Vercel AI SDK requirements
 * 
 * In AgentDock, tools are a specialized type of node that can be used by AI agents.
 * This file defines the types for these custom tools, ensuring compatibility with
 * both the AgentDock Core framework and the Vercel AI SDK.
 */

import { z } from 'zod';

/**
 * Tool execution options as required by Vercel AI SDK
 */
export interface ToolExecutionOptions {
  toolCallId: string;
  messages?: any[];
  /** API key for LLM access (optional, provided by agent) */
  apiKey?: string;
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
 * Registry for managing tool availability and execution
 */
export type ToolRegistry = Record<string, Tool>;

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