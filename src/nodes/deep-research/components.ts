/**
 * @fileoverview Deep Research UI components for rendering research reports.
 * These components are used by the deep research tool to display information.
 */

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

  // Create the full report
  return `# Deep Research Report: "${props.query}"

## Summary
${props.summary}

## Sources
${sourcesMarkdown}

## Research Metadata
- Depth: ${props.depth} (higher means more detailed analysis)
- Breadth: ${props.breadth} (higher means more diverse sources)
`;
} 