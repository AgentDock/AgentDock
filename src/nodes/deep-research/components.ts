/**
 * @fileoverview Deep Research UI components for rendering research reports.
 * These components are used by the deep research tool to display information.
 */

import { createToolResult } from '@/lib/utils/markdown-utils';

/**
 * Deep Research result interface
 */
export interface DeepResearchResult {
  query: string;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
  depth: number;
  breadth: number;
  findings?: string[]; // Add findings property as optional
}

/**
 * Deep Research report component
 * Renders a comprehensive research report with sources and metadata
 */
export function DeepResearchReport(props: DeepResearchResult) {
  // Format sources as markdown list with proper numbering and deduplication
  const uniqueSources = deduplicateSources(props.sources);
  const sourcesMarkdown = uniqueSources.map((source, index) => {
    return `${index + 1}. [${source.title}](${source.url})`;
  }).join('\n');

  // Use the summary directly from the research data
  const summary = props.summary;
  
  // Add sources section
  const sources = `## Sources\n\n${sourcesMarkdown || 'No sources found.'}`;
  
  // Join all sections and return as a tool result
  const content = `${summary}\n\n${sources}`;
  return createToolResult('deep_research_result', content);
}

/**
 * Helper function to deduplicate sources by URL
 */
function deduplicateSources(sources: Array<{ title: string, url: string }>): Array<{ title: string, url: string }> {
  const uniqueUrls = new Set<string>();
  return sources.filter(source => {
    // Normalize URL by removing trailing slashes and query parameters
    const normalizedUrl = source.url.replace(/\/+$/, '').split('?')[0];
    if (uniqueUrls.has(normalizedUrl)) {
      return false;
    }
    uniqueUrls.add(normalizedUrl);
    return true;
  });
} 