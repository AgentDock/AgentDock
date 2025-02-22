/**
 * @fileoverview Core exports for the AgentDock framework
 */

// Core types
export * from './types/agent-config';  // Agent configuration
export * from './types/messages';      // Message types

// Core functionality
export * from './nodes';              // Node implementations
export * from './providers';          // Provider implementations
export * from './errors';             // Error handling
export * from './logging';            // Logging system

// Configuration and utilities
export { loadAgentConfig } from './config/agent-config';  // Configuration utilities
// export * from './utils';              // Utility functions for future use

// Storage
export { SecureStorage } from './storage/secure-storage';  // Secure storage for settings
