/**
 * @fileoverview Deep Research UI components for rendering research reports.
 * These components are used by the deep research tool to display information.
 */

import { createToolResult, formatHeader, formatSubheader, joinSections } from '@/lib/utils/markdown-utils';

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
}

/**
 * Deep Research report component
 * Renders a comprehensive research report with sources and metadata
 */
export function DeepResearchReport(props: DeepResearchResult) {
  // Format sources as markdown list
  const sourcesMarkdown = props.sources.map((source, index) => {
    return `${index + 1}. [${source.title}](${source.url})`;
  }).join('\n');

  // Create the content sections
  const title = formatHeader(`Deep Research Report: "${props.query}"`, 1);
  const summary = joinSections(
    formatSubheader('Summary'),
    props.summary
  );
  const sources = joinSections(
    formatSubheader('Sources'),
    sourcesMarkdown || 'No sources found.'
  );
  const metadata = joinSections(
    formatSubheader('Research Metadata'),
    `- Depth: ${props.depth} (higher means more detailed analysis)
- Breadth: ${props.breadth} (higher means more diverse sources)`
  );

  // Join all sections and return as a tool result
  const content = joinSections(title, summary, sources, metadata);
  return createToolResult('deep_research_result', content);
} 