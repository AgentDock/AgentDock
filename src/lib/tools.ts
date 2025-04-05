/**
 * @fileoverview Utility functions for lazy tool initialization
 * This ensures tools are only initialized when they're actually needed
 */

import { logger, LogCategory } from 'agentdock-core';
import { initToolRegistry } from '@/nodes/init';

// Track initialization state
let toolsInitialized = false;

/**
 * Lazily initialize tools only when needed
 * This function ensures tools are only initialized once per server instance
 * and only when they're about to be used
 */
export function ensureToolsInitialized(): void {
  if (toolsInitialized) {
    logger.debug(LogCategory.NODE, 'ToolInitializer', 'Tools already initialized, skipping');
    return;
  }

  // Performance measurement in development
  const startTime = performance.now();

  try {
    // Initialize tools
    initToolRegistry();
    
    // Mark as initialized
    toolsInitialized = true;
    
    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      const duration = Math.round(performance.now() - startTime);
      logger.info(
        LogCategory.NODE, 
        'ToolInitializer', 
        `Tools initialized successfully in ${duration}ms`
      );
    } else {
      logger.info(LogCategory.NODE, 'ToolInitializer', 'Tools initialized successfully');
    }
  } catch (error) {
    logger.error(
      LogCategory.NODE, 
      'ToolInitializer', 
      'Failed to initialize tools', 
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
    throw error;
  }
} 