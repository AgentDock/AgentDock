/**
 * @fileoverview CRW tool implementation following Vercel AI SDK patterns.
 * Provides web search, scraping, crawling, mapping, and extraction functionality using the fastCRW API.
 *
 * fastCRW is a Firecrawl-compatible web scraper distributed as a single binary;
 * self-host (AGPL open core) or use the managed cloud at https://fastcrw.com.
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import {
  createToolResult,
  formatErrorMessage
} from '@/lib/utils/markdown-utils';
import { Tool } from '../types';
import {
  CrwCrawlResults,
  CrwExtractResults,
  CrwMapResults,
  CrwResults,
  CrwScrapeResults
} from './components';
import {
  checkCrawlStatus,
  crawlCrw,
  extractCrw,
  mapCrw,
  scrapeCrw,
  searchCrw
} from './utils';

/**
 * Schema for crw search tool parameters
 */
const crwSearchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(5)
    .describe('Maximum number of results to return')
});

/**
 * Schema for crw scrape tool parameters
 */
const crwScrapeSchema = z.object({
  url: z.string().url().describe('URL to scrape'),
  formats: z
    .array(z.string())
    .optional()
    .default(['markdown'])
    .describe('Formats to return (markdown, html, etc.)')
});

/**
 * Schema for crw crawl tool parameters
 */
const crwCrawlSchema = z.object({
  url: z.string().url().describe('URL to crawl'),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(10)
    .describe('Maximum number of pages to crawl'),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(2)
    .describe('Maximum crawl depth')
});

/**
 * Schema for crw crawl status tool parameters
 */
const crwCrawlStatusSchema = z.object({
  crawlId: z.string().describe('Crawl job ID to check')
});

/**
 * Schema for crw map tool parameters
 */
const crwMapSchema = z.object({
  url: z.string().url().describe('URL to map'),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(2)
    .describe('Maximum crawl depth')
});

/**
 * Schema for crw extract tool parameters
 */
const crwExtractSchema = z.object({
  url: z.string().url().describe('URL to extract data from'),
  prompt: z.string().optional().describe('Prompt to use for extraction')
});

/**
 * Type inference from schemas
 */
type CrwSearchParams = z.infer<typeof crwSearchSchema>;
type CrwScrapeParams = z.infer<typeof crwScrapeSchema>;
type CrwCrawlParams = z.infer<typeof crwCrawlSchema>;
type CrwCrawlStatusParams = z.infer<typeof crwCrawlStatusSchema>;
type CrwMapParams = z.infer<typeof crwMapSchema>;
type CrwExtractParams = z.infer<typeof crwExtractSchema>;

/**
 * CRW search tool implementation
 */
export const crwSearchTool: Tool = {
  name: 'crw_search',
  description: 'Search the web for information on any topic using fastCRW',
  parameters: crwSearchSchema,
  async execute({ query, limit = 5 }, options) {
    logger.debug(
      LogCategory.NODE,
      '[CRW]',
      `Executing search for query: ${query}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!query.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty search query provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage(
            'Error',
            'Please provide a non-empty search query.'
          )
        );
      }

      // Get actual search results from the API
      const results = await searchCrw(query, limit);

      // Use our CrwResults component to format the output
      return CrwResults({
        query,
        results
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Search execution error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * CRW scrape tool implementation
 */
export const crwScrapeTool: Tool = {
  name: 'crw_scrape',
  description: 'Scrape a webpage and extract its content using fastCRW',
  parameters: crwScrapeSchema,
  async execute({ url, formats = ['markdown'] }, options) {
    logger.debug(LogCategory.NODE, '[CRW]', `Executing scrape for URL: ${url}`, {
      toolCallId: options.toolCallId
    });

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty URL provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual scrape results from the API
      const result = await scrapeCrw(url, formats);

      // Use our CrwScrapeResults component to format the output
      return CrwScrapeResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Scrape execution error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * CRW crawl tool implementation
 */
export const crwCrawlTool: Tool = {
  name: 'crw_crawl',
  description:
    'Crawl a website and extract content from multiple pages using fastCRW',
  parameters: crwCrawlSchema,
  async execute({ url, limit = 10, maxDepth = 2 }, options) {
    logger.debug(LogCategory.NODE, '[CRW]', `Executing crawl for URL: ${url}`, {
      toolCallId: options.toolCallId
    });

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty URL provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual crawl results from the API
      const result = await crawlCrw(url, limit, maxDepth);

      // Use our CrwCrawlResults component to format the output
      return CrwCrawlResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Crawl execution error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * CRW crawl status tool implementation
 */
export const crwCrawlStatusTool: Tool = {
  name: 'crw_crawl_status',
  description: 'Check the status of a crawl job using fastCRW',
  parameters: crwCrawlStatusSchema,
  async execute({ crawlId }, options) {
    logger.debug(
      LogCategory.NODE,
      '[CRW]',
      `Checking crawl status for ID: ${crawlId}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!crawlId.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty crawl ID provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage('Error', 'Please provide a non-empty crawl ID.')
        );
      }

      // Get actual crawl status from the API
      const result = await checkCrawlStatus(crawlId);

      // Use our CrwCrawlResults component to format the output
      return CrwCrawlResults({
        url: '',
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Crawl status check error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * CRW map tool implementation
 */
export const crwMapTool: Tool = {
  name: 'crw_map',
  description: 'Map a website and get a list of all URLs using fastCRW',
  parameters: crwMapSchema,
  async execute({ url, maxDepth = 2 }, options) {
    logger.debug(LogCategory.NODE, '[CRW]', `Executing map for URL: ${url}`, {
      toolCallId: options.toolCallId
    });

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty URL provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual map results from the API
      const result = await mapCrw(url, maxDepth);

      // Use our CrwMapResults component to format the output
      return CrwMapResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Map execution error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * CRW extract tool implementation
 */
export const crwExtractTool: Tool = {
  name: 'crw_extract',
  description: 'Extract structured data from a webpage using fastCRW',
  parameters: crwExtractSchema,
  async execute({ url, prompt }, options) {
    logger.debug(
      LogCategory.NODE,
      '[CRW]',
      `Executing extract for URL: ${url}`,
      { toolCallId: options.toolCallId }
    );

    try {
      // Validate input
      if (!url.trim()) {
        logger.warn(LogCategory.NODE, '[CRW]', 'Empty URL provided');
        return createToolResult(
          'crw_error',
          formatErrorMessage('Error', 'Please provide a non-empty URL.')
        );
      }

      // Get actual extract results from the API
      const result = await extractCrw(url, undefined, prompt);

      // Use our CrwExtractResults component to format the output
      return CrwExtractResults({
        url,
        result
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[CRW]', 'Extract execution error:', {
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
          'The fastCRW service is not properly configured. Please ensure the CRW_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from fastcrw.com\n2. Add it to your environment variables as CRW_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The fastCRW service encountered an error: ' +
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

      return createToolResult('crw_error', errorContent);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  crw_search: crwSearchTool,
  crw_scrape: crwScrapeTool,
  crw_crawl: crwCrawlTool,
  crw_crawl_status: crwCrawlStatusTool,
  crw_map: crwMapTool,
  crw_extract: crwExtractTool
};
