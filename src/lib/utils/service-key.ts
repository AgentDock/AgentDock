/**
 * @fileoverview Service key resolution utilities
 * These utilities will be moved to the provider registry in the future refactor.
 */

import { ServiceProvider, ServiceKeyResult, getEnvConfig } from '@/types/env';
import { AgentError, ErrorCode } from 'agentdock-core';

/**
 * Service key configuration
 * This will be expanded in the future provider registry
 */
export interface ServiceKeyConfig {
  provider: ServiceProvider;
  apiKey?: string;
  byokOnly?: boolean;
}

/**
 * Service key error types
 * These will be moved to the provider registry error types
 */
export type ServiceKeyError = 
  | 'MISSING_KEY'
  | 'INVALID_PROVIDER'
  | 'BYOK_REQUIRED'
  | 'SERVICE_UNAVAILABLE';

/**
 * Resolve service key based on configuration
 * This will be moved to the provider registry in the future
 */
export async function resolveServiceKey(config: ServiceKeyConfig): Promise<ServiceKeyResult> {
  try {
    // Get environment configuration
    const env = getEnvConfig();

    // 1. Always try BYOK first
    if (config.apiKey) {
      return {
        key: config.apiKey,
        source: 'byok',
        provider: config.provider
      };
    }

    // 2. If BYOK-only mode is enabled and no BYOK key is provided, fail
    if (config.byokOnly) {
      throw new AgentError(
        'BYOK key required and no key provided',
        ErrorCode.SERVICE_KEY_MISSING,
        { provider: config.provider }
      );
    }

    // 3. Check if the requested provider matches the configured one
    if (config.provider !== env.SERVICE_PROVIDER && env.SERVICE_PROVIDER !== 'none') {
      throw new AgentError(
        `Provider mismatch: requested ${config.provider} but configured for ${env.SERVICE_PROVIDER}`,
        ErrorCode.SERVICE_UNAVAILABLE,
        { 
          requestedProvider: config.provider,
          configuredProvider: env.SERVICE_PROVIDER 
        }
      );
    }

    // 4. If no service provider configured, fail
    if (env.SERVICE_PROVIDER === 'none') {
      throw new AgentError(
        'No service provider configured',
        ErrorCode.SERVICE_UNAVAILABLE,
        { provider: config.provider }
      );
    }

    // 5. Return appropriate service key
    const keyMap: Record<ServiceProvider, string | undefined> = {
      'openrouter': env.OPENROUTER_API_KEY,
      'google': env.GOOGLE_API_KEY,
      'none': undefined
    };

    const key = keyMap[env.SERVICE_PROVIDER];
    if (!key) {
      throw new AgentError(
        `Missing ${env.SERVICE_PROVIDER} API key`,
        ErrorCode.SERVICE_KEY_MISSING,
        { provider: env.SERVICE_PROVIDER }
      );
    }

    return {
      key,
      source: 'service',
      provider: config.provider
    };
  } catch (error) {
    // Re-throw if it's already our error type
    if (error instanceof AgentError) {
      throw error;
    }

    // Otherwise, wrap in a service error
    throw new AgentError(
      'Failed to resolve service key',
      ErrorCode.SERVICE_KEY_MISSING,
      {
        provider: config.provider,
        cause: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}

/**
 * Validate service key
 * This will be moved to the provider registry in the future
 */
export async function validateServiceKey(
  provider: ServiceProvider,
  key: string
): Promise<boolean> {
  try {
    // This will be replaced by provider-specific validation in the registry
    const response = await fetch(`/api/validate-key/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get service provider display name
 * This will be moved to the provider registry in the future
 */
export function getProviderDisplayName(provider: ServiceProvider): string {
  const displayNames: Record<ServiceProvider, string> = {
    'openrouter': 'OpenRouter',
    'google': 'Google AI',
    'none': 'None'
  };

  return displayNames[provider];
} 