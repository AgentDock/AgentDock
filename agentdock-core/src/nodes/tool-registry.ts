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
   * Register a tool with the registry
   */
  registerTool(name: string, tool: any): void;

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
    // Removed verbose logging for individual tool registration
    /*
    logger.debug(
      LogCategory.NODE,
      'ToolRegistry',
      'Registered tool',
      { name }
    );
    */
  }

  /**
   * Get tools for a specific agent based on node names
   */
  getToolsForAgent(nodeNames: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    nodeNames.forEach((name) => {
      if (this.tools[name]) {
        // Make a copy of the tool and ensure its name matches its registry key
        const tool = { ...this.tools[name] };
        if (!tool.name || tool.name !== name) {
          logger.debug(
            LogCategory.NODE,
            'ToolRegistry',
            'Updating tool name to match registry key',
            {
              registryKey: name,
              originalName: tool.name || 'undefined',
            },
          );
          tool.name = name;
        }
        result[name] = tool;
      }
    });

    logger.debug(LogCategory.NODE, 'ToolRegistry', 'Core: Got tools for agent', {
      requestedTools: nodeNames.length,
      availableTools: Object.keys(result).length,
      tools: Object.keys(result).join(', '),
    });

    return result;
  }
}

// --- Robust Singleton Implementation ---
declare global {
  // eslint-disable-next-line no-var
  var __agentdockToolRegistryInstance: ToolRegistry | undefined;
}

/**
 * Get the global tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalThis.__agentdockToolRegistryInstance) {
    globalThis.__agentdockToolRegistryInstance = new DefaultToolRegistry();
    logger.debug(
      LogCategory.NODE,
      'ToolRegistry',
      'Core: Created default tool registry instance on globalThis',
    );
  }
  return globalThis.__agentdockToolRegistryInstance;
}

/**
 * Set the global tool registry
 */
export function setToolRegistry(registry: ToolRegistry): void {
  globalThis.__agentdockToolRegistryInstance = registry;
  logger.debug(
    LogCategory.NODE,
    'ToolRegistry',
    'Core: Set global tool registry instance on globalThis',
  );
}
// --- Singleton Implementation ---
