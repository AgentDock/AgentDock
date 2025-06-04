/**
 * @fileoverview arXiv API tool implementation for searching and retrieving scientific papers
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import { Tool, ToolExecutionOptions } from '../../types';
import { fetchArxivPaper, searchArxiv } from './api';
import {
  formatPaperAsMarkdown,
  formatSearchResultsAsMarkdown
} from './formatters';
import { ArxivFetchSchema, ArxivSearchSchema } from './schema';

// Type inference from schemas
type ArxivSearchParams = z.infer<typeof ArxivSearchSchema>;
type ArxivFetchParams = z.infer<typeof ArxivFetchSchema>;

/**
 * Tool implementation for arXiv Search
 */
export const arxivSearchTool: Tool = {
  name: 'arxiv_search',
  description: `
The arxiv_search tool allows you to search for scientific papers on arXiv.

You should use this tool when the user wants to:
- Find scientific research articles on a specific topic
- Get recent publications in fields like physics, computer science, mathematics, etc.
- Find papers by specific authors or from specific categories
- Research technical or scientific concepts

The tool requires:
- query: The search term or phrase to look for
- maxResults: (Optional) Maximum number of results to return (default: 10, max: 50)
- sortBy: (Optional) Sort order - either "relevance" (default), "lastUpdated", or "submitted"
- category: (Optional) arXiv category to search within (e.g., 'cs.AI', 'physics')
- searchIn: (Optional) Where to search - "all" (default), "title", "abstract", or "author"

This tool accesses arXiv.org, an open-access archive for scholarly articles in physics, mathematics, computer science, and related fields.
`,
  parameters: ArxivSearchSchema,
  execute: async (params: ArxivSearchParams, options: ToolExecutionOptions) => {
    try {
      logger.debug(LogCategory.NODE, '[ArxivAPI]', 'Starting arXiv search', {
        query: params.query,
        toolCallId: options.toolCallId
      });

      const results = await searchArxiv(params);
      const markdown = formatSearchResultsAsMarkdown(params.query, results);

      return {
        type: 'arxiv_search_result',
        content: markdown,
        data: {
          papers: results.papers,
          query: params.query,
          total: results.total
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        LogCategory.NODE,
        '[ArxivAPI]',
        'Error in arxiv_search tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'arxiv_search_result',
        content: `## arXiv Search Error\n\nUnable to search arXiv for "${params.query}": ${errorMessage}`,
        data: {
          error: errorMessage,
          query: params.query
        }
      };
    }
  }
};

/**
 * Tool implementation for arXiv Fetch
 */
export const arxivFetchTool: Tool = {
  name: 'arxiv_fetch',
  description: `
The arxiv_fetch tool allows you to retrieve detailed information about a specific scientific paper from arXiv.

You should use this tool when the user wants to:
- Get detailed information about a specific scientific paper
- Retrieve the abstract or details of a paper with a known arXiv ID
- Find citation information for a specific publication
- Examine a particular research paper mentioned in previous search results

The tool requires:
- id: The arXiv ID of the paper to retrieve (e.g., "2302.13971" or full URL)
- format: (Optional) The level of detail - "summary" (default) or "full"

This tool accesses arXiv.org, an open-access archive for scholarly articles in physics, mathematics, computer science, and related fields.
`,
  parameters: ArxivFetchSchema,
  execute: async (params: ArxivFetchParams, options: ToolExecutionOptions) => {
    try {
      logger.debug(LogCategory.NODE, '[ArxivAPI]', 'Starting arXiv fetch', {
        id: params.id,
        format: params.format,
        toolCallId: options.toolCallId
      });

      const paper = await fetchArxivPaper(params);
      const markdown = formatPaperAsMarkdown(paper);

      return {
        type: 'arxiv_paper_result',
        content: markdown,
        data: {
          paper
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        LogCategory.NODE,
        '[ArxivAPI]',
        'Error in arxiv_fetch tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'arxiv_paper_result',
        content: `## arXiv Paper Fetch Error\n\nUnable to retrieve paper with ID "${params.id}": ${errorMessage}`,
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
  arxiv_search: arxivSearchTool,
  arxiv_fetch: arxivFetchTool
};
