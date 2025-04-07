/**
 * @fileoverview Helper functions for XML parsing and manipulation
 */

import { DOMParser, Document, Element } from '@xmldom/xmldom';

/**
 * Convert XML string to DOM Document for easier parsing
 */
export function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Extract text content from an XML element safely
 * Note: Using simple tag name instead of complex selectors as xmldom doesn't support querySelector
 */
export function getElementText(doc: Document, tagName: string): string {
  const elements = doc.getElementsByTagName(tagName);
  return elements.length > 0 ? elements[0].textContent || '' : '';
}

/**
 * Safely extract an array of text content from XML elements
 * Note: Using simple tag name instead of complex selectors as xmldom doesn't support querySelectorAll
 */
export function getElementsText(doc: Document, tagName: string): string[] {
  const elements = doc.getElementsByTagName(tagName);
  return Array.from(elements).map(el => el.textContent || '');
} 