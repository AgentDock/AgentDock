import { useState, useEffect } from 'react';
import { SecureStorage, logger, LogCategory } from 'agentdock-core';
import { templates, TemplateId } from '@/generated/templates';
import type { GlobalSettings } from '@/lib/types/settings';
import type { ValidatedPersonality } from 'agentdock-core/types/agent-config';
import { PersonalitySchema } from 'agentdock-core/types/agent-config';

// Create a single instance for storage
const storage = SecureStorage.getInstance('agentdock');

type LLMProvider = 'anthropic' | 'openai';

interface ChatSettings {
  name: string;
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  personality?: ValidatedPersonality;
  apiKey?: string;
  initialMessages?: readonly string[];
}

// Helper to determine provider from node configuration
function getProviderFromNodes(nodes: string[]): LLMProvider {
  if (nodes.includes('llm.openai')) return 'openai';
  if (nodes.includes('llm.anthropic')) return 'anthropic';
  throw new Error('No supported LLM provider found in template');
}

// Helper to get model configuration based on provider
function getModelConfig(template: any, provider: LLMProvider) {
  const config = template.nodeConfigurations?.[`llm.${provider}`];
  if (!config) {
    throw new Error(`Configuration for ${provider} not found in template`);
  }
  return config;
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

        // Determine provider from template nodes
        const provider = getProviderFromNodes(template.nodes || []);

        // Load global settings for API key
        const globalSettings = await storage.get<GlobalSettings>('global_settings');
        if (!globalSettings?.apiKeys?.[provider]) {
          throw new Error(`Please add your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key in settings to use the chat`);
        }

        // Get model configuration based on provider
        const modelConfig = getModelConfig(template, provider);

        // Set default values based on provider
        const defaultValues = {
          anthropic: {
            model: 'claude-3-opus',
            temperature: 0.7,
            maxTokens: 2048
          },
          openai: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2048
          }
        };

        // Set settings from template
        setSettings({
          name: template.name,
          provider,
          model: modelConfig.model || defaultValues[provider].model,
          temperature: modelConfig.temperature || defaultValues[provider].temperature,
          maxTokens: modelConfig.maxTokens || defaultValues[provider].maxTokens,
          personality: PersonalitySchema.parse(template.personality),
          apiKey: globalSettings.apiKeys[provider],
          initialMessages: template.chatSettings?.initialMessages
        });

        setDebugMode(globalSettings.core.debugMode || false);

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
    settings,
    isLoading,
    error,
    debugMode
  };
}