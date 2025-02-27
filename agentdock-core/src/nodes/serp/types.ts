/**
 * @fileoverview Type definitions for the SERP (Search Engine Results Page) node.
 * This file contains interfaces and types for search results, adapters, and configurations.
 */

import { BaseNode } from '../base-node';

/**
 * Represents a single search result from a SERP provider
 */
export interface SerpResult {
  /**
   * The title of the search result
   */
  title: string;

  /**
   * A snippet or description of the search result
   */
  snippet: string;

  /**
   * The URL of the search result
   */
  url: string;

  /**
   * The position of the result in the search results (1-based)
   */
  position: number;

  /**
   * Additional metadata about the search result
   */
  metadata?: {
    /**
     * The domain of the search result
     */
    domain?: string;

    /**
     * When the page was last updated (if available)
     */
    lastUpdated?: string;

    /**
     * Any additional metadata provided by the SERP provider
     */
    [key: string]: any;
  };
}

/**
 * Options for search requests
 */
export interface SearchOptions {
  /**
   * Maximum number of results to return
   */
  limit?: number;

  /**
   * Number of results to skip (for pagination)
   */
  offset?: number;

  /**
   * Language code for the search results (e.g., 'en', 'fr')
   */
  language?: string;

  /**
   * Region code for the search results (e.g., 'us', 'uk')
   */
  region?: string;

  /**
   * Whether to enable safe search filtering
   */
  safeSearch?: boolean;

  /**
   * Any additional options supported by the SERP provider
   */
  [key: string]: any;
}

/**
 * Interface for SERP adapter implementations
 */
export interface SerpAdapter {
  /**
   * Perform a search query and return results
   * @param query The search query
   * @param options Optional search parameters
   * @returns Promise resolving to an array of search results
   */
  search(query: string, options?: SearchOptions): Promise<SerpResult[]>;

  /**
   * Get the provider name for this adapter
   * @returns The provider name (e.g., 'firecrawl', 'serpapi')
   */
  getProvider(): string;

  /**
   * Validate the adapter configuration
   * @returns True if the configuration is valid, false otherwise
   */
  validateConfig(): boolean;
}

/**
 * Base configuration for all SERP adapters
 */
export interface BaseSerpConfig {
  /**
   * API key for the SERP provider
   */
  apiKey: string;

  /**
   * Rate limit for API requests (requests per minute)
   */
  rateLimit?: number;

  /**
   * Timeout for API requests in milliseconds
   */
  timeout?: number;

  /**
   * Cache configuration
   */
  cache?: {
    /**
     * Whether caching is enabled
     */
    enabled: boolean;

    /**
     * Time-to-live for cached results in seconds
     */
    ttl: number;
  };

  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum number of retry attempts
     */
    maxAttempts: number;

    /**
     * Backoff factor for retry delays
     */
    backoffFactor: number;
  };
}

/**
 * Configuration for the Firecrawl adapter
 */
export interface FirecrawlConfig extends BaseSerpConfig {
  /**
   * Base URL for the Firecrawl API
   */
  baseUrl?: string;

  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
}

/**
 * Configuration for the SerpNode
 */
export interface SerpNodeConfig {
  /**
   * The SERP provider to use
   */
  provider: string;

  /**
   * Provider-specific configuration
   */
  config: BaseSerpConfig;
}

/**
 * Custom error class for SERP-related errors
 */
export class SerpError extends Error {
  /**
   * Creates a new SerpError
   * @param message Error message
   * @param code Error code
   * @param status HTTP status code (if applicable)
   * @param response Raw response data (if applicable)
   */
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'SerpError';
  }
}

/**
 * Type for a search response
 */
export interface SearchResponse {
  /**
   * The search results
   */
  results: SerpResult[];

  /**
   * Metadata about the search
   */
  metadata: {
    /**
     * The provider that performed the search
     */
    provider: string;

    /**
     * The original query
     */
    query: string;

    /**
     * Total number of results available (may be estimated)
     */
    totalResults?: number;

    /**
     * Time taken to perform the search in milliseconds
     */
    searchTime?: number;

    /**
     * Whether the results were retrieved from cache
     */
    fromCache?: boolean;
  };
}

/**
 * Type for a formatted search response (as returned by the SerpNode)
 */
export interface FormattedSearchResponse {
  /**
   * Markdown-formatted search results
   */
  markdown: string;

  /**
   * Raw search results
   */
  raw: SearchResponse;
} 