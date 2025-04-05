/**
 * @fileoverview Client for fetching a specific arXiv paper
 */

import { z } from 'zod';
import { ArxivPaper } from '../component';
import { 
  ARXIV_API_URL, 
  RATE_LIMIT_MS 
} from './constants';
import { ArxivFetchSchema } from '../schema';
import { handleApiError } from '../utils/error-helpers';
import { parseXML, getElements, parseArxivEntry } from '../utils/xml-helpers';

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract arXiv ID from a string that might be a full URL or just the ID
 * @param idOrUrl The arXiv ID or URL
 * @returns The extracted arXiv ID
 */
function extractArxivId(idOrUrl: string): string {
  // Check if it's a URL
  if (idOrUrl.includes('arxiv.org')) {
    // Extract ID from URL like https://arxiv.org/abs/2303.08774 or https://arxiv.org/pdf/2303.08774.pdf
    const matches = idOrUrl.match(/arxiv\.org(?:\/abs|\/pdf)?\/?([0-9v.]+)/i);
    if (matches && matches[1]) {
      return matches[1].replace('.pdf', '');
    }
  }
  
  // If not matched as a URL, assume it's already an ID (e.g., "2303.08774" or "2303.08774v2")
  return idOrUrl;
}

/**
 * Fetch a specific paper from arXiv
 * @param fetchParams Parameters for the fetch operation
 * @returns The fetched paper details
 */
export async function fetchArxivPaper(fetchParams: z.infer<typeof ArxivFetchSchema>): Promise<ArxivPaper> {
  try {
    // Validate and process the fetch parameters
    const validParams = ArxivFetchSchema.parse(fetchParams);
    
    // Extract the arXiv ID from the provided ID
    const arxivId = extractArxivId(validParams.id);
    
    // Build the query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('id_list', arxivId);
    
    // Construct the URL
    const url = `${ARXIV_API_URL}?${queryParams.toString()}`;
    
    // Respect the rate limit
    await sleep(RATE_LIMIT_MS);
    
    // Make the request
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`arXiv API returned ${response.status}: ${response.statusText}`);
    }
    
    // Parse the XML response
    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);
    
    // Extract the entry
    const entries = getElements(xmlDoc, 'entry');
    
    if (entries.length === 0) {
      throw new Error(`No paper found with ID: ${arxivId}`);
    }
    
    // Parse the paper details
    const paper = parseArxivEntry(entries[0]);
    
    return paper;
  } catch (error) {
    const errorMessage = handleApiError(error);
    throw new Error(`Error fetching arXiv paper: ${errorMessage}`);
  }
} 