/**
 * @fileoverview Registry for custom tools.
 * 
 * In AgentDock, tools are a specialized type of node that can be used by AI agents.
 * This registry manages the custom tools implemented in the src/nodes directory.
 */

import { tools as stockTools } from './stock-price';
import { tools as weatherTools } from './weather';
import { tools as searchTools } from './search';
import { tools as deepResearchTools } from './deep-research';
import { tools as firecrawlTools } from './firecrawl';
import type { ToolRegistry } from './types';

// Combined tools registry
export const allTools: ToolRegistry = {
  ...stockTools,
  ...weatherTools,
  ...searchTools,
  ...deepResearchTools,
  ...firecrawlTools
};

/**
 * Gets tools available for a specific agent based on their node configuration
 */
export function getToolsForAgent(nodeNames: string[]): ToolRegistry {
  const tools: ToolRegistry = {};
  nodeNames.forEach(name => {
    if (allTools[name]) {
      tools[name] = allTools[name];
    }
  });
  return tools;
}

/**
 * Gets metadata about a tool
 */
export function getToolMetadata(name: string) {
  const tool = allTools[name];
  if (tool) {
    return {
      name: tool.name,
      description: tool.description,
      hasExecute: 'execute' in tool,
      parameters: tool.parameters
    };
  }
  return undefined;
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

// Future enhancements:
// - registerCustomTool(name: string, tool: unknown)
// - unregisterCustomTool(name: string)
// - validateCustomTool(tool: unknown)
// - getCustomToolMetadata(name: string) 