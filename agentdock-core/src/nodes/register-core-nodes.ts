/**
 * @fileoverview Core node registration for AgentDock.
 * This file registers all core nodes with the NodeRegistry.
 */

import { AgentNode } from './agent-node';
import { NodeRegistry } from './node-registry';

/**
 * Register all core nodes with the registry
 */
export function registerCoreNodes(): void {
  // Register core nodes
  NodeRegistry.register('core.agent', AgentNode, '1.0.0');
}

// Auto-registration removed to prevent duplicate registrations
// registerCoreNodes();
