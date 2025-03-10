/**
 * @fileoverview Centralized initialization for AgentDock
 * This is the single entry point for all system initialization
 */

import { logger, LogCategory, LogLevel } from 'agentdock-core';
import { initToolRegistry } from '@/nodes/init';

// Global initialization flag (will persist across hot reloads)
declare global {
  var __systemInitialized: boolean;
}

// Initialize the global flag if it doesn't exist
if (typeof global.__systemInitialized === 'undefined') {
  global.__systemInitialized = false;
}

/**
 * Initialize the entire AgentDock system
 * This is the single entry point for all initialization
 */
export function initSystem(): void {
  // Skip if already initialized
  if (global.__systemInitialized) {
    logger.debug(LogCategory.SYSTEM, 'System', 'System already initialized, skipping');
    return;
  }

  // Set log level to INFO to reduce excessive debug logging
  logger.setLogLevel(LogLevel.INFO);

  logger.info(LogCategory.SYSTEM, 'System', 'Initializing AgentDock system');
  
  try {
    // 1. Initialize tool registry (custom tools only)
    initToolRegistry();
    
    // 2. Initialize other subsystems here as needed
    // ...
    
    // Mark as initialized globally
    global.__systemInitialized = true;
    logger.info(LogCategory.SYSTEM, 'System', 'System initialized successfully');
  } catch (error) {
    logger.error(
      LogCategory.SYSTEM,
      'System',
      'Failed to initialize system',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

// Auto-initialize the system
// This ensures the system is initialized when this file is imported
initSystem(); 