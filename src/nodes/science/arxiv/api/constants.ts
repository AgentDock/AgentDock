/**
 * @fileoverview Constants for the arXiv API client
 */

// Base URL for arXiv API
export const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

// Default parameters
export const DEFAULT_SEARCH_RESULTS = 10;
export const MAX_SEARCH_RESULTS = 50;

// Categories
export const ARXIV_CATEGORIES = {
  CS: 'Computer Science',
  MATH: 'Mathematics',
  PHYSICS: 'Physics',
  ECON: 'Economics',
  EESS: 'Electrical Engineering and Systems Science',
  QUANT_BIO: 'Quantitative Biology',
  QUANT_FIN: 'Quantitative Finance',
  STAT: 'Statistics',
};

// Rate limits (arXiv requests max 1 request per 3 seconds)
export const RATE_LIMIT_MS = 3100; // Add a little buffer (3.1 seconds) 