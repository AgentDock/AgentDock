/**
 * @fileoverview Type definitions for the DeepResearchNode.
 */

import { SerpResult } from '../serp/types';

/**
 * Configuration for the DeepResearchNode
 */
export interface DeepResearchNodeConfig {
  /** The SERP provider to use for search */
  serpProvider: string;
  
  /** Configuration for the SERP provider */
  serpConfig: Record<string, any>;
  
  /** The LLM provider to use for summarization */
  llmProvider: string;
  
  /** Configuration for the LLM provider */
  llmConfig: Record<string, any>;
  
  /** Maximum number of search results to process */
  maxResults?: number;
  
  /** Maximum depth for follow-up searches */
  maxDepth?: number;
  
  /** Whether to include source citations in the output */
  includeCitations?: boolean;
  
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Options for a research query
 */
export interface ResearchOptions {
  /** Maximum number of search results to process (overrides config) */
  maxResults?: number;
  
  /** Maximum depth for follow-up searches (overrides config) */
  maxDepth?: number;
  
  /** Whether to include source citations in the output (overrides config) */
  includeCitations?: boolean;
  
  /** Additional search parameters to pass to the SERP provider */
  searchParams?: Record<string, any>;
  
  /** Additional LLM parameters to pass to the LLM provider */
  llmParams?: Record<string, any>;
}

/**
 * Research query input
 */
export type ResearchQuery = string | {
  query: string;
  options?: ResearchOptions;
};

/**
 * Source citation
 */
export interface SourceCitation {
  /** The title of the source */
  title: string;
  
  /** The URL of the source */
  url: string;
  
  /** The snippet from the source */
  snippet?: string;
  
  /** The date the source was published */
  date?: string;
}

/**
 * Research result
 */
export interface ResearchResult {
  /** The original query */
  query: string;
  
  /** The summary of the research */
  summary: string;
  
  /** Key findings from the research */
  keyFindings: string[];
  
  /** Source citations */
  sources: SourceCitation[];
  
  /** Metadata about the research */
  metadata: {
    /** The total number of sources processed */
    totalSources: number;
    
    /** The depth of the research */
    depth: number;
    
    /** The time taken to complete the research in milliseconds */
    researchTime: number;
    
    /** The providers used for the research */
    providers: {
      serp: string;
      llm: string;
    };
  };
}

/**
 * Intermediate research data
 */
export interface IntermediateResearchData {
  /** The search results */
  searchResults: SerpResult[];
  
  /** The summarized content */
  summarizedContent?: string;
  
  /** The key findings */
  keyFindings?: string[];
  
  /** The sources */
  sources: SourceCitation[];
  
  /** The depth of the research */
  depth: number;
  
  /** The time taken so far */
  timeTaken: number;
} 