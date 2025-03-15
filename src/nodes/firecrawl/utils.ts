/**
 * @fileoverview Utility functions for the firecrawl tool.
 * Contains functions for making API calls to the Firecrawl API using the official SDK.
 */

import { logger, LogCategory } from 'agentdock-core';
import { FirecrawlResult, FirecrawlScrapeResult, FirecrawlCrawlResult, FirecrawlMapResult, FirecrawlExtractResult } from './components';
import { cleanText, cleanUrl } from '@/lib/utils/markdown-utils';

// Import the Firecrawl SDK
// Note: This is commented out until the package is installed
// import FirecrawlApp from '@mendable/firecrawl-js';

/**
 * Firecrawl API client
 * This is a placeholder until the actual SDK is installed
 */
class FirecrawlClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.firecrawl.dev/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn(LogCategory.NODE, '[FirecrawlAPI]', 'No API key provided, using environment variable');
    }
    
    // Override base URL if specified in environment
    if (process.env.FIRECRAWL_BASE_URL) {
      this.baseUrl = process.env.FIRECRAWL_BASE_URL;
    }
  }

  /**
   * Make an API request to Firecrawl
   */
  private async request(endpoint: string, method: string = 'POST', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if API key is available
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    const options: RequestInit = {
      method,
      headers,
      cache: 'no-store' // Ensure fresh results
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(LogCategory.NODE, '[FirecrawlAPI]', `API error: ${response.status}`, { error: errorText });
      throw new Error(`Firecrawl API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }
    
    return await response.json();
  }

  /**
   * Search the web using Firecrawl
   */
  async search(query: string, options: {
    limit?: number;
    lang?: string;
    country?: string;
    scrapeOptions?: {
      formats?: string[];
    }
  } = {}): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Searching for: ${query}`);
    
    const body = {
      query,
      limit: options.limit || 25,
      lang: options.lang || 'en',
      country: options.country || 'us',
      scrapeOptions: options.scrapeOptions || { formats: ['markdown'] }
    };
    
    return this.request('/search', 'POST', body);
  }

  /**
   * Scrape a URL using Firecrawl
   */
  async scrape(url: string, options: {
    formats?: string[];
    jsonOptions?: {
      schema?: any;
      prompt?: string;
    }
  } = {}): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Scraping URL: ${url}`);
    
    const body = {
      url,
      formats: options.formats || ['markdown'],
      jsonOptions: options.jsonOptions
    };
    
    return this.request('/scrape', 'POST', body);
  }

  /**
   * Crawl a website using Firecrawl
   */
  async crawl(url: string, options: {
    limit?: number;
    maxDepth?: number;
    excludePaths?: string[];
    includePaths?: string[];
    scrapeOptions?: {
      formats?: string[];
    }
  } = {}): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Crawling website: ${url}`);
    
    const body = {
      url,
      limit: options.limit || 10,
      maxDepth: options.maxDepth || 2,
      excludePaths: options.excludePaths || [],
      includePaths: options.includePaths || [],
      scrapeOptions: options.scrapeOptions || { formats: ['markdown'] }
    };
    
    return this.request('/crawl', 'POST', body);
  }

  /**
   * Check crawl status
   */
  async checkCrawlStatus(id: string): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Checking crawl status: ${id}`);
    return this.request(`/crawl/${id}`, 'GET');
  }

  /**
   * Map a website using Firecrawl
   */
  async map(url: string, options: {
    maxDepth?: number;
    excludePaths?: string[];
    includePaths?: string[];
  } = {}): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Mapping website: ${url}`);
    
    const body = {
      url,
      maxDepth: options.maxDepth || 2,
      excludePaths: options.excludePaths || [],
      includePaths: options.includePaths || []
    };
    
    return this.request('/map', 'POST', body);
  }

  /**
   * Extract structured data from a URL using Firecrawl
   */
  async extract(url: string, options: {
    schema?: any;
    prompt?: string;
  } = {}): Promise<any> {
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', `Extracting data from URL: ${url}`);
    
    const body = {
      url,
      formats: ['json'],
      jsonOptions: {
        schema: options.schema,
        prompt: options.prompt
      }
    };
    
    return this.request('/scrape', 'POST', body);
  }
}

// Create a singleton instance of the Firecrawl client
const firecrawlClient = new FirecrawlClient();

/**
 * Performs a web search using the Firecrawl API
 * @param query The search query
 * @param limit Maximum number of results to return
 * @returns Array of search results
 */
export async function searchFirecrawl(query: string, limit: number = 25): Promise<FirecrawlResult[]> {
  try {
    const response = await firecrawlClient.search(query, { limit });
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Search results received', { 
      resultsCount: response.data?.length || 0
    });
    
    // Transform API response to our FirecrawlResult format
    const results: FirecrawlResult[] = [];
    
    // Process results
    if (response.data && Array.isArray(response.data)) {
      for (const item of response.data) {
        if (results.length >= limit) break;
        
        // Skip results without a URL or with empty content
        if (!item.url || (!item.title && !item.description)) continue;
        
        results.push({
          title: cleanText(item.title) || 'No title',
          url: cleanUrl(item.url),
          snippet: cleanText(item.description || (item.markdown ? item.markdown.substring(0, 200) + '...' : '')) || 'No description available.'
        });
      }
    }
    
    // If we still don't have enough results, add a message
    if (results.length === 0) {
      logger.warn(LogCategory.NODE, '[FirecrawlAPI]', 'No valid search results found for query', { query });
      results.push({
        title: 'No results found',
        url: '#',
        snippet: `No search results were found for "${query}". Try a different search query.`
      });
    }
    
    // Limit to requested number
    return results.slice(0, limit);
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Search error:', { error });
    throw error;
  }
}

/**
 * Scrapes a URL using the Firecrawl API
 * @param url The URL to scrape
 * @param formats The formats to return (markdown, html, etc.)
 * @returns Scrape result
 */
export async function scrapeFirecrawl(url: string, formats: string[] = ['markdown']): Promise<FirecrawlScrapeResult> {
  try {
    const response = await firecrawlClient.scrape(url, { formats });
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Scrape result received', { url });
    
    return {
      url: url,
      title: response.data?.metadata?.title || 'No title',
      content: response.data?.markdown || 'No content available.',
      metadata: response.data?.metadata || {}
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Scrape error:', { error });
    throw error;
  }
}

/**
 * Crawls a website using the Firecrawl API
 * @param url The URL to crawl
 * @param limit Maximum number of pages to crawl
 * @param maxDepth Maximum crawl depth
 * @returns Crawl result
 */
export async function crawlFirecrawl(url: string, limit: number = 10, maxDepth: number = 2): Promise<FirecrawlCrawlResult> {
  try {
    const response = await firecrawlClient.crawl(url, { 
      limit, 
      maxDepth,
      scrapeOptions: { formats: ['markdown'] }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Crawl job submitted', { 
      url,
      crawlId: response.id
    });
    
    // For synchronous crawls, we might get data directly
    if (response.data) {
      return {
        url: url,
        pages: response.data.length,
        crawlId: response.id,
        status: 'completed',
        results: response.data.map((item: any) => ({
          url: item.metadata?.sourceURL || '#',
          title: item.metadata?.title || 'No title',
          content: item.markdown?.substring(0, 200) + '...' || 'No content available.'
        }))
      };
    }
    
    // For asynchronous crawls, we return the job ID
    return {
      url: url,
      pages: 0,
      crawlId: response.id,
      status: 'pending',
      results: []
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Crawl error:', { error });
    throw error;
  }
}

/**
 * Checks the status of a crawl job
 * @param crawlId The crawl job ID
 * @returns Crawl result
 */
export async function checkCrawlStatus(crawlId: string): Promise<FirecrawlCrawlResult> {
  try {
    const response = await firecrawlClient.checkCrawlStatus(crawlId);
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Crawl status received', { 
      crawlId,
      status: response.status,
      completed: response.completed,
      total: response.total
    });
    
    return {
      url: '',
      pages: response.total || 0,
      crawlId: crawlId,
      status: response.status,
      results: (response.data || []).map((item: any) => ({
        url: item.metadata?.sourceURL || '#',
        title: item.metadata?.title || 'No title',
        content: item.markdown?.substring(0, 200) + '...' || 'No content available.'
      }))
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Check crawl status error:', { error });
    throw error;
  }
}

/**
 * Maps a website using the Firecrawl API
 * @param url The URL to map
 * @param maxDepth Maximum crawl depth
 * @returns Map result
 */
export async function mapFirecrawl(url: string, maxDepth: number = 2): Promise<FirecrawlMapResult> {
  try {
    const response = await firecrawlClient.map(url, { maxDepth });
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Map result received', { 
      url,
      urlCount: response.data?.urls?.length || 0
    });
    
    return {
      url: url,
      urlCount: response.data?.urls?.length || 0,
      urls: response.data?.urls || []
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Map error:', { error });
    throw error;
  }
}

/**
 * Extracts structured data from a URL using the Firecrawl API
 * @param url The URL to extract data from
 * @param schema The schema to extract (optional)
 * @param prompt The prompt to use for extraction (optional)
 * @returns Extract result
 */
export async function extractFirecrawl(url: string, schema?: any, prompt?: string): Promise<FirecrawlExtractResult> {
  try {
    const options: any = {};
    
    if (schema) {
      options.schema = schema;
    } else if (prompt) {
      options.prompt = prompt;
    }
    
    const response = await firecrawlClient.extract(url, options);
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    
    logger.debug(LogCategory.NODE, '[FirecrawlAPI]', 'Extract result received', { url });
    
    return {
      url: url,
      title: response.data?.metadata?.title || 'No title',
      data: response.data?.json || {},
      metadata: response.data?.metadata || {}
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[FirecrawlAPI]', 'Extract error:', { error });
    throw error;
  }
} 