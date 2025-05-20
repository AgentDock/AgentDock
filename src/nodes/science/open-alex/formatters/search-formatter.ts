/**
 * @fileoverview Formatter for OpenAlex search results
 */

import { OpenAlexSearchResult, OpenAlexWork } from '../component';

/**
 * Format OpenAlex search results as Markdown
 */
export function formatSearchResultsAsMarkdown(query: string, result: OpenAlexSearchResult): string {
  const { works, total } = result;

  if (works.length === 0) {
    return `## OpenAlex Search Results\n\nNo results found for "${query}".`;
  }

  let markdown = `## OpenAlex Search Results for "${query}"\n\n`;
  markdown += `Found ${total} results. Showing ${works.length}:\n\n`;

  works.forEach((work, index) => {
    markdown += formatWorkSummary(work, index + 1);
  });

  // Add a note about OpenAlex attribution
  markdown += '\n---\n';
  markdown +=
    'Data provided by [OpenAlex](https://openalex.org), an open and comprehensive catalog of scholarly papers, authors, institutions, and more.\n';

  return markdown;
}

/**
 * Format a single work as Markdown summary
 */
function formatWorkSummary(work: OpenAlexWork, index: number): string {
  let summary = `### ${index}. ${work.title}\n\n`;

  // Authors
  if (work.authors && work.authors.length > 0) {
    summary += `**Authors:** ${work.authors.join(', ')}\n\n`;
  }

  // Publication details
  const pubDetails = [];
  if (work.venue) pubDetails.push(work.venue);
  if (work.year) pubDetails.push(`${work.year}`);
  if (pubDetails.length > 0) {
    summary += `**Published in:** ${pubDetails.join(', ')}\n\n`;
  }

  // Citation count
  if (work.cited_by_count !== undefined) {
    summary += `**Citations:** ${work.cited_by_count}\n\n`;
  }

  // Open access badge
  if (work.is_open_access) {
    summary += `**🔓 Open Access Available**\n\n`;
  }

  // Links
  summary += `**ID:** ${work.id}\n\n`;

  if (work.doi) {
    summary += `**DOI:** [${work.doi}](https://doi.org/${work.doi})\n\n`;
  }

  summary += `**[View on OpenAlex](${work.url})**\n\n`;

  if (work.is_open_access && work.open_access_url) {
    summary += `**[Access Full Text](${work.open_access_url})**\n\n`;
  }

  return summary;
}
