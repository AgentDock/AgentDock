'use client';

/**
 * @fileoverview Core state management implementation for AgentDock.
 * Uses Zustand for state management.
 */

import { create } from 'zustand';
import { SecureStorage, logger, LogCategory } from 'agentdock-core';
import { templates, TemplateId, getTemplate } from '@/generated/templates';
import { Store, Agent, AgentState, AgentRuntimeSettings } from './types';
import { registerCoreNodes } from '@/lib/core/register-nodes';

// Create a single instance for the store
const storage = SecureStorage.getInstance('agentdock');

export const useAgents = create<Store>((set, get) => ({
  // State
  agents: [],
  activeAgentId: null,
  isInitialized: false,

  // Actions
  addAgent: (agent) => {
    const newAgent: Agent = {
      ...agent,
      id: crypto.randomUUID(),
      state: AgentState.CREATED,
      nodes: [],
      metadata: {
        created: Date.now(),
        lastStateChange: Date.now()
      }
    };
    set((state) => ({
      agents: [...state.agents, newAgent]
    }));
  },

  removeAgent: (id) => {
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId
    }));
  },

  updateAgent: (id, updates) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent
      )
    }));
  },

  setActiveAgent: (id) => {
    set({ activeAgentId: id });
  },

  initialize: async () => {
    try {
      // 1. Register core nodes first
      registerCoreNodes();

      // 2. Load runtime settings from storage
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};

      // 3. Create agents from bundled templates
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
        const agent: Agent = {
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

        return agent;
      });

      set({ agents, isInitialized: true });

      logger.info(
        LogCategory.SYSTEM,
        'Store',
        'Store initialized successfully',
        { agentCount: agents.length }
      );
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'Store',
        'Failed to initialize store',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
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

  updateAgentRuntime: async (agentId, settings) => {
    try {
      // 1. Load current settings
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};
      
      // 2. Update settings for this agent
      const updatedSettings = {
        ...storedSettings,
        [agentId]: {
          ...storedSettings[agentId],
          ...settings
        }
      };

      // 3. Save to storage
      await storage.set('agent_runtime_settings', updatedSettings);

      // 4. Update agent in state
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.agentId === agentId
            ? {
                ...agent,
                runtimeSettings: {
                  ...agent.runtimeSettings,
                  ...settings
                }
              }
            : agent
        )
      }));

      logger.info(
        LogCategory.SYSTEM,
        'Store',
        'Agent runtime settings updated',
        { agentId, settings }
      );
    } catch (error) {
      logger.error(
        LogCategory.SYSTEM,
        'Store',
        'Failed to update agent runtime settings',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }
})); 