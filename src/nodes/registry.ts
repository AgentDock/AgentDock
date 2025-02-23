/**
 * @fileoverview Registry for custom nodes provided by consumers of the framework.
 * Implements Vercel AI SDK tool patterns with validation and type safety.
 */

import { tools as stockTools } from './stock-price';
import { tools as weatherTools } from './weather';
import type { Tool, ToolRegistry } from './types';

/**
 * Registry of consumer-provided custom nodes
 */
export const tools: ToolRegistry = {
  ...stockTools,
  ...weatherTools
};

// Add validation to ensure tools are registered
for (const [name, tool] of Object.entries(tools)) {
  validateCustomTool(tool);
  console.log(`Tool registered: ${name}`, {
    description: tool.description,
    hasExecute: 'execute' in tool,
    parameters: tool.parameters
  });
}

/**
 * Error handler for tool execution
 */
export function errorHandler(error: unknown) {
  if (error == null) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

/**
 * Get only the tools that are enabled for a specific agent
 * @param enabledTools Array of tool names from agent template
 * @returns Record of allowed custom tools for this agent
 */
export function getToolsForAgent(enabledTools: string[]): ToolRegistry {
  const allowedTools: ToolRegistry = {};
  
  for (const toolName of enabledTools) {
    if (toolName in tools) {
      allowedTools[toolName] = tools[toolName];
    }
  }
  
  return allowedTools;
}

/**
 * Get all registered custom tools/nodes.
 * These are additional to core framework tools.
 * @returns Record of all registered custom tools
 * @deprecated Use getToolsForAgent instead to respect template permissions
 */
export function getCustomTools(): ToolRegistry {
  return tools;
}

/**
 * Get a specific custom tool/node by name.
 * @param name Name of the custom tool
 * @returns The requested tool or undefined if not found
 */
export function getCustomToolByName(name: string): Tool | undefined {
  return tools[name];
}

/**
 * Validates a tool's configuration and implementation
 * @param tool Tool to validate
 * @returns true if valid, throws error if invalid
 */
export function validateCustomTool(tool: unknown): boolean {
  if (!tool || typeof tool !== 'object') throw new Error('Invalid tool format');
  const toolObj = tool as Tool;
  if (!toolObj.name) throw new Error('Tool must have a name');
  if (!toolObj.description) throw new Error('Tool must have a description');
  if (!toolObj.parameters) throw new Error('Tool must have parameters defined');
  
  // If tool has execute function, it must be async
  if ('execute' in toolObj && typeof toolObj.execute !== 'function') {
    throw new Error('Tool execute property must be a function');
  }

  return true;
}

/**
 * Registers a new custom tool
 * @param name Tool name
 * @param tool Tool implementation
 * @returns true if registration successful
 */
export function registerCustomTool(name: string, tool: Tool): boolean {
  if (name in tools) {
    throw new Error(`Tool ${name} already registered`);
  }

  validateCustomTool(tool);
  tools[name] = tool;
  return true;
}

/**
 * Unregisters a custom tool
 * @param name Tool name to unregister
 * @returns true if unregistration successful
 */
export function unregisterCustomTool(name: string): boolean {
  if (!(name in tools)) {
    throw new Error(`Tool ${name} not found`);
  }

  delete tools[name];
  return true;
}

/**
 * Gets metadata about a registered tool
 * @param name Tool name
 * @returns Tool metadata or undefined if not found
 */
export function getCustomToolMetadata(name: string) {
  const tool = tools[name];
  if (!tool) return undefined;

  return {
    name: tool.name,
    description: tool.description,
    hasExecute: 'execute' in tool,
    parameters: tool.parameters
  };
}

// Future enhancements:
// - registerCustomTool(name: string, tool: unknown)
// - unregisterCustomTool(name: string)
// - validateCustomTool(tool: unknown)
// - getCustomToolMetadata(name: string) 