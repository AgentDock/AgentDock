/**
 * @fileoverview Adapter for integrating AgentNode with the Next.js implementation.
 * This provides a bridge between the AgentNode abstraction and the existing tool registry.
 */

import { setToolRegistry, ToolRegistry } from 'agentdock-core';
import { getToolsForAgent } from '@/nodes/registry';

/**
 * Next.js implementation of the tool registry
 */
class NextJsToolRegistry implements ToolRegistry {
  /**
   * Get tools for a specific agent based on node names
   */
  getToolsForAgent(nodeNames: string[]): Record<string, any> {
    return getToolsForAgent(nodeNames);
  }
}

// Set the registry on startup
setToolRegistry(new NextJsToolRegistry());

// Export for use in other files
export const toolRegistry = new NextJsToolRegistry(); 