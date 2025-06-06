/**
 * @fileoverview Constants for the OpenAlex API client
 */

// Base URL for OpenAlex API
export const OPENALEX_BASE_URL = 'https://api.openalex.org';

// Get OpenAlex API key (email) from environment if available
// OpenAlex doesn't require an API key but recommends providing an email to get higher rate limits
export const OPENALEX_EMAIL = process.env.OPENALEX_EMAIL || '';

// API endpoints
export const WORKS_ENDPOINT = '/works';
export const SEARCH_ENDPOINT = '/search';

// Default parameters
export const DEFAULT_SEARCH_RESULTS = 10;
export const MAX_SEARCH_RESULTS = 50;
