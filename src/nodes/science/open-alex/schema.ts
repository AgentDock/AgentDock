/**
 * @fileoverview Schema definitions for OpenAlex API parameters
 */

import { z } from 'zod';

/**
 * Schema for OpenAlex search parameters
 */
export const OpenAlexSearchSchema = z.object({
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
  filter: z
    .enum(['open_access', 'recent', 'highly_cited'])
    .describe('Optional filter to apply to results')
    .optional(),
  sort: z
    .enum(['relevance', 'date', 'citations'])
    .default('relevance')
    .describe('Sort order for results')
    .optional(),
  fields: z.string().describe('Comma-separated list of specific fields to return').optional(),
});

/**
 * Schema for OpenAlex fetch parameters
 */
export const OpenAlexFetchSchema = z.object({
  id: z
    .string()
    .min(1, 'Work ID must not be empty')
    .describe('The OpenAlex ID or DOI of the work to retrieve'),
  format: z
    .enum(['summary', 'full'])
    .default('summary')
    .describe('Amount of detail to include')
    .optional(),
});

// Type inference from schemas
export type OpenAlexSearchParameters = z.infer<typeof OpenAlexSearchSchema>;
export type OpenAlexFetchParameters = z.infer<typeof OpenAlexFetchSchema>;
