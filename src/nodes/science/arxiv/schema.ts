/**
 * @fileoverview Schema definitions for arXiv API parameters
 */

import { z } from 'zod';

/**
 * Schema for arXiv search parameters
 */
export const ArxivSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Query must not be empty')
    .describe('The search query for finding scientific papers'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (default: 10, max: 100)')
    .optional(),
  sortBy: z
    .enum(['relevance', 'lastUpdated', 'submitted'])
    .default('relevance')
    .describe('Sort order for results')
    .optional(),
  category: z
    .string()
    .describe("arXiv category to search within (e.g., 'cs.AI', 'physics')")
    .optional(),
  searchIn: z
    .enum(['all', 'title', 'abstract', 'author'])
    .default('all')
    .describe('Where to search for the query')
    .optional(),
});

/**
 * Schema for arXiv fetch parameters
 */
export const ArxivFetchSchema = z.object({
  id: z
    .string()
    .min(1, 'arXiv ID must not be empty')
    .describe("The arXiv paper ID to retrieve (e.g., '2302.13971' or full URL)"),
  format: z
    .enum(['summary', 'full'])
    .default('summary')
    .describe('Amount of detail to include')
    .optional(),
});

// Type inference from schemas
export type ArxivSearchParameters = z.infer<typeof ArxivSearchSchema>;
export type ArxivFetchParameters = z.infer<typeof ArxivFetchSchema>;
