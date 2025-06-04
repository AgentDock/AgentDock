/**
 * @fileoverview Utility functions for the search tool.
 * Contains functions for making API calls to search engines.
 */

import { LogCategory, logger } from 'agentdock-core';

import { cleanText, cleanUrl } from '@/lib/utils/markdown-utils';
import { SearchResult } from './components';

/**
 * Interface for Serper API response
 */
interface SerperApiResponse {
  organic?: {
    title: string;
    link: string;
    snippet: string;
    position?: number;
  }[];
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
    attributes?: Record<string, string>;
  };
  answerBox?: {
    title?: string;
    answer?: string;
    snippet?: string;
  };
  searchParameters?: {
    q: string;
    gl: string;
    hl: string;
  };
}

/**
 * Performs a web search using the Serper API
 * @param query The search query
 * @param limit Maximum number of results to return
 * @returns Array of search results
 */
export async function searchWeb(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  logger.debug(LogCategory.NODE, '[SearchAPI]', `Searching for: ${query}`);

  try {
    // Get API key from environment
    const apiKey = process.env.SERPER_API_KEY;

    if (!apiKey) {
      logger.error(
        LogCategory.NODE,
        '[SearchAPI]',
        'SERPER_API_KEY not found in environment'
      );
      throw new Error(
        'Search API key not configured. Please set SERPER_API_KEY environment variable.'
      );
    }

    // Make API request to Serper
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        gl: 'us', // Country for search (US)
        hl: 'en', // Language (English)
        num: Math.min(limit + 3, 10) // Request a few extra results in case some are filtered
      }),
      cache: 'no-store' // Ensure fresh results
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        LogCategory.NODE,
        '[SearchAPI]',
        `API error: ${response.status}`,
        { error: errorText }
      );
      throw new Error(
        `Search API error: ${response.status} - ${errorText.substring(0, 100)}`
      );
    }

    const data = (await response.json()) as SerperApiResponse;
    logger.debug(LogCategory.NODE, '[SearchAPI]', 'Search results received', {
      organicCount: data.organic?.length || 0,
      hasKnowledgeGraph: !!data.knowledgeGraph,
      hasAnswerBox: !!data.answerBox
    });

    // Transform API response to our SearchResult format
    const results: SearchResult[] = [];

    // Add answer box if available (as the first result)
    if (data.answerBox && (data.answerBox.answer || data.answerBox.snippet)) {
      results.push({
        title: cleanText(data.answerBox.title || 'Featured Snippet'),
        url: '#',
        snippet: cleanText(
          data.answerBox.answer ||
            data.answerBox.snippet ||
            'No description available.'
        ),
        isFeatured: true
      });
    }

    // Add knowledge graph if available
    if (data.knowledgeGraph && data.knowledgeGraph.description) {
      results.push({
        title: cleanText(data.knowledgeGraph.title || 'Knowledge Graph'),
        url: '#',
        snippet: cleanText(data.knowledgeGraph.description),
        isKnowledgeGraph: true
      });
    }

    // Process organic results
    if (data.organic && Array.isArray(data.organic)) {
      for (const item of data.organic) {
        if (results.length >= limit) break;

        // Skip results without a link or with empty content
        if (!item.link || (!item.title && !item.snippet)) continue;

        results.push({
          title: cleanText(item.title) || 'No title',
          url: cleanUrl(item.link),
          snippet: cleanText(item.snippet) || 'No description available.'
        });
      }
    }

    // If we still don't have enough results, add a message
    if (results.length === 0) {
      logger.warn(
        LogCategory.NODE,
        '[SearchAPI]',
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
    logger.error(LogCategory.NODE, '[SearchAPI]', 'Search error:', { error });
    throw error;
  }
}
