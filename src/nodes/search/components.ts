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
}

/**
 * Search results component props
 */
interface SearchResultsProps {
  query: string;
  results: SearchResult[];
}

/**
 * Search results React component
 */
export function SearchResults(props: SearchResultsProps) {
  // Format results as markdown
  const resultsMarkdown = props.results.map((result, index) => {
    return `### ${index + 1}. [${result.title}](${result.url})\n${result.snippet}\n`;
  }).join('\n');

  return `## Search Results for "${props.query}"\n\n${resultsMarkdown}`;
} 