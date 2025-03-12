/**
 * @fileoverview Handles initialization for custom tools.
 * Serves as the single entry point for all tool registration in the system.
 * 
 * In AgentDock, tools are a specialized type of node that can be used by AI agents.
 * This file initializes the registry for these custom tools.
 */

import { logger, LogCategory } from 'agentdock-core';

// Global flag to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __toolRegistryInitialized: boolean;
}

/**
 * Initialize the tool registry with custom tools
 * This is called once at system startup
 */
export function initToolRegistry() {
  // Prevent multiple initializations
  if (global.__toolRegistryInitialized) {
    logger.debug(LogCategory.NODE, '[NodeRegistry]', 'Tool registry already initialized, skipping');
    return;
  }

  try {
    logger.debug(LogCategory.NODE, '[NodeRegistry]', 'Initializing tool registry...');
    
    // Custom tools are registered in registry.ts when it's imported
    
    // Mark as initialized globally
    global.__toolRegistryInitialized = true;
  } catch (error) {
    logger.error(LogCategory.NODE, '[NodeRegistry]', 'Failed to initialize tool registry:', { error });
    throw error;
  }
}

// Auto-initialization removed to prevent duplicate registrations
// initToolRegistry();