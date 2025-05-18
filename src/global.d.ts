/**
 * Global type definitions for AgentDock
 */

// Extend Window interface to include AgentDock-specific properties
interface Window {
  // History policy control
  ENV_HISTORY_POLICY?: 'none' | 'lastN' | 'all';
  ENV_HISTORY_LENGTH?: number;

  // System initialization flag
  __systemInitialized?: boolean;
}

// Export types that need to be used across the application
export type HistoryPolicy = 'none' | 'lastN' | 'all';
