/**
 * @fileoverview Core types for the AgentDock tool system.
 * Based on Vercel AI SDK patterns for tool handling.
 */

import { z } from 'zod';
import type { Tool as VercelTool } from 'ai';

/**
 * Required properties for our tools
 */
interface ToolMetadata {
  name: string;
  description: string;
}

/**
 * Tool type combining Vercel AI SDK Tool
 */
export type Tool<
  TParams extends z.ZodType = z.ZodType,
  TResult = any
> = VercelTool<TParams, TResult> & ToolMetadata;

/**
 * Tool execution options from Vercel AI SDK
 */
export interface ToolExecutionOptions {
  signal?: AbortSignal;
  // Add other options as needed
}

/**
 * Base interface for all tool results
 */
export interface BaseToolResult {
  timestamp: string;
}

/**
 * States a tool can be in during execution
 */
export type ToolState = 'partial-call' | 'call' | 'result';

/**
 * Base interface for tool invocations
 */
export interface ToolInvocation<TName extends string = string, TArgs = unknown> {
  toolCallId: string;
  toolName: TName;
  args: TArgs;
  state: ToolState;
  result?: unknown;
}

/**
 * Configuration for tool execution
 */
export interface ToolConfig {
  maxSteps?: number;
  toolCallStreaming?: boolean;
  getErrorMessage?: (error: unknown) => string;
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