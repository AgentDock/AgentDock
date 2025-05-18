/**
 * @fileoverview Formatter for arXiv search results
 */

import { ArxivSearchResult, ArxivPaper } from '../component';
import { ARXIV_CATEGORIES } from '../api/constants';

/**
 * Format arXiv search results as Markdown
 */
export function formatSearchResultsAsMarkdown(query: string, result: ArxivSearchResult): string {
  const { papers, total } = result;

  if (papers.length === 0) {
    return `## arXiv Search Results\n\nNo results found for "${query}".`;
  }

  let markdown = `## arXiv Search Results for "${query}"\n\n`;
  markdown += `Found ${total} results. Showing ${papers.length}:\n\n`;

  // Add category information if available
  if (result.searchParams.category) {
    markdown += `Category: ${result.searchParams.category}\n\n`;
  }

  papers.forEach((paper, index) => {
    markdown += formatPaperSummary(paper, index + 1);
  });

  // Add a note about arXiv attribution
  markdown += '\n---\n';
  markdown +=
    'Data provided by [arXiv.org](https://arxiv.org), a free distribution service and an open-access archive for scholarly articles.\n';

  return markdown;
}

/**
 * Format a single paper as Markdown summary
 */
function formatPaperSummary(paper: ArxivPaper, index: number): string {
  let summary = `### ${index}. ${paper.title}\n\n`;

  // Authors
  if (paper.authors && paper.authors.length > 0) {
    summary += `**Authors:** ${paper.authors.join(', ')}\n\n`;
  }

  // Categories with full names where possible
  if (paper.categories && paper.categories.length > 0) {
    const categoryNames = paper.categories.map((cat) => {
      const mainCat = cat.split('.')[0].toUpperCase();
      const fullName = ARXIV_CATEGORIES[mainCat as keyof typeof ARXIV_CATEGORIES];
      return fullName ? `${cat} (${fullName})` : cat;
    });
    summary += `**Categories:** ${categoryNames.join(', ')}\n\n`;
  }

  // Publication date
  const pubDate = new Date(paper.published);
  summary += `**Published:** ${pubDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  // Update date if different from publication
  if (paper.updated !== paper.published) {
    const updateDate = new Date(paper.updated);
    summary += `**Last Updated:** ${updateDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
  }

  // Journal reference if available
  if (paper.journalRef) {
    summary += `**Journal Reference:** ${paper.journalRef}\n\n`;
  }

  // Add a brief excerpt from the abstract (first 200 chars)
  if (paper.summary) {
    const excerpt =
      paper.summary.length > 200 ? paper.summary.substring(0, 200) + '...' : paper.summary;
    summary += `**Abstract (excerpt):** ${excerpt}\n\n`;
  }

  // Links to arXiv
  summary += `**ID:** ${paper.id}\n\n`;
  summary += `**[View Abstract](${paper.htmlUrl}) | [PDF](${paper.pdfUrl})**\n\n`;

  return summary;
}
