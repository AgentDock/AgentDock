/**
 * @fileoverview Environment configuration types
 * These types define the shape of our environment configuration
 */

export type ServiceProvider = 'openrouter' | 'google' | 'none';

export interface ServiceKeyResult {
  key: string;
  source: 'byok' | 'service';
  provider: ServiceProvider;
}

export interface EnvConfig {
  SERVICE_PROVIDER: ServiceProvider;
  OPENROUTER_API_KEY?: string;
  GOOGLE_API_KEY?: string;
}

/**
 * Get environment configuration
 * This will be moved to a proper config manager in the future
 */
export function getEnvConfig(): EnvConfig {
  return {
    SERVICE_PROVIDER: (process.env.SERVICE_PROVIDER as ServiceProvider) || 'none',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY
  };
} 