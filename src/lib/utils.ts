import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LLMConfig, LLMProvider, ProviderRegistry } from 'agentdock-core'
import { ModelRegistry } from './models/registry'
import { ModelService } from './services/model-service'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get LLM configuration and provider information from a template or agent
 * @param config Template or agent configuration containing nodes and nodeConfigurations
 * @returns LLM configuration details including provider info and display name
 */
export function getLLMInfo(config: Record<string, any>) {
  // Find the provider using the core registry
  const provider = ProviderRegistry.getProviderFromNodes(config.nodes || []);
  const nodeType = ProviderRegistry.getNodeTypeFromProvider(provider);
  
  // Get provider metadata
  const providerMetadata = ProviderRegistry.getProvider(provider);
  if (!providerMetadata) {
    throw new Error(`Provider not found: ${provider}`);
  }
  
  const llmConfig = config.nodeConfigurations?.[nodeType];
  const modelId = llmConfig?.model || providerMetadata.defaultModel;
  
  // Get model metadata from application registry
  const modelMetadata = ModelRegistry.getModel(modelId);
  
  return {
    config: llmConfig,
    provider,
    displayName: modelMetadata 
      ? `${providerMetadata.displayName} - ${modelMetadata.displayName}` 
      : `${providerMetadata.displayName} - ${modelId}`,
    validateApiKey: (key: string) => ProviderRegistry.validateApiKey(provider, key)
  };
}

// Export provider utilities
export const validateLLMApiKey = (provider: LLMProvider, apiKey: string): boolean => {
  return ProviderRegistry.validateApiKey(provider, apiKey);
};

// Export model utilities
export const getModelsForProvider = (provider: LLMProvider): any[] => {
  return ModelService.getModels(provider);
};

/**
 * Converts an array of File objects to a proper FileList
 * This is useful for handling file uploads in forms
 */
export function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  return dataTransfer.files;
}
