/**
 * @fileoverview Formatter for arXiv paper details
 */

import { ArxivPaper } from '../component';
import { ARXIV_CATEGORIES } from '../api/constants';

/**
 * Format a paper as Markdown
 */
export function formatPaperAsMarkdown(paper: ArxivPaper): string {
  let markdown = `# ${paper.title}\n\n`;

  // Authors section
  if (paper.authors && paper.authors.length > 0) {
    markdown += `## Authors\n${paper.authors.join(', ')}\n\n`;
  }

  // Publication details section
  markdown += '## Publication Details\n\n';

  // Categories with full names where possible
  if (paper.categories && paper.categories.length > 0) {
    const categoryNames = paper.categories.map((cat) => {
      const mainCat = cat.split('.')[0].toUpperCase();
      const fullName = ARXIV_CATEGORIES[mainCat as keyof typeof ARXIV_CATEGORIES];
      return fullName ? `${cat} (${fullName})` : cat;
    });
    markdown += `**Categories:** ${categoryNames.join(', ')}\n\n`;
  }

  // Publication date
  const pubDate = new Date(paper.published);
  markdown += `**Published:** ${pubDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  // Update date if different from publication
  if (paper.updated !== paper.published) {
    const updateDate = new Date(paper.updated);
    markdown += `**Last Updated:** ${updateDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
  }

  // Journal reference if available
  if (paper.journalRef) {
    markdown += `**Journal Reference:** ${paper.journalRef}\n\n`;
  }

  // DOI if available
  if (paper.doi) {
    markdown += `**DOI:** [${paper.doi}](https://doi.org/${paper.doi})\n\n`;
  }

  // Comment if available
  if (paper.comment) {
    markdown += `**Comment:** ${paper.comment}\n\n`;
  }

  // Abstract
  if (paper.summary) {
    markdown += `## Abstract\n\n${paper.summary}\n\n`;
  }

  // Links section
  markdown += '## Links\n\n';
  markdown += `**arXiv ID:** ${paper.id}\n\n`;
  markdown += `**[Download PDF](${paper.pdfUrl})**\n\n`;
  markdown += `**[View on arXiv](${paper.htmlUrl})**\n\n`;

  // Add citation information
  markdown += '## How to Cite\n\n';

  // APA style citation
  markdown += '**APA Format:**\n\n';
  const year = new Date(paper.published).getFullYear();
  const authorCitation =
    paper.authors.length > 0
      ? paper.authors.length > 1
        ? `${paper.authors[0]} et al.`
        : paper.authors[0]
      : 'Unknown author';

  const apaCitation = `${authorCitation} (${year}). ${paper.title}. *arXiv preprint* arXiv:${paper.id}.`;
  markdown += `${apaCitation}\n\n`;

  // BibTeX citation
  markdown += '**BibTeX Format:**\n\n';
  const authorsLastNames = paper.authors.map((author) => {
    const nameParts = author.trim().split(' ');
    return nameParts[nameParts.length - 1];
  });
  const authorKey = authorsLastNames.length > 0 ? authorsLastNames[0].toLowerCase() : 'unknown';
  const bibtexId = `${authorKey}${year}${paper.title.split(' ')[0].toLowerCase()}`;

  markdown += '```bibtex\n';
  markdown += `@article{${bibtexId},\n`;
  markdown += `  title={${paper.title}},\n`;
  markdown += `  author={${paper.authors.join(' and ')}},\n`;
  markdown += `  journal={arXiv preprint arXiv:${paper.id}},\n`;
  markdown += `  year={${year}}\n`;
  if (paper.doi) {
    markdown += `  doi={${paper.doi}},\n`;
  }
  markdown += '}\n';
  markdown += '```\n\n';

  // Add a note about arXiv attribution
  markdown += '---\n';
  markdown +=
    'Data provided by [arXiv.org](https://arxiv.org), a free distribution service and an open-access archive for scholarly articles.\n';

  return markdown;
}
