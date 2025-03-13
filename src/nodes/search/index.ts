/**
 * @fileoverview Search tool implementation following Vercel AI SDK patterns.
 * Provides web search functionality using the Serper API.
 */

import { z } from 'zod';
import { Tool } from '../types';
import { SearchResults } from './components';
import { searchWeb } from './utils';
import { logger, LogCategory } from 'agentdock-core';
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Schema for search tool parameters
 */
const searchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return')
});

/**
 * Type inference from schema
 */
type SearchParams = z.infer<typeof searchSchema>;

/**
 * Search tool implementation
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web for information on any topic',
  parameters: searchSchema,
  async execute({ query, limit = 5 }, options) {
    logger.debug(LogCategory.NODE, '[Search]', `Executing search for query: ${query}`, { toolCallId: options.toolCallId });
    
    try {
      // Validate input
      if (!query.trim()) {
        logger.warn(LogCategory.NODE, '[Search]', 'Empty search query provided');
        return createToolResult(
          'search_error',
          formatErrorMessage('Error', 'Please provide a non-empty search query.')
        );
      }
      
      // Get actual search results from the API
      const results = await searchWeb(query, limit);
      
      // Use our SearchResults component to format the output
      return SearchResults({
        query,
        results
      });
    } catch (error: unknown) {
      logger.error(LogCategory.NODE, '[Search]', 'Search execution error:', { error });
      
      // Return a formatted error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorContent: string;
      
      // Check for specific error types
      if (errorMessage.includes('SERPER_API_KEY not found')) {
        errorContent = formatErrorMessage(
          'Configuration Error',
          'The search service is not properly configured. Please ensure the SERPER_API_KEY environment variable is set.',
          'To fix this issue:\n1. Get an API key from Serper.dev\n2. Add it to your environment variables as SERPER_API_KEY\n3. Restart the application'
        );
      } else if (errorMessage.includes('API error')) {
        errorContent = formatErrorMessage(
          'API Error',
          'The search service encountered an error: ' + errorMessage.split(' - ')[0],
          'This might be due to:\n- Rate limiting\n- Invalid API key\n- Service outage\n\nPlease try again later or with a different query.'
        );
      } else {
        // Generic error message
        errorContent = formatErrorMessage(
          'Error',
          `Unable to complete search for "${query}": ${errorMessage}`,
          'Please try again with a different query.'
        );
      }
      
      return createToolResult('search_error', errorContent);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  'search': searchTool
}; 