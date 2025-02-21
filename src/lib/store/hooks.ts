/**
 * @fileoverview Custom hooks for accessing the AgentDock store.
 * Provides type-safe hooks for accessing store slices and actions.
 * 
 * @module lib/store/hooks
 */

import { useAgents as useStore } from './index';
import type { Store, Agent, AppState, AppActions } from './types';

// Type-safe hooks for accessing store slices

/**
 * Hook to access all agents in the system.
 * @returns Array of all agents
 */
export const useAgents = () => useStore((state: Store) => state.agents);

/**
 * Hook to access the currently active agent.
 * @returns The active agent or undefined if none is active
 */
export const useActiveAgent = () => {
  const agents = useStore((state: Store) => state.agents);
  const activeAgentId = useStore((state: Store) => state.activeAgentId);
  return agents.find(agent => agent.id === activeAgentId);
};

/**
 * Hook to access agent management actions.
 * @returns Object containing all agent-related actions
 */
export const useAgentActions = () => {
  const store = useStore();
  return {
    addAgent: store.addAgent,
    removeAgent: store.removeAgent,
    updateAgent: store.updateAgent,
    setActiveAgent: store.setActiveAgent,
  } as const;
};

/**
 * Hook to access application state.
 * @returns Object containing app state
 */
export const useAppState = () => ({
  isInitialized: useStore((state: Store) => state.isInitialized),
  initialize: useStore((state: Store) => state.initialize),
}); 