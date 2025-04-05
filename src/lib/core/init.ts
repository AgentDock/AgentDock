/**
 * @fileoverview Centralized initialization for AgentDock
 * This is the single entry point for all system initialization
 */

import { logger, LogCategory, LogLevel } from 'agentdock-core';

// In server components, we need to be careful about initialization
// to avoid non-serializable objects being passed to client components

// Detect if we're running on the server or client
const isServer = typeof window === 'undefined';

// Initialize the logger without any side effects that could cause RSC serialization issues
export function setupLogger() {
  // Set log level to INFO to reduce excessive debug logging
  logger.setLogLevel(LogLevel.INFO);
  
  return {
    info: (message: string) => {
      logger.info(LogCategory.SYSTEM, 'System', message);
    },
    error: (message: string, error?: unknown) => {
      logger.error(
        LogCategory.SYSTEM,
        'System',
        message,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };
}

// This function should only be called from client components
export function initSystem(): void {
  // Skip initialization on the server to avoid RSC serialization issues
  if (isServer) {
    return;
  }
  
  const log = setupLogger();
  
  try {
    // Check if the system is already initialized using a simpler approach
    if (typeof window !== 'undefined' && (window as any).__systemInitialized) {
      logger.debug(LogCategory.SYSTEM, 'System', 'System already initialized, skipping');
      return;
    }
    
    log.info('Initializing AgentDock system');
    
    // Set global initialization flag on the window object instead of global
    if (typeof window !== 'undefined') {
      (window as any).__systemInitialized = true;
    }
    
    // Tool registry initialization will be handled by the client component
    
    log.info('System initialized successfully');
  } catch (error) {
    log.error('Failed to initialize system', error);
  }
}

// Do NOT auto-initialize the system here to avoid RSC serialization issues
// Initialization will be done in client components 