/**
 * @fileoverview Client for searching papers on Semantic Scholar
 */

import { z } from 'zod';
import { logger, LogCategory } from 'agentdock-core';
import { 
  SEMANTIC_SCHOLAR_API_URL, 
  DEFAULT_SEARCH_RESULTS, 
  MAX_SEARCH_RESULTS, 
  PAPER_FIELDS,
  SEMANTIC_SCHOLAR_API_KEY_ENV,
  RATE_LIMIT_MS
} from './constants';
import { SemanticScholarSearchSchema } from '../schema';
import { handleApiError } from '../utils/error-helpers';
import { SemanticScholarPaper, SemanticScholarSearchResult } from '../component';

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search for papers on Semantic Scholar
 * @param searchParams Parameters for the search
 * @returns Search results
 */
export async function searchSemanticScholar(
  searchParams: z.infer<typeof SemanticScholarSearchSchema>
): Promise<SemanticScholarSearchResult> {
  try {
    // Validate and process search parameters
    const validParams = SemanticScholarSearchSchema.parse(searchParams);
    
    // Ensure maxResults is within limits
    const maxResults = Math.min(
      validParams.maxResults || DEFAULT_SEARCH_RESULTS,
      MAX_SEARCH_RESULTS
    );
    
    // Build the query URL with parameters
    const fields = validParams.fields || PAPER_FIELDS;
    const queryParams = new URLSearchParams();
    queryParams.append('query', validParams.query);
    queryParams.append('limit', maxResults.toString());
    queryParams.append('fields', fields);
    
    // Add optional filters if provided
    if (validParams.year) {
      queryParams.append('year', validParams.year.toString());
    }
    
    if (validParams.openAccess) {
      queryParams.append('openAccessPdf', 'true');
    }
    
    if (validParams.venue) {
      queryParams.append('venue', validParams.venue);
    }
    
    if (validParams.fieldsOfStudy) {
      queryParams.append('fieldsOfStudy', validParams.fieldsOfStudy);
    }
    
    // Construct the URL
    const url = `${SEMANTIC_SCHOLAR_API_URL}/paper/search?${queryParams.toString()}`;
    
    // Prepare the request headers
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    
    // Add API key if available
    const apiKey = process.env[SEMANTIC_SCHOLAR_API_KEY_ENV];
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    
    // Respect rate limits
    await sleep(RATE_LIMIT_MS);
    
    // Make the request
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Searching papers', { 
      query: validParams.query, 
      maxResults, 
      hasApiKey: !!apiKey 
    });
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw response;
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    // Format the response into our interface
    const total = data.total || 0;
    const offset = data.offset || 0;
    
    // Map the papers to our interface
    const papers: SemanticScholarPaper[] = data.data?.map((paper: any) => {
      return {
        paperId: paper.paperId,
        title: paper.title || 'Untitled',
        abstract: paper.abstract,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        year: paper.year,
        venue: paper.venue || paper.publicationVenue?.name,
        publicationDate: paper.publicationDate,
        authors: (paper.authors || []).map((author: any) => ({
          authorId: author.authorId,
          name: author.name || 'Unknown',
          url: author.url
        })),
        citationCount: paper.citationCount,
        referenceCount: paper.referenceCount,
        openAccessPdf: paper.openAccessPdf,
        fieldsOfStudy: paper.fieldsOfStudy,
        tldr: paper.tldr,
        externalIds: paper.externalIds
      };
    }) || [];
    
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Search results', { 
      query: validParams.query, 
      total, 
      returned: papers.length 
    });
    
    return {
      query: validParams.query,
      total,
      offset,
      papers,
      searchParams: {
        year: validParams.year,
        venue: validParams.venue,
        openAccess: validParams.openAccess,
        fieldsOfStudy: validParams.fieldsOfStudy
      }
    };
  } catch (error) {
    const errorMessage = handleApiError(error);
    throw new Error(`Error searching Semantic Scholar: ${errorMessage}`);
  }
} 