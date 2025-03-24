import { useState, useEffect } from 'react';
import { SecureStorage, logger, LogCategory, ProviderRegistry, LLMProvider, APIError, ErrorCode } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import type { GlobalSettings } from '@/lib/types/settings';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

/**
 * Hook to handle chat initialization
 * @param agentId The agent ID to initialize
 * @returns Initialization state and data
 */
export function useChatInitialization(agentId: string = 'default') {
  const [isInitializing, setIsInitializing] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsInitializing(true);
        
        // Get template
        const template = templates[agentId as TemplateId];
        if (!template) {
          throw new APIError(
            'Template not found',
            ErrorCode.CONFIG_NOT_FOUND,
            'ChatContainer',
            'loadData',
            { agentId }
          );
        }

        // Determine provider from template
        const provider = ProviderRegistry.getProviderFromNodes((template.nodes || []).slice());
        setProvider(provider);

        // Try to load API key from secure storage but continue without it if not found
        try {
          const settings = await storage.get<GlobalSettings>('global_settings');
          const apiKeys = settings?.apiKeys || {};
          const currentApiKey = apiKeys[provider as keyof typeof apiKeys];
          
          if (currentApiKey) {
            setApiKey(currentApiKey);
            logger.debug(
              LogCategory.SYSTEM,
              'ChatContainer', 
              'Using API key from secure storage', 
              { provider }
            );
          } else {
            // Will use server-side API key resolution
            logger.debug(
              LogCategory.SYSTEM,
              'ChatContainer',
              'No API key in storage, will use environment variables',
              { provider }
            );
          }
        } catch (error) {
          logger.warn(
            LogCategory.SYSTEM,
            'ChatContainer',
            'Failed to load from storage, using environment variables',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
        }

        // Always proceed with initialization
        setIsInitializing(false);
      } catch (error) {
        setInitError(error instanceof APIError ? error : new APIError(
          'Failed to initialize chat',
          ErrorCode.CONFIG_NOT_FOUND,
          'ChatContainer',
          'loadData',
          { agentId }
        ));
        setIsInitializing(false);
      }
    };

    loadData();
  }, [agentId]);

  return {
    isInitializing,
    provider,
    apiKey,
    initError
  };
} 