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
import { cryptoPriceTool, trendingCryptosTool } from './crypto-price';
import { tools as snowtracerTools } from './snowtracer/index';
import { tools as imageGenerationTools } from './image-generation';
import { tools as cognitiveTools } from './cognitive-tools';
import { tools as scienceTools } from './science';
import type { ToolCollection } from './types';
import { logger, LogCategory } from 'agentdock-core';

// Combined tools registry
export const allTools: ToolCollection = {
  ...stockTools,
  ...weatherTools,
  ...searchTools,
  ...deepResearchTools,
  ...firecrawlTools,
  ...snowtracerTools,
  ...imageGenerationTools,
  ...cognitiveTools,
  ...scienceTools,
  crypto_price: cryptoPriceTool,
  trending_cryptos: trendingCryptosTool
};

// Log all available tools
logger.debug(
  LogCategory.NODE,
  'ToolRegistry',
  'Available tools',
  { toolCount: Object.keys(allTools).length, tools: Object.keys(allTools) }
);

/**
 * Gets tools available for a specific agent based on their node configuration
 */
export function getToolsForAgent(nodeNames: string[]): ToolCollection {
  const tools: ToolCollection = {};
  nodeNames.forEach(name => {
    if (allTools[name]) {
      tools[name] = allTools[name];
    }
  });
  
  logger.debug(
    LogCategory.NODE,
    'ToolRegistry',
    'Got tools for agent',
    { 
      requestedTools: nodeNames.length,
      availableTools: Object.keys(tools).length,
      tools: Object.keys(tools)
    }
  );
  
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

/**
 * Debug helper for LLM context tracing
 * This patch helps track LLM context throughout the tool execution flow
 */
export function debugToolWithLLMContext(toolName: string, context: any) {
  if (!context) {
    logger.warn(
      LogCategory.NODE,
      `[${toolName}]`,
      'No context provided to tool',
      { tool: toolName }
    );
    return;
  }
  
  // Check for llmContext
  if (!context.llmContext) {
    logger.warn(
      LogCategory.NODE,
      `[${toolName}]`,
      'No llmContext in options',
      { 
        tool: toolName,
        availableKeys: Object.keys(context).join(', ')
      }
    );
    return;
  }
  
  // Check for LLM in context
  if (!context.llmContext.llm) {
    logger.warn(
      LogCategory.NODE,
      `[${toolName}]`,
      'No LLM in llmContext',
      { 
        tool: toolName,
        contextKeys: Object.keys(context.llmContext).join(', ')
      }
    );
    return;
  }
  
  logger.debug(
    LogCategory.NODE,
    `[${toolName}]`,
    'LLM context verified',
    {
      tool: toolName,
      hasLLM: !!context.llmContext.llm,
      provider: context.llmContext.provider,
      model: context.llmContext.model
    }
  );
}

// Future enhancements:
// - registerCustomTool(name: string, tool: unknown)
// - unregisterCustomTool(name: string)
// - validateCustomTool(tool: unknown)
// - getCustomToolMetadata(name: string) 