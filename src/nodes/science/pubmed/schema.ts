import { z } from 'zod';

/**
 * Schema for the PubMed Search tool parameters
 */
export const PubMedSearchSchema = z.object({
  /**
   * The search query for PubMed (e.g., "cancer treatment")
   * @example "diabetes type 2 treatment"
   */
  query: z
    .string()
    .min(1, 'Search query is required')
    .describe('Search query for PubMed'),

  /**
   * The maximum number of results to return
   * @example 10
   */
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Maximum number of results to return (1-100)'),

  /**
   * The sort order for results
   * @example "relevance"
   */
  sort: z
    .enum(['relevance', 'date'])
    .optional()
    .default('relevance')
    .describe('Sort order for results'),

  /**
   * Additional filtering options in PubMed syntax
   * @example "Journal Article[PT] AND English[LA]"
   */
  filter: z
    .string()
    .optional()
    .describe('Additional filtering options in PubMed syntax')
});

/**
 * Schema for the PubMed Fetch tool parameters
 */
export const PubMedFetchSchema = z.object({
  /**
   * The PubMed ID (PMID) to retrieve
   * @example "33782455"
   */
  pmid: z
    .string()
    .min(1, 'PubMed ID is required')
    .describe('PubMed ID (PMID) to retrieve'),

  /**
   * The format of the returned data
   * @example "summary"
   */
  format: z
    .enum(['summary', 'abstract', 'full'])
    .optional()
    .default('summary')
    .describe('Format of the returned data')
});

/**
 * Type definitions for the PubMed tool parameters
 */
export type PubMedSearchParameters = z.infer<typeof PubMedSearchSchema>;
export type PubMedFetchParameters = z.infer<typeof PubMedFetchSchema>;

/**
 * Default values for the PubMed parameters
 */
export const defaultPubMedSearchParams: Partial<PubMedSearchParameters> = {
  maxResults: 10,
  sort: 'relevance'
};

export const defaultPubMedFetchParams: Partial<PubMedFetchParameters> = {
  format: 'summary'
};
