/**
 * @fileoverview Fetch API client for PubMed articles
 */

import { logger, LogCategory } from 'agentdock-core';
import { PubMedArticle } from '../component';
import { PubMedFetchParameters } from '../schema';
import { handleApiError, parseXML, getElementText, getElementsText } from '../utils';
import { EUTILS_BASE_URL, PUBMED_API_KEY } from './constants';
import { Document, Element } from '@xmldom/xmldom';

/**
 * Helper function to get text content from an element with a specific attribute value
 */
function getElementWithAttr(
  doc: Document,
  tagName: string,
  attrName: string,
  attrValue: string,
): string {
  const elements = doc.getElementsByTagName(tagName);
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i] as Element;
    if (element.getAttribute(attrName) === attrValue) {
      return element.textContent || '';
    }
  }
  return '';
}

/**
 * Helper function to get author last names
 */
function getAuthorLastNames(doc: Document): string[] {
  const authors = [];
  const authorElements = doc.getElementsByTagName('Author');

  for (let i = 0; i < authorElements.length; i++) {
    const authorElement = authorElements[i] as Element;
    const lastNameElements = authorElement.getElementsByTagName('LastName');
    if (lastNameElements.length > 0) {
      authors.push(lastNameElements[0].textContent || '');
    }
  }

  return authors;
}

/**
 * Fetch detailed information about a specific PubMed article
 * Using the EFetch E-utility
 */
export async function fetchPubMedArticle(params: PubMedFetchParameters): Promise<PubMedArticle> {
  try {
    const { pmid, format = 'summary' } = params;

    logger.debug(LogCategory.NODE, '[PubMedAPI]', `Fetching PubMed article: ${pmid}`, {
      format,
      hasApiKey: !!PUBMED_API_KEY,
    });

    // Build EFetch URL with parameters
    let efetchUrl = `${EUTILS_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;

    // Add API key if available for higher rate limits
    if (PUBMED_API_KEY) {
      efetchUrl += `&api_key=${PUBMED_API_KEY}`;
    }

    // Retrieve the article data
    const efetchResponse = await fetch(efetchUrl);
    if (!efetchResponse.ok) {
      throw new Error(`EFetch request failed with status ${efetchResponse.status}`);
    }

    const xmlText = await efetchResponse.text();
    const xmlDoc = parseXML(xmlText);

    // Extract article metadata
    const article: PubMedArticle = {
      pmid,
      title: getElementText(xmlDoc, 'ArticleTitle') || 'No title available',
      authors: getAuthorLastNames(xmlDoc),
      journal: getElementText(xmlDoc, 'Title'),
      pubDate: getElementText(xmlDoc, 'PubDate'),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doi: getElementWithAttr(xmlDoc, 'ArticleId', 'IdType', 'doi'),
    };

    // Add abstract if requested
    if (format === 'abstract' || format === 'full') {
      article.abstract = getElementText(xmlDoc, 'AbstractText');
    }

    // Add keywords if requested and available
    if (format === 'full') {
      article.keywords = getElementsText(xmlDoc, 'Keyword');
    }

    logger.debug(LogCategory.NODE, '[PubMedAPI]', `Successfully fetched article ${pmid}`);

    return article;
  } catch (error) {
    const errorMsg = handleApiError(error);
    throw new Error(errorMsg);
  }
}
