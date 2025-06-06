/**
 * @fileoverview Firecrawl tool implementation following Vercel AI SDK patterns.
 * Provides web search, scraping, crawling, mapping, and extraction functionality using the Firecrawl API.
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import {
  createToolResult,
  formatErrorMessage
} from '@/lib/utils/markdown-utils';
import { Tool } from '../types';
import {
  FirecrawlCrawlResults,
  FirecrawlExtractResults,
  FirecrawlMapResults,
  FirecrawlResults,
  FirecrawlScrapeResults
} from './components';
import {
  checkCrawlStatus,
  crawlFirecrawl,
  extractFirecrawl,
  mapFirecrawl,
  scrapeFirecrawl,
  searchFirecrawl
} from './utils';

/**
 * Schema for firecrawl search tool parameters
 */
const firecrawlSearchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of results to return')
});

/**
 * Schema for firecrawl scrape tool parameters
 */
const firecrawlScrapeSchema = z.object({
  url: z.string().url().describe('URL to scrape'),
  formats: z
    .array(z.string())
    .optional()
    .default(['markdown'])
    .describe('Formats to return (markdown, html, etc.)')
});

/**
 * Schema for firecrawl crawl tool parameters
 */
const firecrawlCrawlSchema = z.object({
  url: z.string().url().describe('URL to crawl'),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of pages to crawl'),
  maxDepth: z.number().optional().default(2).describe('Maximum crawl depth')
});

/**
 * Schema for firecrawl crawl status tool parameters
 */
const firecrawlCrawlStatusSchema = z.object({
  crawlId: z.string().describe('Crawl job ID to check')
});

/**
 * Schema for firecrawl map tool parameters
 */
const firecrawlMapSchema = z.object({
  url: z.string().url().describe('URL to map'),
  maxDepth: z.number().optional().default(2).describe('Maximum crawl depth')
});

/**
 * Schema for firecrawl extract tool parameters
 */
const firecrawlExtractSchema = z.object({
  url: z.string().url().describe('URL to extract data from'),
  prompt: z.string().optional().describe('Prompt to use for extraction')
});

/**
 * Type inference from schemas
 */
type FirecrawlSearchParams = z.infer<typeof firecrawlSearchSchema>;
type FirecrawlScrapeParams = z.infer<typeof firecrawlScrapeSchema>;
type FirecrawlCrawlParams = z.infer<typeof firecrawlCrawlSchema>;
type FirecrawlCrawlStatusParams = z.infer<typeof firecrawlCrawlStatusSchema>;
type FirecrawlMapParams = z.infer<typeof firecrawlMapSchema>;
type FirecrawlExtractParams = z.infer<typeof firecrawlExtractSchema>;

/**
 * Firecrawl search tool implementation
 */
export const firecrawlSearchTool: Tool = {
  name: 'firecrawl_search',
  description: 'Search the web for information on any topic using Firecrawl',
  parameters: firecrawlSearchSchema,
  async execute({ query, limit = 5 }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Executing search for query: ${query}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!query.trim()) {
        logger.warn(
          LogCategory.NODE,
          '[Firecrawl]',
          'Empty search query provided'
        );
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage(
            'Error',
            'Please provide a non-empty search query.'
          )
        );
      }

      // Get actual search results from the API
      const results = await searchFirecrawl(query, limit);

      // Use our FirecrawlResults component to format the output
      return FirecrawlResults({
        query,
        results
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Firecrawl]', 'Search execution error:', {
        error
      });

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different query.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to complete search for "${query}": ${errorMessage}`,
          'Please try again with a different query.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Firecrawl scrape tool implementation
 */
export const firecrawlScrapeTool: Tool = {
  name: 'firecrawl_scrape',
  description: 'Scrape a webpage and extract its content using Firecrawl',
  parameters: firecrawlScrapeSchema,
  async execute({ url, formats = ['markdown'] }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Executing scrape for URL: ${url}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[Firecrawl]', 'Empty URL provided');
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual scrape results from the API
      const result = await scrapeFirecrawl(url, formats);

      // Use our FirecrawlScrapeResults component to format the output
      return FirecrawlScrapeResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Firecrawl]', 'Scrape execution error:', {
        error
      });

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different URL.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to scrape URL "${url}": ${errorMessage}`,
          'Please try again with a different URL.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Firecrawl crawl tool implementation
 */
export const firecrawlCrawlTool: Tool = {
  name: 'firecrawl_crawl',
  description:
    'Crawl a website and extract content from multiple pages using Firecrawl',
  parameters: firecrawlCrawlSchema,
  async execute({ url, limit = 10, maxDepth = 2 }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Executing crawl for URL: ${url}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[Firecrawl]', 'Empty URL provided');
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual crawl results from the API
      const result = await crawlFirecrawl(url, limit, maxDepth);

      // Use our FirecrawlCrawlResults component to format the output
      return FirecrawlCrawlResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Firecrawl]', 'Crawl execution error:', {
        error
      });

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different URL.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to crawl website "${url}": ${errorMessage}`,
          'Please try again with a different URL.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Firecrawl crawl status tool implementation
 */
export const firecrawlCrawlStatusTool: Tool = {
  name: 'firecrawl_crawl_status',
  description: 'Check the status of a crawl job using Firecrawl',
  parameters: firecrawlCrawlStatusSchema,
  async execute({ crawlId }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Checking crawl status for ID: ${crawlId}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!crawlId.trim()) {
        logger.warn(LogCategory.NODE, '[Firecrawl]', 'Empty crawl ID provided');
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage('Error', 'Please provide a non-empty crawl ID.')
        );
      }

      // Get actual crawl status from the API
      const result = await checkCrawlStatus(crawlId);

      // Use our FirecrawlCrawlResults component to format the output
      return FirecrawlCrawlResults({
        url: '',
        result
      });
    } catch (error: unknown) {
      logger.error(
        LogCategory.NODE,
        '[Firecrawl]',
        'Crawl status check error:',
        { error }
      );

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different crawl ID.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to check crawl status for ID "${crawlId}": ${errorMessage}`,
          'Please try again with a different crawl ID.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Firecrawl map tool implementation
 */
export const firecrawlMapTool: Tool = {
  name: 'firecrawl_map',
  description: 'Map a website and get a list of all URLs using Firecrawl',
  parameters: firecrawlMapSchema,
  async execute({ url, maxDepth = 2 }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Executing map for URL: ${url}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[Firecrawl]', 'Empty URL provided');
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual map results from the API
      const result = await mapFirecrawl(url, maxDepth);

      // Use our FirecrawlMapResults component to format the output
      return FirecrawlMapResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Firecrawl]', 'Map execution error:', {
        error
      });

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different URL.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to map website "${url}": ${errorMessage}`,
          'Please try again with a different URL.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Firecrawl extract tool implementation
 */
export const firecrawlExtractTool: Tool = {
  name: 'firecrawl_extract',
  description: 'Extract structured data from a webpage using Firecrawl',
  parameters: firecrawlExtractSchema,
  async execute({ url, prompt }, options) {
    logger.debug(
      LogCategory.NODE,
      '[Firecrawl]',
      `Executing extract for URL: ${url}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[Firecrawl]', 'Empty URL provided');
        return createToolResult(
          'firecrawl_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual extract results from the API
      const result = await extractFirecrawl(url, undefined, prompt);

      // Use our FirecrawlExtractResults component to format the output
      return FirecrawlExtractResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(
        LogCategory.NODE,
        '[Firecrawl]',
        'Extract execution error:',
        { error }
      );

      // Return a formatted error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let errorContent: string;

      // Check for specific error types
      if (errorMessage.includes('API key not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The Firecrawl service is not properly configured. Please ensure the FIRECRAWL_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from firecrawl.dev\n2. Add it to your environment variables as FIRECRAWL_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The Firecrawl service encountered an error: ' +
            errorMessage.split(' - ')[0],
          'This might be due to:\n- Service unavailable\n- Invalid request\n- Service outage\n\nPlease try again later or with a different URL.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to extract data from "${url}": ${errorMessage}`,
          'Please try again with a different URL.'
        );
      }

      return createToolResult('firecrawl_error', errorContent);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  firecrawl_search: firecrawlSearchTool,
  firecrawl_scrape: firecrawlScrapeTool,
  firecrawl_crawl: firecrawlCrawlTool,
  firecrawl_crawl_status: firecrawlCrawlStatusTool,
  firecrawl_map: firecrawlMapTool,
  firecrawl_extract: firecrawlExtractTool
};
