/**
 * @fileoverview Formatter for OpenAlex work (paper) details
 */

import { OpenAlexWork } from '../component';

/**
 * Format a work as Markdown
 */
export function formatWorkAsMarkdown(work: OpenAlexWork): string {
  let markdown = `# ${work.title}\n\n`;
  
  // Authors
  if (work.authors && work.authors.length > 0) {
    markdown += `## Authors\n${work.authors.join(', ')}\n\n`;
  }
  
  // Publication details section
  markdown += '## Publication Details\n\n';
  
  if (work.venue) {
    markdown += `**Published in:** ${work.venue}\n\n`;
  }
  
  if (work.publication_date) {
    markdown += `**Publication Date:** ${work.publication_date}\n\n`;
  } else if (work.year) {
    markdown += `**Year:** ${work.year}\n\n`;
  }
  
  if (work.type) {
    markdown += `**Type:** ${work.type}\n\n`;
  }
  
  if (work.cited_by_count !== undefined) {
    markdown += `**Citations:** ${work.cited_by_count}\n\n`;
  }
  
  // Abstract
  if (work.abstract) {
    markdown += `## Abstract\n\n${work.abstract}\n\n`;
  }
  
  // Concepts
  if (work.concepts && work.concepts.length > 0) {
    markdown += '## Concepts\n\n';
    work.concepts.forEach(concept => {
      markdown += `- ${concept.display_name} (Score: ${concept.score})\n`;
    });
    markdown += '\n';
  }
  
  // Keywords
  if (work.keywords && work.keywords.length > 0) {
    markdown += '## Keywords\n\n';
    markdown += work.keywords.join(', ') + '\n\n';
  }
  
  // Links section
  markdown += '## Links\n\n';
  
  if (work.is_open_access && work.open_access_url) {
    markdown += `🔓 **[Access Full Text](${work.open_access_url})**\n\n`;
  }
  
  if (work.doi) {
    markdown += `**DOI:** [${work.doi}](https://doi.org/${work.doi})\n\n`;
  }
  
  markdown += `**ID:** ${work.id}\n\n`;
  markdown += `**[View on OpenAlex](${work.url})**\n\n`;
  
  // Add attribution
  markdown += '---\n';
  markdown += 'Data provided by [OpenAlex](https://openalex.org), an open and comprehensive catalog of scholarly papers, authors, institutions, and more.\n';
  
  return markdown;
} 