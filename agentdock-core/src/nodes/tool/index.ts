/**
 * @fileoverview Tool interface and utilities for AgentDock
 * Based on Vercel AI SDK tool patterns
 */

import { z } from 'zod';
import { BaseNode, NodeMetadata } from '../base-node';
import { createError, ErrorCode } from '../../errors';

/**
 * Options for registering a tool node
 */
export interface ToolRegistrationOptions {
  /** Whether this node can act as a tool */
  isTool?: boolean;
  /** Tool parameters schema (if isTool is true) */
  parameters?: z.ZodSchema;
  /** Tool description (if isTool is true) */
  description?: string;
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
  /**
   * Tool name for registration and lookup
   */
  name: string;

  /**
   * Description of what the tool does
   * Used by LLMs to determine when to use the tool
   */
  description: string;

  /**
   * JSON Schema for tool parameters
   * Used for validation and LLM parameter generation
   */
  parameters: JSONSchema;

  /**
   * Execute the tool with given parameters
   * @param params Tool parameters
   * @returns Tool execution result
   */
  execute(params: TParams): Promise<ToolResult<TResult>>;
}

/**
 * Base tool implementation
 */
export abstract class BaseTool<TParams = unknown, TResult = unknown> extends BaseNode implements Tool<TParams, TResult> {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: JSONSchema;
  private readonly _metadata: NodeMetadata;

  constructor(config: {
    id: string;
    name: string;
    description: string;
    parameters: z.ZodSchema<TParams>;
  }) {
    const metadata: NodeMetadata = {
      version: '1.0.0',
      category: 'custom',
      label: config.name,
      description: config.description,
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
      }
    };

    super(config.id, metadata);
    
    this.name = config.name;
    this.description = config.description;
    this.parameters = zodToJsonSchema(config.parameters);
    this._metadata = metadata;

    // Register message handlers
    this.addMessageHandler('execute', async (params: unknown) => {
      const result = await this.execute(params as TParams);
      await this.sendMessage('tool-result', 'result', JSON.stringify(result));
    });
  }

  public get type(): string {
    return 'node';
  }

  public getCategory(): 'core' | 'custom' {
    return 'custom';
  }

  public getLabel(): string {
    return this._metadata.label;
  }

  public getDescription(): string {
    return this._metadata.description;
  }

  public getMetadata(): NodeMetadata {
    return this._metadata;
  }

  public getInputs(): NodeMetadata['inputs'] {
    return this._metadata.inputs;
  }

  public getOutputs(): NodeMetadata['outputs'] {
    return this._metadata.outputs;
  }

  public getVersion(): string {
    return this._metadata.version;
  }

  public getCompatibility(): NodeMetadata['compatibility'] {
    return this._metadata.compatibility;
  }

  public abstract execute(params: TParams): Promise<ToolResult<TResult>>;
}

/**
 * Helper function to create a tool with type inference
 */
export function createTool<TParams, TResult>(config: {
  name: string;
  description: string;
  parameters: z.ZodSchema<TParams>;
  execute: (params: TParams) => Promise<TResult>;
}): Tool<TParams, TResult> {
  const id = crypto.randomUUID();
  
  return new class extends BaseTool<TParams, TResult> {
    constructor() {
      super({
        id,
        name: config.name,
        description: config.description,
        parameters: config.parameters
      });
    }

    async execute(params: TParams): Promise<ToolResult<TResult>> {
      const result = await config.execute(params);
      return {
        toolCallId: crypto.randomUUID(),
        result
      };
    }
  }();
}

/**
 * Convert Zod schema to JSON Schema
 * This is a simplified version - extend as needed
 */
function zodToJsonSchema(schema: z.ZodType<any>): JSONSchema {
  if (!(schema instanceof z.ZodType)) {
    throw createError(
      'node',
      'Invalid Zod schema',
      ErrorCode.NODE_VALIDATION
    );
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (value instanceof z.ZodType) {
        properties[key] = zodToJsonSchema(value);
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  if (schema instanceof z.ZodString) {
    return {
      type: 'string',
      description: schema.description
    };
  }

  if (schema instanceof z.ZodNumber) {
    return {
      type: 'number',
      description: schema.description
    };
  }

  if (schema instanceof z.ZodBoolean) {
    return {
      type: 'boolean',
      description: schema.description
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
      description: schema.description
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema._def.values,
      description: schema.description
    };
  }

  throw createError(
    'node',
    'Unsupported Zod schema type',
    ErrorCode.NODE_VALIDATION
  );
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