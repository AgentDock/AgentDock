import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LLMConfig } from 'agentdock-core/llm/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Define provider information
const LLM_PROVIDERS = {
  'llm.openai': {
    displayName: 'OpenAI',
    validateApiKey: (key: string) => key.startsWith('sk-') && !key.startsWith('sk-ant-'),
    defaultModel: 'gpt-3.5-turbo'
  },
  'llm.anthropic': {
    displayName: 'Anthropic',
    validateApiKey: (key: string) => key.startsWith('sk-ant-'),
    defaultModel: 'claude-2'
  }
} as const;

type LLMProvider = keyof typeof LLM_PROVIDERS;

/**
 * Get LLM configuration and provider information from a template or agent
 * @param config Template or agent configuration containing nodes and nodeConfigurations
 * @returns LLM configuration details including provider info and display name
 */
// export function getLLMInfo(config: { nodes?: string[], nodeConfigurations?: Record<string, any> }) {
export function getLLMInfo(config: Record<string, any>) {
  // Find the first matching LLM provider in the nodes
  const provider = (config.nodes || []).find((node: string) => 
    Object.keys(LLM_PROVIDERS).includes(node)
  ) as LLMProvider | undefined;

  if (!provider) {
    throw new Error('No valid LLM provider found in configuration');
  }

  const providerInfo = LLM_PROVIDERS[provider];
  const llmConfig = config.nodeConfigurations?.[provider] as LLMConfig | undefined;
  
  return {
    config: llmConfig,
    provider,
    displayName: llmConfig?.model 
      ? `${providerInfo.displayName} - ${llmConfig.model}` 
      : `${providerInfo.displayName} - ${providerInfo.defaultModel}`,
    validateApiKey: providerInfo.validateApiKey
  };
}

// Export provider utilities
export const validateLLMApiKey = (provider: LLMProvider, apiKey: string): boolean => {
  return LLM_PROVIDERS[provider].validateApiKey(apiKey);
};
