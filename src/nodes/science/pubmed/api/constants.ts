/**
 * @fileoverview Constants for the PubMed API client
 */

// Base URL for NCBI E-utilities API
export const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Get PubMed API key from environment if available
export const PUBMED_API_KEY = process.env.PUBMED_API_KEY || '';
