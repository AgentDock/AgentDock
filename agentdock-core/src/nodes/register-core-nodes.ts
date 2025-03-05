/**
 * @fileoverview Core node registration for AgentDock.
 * This file registers all core nodes with the NodeRegistry.
 * 
 * Note: These components are part of the extensibility system
 * and may be utilized in future versions of the framework.
 */

import { NodeRegistry } from './node-registry';
import { AgentNode } from './agent-node';
import { ChatNode } from './chat';

/**
 * Register all core nodes with the registry
 */
export function registerCoreNodes(): void {
  // Register core nodes
  NodeRegistry.register('core.agent', AgentNode, '1.0.0');
  NodeRegistry.register('core.chat', ChatNode, '1.0.0');
}

// Auto-registration removed to prevent duplicate registrations
// registerCoreNodes(); 
 