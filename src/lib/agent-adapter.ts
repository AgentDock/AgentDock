/**
 * @fileoverview Adapter for AgentDock Core to work with Next.js.
 * This provides a clean abstraction for tool registration and discovery.
 */

import { DefaultToolRegistry, setToolRegistry, logger, LogCategory } from 'agentdock-core';
import { allTools } from '@/nodes/registry';

/**
 * NextJs tool registry implementation that wraps tools to inject LLM context
 */
export class NextJsToolRegistry extends DefaultToolRegistry {
  constructor() {
    super();
    
    // Register all tools from the central registry
    Object.entries(allTools).forEach(([name, tool]) => {
      this.registerTool(name, this.wrapToolWithLLMContext(tool));
    });
  }
  
  /**
   * Wrap a tool to inject LLM context
   * This ensures all tools have access to the LLM capabilities from the agent
   */
  private wrapToolWithLLMContext(tool: any): any {
    const originalExecute = tool.execute;
    
    // Create a new execute function that ensures LLM context is available
    tool.execute = async (params: any, options: any) => {
      try {
        // If llmContext is already provided by the agent, use it
        if (options.llmContext) {
          return await originalExecute(params, options);
        }
        
        // If no llmContext is provided, log a warning but proceed with original options
        // This allows tools to function without LLM capabilities when needed
        logger.warn(
          LogCategory.NODE, 
          'ToolRegistry', 
          `Tool ${tool.name} executed without LLM context. Some functionality may be limited.`
        );
        
        // Call the original execute function with the original options
        return await originalExecute(params, options);
      } catch (error) {
        logger.error(
          LogCategory.NODE, 
          'ToolRegistry', 
          `Error executing tool ${tool.name}:`, 
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
        throw error;
      }
    };
    
    return tool;
  }
}

// Export for use in other files
export const toolRegistry = new NextJsToolRegistry();

// Set the global tool registry
setToolRegistry(toolRegistry); 