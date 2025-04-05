/**
 * @fileoverview Formatter for Semantic Scholar author details
 */

import { SemanticScholarAuthor, SemanticScholarPaper } from '../component';

/**
 * Format author details as Markdown
 * @param author The author to format
 * @param papers Optional list of author's papers
 * @returns Markdown formatted author details
 */
export function formatAuthorAsMarkdown(author: SemanticScholarAuthor, papers?: SemanticScholarPaper[]): string {
  // Author name section
  const name = `# ${author.name}`;
  
  // Metrics section
  const metrics = [];
  
  if (author.paperCount !== undefined) {
    metrics.push(`**Papers:** ${author.paperCount}`);
  }
  
  if (author.citationCount !== undefined) {
    metrics.push(`**Citations:** ${author.citationCount}`);
  }
  
  if (author.hIndex !== undefined) {
    metrics.push(`**h-index:** ${author.hIndex}`);
  }
  
  const metricsSection = metrics.length > 0
    ? `## Metrics\n\n${metrics.join('\n\n')}`
    : '';
  
  // Affiliations section
  const affiliations = author.affiliations && author.affiliations.length > 0
    ? `## Affiliations\n\n${author.affiliations.join('\n\n')}`
    : '';
  
  // Links section
  const links = [`**Semantic Scholar:** [View Profile](${author.url})`].filter(Boolean);
  
  const linksSection = links.length > 0
    ? `## Links\n\n${links.join('\n\n')}`
    : '';
  
  // Papers section (if provided)
  let papersSection = '';
  
  if (papers && papers.length > 0) {
    papersSection = `## Selected Papers\n\n`;
    
    // Format each paper as a list item
    const paperItems = papers.map(paper => {
      const title = paper.title;
      const year = paper.year ? `(${paper.year})` : '';
      const venue = paper.venue ? `*${paper.venue}*` : '';
      const citations = paper.citationCount !== undefined ? `Citations: ${paper.citationCount}` : '';
      const link = `[View Paper](${paper.url})`;
      
      return `- **${title}** ${year}\n  ${[venue, citations, link].filter(Boolean).join(' | ')}`;
    });
    
    papersSection += paperItems.join('\n\n');
  }
  
  // Combine all sections and return
  const attribution = `\n\n---\n\nData from [Semantic Scholar](https://www.semanticscholar.org), a free, AI-powered research tool by the Allen Institute for AI.`;
  
  return [
    name,
    metricsSection,
    affiliations,
    linksSection,
    papersSection,
    attribution
  ].filter(Boolean).join('\n\n');
} 