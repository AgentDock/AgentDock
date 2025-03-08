/**
 * @fileoverview Tool registry for managing tool availability and execution.
 * This provides a clean abstraction for tool registration and discovery.
 */

import { logger, LogCategory } from '../logging';

/**
 * Interface for tool registry
 */
export interface ToolRegistry {
  /**
   * Get tools for a specific agent based on node names
   */
  getToolsForAgent(nodeNames: string[]): Record<string, any>;
}

/**
 * Default implementation of tool registry
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools: Record<string, any> = {};
  
  /**
   * Register a tool
   */
  registerTool(name: string, tool: any): void {
    this.tools[name] = tool;
    logger.debug(
      LogCategory.NODE,
      'ToolRegistry',
      'Registered tool',
      { name }
    );
  }
  
  /**
   * Get tools for a specific agent based on node names
   */
  getToolsForAgent(nodeNames: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    nodeNames.forEach(name => {
      if (this.tools[name]) {
        result[name] = this.tools[name];
      }
    });
    
    logger.debug(
      LogCategory.NODE,
      'ToolRegistry',
      'Got tools for agent',
      { 
        requestedTools: nodeNames.length,
        availableTools: Object.keys(result).length
      }
    );
    
    return result;
  }
}

// Global registry instance
let globalRegistry: ToolRegistry | null = null;

/**
 * Set the global tool registry
 */
export function setToolRegistry(registry: ToolRegistry): void {
  globalRegistry = registry;
  logger.debug(
    LogCategory.NODE,
    'ToolRegistry',
    'Set global tool registry'
  );
}

/**
 * Get the global tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new DefaultToolRegistry();
    logger.debug(
      LogCategory.NODE,
      'ToolRegistry',
      'Created default tool registry'
    );
  }
  return globalRegistry;
} 