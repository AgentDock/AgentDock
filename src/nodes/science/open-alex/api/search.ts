/**
 * @fileoverview Search API client for OpenAlex
 */

import { logger, LogCategory } from 'agentdock-core';
import { OpenAlexWork } from '../component';
import { OpenAlexSearchParameters } from '../schema';
import { handleApiError } from '../utils';
import { OPENALEX_BASE_URL, OPENALEX_EMAIL, DEFAULT_SEARCH_RESULTS, MAX_SEARCH_RESULTS } from './constants';

/**
 * Search OpenAlex for scholarly works
 */
export async function searchOpenAlex(params: OpenAlexSearchParameters): Promise<{
  works: OpenAlexWork[];
  total: number;
}> {
  try {
    const { query, maxResults = DEFAULT_SEARCH_RESULTS, filter, sort } = params;
    const limit = Math.min(maxResults, MAX_SEARCH_RESULTS);
    
    logger.debug(LogCategory.NODE, '[OpenAlexAPI]', `Searching OpenAlex for: "${query}"`, {
      maxResults: limit,
      filter,
      sort,
      hasEmail: !!OPENALEX_EMAIL
    });
    
    // Build the search URL with parameters
    let searchUrl = `${OPENALEX_BASE_URL}/works?`;
    
    // Add search query - using the "search" parameter for text search
    searchUrl += `search=${encodeURIComponent(query)}`;
    
    // Add pagination
    searchUrl += `&per_page=${limit}`;
    
    // Add email for higher rate limits if available
    if (OPENALEX_EMAIL) {
      searchUrl += `&mailto=${encodeURIComponent(OPENALEX_EMAIL)}`;
    }
    
    // Add filtering based on the filter parameter
    if (filter) {
      let currentYear;
      switch (filter) {
        case 'open_access':
          searchUrl += '&filter=is_oa:true';
          break;
        case 'recent':
          // Last 3 years
          currentYear = new Date().getFullYear();
          searchUrl += `&filter=publication_year:${currentYear - 3}|${currentYear}`;
          break;
        case 'highly_cited':
          searchUrl += '&filter=cited_by_count:>100';
          break;
      }
    }
    
    // Add sorting
    if (sort) {
      switch (sort) {
        case 'date':
          searchUrl += '&sort=publication_date:desc';
          break;
        case 'citations':
          searchUrl += '&sort=cited_by_count:desc';
          break;
        case 'relevance':
          // Default relevance sorting in OpenAlex
          break;
      }
    }
    
    // Execute the search
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`OpenAlex API request failed with status ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const results = searchData.results || [];
    const total = searchData.meta?.count || results.length;
    
    if (results.length === 0) {
      logger.debug(LogCategory.NODE, '[OpenAlexAPI]', 'No results found for query', { query });
      return { works: [], total: 0 };
    }
    
    // Process each work from the results
    const works: OpenAlexWork[] = results.map((result: any) => {
      return {
        id: result.id,
        doi: result.doi,
        title: result.title || 'No title available',
        authors: result.authorships?.map((authorship: any) => authorship.author.display_name) || [],
        venue: result.primary_location?.source?.display_name || result.host_venue?.display_name,
        year: result.publication_year,
        cited_by_count: result.cited_by_count,
        is_open_access: result.open_access?.is_oa || false,
        open_access_url: result.open_access?.oa_url,
        url: result.id,
        publication_date: result.publication_date,
        type: result.type,
        concepts: result.concepts?.slice(0, 5), // Get top 5 concepts
      };
    });
    
    logger.debug(LogCategory.NODE, '[OpenAlexAPI]', `Found ${works.length} works for query "${query}"`, {
      totalResults: total,
      filter,
      sort
    });
    
    return { works, total };
  } catch (error) {
    const errorMsg = handleApiError(error);
    throw new Error(errorMsg);
  }
} 