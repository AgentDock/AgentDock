/**
 * @fileoverview Search UI components for rendering search results.
 * These components are used by the search tool to display information.
 */

import { 
  formatBold, 
  formatHeader, 
  formatLink, 
  joinSections, 
  createToolResult 
} from '@/lib/utils/markdown-utils';

/**
 * Search result interface
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  isFeatured?: boolean;
  isKnowledgeGraph?: boolean;
}

/**
 * Search results component props
 */
interface SearchResultsProps {
  query: string;
  results: SearchResult[];
}

/**
 * Format a single search result
 */
function formatSearchResult(result: SearchResult, index?: number): string {
  // Special formatting for featured snippets
  if (result.isFeatured) {
    return `${formatBold('Featured Snippet:')} ${result.snippet}`;
  }
  
  // Special formatting for knowledge graph
  if (result.isKnowledgeGraph) {
    return `${formatBold(result.title)}\n${result.snippet}`;
  }
  
  // Standard result formatting with proper URL handling
  const displayUrl = result.url === '#' ? '' : ` - ${formatLink('Source', result.url)}`;
  const resultNumber = index !== undefined ? `${formatBold(`${index + 1}.`)} ` : '';
  
  return `${resultNumber}${formatBold(result.title)}${displayUrl}\n${result.snippet}`;
}

/**
 * Search results React component
 * 
 * This follows the same pattern as the weather components,
 * returning an object with type and content properties.
 */
export function SearchResults(props: SearchResultsProps) {
  // Format header
  const header = formatHeader(`Search Results for "${props.query}"`);
  
  // Format results as markdown with proper spacing
  const resultsMarkdown = props.results
    .map((result, index) => formatSearchResult(result, index))
    .join('\n\n');

  // Return the complete formatted output as an object with type and content
  return createToolResult(
    'search_results',
    joinSections(header, resultsMarkdown)
  );
} 