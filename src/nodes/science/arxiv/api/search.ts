/**
 * @fileoverview Client for searching arXiv papers
 */

import { z } from 'zod';

import { ArxivSearchResult } from '../component';
import { ArxivSearchSchema } from '../schema';
import { handleApiError } from '../utils/error-helpers';
import { getElements, parseArxivEntry, parseXML } from '../utils/xml-helpers';
import {
  ARXIV_API_URL,
  ARXIV_CATEGORIES,
  DEFAULT_SEARCH_RESULTS,
  MAX_SEARCH_RESULTS,
  RATE_LIMIT_MS
} from './constants';

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Search for papers on arXiv
 * @param searchParams Parameters for the search
 * @returns Search results
 */
export async function searchArxiv(
  searchParams: z.infer<typeof ArxivSearchSchema>
): Promise<ArxivSearchResult> {
  try {
    // Validate and process the search parameters
    const validParams = ArxivSearchSchema.parse(searchParams);

    // Ensure maxResults is within limits
    const maxResults = Math.min(
      validParams.maxResults || DEFAULT_SEARCH_RESULTS,
      MAX_SEARCH_RESULTS
    );

    // Build the query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('search_query', buildSearchQuery(validParams));
    queryParams.append('max_results', maxResults.toString());

    if (validParams.sortBy) {
      queryParams.append('sortBy', validParams.sortBy);
      if (validParams.sortBy === 'relevance') {
        queryParams.append('sortOrder', 'descending');
      }
    }

    // Construct the URL
    const url = `${ARXIV_API_URL}?${queryParams.toString()}`;

    // Respect the rate limit
    await sleep(RATE_LIMIT_MS);

    // Make the request
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `arXiv API returned ${response.status}: ${response.statusText}`
      );
    }

    // Parse the XML response
    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);

    // Extract total results
    const totalResultsEl = xmlDoc.getElementsByTagName(
      'opensearch:totalResults'
    )[0];
    const total = totalResultsEl
      ? parseInt(totalResultsEl.textContent || '0', 10)
      : 0;

    // Extract the entries
    const entries = getElements(xmlDoc, 'entry');
    const papers = entries.map((entry) => parseArxivEntry(entry));

    return {
      query: validParams.query,
      total,
      papers,
      searchParams: {
        category: validParams.category,
        sortBy: validParams.sortBy || 'relevance',
        searchIn: validParams.searchIn || 'all'
      }
    };
  } catch (error) {
    const errorMessage = handleApiError(error);
    throw new Error(`Error searching arXiv: ${errorMessage}`);
  }
}

/**
 * Build a search query string based on the provided parameters
 * @param params Search parameters
 * @returns Formatted search query
 */
function buildSearchQuery(params: z.infer<typeof ArxivSearchSchema>): string {
  const { query, category, searchIn } = params;
  let searchQuery = '';

  // Add search terms with field specifier if provided
  if (searchIn === 'title') {
    searchQuery += `ti:"${query}"`;
  } else if (searchIn === 'abstract') {
    searchQuery += `abs:"${query}"`;
  } else if (searchIn === 'author') {
    searchQuery += `au:"${query}"`;
  } else {
    searchQuery += `all:"${query}"`;
  }

  // Add category filter if provided
  if (category && category !== 'all') {
    // Use the category directly
    searchQuery += ` AND cat:${category}`;
  }

  return searchQuery;
}
