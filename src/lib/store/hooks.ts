/**
 * @fileoverview Custom hooks for accessing the AgentDock store.
 * Provides type-safe hooks for accessing store slices and actions.
 *
 * @module lib/store/hooks
 */

import { useAgents as useStore } from './index';
import type { Store } from './types';

// Type-safe hooks for accessing store slices

/**
 * Hook to access all agents in the system.
 * @returns Array of all agents
 */
export const useAgents = () => useStore((state: Store) => state.agents);

/**
 * Hook to access application state.
 * @returns Object containing app state
 */
export const useAppState = () => ({
  isInitialized: useStore((state: Store) => state.isInitialized),
  initialize: useStore((state: Store) => state.initialize),
});
