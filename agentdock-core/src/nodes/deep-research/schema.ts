/**
 * @fileoverview Schema definitions for the DeepResearchNode.
 */

import { z } from 'zod';

/**
 * Schema for research options
 */
export const researchOptionsSchema = z.object({
  maxResults: z.number().int().positive().optional()
    .describe('Maximum number of search results to process'),
  
  maxDepth: z.number().int().min(1).max(5).optional()
    .describe('Maximum depth for follow-up searches'),
  
  includeCitations: z.boolean().optional()
    .describe('Whether to include source citations in the output'),
  
  searchParams: z.record(z.any()).optional()
    .describe('Additional search parameters to pass to the SERP provider'),
  
  llmParams: z.record(z.any()).optional()
    .describe('Additional LLM parameters to pass to the LLM provider')
});

/**
 * Schema for DeepResearchNode parameters
 */
export const deepResearchNodeParametersSchema = z.object({
  serpProvider: z.string()
    .describe('The SERP provider to use for search (e.g., "firecrawl")'),
  
  serpConfig: z.record(z.any())
    .describe('Configuration for the SERP provider'),
  
  llmProvider: z.string()
    .describe('The LLM provider to use for summarization (e.g., "anthropic")'),
  
  llmConfig: z.record(z.any())
    .describe('Configuration for the LLM provider'),
  
  maxResults: z.number().int().positive().default(10)
    .describe('Maximum number of search results to process'),
  
  maxDepth: z.number().int().min(1).max(5).default(1)
    .describe('Maximum depth for follow-up searches'),
  
  includeCitations: z.boolean().default(true)
    .describe('Whether to include source citations in the output'),
  
  maxRetries: z.number().int().min(0).max(5).default(3)
    .describe('Maximum number of retries for failed operations'),
  
  retryDelay: z.number().int().min(100).default(1000)
    .describe('Retry delay in milliseconds')
});

/**
 * Schema for DeepResearchNode configuration
 */
export const deepResearchNodeConfigSchema = deepResearchNodeParametersSchema;

/**
 * Type inference for research options
 */
export type ResearchOptionsSchema = z.infer<typeof researchOptionsSchema>;

/**
 * Type inference for DeepResearchNode parameters
 */
export type DeepResearchNodeParametersSchema = z.infer<typeof deepResearchNodeParametersSchema>;

/**
 * Type inference for DeepResearchNode configuration
 */
export type DeepResearchNodeConfigSchema = z.infer<typeof deepResearchNodeConfigSchema>; 