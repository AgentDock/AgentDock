/**
 * @fileoverview Core agent configuration loading and validation
 */

import { AgentConfig, AgentConfigSchema, PersonalitySchema } from '../types/agent-config';
import { createError, ErrorCode } from '../errors';
import { logger, LogCategory } from '../logging';
import { ProviderRegistry } from '../llm/provider-registry';

/**
 * Ensures a value is a string
 * If it's an array, joins it with newlines
 */
function ensureString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join('\n');
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value || '');
}

/**
 * Get LLM provider from template nodes
 */
function getLLMProvider(template: any) {
  // Use the provider registry to determine the provider from nodes
  const provider = ProviderRegistry.getProviderFromNodes(template.nodes || []);
  return ProviderRegistry.getNodeTypeFromProvider(provider);
}

/**
 * Load and validate an agent configuration
 */
export async function loadAgentConfig(template: any, apiKey?: string): Promise<AgentConfig> {
  try {
    if (!apiKey) {
      throw createError(
        'config',
        'API key not found. Please add your API key in settings.',
        ErrorCode.CONFIG_NOT_FOUND,
      );
    }

    if (!template) {
      throw createError('config', 'Template not found', ErrorCode.CONFIG_NOT_FOUND);
    }

    logger.debug(
      LogCategory.CONFIG,
      'Loading agent configuration',
      JSON.stringify({ name: template.name }),
    );

    // Create config with API key, converting readonly arrays to mutable
    const config = {
      ...template,
      // Convert readonly arrays to mutable
      nodes: [...template.nodes],
      chatSettings: {
        ...template.chatSettings,
        initialMessages: template.chatSettings?.initialMessages
          ? [...template.chatSettings.initialMessages]
          : [],
      },
      nodeConfigurations: {
        ...template.nodeConfigurations,
        [getLLMProvider(template)]: {
          ...template.nodeConfigurations?.[getLLMProvider(template)],
          apiKey,
        },
      },
      // Ensure personality is validated through the schema
      personality: PersonalitySchema.parse(template.personality),
    };

    // Validate the entire config against schema
    return AgentConfigSchema.parse(config);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    throw createError(
      'config',
      `Failed to load agent configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.CONFIG_NOT_FOUND,
    );
  }
}
