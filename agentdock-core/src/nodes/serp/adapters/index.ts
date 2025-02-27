/**
 * @fileoverview Exports for SERP adapters
 */

export * from './firecrawl';

// Factory function to create the appropriate adapter based on provider
import { SerpAdapter, BaseSerpConfig, FirecrawlConfig } from '../types';
import { FirecrawlAdapter } from './firecrawl';

/**
 * Create a SERP adapter instance based on the provider
 * @param provider The provider name
 * @param config The adapter configuration
 * @returns A SerpAdapter instance
 * @throws Error if the provider is not supported
 */
export function createAdapter(provider: string, config: BaseSerpConfig): SerpAdapter {
  switch (provider.toLowerCase()) {
    case 'firecrawl':
      return new FirecrawlAdapter(config as FirecrawlConfig);
    default:
      throw new Error(`Unsupported SERP provider: ${provider}`);
  }
} 