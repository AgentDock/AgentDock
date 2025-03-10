/**
 * @fileoverview Core node registration for AgentDock consumer app.
 * This file registers all core nodes with the NodeRegistry.
 */

import { NodeRegistry , logger, LogCategory } from 'agentdock-core';
import { ChatNode } from '@/lib/store/chat-node';

/**
 * Register all core nodes with the registry
 */
export function registerCoreNodes(): void {
  try {
    // Register core chat node
    // Note: Provider-specific nodes will be handled by AISDKAdapter later
    NodeRegistry.register('chat', ChatNode, '1.0.0');

    logger.info(
      LogCategory.SYSTEM,
      'NodeRegistry',
      'Core nodes registered successfully',
      { nodes: ['chat'] }
    );
  } catch (error) {
    logger.error(
      LogCategory.SYSTEM,
      'NodeRegistry',
      'Failed to register core nodes',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
    throw error; // Re-throw to be handled by the store
  }
} 