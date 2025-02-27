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
import { logger, LogCategory } from '../../../logging';

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
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Creating new FirecrawlAdapter instance", {});
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Configuration", {
      ...config,
      apiKey: config.apiKey ? '***API_KEY_HIDDEN***' : undefined
    });
    
    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === '') {
      logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Missing API key in configuration", {});
      throw createError(
        'service',
        'Firecrawl API key is required',
        ErrorCode.SERVICE_KEY_MISSING
      );
    }
    
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.firecrawl.dev/v1';
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Using base URL", { baseUrl: this.baseUrl });
    
    // Initialize rate limiter
    const rateLimit = config.rateLimit || 60; // Default: 60 requests per minute
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting up rate limiter", { rateLimit });
    this.rateLimiter = new RateLimiter(rateLimit);
    
    // Initialize cache if enabled
    if (config.cache && config.cache.enabled) {
      const ttl = config.cache.ttl || 3600; // Default: 1 hour cache TTL
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Enabling cache", { ttl });
      this.cache = new SearchCache(ttl);
    } else {
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Cache is disabled", {});
    }
    
    this.timeout = config.timeout || 10000; // Default: 10 second timeout
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting request timeout", { timeout: this.timeout });
    
    // Configure retry settings
    this.retryConfig = {
      maxAttempts: config.retry?.maxAttempts || 3,
      backoffFactor: config.retry?.backoffFactor || 2
    };
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Configuring retry settings", { retryConfig: this.retryConfig });
    
    // Set up headers
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...(config.headers || {})
    };
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Headers configured", { 
      headerCount: Object.keys(this.headers).length,
      hasAuth: !!this.headers['Authorization']
    });
  }
  
  /**
   * Execute a search query
   * @param query The search query
   * @param options Optional search parameters
   * @returns Promise resolving to an array of search results
   */
  async search(query: string, options?: SearchOptions): Promise<SerpResult[]> {
    // Validate query
    if (!query || query.trim() === '') {
      logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Empty search query", {});
      throw createError(
        'service',
        'Search query cannot be empty',
        ErrorCode.VALIDATION_ERROR
      );
    }
    
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Generating cache key", {});
    const cacheKey = this.generateCacheKey(query, options);
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Cache key generated", { cacheKey });
    
    // Check cache first if enabled
    if (this.cache) {
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Checking cache for results", {});
      const cachedResults = this.cache.get(cacheKey);
      if (cachedResults) {
        logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Cache hit, returning cached results", { resultCount: cachedResults.length });
        return cachedResults;
      }
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Cache miss, executing search", {});
    }
    
    // Execute search
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Executing search", { query });
    const results = await this.executeSearch(query, options, 1, cacheKey);
    
    // Cache results if enabled
    if (this.cache) {
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Caching search results", { resultCount: results.length });
      this.cache.set(cacheKey, results);
    }
    
    return results;
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
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Validating configuration", {});
    const isValid = !!this.apiKey && this.apiKey.trim() !== '';
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', isValid ? "Configuration is valid" : "Configuration is invalid", {});
    return isValid;
  }
  
  /**
   * Execute the search request
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
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Executing search", { attempt, maxAttempts: this.retryConfig.maxAttempts });
    
    try {
      // Prepare request options
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Preparing request options", {});
      const requestOptions = this.prepareOptions(options);
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Request options prepared", { requestOptions });
      
      // Prepare request URL and body
      const url = `${this.baseUrl}/search`;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Request URL", { url });
      
      const body = {
        query,
        ...requestOptions
      };
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Request body prepared", { body });
      
      // Execute the request with timeout
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Sending API request", {});
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle response
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(LogCategory.NODE, 'FirecrawlAdapter', "API request failed", { 
          status: response.status, 
          statusText: response.statusText,
          errorDetails: errorText
        });
        
        // Handle rate limiting
        if (response.status === 429 && attempt < this.retryConfig.maxAttempts) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          const delay = retryAfter * 1000 || Math.pow(this.retryConfig.backoffFactor, attempt) * 1000;
          
          logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Rate limited, retrying after", { delay });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeSearch(query, options, attempt + 1, cacheKey);
        }
        
        // Handle other errors
        throw createError(
          'service',
          `API error: ${response.status} ${response.statusText}`,
          ErrorCode.API_RESPONSE,
          { status: response.status, response: errorText }
        );
      }
      
      // Parse response
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Parsing API response", {});
      const data = await response.json();
      
      // Transform results
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Transforming API response to SerpResult format", {});
      const results = this.transformResults(data);
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Transformed", { resultCount: results.length });
      
      // Cache results if enabled
      if (this.cache && cacheKey) {
        logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Caching search results", { resultCount: results.length });
        this.cache.set(cacheKey, results);
        logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Results cached successfully");
      }
      
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Search completed successfully", { resultCount: results.length });
      return results;
    } catch (error) {
      logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Error during search execution", { error });
      
      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Request timed out", { timeout: this.timeout });
        
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.pow(this.retryConfig.backoffFactor, attempt) * 1000;
          logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Retrying after", { delay });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeSearch(query, options, attempt + 1, cacheKey);
        }
        
        throw createError(
          'service',
          `Request timed out after ${this.timeout}ms`,
          ErrorCode.SERVICE_UNAVAILABLE
        );
      }
      
      // Handle network errors
      if (error instanceof Error && error.message.includes('network')) {
        logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Network error", { error: error.message });
        
        if (attempt < this.retryConfig.maxAttempts) {
          const delay = Math.pow(this.retryConfig.backoffFactor, attempt) * 1000;
          logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Retrying after", { delay });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeSearch(query, options, attempt + 1, cacheKey);
        }
      }
      
      // Rethrow other errors
      throw error;
    }
  }
  
  /**
   * Transform API response to SerpResult format
   * @param data API response data
   * @returns Array of SerpResult objects
   */
  private transformResults(data: any): SerpResult[] {
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Transforming results from API response", {});
    
    if (!data.results || !Array.isArray(data.results)) {
      logger.error(LogCategory.NODE, 'FirecrawlAdapter', "Invalid API response format, missing results array");
      return [];
    }
    
    return data.results.map((item: any, index: number) => {
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Transforming result", { index: index + 1, title: item.title || 'Untitled' });
      
      return {
        title: item.title || 'Untitled',
        snippet: item.snippet || '',
        url: item.url || '',
        position: item.position || index + 1,
        metadata: {
          domain: item.domain || (item.url ? new URL(item.url).hostname : ''),
          lastUpdated: item.lastUpdated,
          ...item.metadata
        }
      };
    });
  }
  
  /**
   * Prepare options for the API request
   * @param options Search options
   * @returns Prepared options for the API request
   */
  private prepareOptions(options?: SearchOptions): Record<string, any> {
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Preparing options for API request", {});
    
    const requestOptions: Record<string, any> = {};
    
    if (!options) {
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "No options provided, using defaults");
      return requestOptions;
    }
    
    // Map options to API parameters
    if (options.limit !== undefined) {
      requestOptions.limit = options.limit;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting limit", { limit: options.limit });
    }
    
    if (options.offset !== undefined) {
      requestOptions.offset = options.offset;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting offset", { offset: options.offset });
    }
    
    if (options.language) {
      requestOptions.language = options.language;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting language", { language: options.language });
    }
    
    if (options.region) {
      requestOptions.region = options.region;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting region", { region: options.region });
    }
    
    if (options.safeSearch !== undefined) {
      requestOptions.safeSearch = options.safeSearch;
      logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting safeSearch", { safeSearch: options.safeSearch });
    }
    
    // Add any additional options
    Object.entries(options).forEach(([key, value]) => {
      if (!['limit', 'offset', 'language', 'region', 'safeSearch'].includes(key)) {
        requestOptions[key] = value;
        logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Setting additional option", { key, value });
      }
    });
    
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Options prepared", { requestOptions });
    return requestOptions;
  }
  
  /**
   * Generate a cache key for the search
   * @param query Search query
   * @param options Search options
   * @returns Cache key
   */
  private generateCacheKey(query: string, options?: SearchOptions): string {
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Generating cache key for query", { query });
    
    const normalizedQuery = query.trim().toLowerCase();
    const optionsString = options ? JSON.stringify(options) : '';
    const key = `${normalizedQuery}:${optionsString}`;
    
    logger.debug(LogCategory.NODE, 'FirecrawlAdapter', "Generated cache key", { key });
    return key;
  }
} 