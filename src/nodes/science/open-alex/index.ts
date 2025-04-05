/**
 * @fileoverview OpenAlex API tool implementation for searching and retrieving scholarly
 * literature from the open access OpenAlex database.
 */

import { z } from 'zod';
import { Tool, ToolExecutionOptions } from '../../types';
import { logger, LogCategory } from 'agentdock-core';
import { OpenAlexSearchSchema, OpenAlexFetchSchema } from './schema';
import { searchOpenAlex, fetchOpenAlexWork } from './api';
import { formatSearchResultsAsMarkdown, formatWorkAsMarkdown } from './formatters';

// Type inference from schemas
type OpenAlexSearchParams = z.infer<typeof OpenAlexSearchSchema>;
type OpenAlexFetchParams = z.infer<typeof OpenAlexFetchSchema>;

/**
 * Tool implementation for OpenAlex Search
 */
export const openAlexSearchTool: Tool = {
  name: 'openalex_search',
  description: `
The openAlex_search tool allows you to search for scholarly literature across a wide range of disciplines.

You should use this tool when the user wants to:
- Find scholarly articles on a specific topic or research area
- Get recent publications in any field
- Find open access scholarly literature
- Identify highly-cited papers on a subject
- Research specific scientific or academic concepts

The tool requires:
- query: The search term or phrase to look for (e.g., "climate change", "quantum computing")
- maxResults: (Optional) Maximum number of results to return (default: 10, max: 100)
- sort: (Optional) Sort order - "relevance" (default), "date" (newest first), or "citations" (most cited)
- filter: (Optional) Additional filter - "open_access", "recent", or "highly_cited"

This tool accesses OpenAlex, an open and comprehensive index of scholarly papers, authors, institutions, and more.
`,
  parameters: OpenAlexSearchSchema,
  execute: async (params: OpenAlexSearchParams, options: ToolExecutionOptions) => {
    try {
      logger.debug(LogCategory.NODE, '[OpenAlexAPI]', 'Starting OpenAlex search', { 
        query: params.query,
        toolCallId: options.toolCallId
      });
      
      const results = await searchOpenAlex(params);
      const markdown = formatSearchResultsAsMarkdown(params.query, {
        query: params.query,
        total: results.total,
        works: results.works,
        filters: {
          open_access: params.filter === 'open_access',
          recent: params.filter === 'recent',
          highly_cited: params.filter === 'highly_cited',
        }
      });
      
      return {
        type: 'openalex_search_result',
        content: markdown,
        data: {
          works: results.works,
          query: params.query,
          total: results.total
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Only log essential error information
      logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Error in openalex_search tool', {
        error: errorMessage,
        query: params.query
      });
      
      return {
        type: 'openalex_search_result',
        content: `## OpenAlex Search Error\n\nUnable to search OpenAlex for "${params.query}": ${errorMessage}`,
        data: {
          error: errorMessage,
          query: params.query
        }
      };
    }
  }
};

/**
 * Tool implementation for OpenAlex Fetch
 */
export const openAlexFetchTool: Tool = {
  name: 'openalex_fetch',
  description: `
The openAlex_fetch tool allows you to retrieve detailed information about a specific scholarly work.

You should use this tool when the user wants to:
- Get detailed information about a specific scholarly article
- Retrieve the abstract or full details of a paper with a known ID or DOI
- Find citation information for a specific publication
- Examine a particular research paper mentioned in previous search results

The tool requires:
- id: The OpenAlex ID or DOI of the work to retrieve
- format: (Optional) The level of detail - "summary" (default) or "full"

This tool accesses OpenAlex, an open and comprehensive index of scholarly papers, authors, institutions, and more.
`,
  parameters: OpenAlexFetchSchema,
  execute: async (params: OpenAlexFetchParams, options: ToolExecutionOptions) => {
    try {
      logger.debug(LogCategory.NODE, '[OpenAlexAPI]', 'Starting OpenAlex fetch', { 
        id: params.id,
        format: params.format,
        toolCallId: options.toolCallId,
      });
      
      const work = await fetchOpenAlexWork(params);
      const markdown = formatWorkAsMarkdown(work);
      
      return {
        type: 'openAlex_work_result',
        content: markdown,
        data: {
          work
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(LogCategory.NODE, '[OpenAlexAPI]', 'Error in openAlex_fetch tool', {
        error: errorMessage,
        params,
      });
      
      return {
        type: 'openAlex_work_result',
        content: `## OpenAlex Work Fetch Error\n\nUnable to retrieve work with ID "${params.id}": ${errorMessage}`,
        data: {
          error: errorMessage,
          id: params.id
        }
      };
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  openalex_search: openAlexSearchTool,
  openalex_fetch: openAlexFetchTool
}; 