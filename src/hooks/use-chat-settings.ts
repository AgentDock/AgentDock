import { useState, useEffect } from 'react';
import { logger, LogCategory, ProviderRegistry } from 'agentdock-core';
import { SecureStorage } from 'agentdock-core/storage/secure-storage';
import { templates, TemplateId } from '@/generated/templates';
import type { GlobalSettings } from '@/lib/types/settings';
import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';
import type { ChatUISettings, LLMProvider } from '@/lib/types/chat';
import { ModelRegistry } from '@/lib/models/registry';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

/**
 * Hook to get chat settings for a specific agent
 * This is the single source of truth for chat settings
 */
export function useChatSettings(agentId: string | null) {
  const [settings, setSettings] = useState<ChatUISettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!agentId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Get template
        const template = templates[agentId as TemplateId];
        if (!template) {
          throw new Error('Template not found');
        }

        // Determine provider from template nodes using the core registry
        const provider = ProviderRegistry.getProviderFromNodes((template.nodes || []).slice());
        const providerMetadata = ProviderRegistry.getProvider(provider);
        if (!providerMetadata) {
          throw new Error(`Provider not found: ${provider}`);
        }

        // Load global settings for API key
        const globalSettings = await storage.get<GlobalSettings>('global_settings');
        const apiKeys = globalSettings?.apiKeys || {};

        // Skip API key validation - server will handle env vars if needed
        // if (!apiKeys[provider as keyof typeof apiKeys]) {
        //   throw new Error(`Please add your ${providerMetadata.displayName} API key in settings to use the chat`);
        // }

        // Get model configuration
        const nodeType = ProviderRegistry.getNodeTypeFromProvider(provider);
        const nodeConfigs = template.nodeConfigurations as Record<string, any>;
        const modelConfig = nodeConfigs[nodeType] ?? {};
        const modelId = modelConfig.model || providerMetadata.defaultModel;

        // Get model metadata from application registry
        const modelMetadata = ModelRegistry.getModel(modelId);

        // Use model metadata for defaults if available
        const defaultTemperature = modelMetadata?.defaultTemperature || 0.7;
        const defaultMaxTokens = modelMetadata?.defaultMaxTokens || 2048;

        // Set settings from template
        setSettings({
          name: template.name,
          provider,
          model: modelId,
          temperature: modelConfig.temperature || defaultTemperature,
          maxTokens: modelConfig.maxTokens || defaultMaxTokens,
          personality: PersonalitySchema.parse(template.personality),
          apiKey: apiKeys[provider as keyof typeof apiKeys] || '',
          initialMessages: template.chatSettings?.initialMessages,
          chatPrompts: template.chatSettings?.chatPrompts,
        });

        setDebugMode(globalSettings?.core?.debugMode || false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load settings';
        setError(message);
        logger.error(LogCategory.SYSTEM, 'useChatSettings', message, { error });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [agentId]);

  return {
    chatSettings: settings,
    isLoading,
    error,
    debugMode,
  };
}
