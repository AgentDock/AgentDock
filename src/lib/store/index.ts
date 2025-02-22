'use client';

/**
 * @fileoverview Core state management implementation for AgentDock.
 * Uses Zustand for state management.
 */

import { create } from 'zustand';
import { SecureStorage, AgentConfig } from 'agentdock-core';
import { AgentState } from './types';
import type { Store, AgentRuntimeSettings, Agent } from './types';
import { templates, getTemplate, TemplateId } from '@/generated/templates';

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
      // 1. Load runtime settings from storage
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};

      // 2. Create agents from bundled templates
      const agents = Object.keys(templates).map((templateId) => {
        // Get template as AgentConfig
        const template = getTemplate(templateId as TemplateId);

        // Create mutable copies of readonly arrays
        const modules = [...template.modules];
        const nodeConfigurations = { ...template.nodeConfigurations };

        // Create mutable chat settings with defaults
        const chatSettings = {
          initialMessages: template.chatSettings?.initialMessages ? [...template.chatSettings.initialMessages] : [],
          historyPolicy: template.chatSettings?.historyPolicy || 'lastN',
          historyLength: template.chatSettings?.historyLength || 10
        };

        // Create agent from template
        return {
          agentId: template.agentId,
          name: template.name,
          description: template.description,
          personality: template.personality,
          modules,
          nodeConfigurations,
          chatSettings,
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
        };
      });

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