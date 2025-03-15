/**
 * @fileoverview Adapter for AgentDock Core to work with Next.js.
 * This provides a clean abstraction for tool registration and discovery.
 */

import { DefaultToolRegistry, setToolRegistry } from 'agentdock-core';
import { tools as searchTools } from '@/nodes/search';
import { tools as deepResearchTools } from '@/nodes/deep-research';
import { tools as firecrawlTools } from '@/nodes/firecrawl';

/**
 * NextJs tool registry implementation that wraps tools to inject LLM context
 */
export class NextJsToolRegistry extends DefaultToolRegistry {
  constructor() {
    super();
    
    // Register all tools
    Object.entries(searchTools).forEach(([name, tool]) => {
      this.registerTool(name, this.wrapToolWithLLMContext(tool));
    });
    
    Object.entries(deepResearchTools).forEach(([name, tool]) => {
      this.registerTool(name, this.wrapToolWithLLMContext(tool));
    });
    
    Object.entries(firecrawlTools).forEach(([name, tool]) => {
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
        
        // Otherwise, create a minimal context with just the API key
        // This is a fallback for direct tool calls outside of an agent
        const apiKey = process.env.ANTHROPIC_API_KEY || '';
        
        // Create new options with minimal LLM context
        const newOptions = {
          ...options,
          llmContext: {
            apiKey,
            provider: 'anthropic',
            model: 'claude-3-7-sonnet-20250219'
          }
        };
        
        // Call the original execute function with the new options
        return await originalExecute(params, newOptions);
      } catch (error) {
        console.error('Error executing tool with LLM context:', error);
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