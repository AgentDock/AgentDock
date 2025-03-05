/**
 * @fileoverview Handles initialization for custom tools.
 * Serves as the single entry point for all tool registration in the system.
 */

// Global flag to persist across hot reloads
declare global {
  var __toolRegistryInitialized: boolean;
}

/**
 * Initialize the tool registry with custom tools
 * This is called once at system startup
 */
export function initToolRegistry() {
  // Prevent multiple initializations
  if (global.__toolRegistryInitialized) {
    console.log('Tool registry already initialized, skipping');
    return;
  }

  try {
    console.log('Initializing tool registry...');
    
    // Custom tools are registered in registry.ts when it's imported
    
    // Mark as initialized globally
    global.__toolRegistryInitialized = true;
  } catch (error) {
    console.error('Failed to initialize tool registry:', error);
    throw error;
  }
}

// Auto-initialization removed to prevent duplicate registrations
// initToolRegistry(); 