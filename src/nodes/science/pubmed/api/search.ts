/**
 * @fileoverview Search API client for PubMed
 */

import { logger, LogCategory } from 'agentdock-core';
import { PubMedArticle } from '../component';
import { PubMedSearchParameters } from '../schema';
import { handleApiError } from '../utils';
import { EUTILS_BASE_URL, PUBMED_API_KEY } from './constants';

/**
 * Search PubMed for articles matching the query
 * Using the ESearch and ESummary E-utilities
 */
export async function searchPubMed(params: PubMedSearchParameters): Promise<{
  articles: PubMedArticle[];
  total: number;
}> {
  try {
    const { query, maxResults = 10, sort = 'relevance', filter } = params;
    
    logger.debug(LogCategory.NODE, '[PubMedAPI]', `Searching PubMed for: "${query}"`, {
      maxResults,
      sort,
      hasApiKey: !!PUBMED_API_KEY
    });
    
    // Build the ESearch URL with parameters
    let esearchUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}`;
    
    // Add API key if available for higher rate limits
    if (PUBMED_API_KEY) {
      esearchUrl += `&api_key=${PUBMED_API_KEY}`;
    }
    
    // Add sort parameter
    if (sort === 'date') {
      esearchUrl += '&sort=pub+date';
    }
    
    // Add query term
    const term = filter ? `${query} AND ${filter}` : query;
    esearchUrl += `&term=${encodeURIComponent(term)}`;
    
    // Execute the search
    const searchResponse = await fetch(esearchUrl);
    if (!searchResponse.ok) {
      throw new Error(`ESearch request failed with status ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const pmids = searchData.esearchresult.idlist || [];
    const total = parseInt(searchData.esearchresult.count) || 0;
    
    if (pmids.length === 0) {
      logger.debug(LogCategory.NODE, '[PubMedAPI]', 'No results found for query', { query });
      return { articles: [], total: 0 };
    }
    
    // Build the ESummary URL with PMIDs
    let esummaryUrl = `${EUTILS_BASE_URL}/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(',')}`;
    
    // Add API key if available for higher rate limits
    if (PUBMED_API_KEY) {
      esummaryUrl += `&api_key=${PUBMED_API_KEY}`;
    }
    
    // Retrieve article summaries
    const summaryResponse = await fetch(esummaryUrl);
    if (!summaryResponse.ok) {
      throw new Error(`ESummary request failed with status ${summaryResponse.status}`);
    }
    
    const summaryData = await summaryResponse.json();
    const articles: PubMedArticle[] = [];
    
    // Process each article summary
    for (const pmid of pmids) {
      const result = summaryData.result[pmid];
      if (!result) continue;
      
      const article: PubMedArticle = {
        pmid,
        title: result.title || 'No title available',
        authors: result.authors?.map((author: any) => author.name) || [],
        journal: result.fulljournalname || result.source,
        pubDate: result.pubdate,
        doi: result.articleids?.find((id: any) => id.idtype === 'doi')?.value,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
      
      articles.push(article);
    }
    
    logger.debug(LogCategory.NODE, '[PubMedAPI]', `Found ${articles.length} articles for query "${query}"`, {
      totalResults: total
    });
    
    return { articles, total };
  } catch (error) {
    const errorMsg = handleApiError(error);
    throw new Error(errorMsg);
  }
} 