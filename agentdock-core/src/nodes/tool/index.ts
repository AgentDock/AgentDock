/**
 * @fileoverview Tool interface and utilities for AgentDock
 * Based on Vercel AI SDK tool patterns
 */

import { z } from 'zod';
import { BaseNode, NodeMetadata, NodePort } from '../base-node';
import { createError, ErrorCode } from '../../errors';
import { NodeCategory } from '../../types/node-category';

/**
 * Base tool registration options
 */
export interface ToolRegistrationOptions {
  /** Whether this node can act as a tool */
  isTool?: boolean;
  /** Tool parameters schema (if isTool is true) */
  parameters?: z.ZodSchema;
  /** Tool description (if isTool is true) */
  description?: string;
  /** Optional custom metadata */
  metadata?: Partial<NodeMetadata>;
}

/**
 * Tool creation options with required fields
 */
export interface ToolCreationOptions {
  /** Tool name for registration and lookup */
  name: string;
  /** Tool description for LLM usage */
  description: string;
  /** Tool parameters schema */
  parameters: z.ZodSchema;
  /** Optional custom metadata */
  metadata?: Partial<NodeMetadata>;
}

/**
 * JSON Schema type for tool parameters
 */
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
 * Tool execution result type
 */
export type ToolResult<T = unknown> = {
  toolCallId: string;
  result: T;
  error?: string;
};

/**
 * Tool interface with JSON Schema parameters
 */
export interface Tool<TParams = unknown, TResult = unknown> extends BaseNode {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(params: TParams): Promise<ToolResult<TResult>>;
}

/**
 * Base tool implementation with unified registration
 */
export abstract class BaseTool<TParams = unknown, TResult = unknown> extends BaseNode implements Tool<TParams, TResult> {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: JSONSchema;

  constructor(id: string, options: ToolCreationOptions) {
    const metadata: NodeMetadata = {
      version: '1.0.0',
      category: 'custom',
      label: options.name,
      description: options.description,
      inputs: [{
        id: 'params',
        type: 'object',
        label: 'Parameters',
        required: true
      }],
      outputs: [{
        id: 'result',
        type: 'object',
        label: 'Result'
      }],
      compatibility: {
        core: false,
        pro: true,
        custom: true
      },
      ...options.metadata
    };

    super(id, metadata);
    
    this.name = options.name;
    this.description = options.description;
    
    // Instead of conversion, we'll need to provide JSONSchema directly
    this.parameters = {
      type: 'object',
      properties: {},
      required: []
    };

    // Register message handlers
    this.addMessageHandler('execute', async (params: unknown) => {
      const result = await this.execute(params as TParams);
      await this.sendMessage('tool-result', 'result', JSON.stringify(result));
    });
  }

  public get type(): string {
    return 'node';
  }

  protected getCategory(): NodeCategory {
    return NodeCategory.CUSTOM;
  }

  protected getLabel(): string {
    return this.name;
  }

  protected getDescription(): string {
    return this.description;
  }

  protected getInputs(): NodePort[] {
    return [{
      id: 'params',
      type: 'object',
      label: 'Parameters',
      required: true
    }];
  }

  protected getOutputs(): NodePort[] {
    return [{
      id: 'result',
      type: 'object',
      label: 'Result'
    }];
  }

  protected getVersion(): string {
    return '1.0.0';
  }

  protected getCompatibility(): NodeMetadata['compatibility'] {
    return {
      core: false,
      pro: true,
      custom: true
    };
  }

  public abstract execute(params: TParams): Promise<ToolResult<TResult>>;
}

/**
 * Helper function to create a tool with type inference
 */
export function createTool<TParams, TResult>(options: ToolCreationOptions & {
  execute: (params: TParams) => Promise<TResult>;
}): Tool<TParams, TResult> {
  const id = crypto.randomUUID();
  
  return new class extends BaseTool<TParams, TResult> {
    constructor() {
      super(id, options);
    }

    async execute(params: TParams): Promise<ToolResult<TResult>> {
      const result = await options.execute(params);
      return {
        toolCallId: crypto.randomUUID(),
        result
      };
    }
  }();
}

/**
 * Example usage:
 * ```typescript
 * const weatherTool = createTool({
 *   name: 'weather',
 *   description: 'Get the weather for a location',
 *   parameters: z.object({
 *     location: z.string().describe('The location to get weather for'),
 *     unit: z.enum(['celsius', 'fahrenheit']).optional()
 *   }),
 *   execute: async ({ location, unit }) => {
 *     // Implementation
 *     return { temperature: 72, conditions: 'sunny' };
 *   }
 * });
 * ```
 */ 