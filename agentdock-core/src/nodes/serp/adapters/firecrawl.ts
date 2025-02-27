/**
 * @fileoverview Firecrawl adapter implementation for the SERP node.
 * This adapter provides integration with the Firecrawl search API.
 */

import { 
  SerpAdapter, 
  SerpResult, 
  SearchOptions, 
  FirecrawlConfig,
  SerpError
} from '../types';
import { createError, ErrorCode } from '../../../errors';

/**
 * Rate limiter for Firecrawl API requests
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestInterval: number;
  
  /**
   * Creates a new RateLimiter
   * @param rateLimit Maximum requests per minute
   */
  constructor(rateLimit: number) {
    // Convert rate limit (requests per minute) to milliseconds between requests
    this.requestInterval = rateLimit > 0 ? (60 * 1000) / rateLimit : 0;
  }
  
  /**
   * Add a function to the rate-limited queue
   * @param fn Function to execute
   * @returns Promise that resolves with the function's result
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }
  
  /**
   * Process the queue with rate limiting
   */
  private async process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Apply rate limiting
    const now = Date.now();
    const timeToWait = Math.max(0, this.lastRequestTime + this.requestInterval - now);
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Execute the next function in the queue
    const fn = this.queue.shift();
    if (fn) {
      this.lastRequestTime = Date.now();
      try {
        await fn();
      } catch (error) {
        // Error is already handled in the add method
      }
    }
    
    // Process the next item
    this.process();
  }
}

/**
 * Cache for search results
 */
class SearchCache {
  private cache: Map<string, {
    results: SerpResult[];
    timestamp: number;
  }> = new Map();
  
  /**
   * Creates a new SearchCache
   * @param ttl Time-to-live in seconds
   */
  constructor(private ttl: number) {}
  
  /**
   * Get cached results for a query
   * @param key Cache key
   * @returns Cached results or null if not found or expired
   */
  get(key: string): SerpResult[] | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if the cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.results;
  }
  
  /**
   * Store results in the cache
   * @param key Cache key
   * @param results Results to cache
   */
  set(key: string, results: SerpResult[]): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get the number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Firecrawl adapter for the SERP node
 */
export class FirecrawlAdapter implements SerpAdapter {
  private apiKey: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private cache: SearchCache | null = null;
  private timeout: number;
  private retryConfig: {
    maxAttempts: number;
    backoffFactor: number;
  };
  private headers: Record<string, string>;
  
  /**
   * Creates a new FirecrawlAdapter
   * @param config The adapter configuration
   */
  constructor(config: FirecrawlConfig) {
    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw createError(
        'service',
        'Firecrawl API key is required',
        ErrorCode.SERVICE_KEY_MISSING
      );
    }
    
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.firecrawl.dev/v1';
    
    // Initialize rate limiter
    const rateLimit = config.rateLimit || 60; // Default: 60 requests per minute
    this.rateLimiter = new RateLimiter(rateLimit);
    
    // Initialize cache if enabled
    if (config.cache && config.cache.enabled) {
      const ttl = config.cache.ttl || 3600; // Default: 1 hour cache TTL
      this.cache = new SearchCache(ttl);
    }
    
    this.timeout = config.timeout || 10000; // Default: 10 second timeout
    this.retryConfig = {
      maxAttempts: config.retry?.maxAttempts || 3,
      backoffFactor: config.retry?.backoffFactor || 2
    };
    
    // Set request headers
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'AgentDock-SerpNode/1.0',
      ...config.headers
    };
  }
  
  /**
   * Perform a search query
   * @param query Search query
   * @param options Search options
   * @returns Promise resolving to search results
   */
  async search(query: string, options?: SearchOptions): Promise<SerpResult[]> {
    // Validate the query
    if (!query || query.trim() === '') {
      throw createError(
        'service',
        'Search query cannot be empty',
        ErrorCode.VALIDATION_ERROR
      );
    }
    
    // Generate cache key if caching is enabled
    const cacheKey = this.generateCacheKey(query, options);
    
    // Check cache first if enabled
    if (this.cache) {
      const cachedResults = this.cache.get(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }
    }
    
    // Execute the search with rate limiting and retries
    return this.rateLimiter.add(() => this.executeSearch(query, options, 1, cacheKey));
  }
  
  /**
   * Get the provider name
   * @returns The provider name ('firecrawl')
   */
  getProvider(): string {
    return 'firecrawl';
  }
  
  /**
   * Validate the adapter configuration
   * @returns True if the configuration is valid
   */
  validateConfig(): boolean {
    return Boolean(this.apiKey) && this.apiKey.trim().length > 0;
  }
  
  /**
   * Execute a search with retry logic
   * @param query Search query
   * @param options Search options
   * @param attempt Current attempt number
   * @param cacheKey Cache key for storing results
   * @returns Promise resolving to search results
   */
  private async executeSearch(
    query: string, 
    options?: SearchOptions, 
    attempt: number = 1,
    cacheKey?: string
  ): Promise<SerpResult[]> {
    try {
      // Prepare the request URL
      const url = new URL(`${this.baseUrl}/search`);
      
      // Prepare the request body
      const body = {
        query,
        ...this.prepareOptions(options)
      };
      
      // Execute the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle error responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new SerpError(
            `Firecrawl API error: ${response.status} ${response.statusText}`,
            'API_ERROR',
            response.status,
            errorData
          );
        }
        
        // Parse the response
        const data = await response.json();
        
        // Transform the response to SerpResult[]
        const results = this.transformResults(data);
        
        // Cache the results if caching is enabled
        if (this.cache && cacheKey) {
          this.cache.set(cacheKey, results);
        }
        
        return results;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Handle abort errors (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw createError(
          'service',
          `Firecrawl API request timed out after ${this.timeout}ms`,
          ErrorCode.SERVICE_UNAVAILABLE
        );
      }
      
      // Handle SerpError (API errors)
      if (error instanceof SerpError) {
        throw createError(
          'service',
          `Firecrawl API error: ${error.message}`,
          ErrorCode.API_RESPONSE,
          { 
            status: error.status,
            response: error.response
          }
        );
      }
      
      // Handle other errors with retry logic
      if (attempt < this.retryConfig.maxAttempts) {
        // Calculate backoff delay
        const delay = Math.pow(this.retryConfig.backoffFactor, attempt - 1) * 1000;
        
        // Wait for the backoff delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return this.executeSearch(query, options, attempt + 1, cacheKey);
      }
      
      // Rethrow the error if we've exhausted retries
      throw createError(
        'service',
        `Firecrawl search failed after ${attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.API_REQUEST
      );
    }
  }
  
  /**
   * Transform the Firecrawl API response to SerpResult[]
   * @param data API response data
   * @returns Transformed search results
   */
  private transformResults(data: any): SerpResult[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }
    
    return data.results.map((result: any, index: number) => ({
      title: result.title || '',
      snippet: result.snippet || result.description || '',
      url: result.url || '',
      position: index + 1,
      metadata: {
        domain: result.domain || new URL(result.url).hostname,
        lastUpdated: result.lastUpdated || null,
        ...result.metadata
      }
    }));
  }
  
  /**
   * Prepare search options for the API request
   * @param options Search options
   * @returns Prepared options object
   */
  private prepareOptions(options?: SearchOptions): Record<string, any> {
    if (!options) {
      return {};
    }
    
    const prepared: Record<string, any> = {};
    
    // Map standard options
    if (options.limit !== undefined) prepared.limit = options.limit;
    if (options.offset !== undefined) prepared.offset = options.offset;
    if (options.language !== undefined) prepared.language = options.language;
    if (options.region !== undefined) prepared.region = options.region;
    if (options.safeSearch !== undefined) prepared.safeSearch = options.safeSearch;
    
    // Add any additional options
    for (const [key, value] of Object.entries(options)) {
      if (!['limit', 'offset', 'language', 'region', 'safeSearch'].includes(key)) {
        prepared[key] = value;
      }
    }
    
    return prepared;
  }
  
  /**
   * Generate a cache key for a query and options
   * @param query Search query
   * @param options Search options
   * @returns Cache key
   */
  private generateCacheKey(query: string, options?: SearchOptions): string {
    return `${query}:${JSON.stringify(options || {})}`;
  }
} 