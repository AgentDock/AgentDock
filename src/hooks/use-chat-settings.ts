import { useState, useEffect } from 'react';
import { SecureStorage, logger, LogCategory } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import type { GlobalSettings } from '@/lib/types/settings';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

interface ChatSettings {
  name: string;
  model: string;
  temperature: number;
  maxTokens: number;
  personality?: string;
  apiKey?: string;
  initialMessages?: readonly string[];
}

export function useChatSettings(agentId: string | null) {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
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

        // Load global settings for API key
        const globalSettings = await storage.get<GlobalSettings>('global_settings');
        if (!globalSettings?.apiKeys?.anthropic) {
          throw new Error('Please add your Anthropic API key in settings to use the chat');
        }

        // Set settings from template
        setSettings({
          name: template.name,
          model: template.nodeConfigurations?.['llm.anthropic']?.model || 'claude-3-opus',
          temperature: template.nodeConfigurations?.['llm.anthropic']?.temperature || 0.7,
          maxTokens: template.nodeConfigurations?.['llm.anthropic']?.maxTokens || 2048,
          personality: template.personality,
          apiKey: globalSettings.apiKeys.anthropic,
          initialMessages: template.chatSettings?.initialMessages
        });

        setDebugMode(globalSettings.core.debugMode || false);

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load settings';
        setError(message);
        logger.error(LogCategory.SYSTEM, 'useChatSettings', message);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [agentId]);

  return {
    settings,
    isLoading,
    error,
    debugMode
  };
} 