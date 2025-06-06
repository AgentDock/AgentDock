/**
 * @fileoverview Constants for the Semantic Scholar API client
 */

// Base URL for Semantic Scholar API
export const SEMANTIC_SCHOLAR_API_URL =
  'https://api.semanticscholar.org/graph/v1';

// Default parameters
export const DEFAULT_SEARCH_RESULTS = 10;
export const MAX_SEARCH_RESULTS = 50;

// API key environment variable name
// To use your own API key, set this environment variable
export const SEMANTIC_SCHOLAR_API_KEY_ENV = 'SEMANTIC_SCHOLAR_API_KEY';

// Fields to request when fetching papers
export const PAPER_FIELDS = [
  'paperId',
  'externalIds',
  'url',
  'title',
  'abstract',
  'venue',
  'year',
  'publicationDate',
  'journal',
  'authors',
  'referenceCount',
  'citationCount',
  'openAccessPdf',
  'publicationVenue',
  'publicationTypes',
  'fieldsOfStudy',
  'tldr'
].join(',');

// Fields to request when fetching authors
export const AUTHOR_FIELDS = [
  'authorId',
  'externalIds',
  'url',
  'name',
  'affiliations',
  'homepage',
  'paperCount',
  'citationCount',
  'hIndex'
].join(',');

// Rate limits (100 requests per 5 minutes without API key)
export const RATE_LIMIT_MS = 300; // Conservative 300ms per request
export const MAX_REQUESTS_PER_MINUTE = 20; // Conservative 20 requests per minute
