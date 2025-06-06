'use client';

/**
 * @fileoverview Core state management implementation for AgentDock.
 * Uses Zustand for state management.
 *
 * OPTIMIZATION OPPORTUNITIES:
 * 1. Move template validation to server components instead of client-side
 * 2. Use Zustand middleware for storage persistence instead of manual operations
 * 3. Split store into smaller, more targeted slices
 * 4. Implement proper hydration pattern for server/client consistency
 * 5. Add selectors for more granular component updates
 */
import { LogCategory, logger } from 'agentdock-core';
import { toast } from 'sonner';
import { create } from 'zustand';

import { SecureStorage } from 'agentdock-core/storage/secure-storage';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

import { templates } from '@/generated/templates';
import { getLLMInfo } from '@/lib/utils';
import { Agent, AgentRuntimeSettings, AgentState, Store } from './types';

// Create a single instance for the store
const storage = SecureStorage.getInstance('agentdock');

// OPTIMIZATION: Consider using Zustand's persist middleware instead of manual storage
export const useAgents = create<Store>((set) => ({
  // State
  agents: [],
  isInitialized: false,
  templatesValidated: false,
  templatesError: null,

  // Core Actions
  initialize: async () => {
    try {
      // 1. Register core nodes first - Removed to prevent duplicate registrations
      // Node registration is now centralized in src/nodes/init.ts
      // registerCoreNodes();

      // OPTIMIZATION: This template validation could be done server-side
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

      // OPTIMIZATION: Use middleware for storage operations
      // 3. Load runtime settings from storage
      const storedSettings =
        (await storage.get<Record<string, AgentRuntimeSettings>>(
          'agent_runtime_settings'
        )) || {};

      // 4. Create agents from validated templates
      const agents = templateArray.map((template) => {
        // Create mutable copies of readonly arrays
        const nodes = [...template.nodes];
        const nodeConfigurations = { ...template.nodeConfigurations };

        // Create mutable chat settings with defaults
        const defaultChatSettings = {
          initialMessages: [] as string[],
          historyPolicy: 'lastN' as const,
          historyLength: 50
        };

        const chatSettings = template.chatSettings
          ? {
              initialMessages: [
                ...template.chatSettings.initialMessages
              ] as string[],
              historyPolicy: template.chatSettings.historyPolicy as
                | 'lastN'
                | 'all',
              historyLength: (template.chatSettings as any).historyLength ?? 50
            }
          : defaultChatSettings;

        return {
          agentId: template.agentId,
          name: template.name,
          description: template.description,
          personality: PersonalitySchema.parse(template.personality),
          nodes,
          nodeConfigurations,
          chatSettings,
          id: crypto.randomUUID(),
          state: AgentState.CREATED,
          metadata: {
            created: Date.now(),
            lastStateChange: Date.now()
          },
          runtimeSettings: storedSettings[template.agentId] || {
            temperature: getLLMInfo(template).config?.temperature || 0.7,
            maxTokens: getLLMInfo(template).config?.maxTokens || 4096
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
      const message =
        error instanceof Error ? error.message : 'Failed to initialize store';
      logger.error(LogCategory.SYSTEM, 'Store', 'Failed to initialize store', {
        error: message
      });
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

  // OPTIMIZATION: Use middleware for persistence instead of manual operations
  updateAgentRuntime: async (agentId, settings) => {
    try {
      // 1. Load current settings
      const storedSettings =
        (await storage.get<Record<string, AgentRuntimeSettings>>(
          'agent_runtime_settings'
        )) || {};

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
