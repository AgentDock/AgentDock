/**
 * @fileoverview Client for fetching author details from Semantic Scholar
 */

import { z } from 'zod';
import { logger, LogCategory } from 'agentdock-core';
import { 
  SEMANTIC_SCHOLAR_API_URL, 
  AUTHOR_FIELDS,
  PAPER_FIELDS,
  SEMANTIC_SCHOLAR_API_KEY_ENV,
  RATE_LIMIT_MS
} from './constants';
import { SemanticScholarAuthorFetchSchema } from '../schema';
import { handleApiError } from '../utils/error-helpers';
import { SemanticScholarAuthor, SemanticScholarPaper } from '../component';

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process author ID - extracts Semantic Scholar ID from potential ORCID
 * @param authorId The ID string to process
 * @returns Processed ID string and type
 */
function processAuthorId(authorId: string): { id: string, type: 'authorId' | 'orcid' } {
  // ORCID pattern (e.g., 0000-0002-1825-0097)
  if (authorId.match(/^\d{4}-\d{4}-\d{4}-\d{4}$/) || authorId.toLowerCase().startsWith('orcid:')) {
    const orcid = authorId.replace(/^orcid:/i, '');
    return { id: orcid, type: 'orcid' };
  }
  
  // Default to author ID
  return { id: authorId, type: 'authorId' };
}

/**
 * Fetch an author from Semantic Scholar
 * @param fetchParams Parameters for fetching the author
 * @returns The author details and optional papers
 */
export async function fetchSemanticScholarAuthor(
  fetchParams: z.infer<typeof SemanticScholarAuthorFetchSchema>
): Promise<{ author: SemanticScholarAuthor, papers?: SemanticScholarPaper[] }> {
  try {
    // Validate and process parameters
    const validParams = SemanticScholarAuthorFetchSchema.parse(fetchParams);
    
    // Process the ID
    const { id, type } = processAuthorId(validParams.authorId);
    
    // Build the query URL with parameters
    const fields = validParams.fields || AUTHOR_FIELDS;
    let endpoint = '';
    
    // Construct the URL based on the ID type
    if (type === 'authorId') {
      endpoint = `${SEMANTIC_SCHOLAR_API_URL}/author/${id}`;
    } else {
      // For ORCID
      endpoint = `${SEMANTIC_SCHOLAR_API_URL}/author/${type}:${id}`;
    }
    
    // Add fields parameter
    const queryParams = new URLSearchParams();
    queryParams.append('fields', fields);
    
    // Include papers if requested
    if (validParams.includePapers) {
      queryParams.append('paperFields', PAPER_FIELDS);
      queryParams.append('limit', String(validParams.paperLimit || 10));
    }
    
    // Append parameters
    endpoint += `?${queryParams.toString()}`;
    
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
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Fetching author', { 
      id, 
      type,
      includePapers: validParams.includePapers,
      hasApiKey: !!apiKey 
    });
    
    const response = await fetch(endpoint, { headers });
    
    if (!response.ok) {
      throw response;
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    // Map the author to our interface
    const author: SemanticScholarAuthor = {
      authorId: data.authorId,
      name: data.name || 'Unknown',
      url: data.url || `https://www.semanticscholar.org/author/${data.authorId}`,
      affiliations: data.affiliations,
      paperCount: data.paperCount,
      citationCount: data.citationCount,
      hIndex: data.hIndex
    };
    
    // Map papers if included
    let papers: SemanticScholarPaper[] | undefined;
    if (validParams.includePapers && data.papers) {
      papers = data.papers.map((paper: any) => ({
        paperId: paper.paperId,
        title: paper.title || 'Untitled',
        abstract: paper.abstract,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        year: paper.year,
        venue: paper.venue || paper.publicationVenue?.name,
        publicationDate: paper.publicationDate,
        authors: (paper.authors || []).map((a: any) => ({
          authorId: a.authorId,
          name: a.name || 'Unknown',
          url: a.url
        })),
        citationCount: paper.citationCount,
        referenceCount: paper.referenceCount,
        openAccessPdf: paper.openAccessPdf,
        fieldsOfStudy: paper.fieldsOfStudy,
        externalIds: paper.externalIds
      }));
    }
    
    logger.debug(LogCategory.NODE, '[SemanticScholarAPI]', 'Author fetched successfully', { 
      id, 
      name: author.name,
      paperCount: papers?.length 
    });
    
    return { author, papers };
  } catch (error) {
    const errorMessage = handleApiError(error);
    throw new Error(`Error fetching author from Semantic Scholar: ${errorMessage}`);
  }
} 