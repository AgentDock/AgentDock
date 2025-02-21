'use client';

/**
 * @fileoverview Core state management implementation for AgentDock.
 * Uses Zustand for state management.
 */

import { create } from 'zustand';
import { SecureStorage } from 'agentdock-core';
import { AgentState } from './types';
import type { Store, AgentTemplate, AgentRuntimeSettings, Agent } from './types';

// Create a single instance for the store
const storage = SecureStorage.getInstance('agentdock');

export const useAgents = create<Store>((set, get): Store => ({
  // State
  agents: [],
  activeAgentId: null,
  isInitialized: false,

  // Actions
  addAgent: (agent) => {
    const { agents } = get();
    const newAgent = {
      ...agent,
      id: crypto.randomUUID(),
      state: AgentState.CREATED,
      metadata: {
        created: Date.now(),
        lastStateChange: Date.now()
      }
    };
    set({ agents: [...agents, newAgent] });
  },

  removeAgent: (id) => {
    const { agents } = get();
    set({ agents: agents.filter(agent => agent.id !== id) });
  },

  updateAgent: (id, updates) => {
    const { agents } = get();
    set({
      agents: agents.map(agent =>
        agent.id === id ? { ...agent, ...updates } : agent
      )
    });
  },

  setActiveAgent: (id) => {
    set({ activeAgentId: id });
  },

  initialize: async () => {
    try {
      // 1. Load base templates from API
      const response = await fetch('/api/agents/templates');
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      const templates = await response.json();

      // 2. Load runtime settings from storage
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};

      // 3. Create agents by combining templates with runtime settings
      const agents = templates.map((template: AgentTemplate) => ({
        ...template,
        id: crypto.randomUUID(),
        state: AgentState.CREATED,
        nodes: [],
        metadata: {
          created: Date.now(),
          lastStateChange: Date.now()
        },
        runtimeSettings: storedSettings[template.agentId] || {
          temperature: template.nodeConfigurations?.['llm.anthropic']?.temperature || 0.7,
          maxTokens: template.nodeConfigurations?.['llm.anthropic']?.maxTokens || 4096
        }
      }));

      set({ agents, isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize agents:', error);
      set({ isInitialized: true }); // Set initialized even on error
    }
  },

  reset: () => {
    set({
      agents: [],
      activeAgentId: null,
      isInitialized: false
    });
  },

  updateAgentRuntime: async (agentId: string, settings: Partial<AgentRuntimeSettings>) => {
    try {
      const { agents } = get();
      
      // Update runtime settings in storage
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};
      storedSettings[agentId] = {
        ...storedSettings[agentId],
        ...settings
      };
      await storage.set('agent_runtime_settings', storedSettings);

      // Update agents in state
      const updatedAgents = agents.map(agent =>
        agent.agentId === agentId
          ? { ...agent, runtimeSettings: { ...agent.runtimeSettings, ...settings } }
          : agent
      );

      set({ agents: updatedAgents });
    } catch (error) {
      console.error('Failed to update agent runtime settings:', error);
      throw error;
    }
  }
})); 