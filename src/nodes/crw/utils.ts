/**
 * @fileoverview Utility functions for the crw tool.
 * Contains functions for making API calls to the fastCRW API.
 *
 * fastCRW is a Firecrawl-compatible web scraper available as a single binary;
 * self-host or use the managed cloud. Because the API is Firecrawl-compatible,
 * this mirrors the Firecrawl provider with the fastCRW base URL.
 */

import { LogCategory, logger } from 'agentdock-core';

import { cleanText, cleanUrl } from '@/lib/utils/markdown-utils';
import {
  CrwCrawlResult,
  CrwExtractResult,
  CrwMapResult,
  CrwResult,
  CrwScrapeResult
} from './components';

/**
 * CRW API client
 * Talks to the Firecrawl-compatible fastCRW REST API.
 */
class CrwClient {
  private apiKey: string;
  private baseUrl: string = 'https://fastcrw.com/api/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CRW_API_KEY || '';

    if (!this.apiKey) {
      logger.warn(
        LogCategory.NODE,
        '[CrwAPI]',
        'No API key provided, using environment variable'
      );
    }

    // Override base URL if specified in environment (e.g. self-hosted instance)
    if (process.env.CRW_BASE_URL) {
      this.baseUrl = process.env.CRW_BASE_URL;
    }
  }

  /**
   * Make an API request to CRW
   */
  private async request(
    endpoint: string,
    method: string = 'POST',
    body?: any
  ): Promise<any> {
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
      logger.error(
        LogCategory.NODE,
        '[CrwAPI]',
        `API error: ${response.status}`,
        { error: errorText }
      );
      throw new Error(
        `CRW API error: ${response.status} - ${errorText.substring(0, 100)}`
      );
    }

    return await response.json();
  }

  /**
   * Search the web using CRW
   */
  async search(
    query: string,
    options: {
      limit?: number;
      lang?: string;
      country?: string;
      scrapeOptions?: {
        formats?: string[];
      };
    } = {}
  ): Promise<any> {
    logger.debug(LogCategory.NODE, '[CrwAPI]', `Searching for: ${query}`);

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
   * Scrape a URL using CRW
   */
  async scrape(
    url: string,
    options: {
      formats?: string[];
      jsonOptions?: {
        schema?: any;
        prompt?: string;
      };
    } = {}
  ): Promise<any> {
    logger.debug(LogCategory.NODE, '[CrwAPI]', `Scraping URL: ${url}`);

    const body = {
      url,
      formats: options.formats || ['markdown'],
      jsonOptions: options.jsonOptions
    };

    return this.request('/scrape', 'POST', body);
  }

  /**
   * Crawl a website using CRW
   */
  async crawl(
    url: string,
    options: {
      limit?: number;
      maxDepth?: number;
      excludePaths?: string[];
      includePaths?: string[];
      scrapeOptions?: {
        formats?: string[];
      };
    } = {}
  ): Promise<any> {
    logger.debug(LogCategory.NODE, '[CrwAPI]', `Crawling website: ${url}`);

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
    logger.debug(LogCategory.NODE, '[CrwAPI]', `Checking crawl status: ${id}`);
    return this.request(`/crawl/${id}`, 'GET');
  }

  /**
   * Map a website using CRW
   */
  async map(
    url: string,
    options: {
      maxDepth?: number;
      excludePaths?: string[];
      includePaths?: string[];
    } = {}
  ): Promise<any> {
    logger.debug(LogCategory.NODE, '[CrwAPI]', `Mapping website: ${url}`);

    const body = {
      url,
      maxDepth: options.maxDepth || 2,
      excludePaths: options.excludePaths || [],
      includePaths: options.includePaths || []
    };

    return this.request('/map', 'POST', body);
  }

  /**
   * Extract structured data from a URL using CRW
   */
  async extract(
    url: string,
    options: {
      schema?: any;
      prompt?: string;
    } = {}
  ): Promise<any> {
    logger.debug(
      LogCategory.NODE,
      '[CrwAPI]',
      `Extracting data from URL: ${url}`
    );

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

// Create a singleton instance of the CRW client
const crwClient = new CrwClient();

/**
 * Performs a web search using the CRW API
 * @param query The search query
 * @param limit Maximum number of results to return
 * @returns Array of search results
 */
export async function searchCrw(
  query: string,
  limit: number = 25
): Promise<CrwResult[]> {
  try {
    const response = await crwClient.search(query, { limit });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Search results received', {
      resultsCount: response.data?.length || 0
    });

    // Transform API response to our CrwResult format
    const results: CrwResult[] = [];

    // Process results
    if (response.data && Array.isArray(response.data)) {
      for (const item of response.data) {
        if (results.length >= limit) break;

        // Skip results without a URL or with empty content
        if (!item.url || (!item.title && !item.description)) continue;

        results.push({
          title: cleanText(item.title) || 'No title',
          url: cleanUrl(item.url),
          snippet:
            cleanText(
              item.description ||
                (item.markdown ? item.markdown.substring(0, 200) + '...' : '')
            ) || 'No description available.'
        });
      }
    }

    // If we still don't have enough results, add a message
    if (results.length === 0) {
      logger.warn(
        LogCategory.NODE,
        '[CrwAPI]',
        'No valid search results found for query',
        { query }
      );
      results.push({
        title: 'No results found',
        url: '#',
        snippet: `No search results were found for "${query}". Try a different search query.`
      });
    }

    // Limit to requested number
    return results.slice(0, limit);
  } catch (error) {
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Search error:', {
      error
    });
    throw error;
  }
}

/**
 * Scrapes a URL using the CRW API
 * @param url The URL to scrape
 * @param formats The formats to return (markdown, html, etc.)
 * @returns Scrape result
 */
export async function scrapeCrw(
  url: string,
  formats: string[] = ['markdown']
): Promise<CrwScrapeResult> {
  try {
    const response = await crwClient.scrape(url, { formats });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Scrape result received', {
      url
    });

    return {
      url: url,
      title: response.data?.metadata?.title || 'No title',
      content: response.data?.markdown || 'No content available.',
      metadata: response.data?.metadata || {}
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Scrape error:', {
      error
    });
    throw error;
  }
}

/**
 * Crawls a website using the CRW API
 * @param url The URL to crawl
 * @param limit Maximum number of pages to crawl
 * @param maxDepth Maximum crawl depth
 * @returns Crawl result
 */
export async function crawlCrw(
  url: string,
  limit: number = 10,
  maxDepth: number = 2
): Promise<CrwCrawlResult> {
  try {
    const response = await crwClient.crawl(url, {
      limit,
      maxDepth,
      scrapeOptions: { formats: ['markdown'] }
    });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Crawl job submitted', {
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
          content:
            item.markdown?.substring(0, 200) + '...' || 'No content available.'
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
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Crawl error:', { error });
    throw error;
  }
}

/**
 * Checks the status of a crawl job
 * @param crawlId The crawl job ID
 * @returns Crawl result
 */
export async function checkCrawlStatus(
  crawlId: string
): Promise<CrwCrawlResult> {
  try {
    const response = await crwClient.checkCrawlStatus(crawlId);

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Crawl status received', {
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
        content:
          item.markdown?.substring(0, 200) + '...' || 'No content available.'
      }))
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Check crawl status error:', {
      error
    });
    throw error;
  }
}

/**
 * Maps a website using the CRW API
 * @param url The URL to map
 * @param maxDepth Maximum crawl depth
 * @returns Map result
 */
export async function mapCrw(
  url: string,
  maxDepth: number = 2
): Promise<CrwMapResult> {
  try {
    const response = await crwClient.map(url, { maxDepth });

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Map result received', {
      url,
      urlCount: response.data?.urls?.length || 0
    });

    return {
      url: url,
      urlCount: response.data?.urls?.length || 0,
      urls: response.data?.urls || []
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Map error:', { error });
    throw error;
  }
}

/**
 * Extracts structured data from a URL using the CRW API
 * @param url The URL to extract data from
 * @param schema The schema to extract (optional)
 * @param prompt The prompt to use for extraction (optional)
 * @returns Extract result
 */
export async function extractCrw(
  url: string,
  schema?: any,
  prompt?: string
): Promise<CrwExtractResult> {
  try {
    const options: any = {};

    if (schema) {
      options.schema = schema;
    } else if (prompt) {
      options.prompt = prompt;
    }

    const response = await crwClient.extract(url, options);

    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }

    logger.debug(LogCategory.NODE, '[CrwAPI]', 'Extract result received', {
      url
    });

    return {
      url: url,
      title: response.data?.metadata?.title || 'No title',
      data: response.data?.json || {},
      metadata: response.data?.metadata || {}
    };
  } catch (error) {
    logger.error(LogCategory.NODE, '[CrwAPI]', 'Extract error:', {
      error
    });
    throw error;
  }
}
