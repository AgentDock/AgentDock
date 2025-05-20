/**
 * @fileoverview XML parsing utilities for arXiv API
 */

import { DOMParser, Document, Element } from '@xmldom/xmldom';
import { ArxivPaper } from '../component';

/**
 * Parse XML string to DOM Document
 */
export function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Get text content from an element
 */
export function getElementText(doc: Document, tagName: string, parentElement?: Element): string {
  if (parentElement) {
    const elements = parentElement.getElementsByTagName(tagName);
    return elements.length > 0 ? elements[0].textContent || '' : '';
  }

  const elements = doc.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0].textContent || '' : '';
}

/**
 * Get multiple elements by tag name
 */
export function getElements(doc: Document, tagName: string, parentElement?: Element): Element[] {
  if (parentElement) {
    return Array.from(parentElement.getElementsByTagName(tagName));
  }

  return Array.from(doc.getElementsByTagName(tagName));
}

/**
 * Get attribute value from an element
 */
export function getElementAttr(element: Element, attrName: string): string {
  return element.getAttribute(attrName) || '';
}

/**
 * Extract text content from elements in array form
 */
export function getElementsText(doc: Document, tagName: string, parentElement?: Element): string[] {
  const elements = getElements(doc, tagName, parentElement);
  return elements.map((el) => el.textContent || '');
}

/**
 * Parse arXiv entry element to ArxivPaper
 */
export function parseArxivEntry(entry: Element): ArxivPaper {
  // Get ID from <id> tag, extract the ID portion
  const idUrl = getElementText(null as unknown as Document, 'id', entry);
  const idMatch = idUrl.match(/([^/]+)$/);
  const id = idMatch ? idMatch[1] : idUrl;

  // Get title and clean it (arXiv titles sometimes have newlines)
  let title = getElementText(null as unknown as Document, 'title', entry);
  title = title.replace(/\s+/g, ' ').trim();

  // Get summary/abstract and clean it
  let summary = getElementText(null as unknown as Document, 'summary', entry);
  summary = summary.replace(/\s+/g, ' ').trim();

  // Get authors - each in its own <author> tag containing a <name> tag
  const authorElements = getElements(null as unknown as Document, 'author', entry);
  const authors = authorElements
    .map((authorEl) => {
      const nameEls = authorEl.getElementsByTagName('name');
      return nameEls.length > 0 ? nameEls[0].textContent || '' : '';
    })
    .filter((name) => name !== '');

  // Get categories
  const categories: string[] = [];
  const categoryElements = getElements(null as unknown as Document, 'category', entry);
  categoryElements.forEach((catEl) => {
    const term = catEl.getAttribute('term');
    if (term) categories.push(term);
  });

  // Get links (PDF, HTML)
  let pdfUrl = '';
  let htmlUrl = '';
  const linkElements = getElements(null as unknown as Document, 'link', entry);
  linkElements.forEach((linkEl) => {
    const rel = linkEl.getAttribute('rel') || '';
    const href = linkEl.getAttribute('href') || '';
    const title = linkEl.getAttribute('title') || '';

    if (rel === 'alternate' && title !== 'pdf') {
      htmlUrl = href;
    } else if ((rel === 'related' && title === 'pdf') || href.endsWith('.pdf')) {
      pdfUrl = href;
    }
  });

  // If no PDF URL was found, try to construct it from the ID
  if (!pdfUrl && id) {
    pdfUrl = `https://arxiv.org/pdf/${id}.pdf`;
  }

  // If no HTML URL was found, try to construct it from the ID
  if (!htmlUrl && id) {
    htmlUrl = `https://arxiv.org/abs/${id}`;
  }

  // Get dates
  const published = getElementText(null as unknown as Document, 'published', entry);
  const updated = getElementText(null as unknown as Document, 'updated', entry);

  // Get optional fields using arXiv namespace
  const journalRef =
    getElementText(null as unknown as Document, 'journal_ref', entry) ||
    getElementText(null as unknown as Document, 'arxiv:journal_ref', entry);

  const doi =
    getElementText(null as unknown as Document, 'doi', entry) ||
    getElementText(null as unknown as Document, 'arxiv:doi', entry);

  const comment =
    getElementText(null as unknown as Document, 'comment', entry) ||
    getElementText(null as unknown as Document, 'arxiv:comment', entry);

  return {
    id,
    title,
    summary,
    authors,
    categories,
    pdfUrl,
    htmlUrl,
    published,
    updated,
    journalRef: journalRef || undefined,
    doi: doi || undefined,
    comment: comment || undefined,
  };
}
