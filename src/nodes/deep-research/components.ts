/**
 * @fileoverview Deep Research UI components for rendering research reports.
 * Component now takes raw findings and formats them directly.
 */

import { createToolResult, formatHeader } from '@/lib/utils/markdown-utils';

/**
 * Deep Research result interface
 * - `summary` is removed
 * - `findings` is now required
 * - Added optional `status` for notes
 */
export interface DeepResearchResult {
  query: string;
  // summary: string; // Removed
  sources: Array<{ title: string; url: string }>;
  depth: number;
  breadth: number;
  findings: string[]; // Now required
  status?: string; // Optional status message (e.g., rate limit note)
}

/**
 * Deep Research report component
 * Renders report from query, findings, sources, and status.
 */
export function DeepResearchReport(props: DeepResearchResult) {
  // 1. Format Title
  const title = formatHeader(`Deep Research Report: "${props.query}"`, 1);

  // 2. Format Status (if provided)
  const statusSection = props.status ? `${props.status.trim()}\n\n` : '';

  // 3. Format Research Stats
  const uniqueSourceCount = deduplicateSources(props.sources || []).length;
  const statsSection =
    `## Research Statistics\n\n` +
    `- **Depth**: ${props.depth} ${props.depth === 1 ? '(Basic search)' : props.depth === 2 ? '(Search + content extraction)' : '(Comprehensive research)'}\n` +
    `- **Breadth**: ${props.breadth} sources requested\n` +
    `- **Sources analyzed**: ${uniqueSourceCount} unique sources\n` +
    `- **Findings extracted**: ${props.findings?.length || 0} key points\n`;

  // 4. Format Findings Section - with extra cleaning to prevent duplicate headings
  let findingsSection = '';

  if (props.findings && props.findings.length > 0) {
    // Additional cleaning to prevent duplicate heading issues:
    // 1. Remove any finding that looks like a heading (starts with "Key" or contains "findings")
    // 2. Remove any finding that is too short or doesn't provide substantial information
    // 3. Ensure proper formatting with numbers and spacing
    const cleanFindings = props.findings
      .map((f) => f.trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
      .filter(
        (f) =>
          f.length > 10 &&
          !f.toLowerCase().match(/^key\s+(factual\s+)?findings/) &&
          !f.toLowerCase().includes('following are') &&
          !f.toLowerCase().includes('research findings') &&
          !f.toLowerCase().match(/^here are/i)
      );

    // Format all findings under a single "Key Findings" section with proper formatting and numbering
    findingsSection = `## Key Findings\n\n${cleanFindings.map((f, i) => `${i + 1}. ${f}`).join('\n\n')}`;
  } else {
    // Explicit message if findings array is empty/missing
    findingsSection =
      '## Key Findings\n\nAnalysis could not be completed or yielded no findings.';
  }

  // 5. Format Sources Section (keep deduplication)
  const uniqueSources = deduplicateSources(props.sources || []);
  let sourcesSection = '';

  if (uniqueSources.length > 0) {
    const sourcesHeader = `## Sources`;
    const sourcesList = uniqueSources
      .map((source, index) => {
        // Extract domain from URL for cleaner display
        const domain = extractDomain(source.url);
        return `${index + 1}. [${source.title}](${source.url}) ${domain ? `(${domain})` : ''}`;
      })
      .join('\n');
    sourcesSection = `${sourcesHeader}\n\n${sourcesList}`;
  } else {
    sourcesSection = '## Sources\n\nNo sources found.';
  }

  // 6. Combine sections with proper spacing - NOW PUTTING SOURCES LAST
  const reportSections = [
    title.trim(),
    statusSection.trim(),
    findingsSection.trim(), // Key Findings moved up before Research Statistics
    statsSection.trim(), // Research Statistics now before Sources
    sourcesSection.trim() // Sources now last
  ].filter(Boolean); // Filter out empty strings

  const content = reportSections.join('\n\n');

  return createToolResult('deep_research_result', content);
}

/**
 * Helper function to deduplicate sources by URL
 */
function deduplicateSources(
  sources: Array<{ title: string; url: string }>
): Array<{ title: string; url: string }> {
  const uniqueUrls = new Set<string>();
  return sources.filter((source) => {
    // Normalize URL by removing trailing slashes and query parameters
    const normalizedUrl = source.url.replace(/\/+$/, '').split('?')[0];
    if (uniqueUrls.has(normalizedUrl)) {
      return false;
    }
    uniqueUrls.add(normalizedUrl);
    return true;
  });
}

/**
 * Helper function to extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
