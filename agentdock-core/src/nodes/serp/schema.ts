/**
 * @fileoverview Schema definitions for the SerpNode
 */

import { z } from 'zod';

/**
 * Schema for search options
 */
export const searchOptionsSchema = z.object({
  limit: z.number().optional().describe('Maximum number of results to return'),
  offset: z.number().optional().describe('Number of results to skip (for pagination)'),
  language: z.string().optional().describe('Language code for the search results (e.g., "en", "fr")'),
  region: z.string().optional().describe('Region code for the search results (e.g., "us", "uk")'),
  safeSearch: z.boolean().optional().describe('Whether to enable safe search filtering')
}).optional().describe('Optional search parameters');

/**
 * Schema for SerpNode parameters
 */
export const serpNodeParametersSchema = z.object({
  query: z.string().describe('The search query to execute'),
  options: searchOptionsSchema
});

/**
 * Schema for SerpNode configuration
 */
export const serpNodeConfigSchema = z.object({
  provider: z.string().describe('The SERP provider to use (e.g., "firecrawl")'),
  config: z.object({
    apiKey: z.string().describe('API key for the SERP provider'),
    baseUrl: z.string().optional().describe('Base URL for the API (provider-specific)'),
    rateLimit: z.number().optional().describe('Rate limit for API requests (requests per minute)'),
    timeout: z.number().optional().describe('Timeout for API requests in milliseconds'),
    cache: z.object({
      enabled: z.boolean().describe('Whether caching is enabled'),
      ttl: z.number().describe('Time-to-live for cached results in seconds')
    }).optional().describe('Cache configuration'),
    retry: z.object({
      maxAttempts: z.number().describe('Maximum number of retry attempts'),
      backoffFactor: z.number().describe('Backoff factor for retry delays')
    }).optional().describe('Retry configuration'),
    headers: z.record(z.string()).optional().describe('Additional headers to include in requests')
  }).describe('Provider-specific configuration')
});

/**
 * Type inference from schemas
 */
export type SerpNodeParameters = z.infer<typeof serpNodeParametersSchema>;
export type SerpNodeConfigSchema = z.infer<typeof serpNodeConfigSchema>; 