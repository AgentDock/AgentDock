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
import { toast } from 'sonner';

// Create a single instance for the store
const storage = SecureStorage.getInstance('agentdock');

export const useAgents = create<Store>((set) => ({
  // State
  agents: [],
  isInitialized: false,
  templatesValidated: false,
  templatesError: null,

  // Core Actions
  initialize: async () => {
    try {
      // 1. Register core nodes first
      registerCoreNodes();

      // 2. Validate templates
      const templateArray = Object.values(templates);
      if (templateArray.length === 0) {
        throw new Error('No templates available');
      }

      logger.info(
        LogCategory.SYSTEM,
        'Store',
        'Templates validated successfully',
        { count: templateArray.length }
      );

      // 3. Load runtime settings from storage
      const storedSettings = await storage.get<Record<string, AgentRuntimeSettings>>('agent_runtime_settings') || {};

      // 4. Create agents from validated templates
      const agents = templateArray.map((template) => {
        // Create mutable copies of readonly arrays
        const modules = [...template.modules];
        const nodeConfigurations = { ...template.nodeConfigurations };

        // Create mutable chat settings with defaults
        const defaultChatSettings = {
          initialMessages: [] as string[],
          historyPolicy: 'lastN' as const,
          historyLength: 50
        };

        const chatSettings = template.chatSettings ? {
          initialMessages: [...template.chatSettings.initialMessages] as string[],
          historyPolicy: template.chatSettings.historyPolicy as 'lastN' | 'all',
          historyLength: (template.chatSettings as any).historyLength ?? 50
        } : defaultChatSettings;

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

      set({ 
        agents, 
        isInitialized: true,
        templatesValidated: true,
        templatesError: null
      });

      logger.info(
        LogCategory.SYSTEM,
        'Store',
        'Store initialized successfully',
        { agentCount: agents.length }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize store';
      logger.error(
        LogCategory.SYSTEM,
        'Store',
        'Failed to initialize store',
        { error: message }
      );
      set({ 
        isInitialized: true,
        templatesValidated: false,
        templatesError: message
      });
      toast.error('Failed to load templates');
    }
  },

  reset: () => {
    set({
      agents: [],
      isInitialized: false,
      templatesValidated: false,
      templatesError: null
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

export type { Store, Agent, AgentState, AgentRuntimeSettings }; 