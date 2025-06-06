/**
 * @fileoverview Semantic Scholar API tool implementation for searching and retrieving scientific papers
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import { Tool, ToolExecutionOptions } from '../../types';
import {
  fetchSemanticScholarAuthor,
  fetchSemanticScholarPaper,
  searchSemanticScholar
} from './api';
import {
  formatAuthorAsMarkdown,
  formatPaperAsMarkdown,
  formatSearchResultsAsMarkdown
} from './formatters';
import {
  SemanticScholarAuthorFetchSchema,
  SemanticScholarPaperFetchSchema,
  SemanticScholarSearchSchema
} from './schema';

// Type inference from schemas
type SemanticScholarSearchParams = z.infer<typeof SemanticScholarSearchSchema>;
type SemanticScholarPaperFetchParams = z.infer<
  typeof SemanticScholarPaperFetchSchema
>;
type SemanticScholarAuthorFetchParams = z.infer<
  typeof SemanticScholarAuthorFetchSchema
>;

/**
 * Tool implementation for Semantic Scholar Search
 */
export const semanticScholarSearchTool: Tool = {
  name: 'semantic_scholar_search',
  description: `
The semantic_scholar_search tool allows you to search for scientific papers on Semantic Scholar.

You should use this tool when the user wants to:
- Find scientific research articles on a specific topic
- Get recent or highly-cited publications in any field
- Find papers by specific authors or from specific venues (journals/conferences)
- Research technical or scientific concepts

The tool requires:
- query: The search term or phrase to look for
- maxResults: (Optional) Maximum number of results to return (default: 10, max: 100)
- year: (Optional) Filter by publication year
- openAccess: (Optional) Set to true to only include open access papers
- venue: (Optional) Filter by publication venue (journal or conference)
- fieldsOfStudy: (Optional) Filter by field of study (e.g., 'Computer Science')

This tool accesses Semantic Scholar, a free, AI-powered research tool for scientific literature from the Allen Institute for AI.
`,
  parameters: SemanticScholarSearchSchema,
  execute: async (
    params: SemanticScholarSearchParams,
    options: ToolExecutionOptions
  ) => {
    try {
      logger.debug(
        LogCategory.NODE,
        '[SemanticScholarAPI]',
        'Starting Semantic Scholar search',
        {
          query: params.query,
          toolCallId: options.toolCallId
        }
      );

      const results = await searchSemanticScholar(params);
      const markdown = formatSearchResultsAsMarkdown(params.query, results);

      return {
        type: 'semantic_scholar_search_result',
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
        '[SemanticScholarAPI]',
        'Error in semantic_scholar_search tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'semantic_scholar_search_result',
        content: `## Semantic Scholar Search Error\n\nUnable to search Semantic Scholar for "${params.query}": ${errorMessage}`,
        data: {
          error: errorMessage,
          query: params.query
        }
      };
    }
  }
};

/**
 * Tool implementation for Semantic Scholar Paper Fetch
 */
export const semanticScholarPaperFetchTool: Tool = {
  name: 'semantic_scholar_paper',
  description: `
The semantic_scholar_paper tool allows you to retrieve detailed information about a specific scientific paper from Semantic Scholar.

You should use this tool when the user wants to:
- Get detailed information about a specific scientific paper
- Retrieve the abstract or details of a paper with a known ID, DOI, or arXiv ID
- Find citation information for a specific publication
- Examine a particular research paper mentioned in previous search results

The tool requires:
- paperId: The Semantic Scholar Paper ID, DOI, or arXiv ID
- includeCitations: (Optional) Set to true to include top citations
- includeReferences: (Optional) Set to true to include references

This tool accesses Semantic Scholar, a free, AI-powered research tool for scientific literature from the Allen Institute for AI.
`,
  parameters: SemanticScholarPaperFetchSchema,
  execute: async (
    params: SemanticScholarPaperFetchParams,
    options: ToolExecutionOptions
  ) => {
    try {
      logger.debug(
        LogCategory.NODE,
        '[SemanticScholarAPI]',
        'Starting Semantic Scholar paper fetch',
        {
          paperId: params.paperId,
          toolCallId: options.toolCallId
        }
      );

      const paper = await fetchSemanticScholarPaper(params);
      const markdown = formatPaperAsMarkdown(paper);

      return {
        type: 'semantic_scholar_paper_result',
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
        '[SemanticScholarAPI]',
        'Error in semantic_scholar_paper tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'semantic_scholar_paper_result',
        content: `## Semantic Scholar Paper Fetch Error\n\nUnable to retrieve paper with ID "${params.paperId}": ${errorMessage}`,
        data: {
          error: errorMessage,
          paperId: params.paperId
        }
      };
    }
  }
};

/**
 * Tool implementation for Semantic Scholar Author Fetch
 */
export const semanticScholarAuthorFetchTool: Tool = {
  name: 'semantic_scholar_author',
  description: `
The semantic_scholar_author tool allows you to retrieve information about a researcher from Semantic Scholar.

You should use this tool when the user wants to:
- Get information about a specific researcher or author
- Find publication metrics (h-index, citation count) for an author
- Get a list of an author's papers
- Find an author's affiliations

The tool requires:
- authorId: The Semantic Scholar Author ID or ORCID
- includePapers: (Optional) Set to true to include the author's papers
- paperLimit: (Optional) Maximum number of papers to return (default: 10, max: 100)

This tool accesses Semantic Scholar, a free, AI-powered research tool for scientific literature from the Allen Institute for AI.
`,
  parameters: SemanticScholarAuthorFetchSchema,
  execute: async (
    params: SemanticScholarAuthorFetchParams,
    options: ToolExecutionOptions
  ) => {
    try {
      logger.debug(
        LogCategory.NODE,
        '[SemanticScholarAPI]',
        'Starting Semantic Scholar author fetch',
        {
          authorId: params.authorId,
          includePapers: params.includePapers,
          toolCallId: options.toolCallId
        }
      );

      const { author, papers } = await fetchSemanticScholarAuthor(params);
      const markdown = formatAuthorAsMarkdown(author, papers);

      return {
        type: 'semantic_scholar_author_result',
        content: markdown,
        data: {
          author,
          papers
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        LogCategory.NODE,
        '[SemanticScholarAPI]',
        'Error in semantic_scholar_author tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'semantic_scholar_author_result',
        content: `## Semantic Scholar Author Fetch Error\n\nUnable to retrieve author with ID "${params.authorId}": ${errorMessage}`,
        data: {
          error: errorMessage,
          authorId: params.authorId
        }
      };
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  semantic_scholar_search: semanticScholarSearchTool,
  semantic_scholar_paper: semanticScholarPaperFetchTool,
  semantic_scholar_author: semanticScholarAuthorFetchTool
};
