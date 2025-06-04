/**
 * @fileoverview PubMed API tool implementation for searching and retrieving biomedical literature
 * through NCBI's Entrez Programming Utilities (E-utilities).
 */

import { LogCategory, logger } from 'agentdock-core';
import { z } from 'zod';

import { Tool, ToolExecutionOptions } from '../../types';
import { fetchPubMedArticle, searchPubMed } from './api';
import {
  formatArticleAsMarkdown,
  formatSearchResultsAsMarkdown
} from './formatters';
import { PubMedFetchSchema, PubMedSearchSchema } from './schema';

// Type inference from schemas
type PubMedSearchParams = z.infer<typeof PubMedSearchSchema>;
type PubMedFetchParams = z.infer<typeof PubMedFetchSchema>;

/**
 * Tool implementation for PubMed Search
 */
export const pubmedSearchTool: Tool = {
  name: 'pubmed_search',
  description: `
The pubmed_search tool allows you to search for biomedical literature in PubMed.

You should use this tool when the user wants to:
- Find medical or scientific research articles on a specific topic
- Get recent publications about a disease, treatment, or medical condition
- Find papers by specific authors or from specific journals in biomedicine
- Research specific medical concepts, drugs, or therapies

The tool requires:
- query: The search term or phrase to look for (e.g., "cancer immunotherapy", "COVID-19 treatment")
- maxResults: (Optional) Maximum number of results to return (default: 10, max: 100)
- sort: (Optional) Sort order - either "relevance" (default) or "date" (newest first)
- filter: (Optional) Additional PubMed filters in standard PubMed syntax

This tool accesses the National Library of Medicine's PubMed database through the E-utilities API.
`,
  parameters: PubMedSearchSchema,
  execute: async (
    params: PubMedSearchParams,
    options: ToolExecutionOptions
  ) => {
    try {
      logger.debug(LogCategory.NODE, '[PubMedAPI]', 'Starting PubMed search', {
        query: params.query,
        toolCallId: options.toolCallId
      });

      const results = await searchPubMed(params);
      const markdown = formatSearchResultsAsMarkdown(params.query, results);

      return {
        type: 'pubmed_search_result',
        content: markdown,
        data: {
          articles: results.articles,
          query: params.query,
          total: results.total
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        LogCategory.NODE,
        '[PubMedAPI]',
        'Error in pubmed_search tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'pubmed_search_result',
        content: `## PubMed Search Error\n\nUnable to search PubMed for "${params.query}": ${errorMessage}`,
        data: {
          error: errorMessage,
          query: params.query
        }
      };
    }
  }
};

/**
 * Tool implementation for PubMed Fetch
 */
export const pubmedFetchTool: Tool = {
  name: 'pubmed_fetch',
  description: `
The pubmed_fetch tool allows you to retrieve detailed information about a specific article from PubMed.

You should use this tool when the user wants to:
- Get detailed information about a specific medical or scientific paper
- Retrieve the abstract or full details of an article with a known PubMed ID (PMID)
- Find citation information for a specific publication
- Examine a particular research paper mentioned in previous search results

The tool requires:
- pmid: The PubMed ID (PMID) of the article to retrieve
- format: (Optional) The level of detail - "summary" (default), "abstract", or "full"

This tool accesses the National Library of Medicine's PubMed database through the E-utilities API.
`,
  parameters: PubMedFetchSchema,
  execute: async (params: PubMedFetchParams, options: ToolExecutionOptions) => {
    try {
      logger.debug(LogCategory.NODE, '[PubMedAPI]', 'Starting PubMed fetch', {
        pmid: params.pmid,
        format: params.format,
        toolCallId: options.toolCallId
      });

      const article = await fetchPubMedArticle(params);
      const markdown = formatArticleAsMarkdown(article);

      return {
        type: 'pubmed_article_result',
        content: markdown,
        data: {
          article
        }
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        LogCategory.NODE,
        '[PubMedAPI]',
        'Error in pubmed_fetch tool',
        {
          error: errorMessage,
          params
        }
      );

      return {
        type: 'pubmed_article_result',
        content: `## PubMed Article Fetch Error\n\nUnable to retrieve article with PMID "${params.pmid}": ${errorMessage}`,
        data: {
          error: errorMessage,
          pmid: params.pmid
        }
      };
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  pubmed_search: pubmedSearchTool,
  pubmed_fetch: pubmedFetchTool
};
