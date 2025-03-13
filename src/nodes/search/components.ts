/**
 * @fileoverview Search UI components for rendering search results.
 * These components are used by the search tool to display information.
 */

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
    return `**Featured Snippet:** ${result.snippet}`;
  }
  
  // Special formatting for knowledge graph
  if (result.isKnowledgeGraph) {
    return `**${result.title}**\n${result.snippet}`;
  }
  
  // Standard result formatting with proper URL handling
  const displayUrl = result.url === '#' ? '' : ` - [Source](${result.url})`;
  const resultNumber = index !== undefined ? `**${index + 1}.** ` : '';
  
  return `${resultNumber}**${result.title}**${displayUrl}\n${result.snippet}`;
}

/**
 * Search results React component
 * 
 * This follows the same pattern as the weather components,
 * returning an object with type and content properties.
 */
export function SearchResults(props: SearchResultsProps): { type: string; content: string } {
  // Format header
  const header = `## Search Results for "${props.query}"`;
  
  // Format results as markdown with proper spacing
  const resultsMarkdown = props.results
    .map((result, index) => formatSearchResult(result, index))
    .join('\n\n');

  // Return the complete formatted output as an object with type and content
  return {
    type: 'search_results',
    content: `${header}\n\n${resultsMarkdown}`
  };
} 