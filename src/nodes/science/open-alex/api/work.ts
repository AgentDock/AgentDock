/**
 * @fileoverview Work API client for OpenAlex
 */

import { LogCategory, logger } from 'agentdock-core';

import { OpenAlexWork } from '../component';
import { OpenAlexFetchParameters } from '../schema';
import { handleApiError } from '../utils';
import { OPENALEX_BASE_URL, OPENALEX_EMAIL } from './constants';

/**
 * Fetch details about a specific work from OpenAlex
 */
export async function fetchOpenAlexWork(
  params: OpenAlexFetchParameters
): Promise<OpenAlexWork> {
  try {
    const { id, format = 'summary' } = params;

    logger.debug(
      LogCategory.NODE,
      '[OpenAlexAPI]',
      `Fetching OpenAlex work: ${id}`,
      {
        format,
        hasEmail: !!OPENALEX_EMAIL
      }
    );

    // Convert DOI to OpenAlex ID if necessary
    let workId = id;
    if (id.startsWith('10.') || id.includes('/10.')) {
      // This looks like a DOI, need to format it properly for OpenAlex
      const doi = id.includes('/10.') ? id.split('/10.')[1] : id;
      workId = `https://doi.org/${doi.startsWith('10.') ? doi : '10.' + doi}`;
    }

    // Build the work URL
    let workUrl;

    // If it's an OpenAlex ID (starts with 'https://openalex.org/W'), use it directly
    if (workId.startsWith('https://openalex.org/W')) {
      workUrl = `${OPENALEX_BASE_URL}/works/${workId.replace('https://openalex.org/', '')}`;
    }
    // If it's a simple W ID
    else if (workId.startsWith('W')) {
      workUrl = `${OPENALEX_BASE_URL}/works/${workId}`;
    }
    // Otherwise treat as a DOI or URL
    else {
      workUrl = `${OPENALEX_BASE_URL}/works/${encodeURIComponent(workId)}`;
    }

    // Add email for higher rate limits if available
    if (OPENALEX_EMAIL) {
      workUrl += `?mailto=${encodeURIComponent(OPENALEX_EMAIL)}`;
    }

    // Retrieve the work data
    const workResponse = await fetch(workUrl);
    if (!workResponse.ok) {
      throw new Error(`Work request failed with status ${workResponse.status}`);
    }

    const workData = await workResponse.json();

    // Extract keywords from abstract if full format requested
    let keywords: string[] = [];
    if (format === 'full' && workData.abstract_inverted_index) {
      try {
        // Use concepts as keywords - they're more structured
        keywords =
          workData.concepts
            ?.filter((concept: any) => concept.score > 0.5) // Only significant concepts
            ?.map((concept: any) => concept.display_name) || [];
      } catch (error) {
        logger.warn(
          LogCategory.NODE,
          '[OpenAlexAPI]',
          'Error extracting keywords',
          { error }
        );
      }
    }

    // Map response to our interface
    const work: OpenAlexWork = {
      id: workData.id,
      doi: workData.doi,
      title: workData.title || 'No title available',
      authors:
        workData.authorships?.map(
          (authorship: any) => authorship.author.display_name
        ) || [],
      venue:
        workData.primary_location?.source?.display_name ||
        workData.host_venue?.display_name,
      year: workData.publication_year,
      cited_by_count: workData.cited_by_count,
      is_open_access: workData.open_access?.is_oa || false,
      open_access_url: workData.open_access?.oa_url,
      url: workData.id,
      publication_date: workData.publication_date,
      type: workData.type,
      concepts: workData.concepts?.slice(0, 10) // Get top 10 concepts
    };

    // Add abstract if requested
    if (format === 'full') {
      work.abstract = workData.abstract;
    }

    // Add keywords if requested and available
    if (format === 'full') {
      work.keywords = keywords;
    }

    logger.debug(
      LogCategory.NODE,
      '[OpenAlexAPI]',
      `Successfully fetched work ${id}`
    );

    return work;
  } catch (error) {
    const errorMsg = handleApiError(error);
    throw new Error(errorMsg);
  }
}
