/**
 * @fileoverview Client for fetching paper details from Semantic Scholar
 */

import { z } from 'zod';
import { logger, LogCategory } from 'agentdock-core';
import { 
  SEMANTIC_SCHOLAR_API_URL, 
  PAPER_FIELDS,
  SEMANTIC_SCHOLAR_API_KEY_ENV,
  RATE_LIMIT_MS
} from './constants';
import { SemanticScholarPaperFetchSchema } from '../schema';
import { handleApiError } from '../utils/error-helpers';
import { SemanticScholarPaper } from '../component';

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract Semantic Scholar ID from a string that might be an ID, DOI, or arXiv ID
 * @param idString The ID string to process
 * @returns Processed ID string and type
 */
function processId(idString: string): { id: string, type: 'corpusId' | 'doi' | 'arxiv' | 'mag' | 'acl' | 'url' } {
  // DOI pattern
  if (idString.startsWith('10.') || idString.toLowerCase().startsWith('doi:10.')) {
    const doi = idString.replace(/^doi:/i, '');
    return { id: doi, type: 'doi' };
  }
  
  // arXiv pattern
  if (idString.match(/^\d+\.\d+v?\d*$/) || idString.toLowerCase().startsWith('arxiv:')) {
    const arxiv = idString.replace(/^arxiv:/i, '');
    return { id: arxiv, type: 'arxiv' };
  }
  
  // URL pattern
  if (idString.startsWith('http')) {
    return { id: idString, type: 'url' };
  }
  
  // Default to corpus ID
  return { id: idString, type: 'corpusId' };
}

/**
 * Fetch a paper from Semantic Scholar
 * @param fetchParams Parameters for fetching the paper
 * @returns The paper details
 */
export async function fetchSemanticScholarPaper(
  fetchParams: z.infer<typeof SemanticScholarPaperFetchSchema>
): Promise<SemanticScholarPaper> {
  try {
    // Validate and process parameters
    const validParams = SemanticScholarPaperFetchSchema.parse(fetchParams);
    
    // Process the ID
    const { id, type } = processId(validParams.paperId);
    
    // Build the query URL with parameters
    const fields = validParams.fields || PAPER_FIELDS;
    let endpoint = '';
    
    // Construct the URL based on the ID type
    if (type === 'corpusId') {
      endpoint = `${SEMANTIC_SCHOLAR_API_URL}/paper/${id}`;
    } else if (type === 'url') {
      endpoint = `${SEMANTIC_SCHOLAR_API_URL}/paper/url`;
      // For URLs, we'll add the URL as a query parameter
      const queryParams = new URLSearchParams();
      queryParams.append('url', id);
      endpoint += `?${queryParams.toString()}`;
    } else {
      // For DOI, arXiv, etc.
      endpoint = `${SEMANTIC_SCHOLAR_API_URL}/paper/${type}:${id}`;
    }
    
    // Add fields
    const fieldsParam = new URLSearchParams();
    fieldsParam.append('fields', fields);
    
    // Add citations or references if requested
    if (validParams.includeCitations) {
      fieldsParam.append('citationLimit', '10');
    }
    
    if (validParams.includeReferences) {
      fieldsParam.append('referenceLimit', '10');
    }
    
    // Append parameters
    endpoint += endpoint.includes('?') ? `&${fieldsParam.toString()}` : `?${fieldsParam.toString()}`;
    
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
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Fetching paper', { 
      id, 
      type,
      hasApiKey: !!apiKey 
    });
    
    const response = await fetch(endpoint, { headers });
    
    if (!response.ok) {
      throw response;
    }
    
    // Parse the JSON response
    const paper = await response.json();
    
    // Map the response to our interface
    const result: SemanticScholarPaper = {
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
    
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Paper fetched successfully', { 
      id, 
      title: result.title 
    });
    
    return result;
  } catch (error) {
    const errorMessage = handleApiError(error);
    throw new Error(`Error fetching paper from Semantic Scholar: ${errorMessage}`);
  }
} 