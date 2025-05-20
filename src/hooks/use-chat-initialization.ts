import { useState, useEffect } from 'react';
import {
  logger,
  LogCategory,
  ProviderRegistry,
  LLMProvider,
  APIError,
  ErrorCode,
} from 'agentdock-core';
import { SecureStorage } from 'agentdock-core/storage/secure-storage';
import { templates, TemplateId } from '@/generated/templates';
import type { GlobalSettings } from '@/lib/types/settings';
import { useAgents } from '@/lib/store/index';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

/**
 * Hook to handle chat initialization
 *
 * OPTIMIZATION OPPORTUNITIES:
 * 1. Move template validation to server components
 * 2. Replace direct store access with subscription hook
 * 3. Implement React Query or SWR for data fetching/caching
 * 4. Use Next.js data fetching patterns instead of useEffect
 * 5. Split storage operations into a separate utility
 *
 * @param agentId The agent ID to initialize
 * @returns Initialization state and data
 */
export function useChatInitialization(agentId: string = 'default') {
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [initError, setInitError] = useState<Error | null>(null);

  // OPTIMIZATION: Replace with proper subscription hook
  // Get the agent store to check for agent-specific API keys
  const { agents } = useAgents.getState();

  // OPTIMIZATION: Use React Query/SWR for data fetching and caching
  // Function to load the API key and provider data
  const loadData = async () => {
    try {
      setIsInitializing(true);

      // OPTIMIZATION: Move template validation to server
      // Get template
      const template = templates[agentId as TemplateId];
      if (!template) {
        throw new APIError(
          'Template not found',
          ErrorCode.CONFIG_NOT_FOUND,
          'ChatContainer',
          'loadData',
          { agentId },
        );
      }

      // Determine provider from template
      const provider = ProviderRegistry.getProviderFromNodes((template.nodes || []).slice());
      setProvider(provider);

      // PRIORITY ORDER FOR API KEYS:
      // 1. Per-agent custom API key (from agent.runtimeSettings.apiKey)
      // 2. Global settings API key (from global_settings.apiKeys[provider])
      // 3. Fallback to environment variables on the server

      // First check if this agent has a custom API key
      const agent = agents.find((a) => a.agentId === agentId);
      if (agent?.runtimeSettings?.apiKey) {
        setApiKey(agent.runtimeSettings.apiKey);
        setInitError(null); // Clear any previous API key errors
        logger.debug(LogCategory.SYSTEM, 'ChatContainer', 'Using agent-specific API key', {
          provider,
          agentId,
        });
        setIsInitializing(false);
        return;
      }

      // OPTIMIZATION: Extract into a reusable settings utility
      // Try to load API key from secure storage
      try {
        const settings = await storage.get<GlobalSettings>('global_settings');
        const apiKeys = settings?.apiKeys || {};
        const currentApiKey = apiKeys[provider as keyof typeof apiKeys];

        if (currentApiKey) {
          setApiKey(currentApiKey);
          setInitError(null); // Clear any previous API key errors
          logger.debug(LogCategory.SYSTEM, 'ChatContainer', 'Using API key from global settings', {
            provider,
          });
        } else {
          // No API key found, will use server-side API key resolution
          setApiKey(''); // Clear any previous API key
          logger.debug(
            LogCategory.SYSTEM,
            'ChatContainer',
            'No API key in storage, will use environment variables',
            { provider },
          );
        }
      } catch (error) {
        // Error loading from storage
        setApiKey(''); // Clear any previous API key
        logger.warn(
          LogCategory.SYSTEM,
          'ChatContainer',
          'Failed to load from storage, using environment variables',
          { error: error instanceof Error ? error.message : 'Unknown error' },
        );
      }

      // Always proceed with initialization
      setIsInitializing(false);
      setInitError(null);
    } catch (error) {
      setInitError(
        error instanceof APIError
          ? error
          : new APIError(
              'Failed to initialize chat',
              ErrorCode.CONFIG_NOT_FOUND,
              'ChatContainer',
              'loadData',
              { agentId },
            ),
      );
      setIsInitializing(false);
    }
  };

  // OPTIMIZATION: Use React Query/SWR instead of useEffect
  // Initial load - only depends on agentId and agents now
  useEffect(() => {
    loadData();
  }, [agentId, agents]); // Removed lastFocused dependency since we no longer need window focus refreshes

  return {
    isInitializing,
    provider,
    apiKey,
    initError,
    reload: loadData, // Expose reload function
  };
}
