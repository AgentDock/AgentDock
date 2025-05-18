/**
 * @fileoverview Schema definitions for Semantic Scholar API parameters
 */

import { z } from 'zod';

/**
 * Schema for Semantic Scholar paper search parameters
 */
export const SemanticScholarSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Query must not be empty')
    .describe('The search query for finding papers'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of results to return (default: 10, max: 100)')
    .optional(),
  fields: z.string().optional().describe('Comma-separated list of fields to include in results'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional()
    .describe('Filter by publication year'),
  openAccess: z.boolean().optional().describe('Filter to only include open access papers'),
  venue: z.string().optional().describe('Filter by publication venue (journal or conference)'),
  fieldsOfStudy: z
    .string()
    .optional()
    .describe("Filter by field of study (e.g., 'Computer Science')"),
});

/**
 * Schema for Semantic Scholar paper fetch parameters
 */
export const SemanticScholarPaperFetchSchema = z.object({
  paperId: z
    .string()
    .min(1, 'Paper ID must not be empty')
    .describe('The Semantic Scholar Paper ID or DOI/arXiv ID'),
  fields: z.string().optional().describe('Comma-separated list of fields to include in results'),
  includeCitations: z.boolean().default(false).describe('Include citation information').optional(),
  includeReferences: z
    .boolean()
    .default(false)
    .describe('Include reference information')
    .optional(),
});

/**
 * Schema for Semantic Scholar author fetch parameters
 */
export const SemanticScholarAuthorFetchSchema = z.object({
  authorId: z
    .string()
    .min(1, 'Author ID must not be empty')
    .describe('The Semantic Scholar Author ID or ORCID'),
  fields: z.string().optional().describe('Comma-separated list of fields to include in results'),
  includePapers: z.boolean().default(false).describe("Include author's papers").optional(),
  paperLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .describe('Max number of papers to include'),
});

// Type inference from schemas
export type SemanticScholarSearchParameters = z.infer<typeof SemanticScholarSearchSchema>;
export type SemanticScholarPaperFetchParameters = z.infer<typeof SemanticScholarPaperFetchSchema>;
export type SemanticScholarAuthorFetchParameters = z.infer<typeof SemanticScholarAuthorFetchSchema>;
