/**
 * @fileoverview Formatter for Semantic Scholar paper details
 */

import { SemanticScholarPaper } from '../component';

/**
 * Format a paper's details as Markdown
 * @param paper The paper to format
 * @returns Markdown formatted paper details
 */
export function formatPaperAsMarkdown(paper: SemanticScholarPaper): string {
  // Title section
  const title = `# ${paper.title}`;

  // Authors section
  const authors =
    paper.authors?.length > 0 ? `## Authors\n\n${paper.authors.map((a) => a.name).join(', ')}` : '';

  // Publication details section
  const publicationDetails = [];

  if (paper.venue) {
    publicationDetails.push(`**Venue:** ${paper.venue}`);
  }

  if (paper.year) {
    publicationDetails.push(`**Year:** ${paper.year}`);
  }

  if (paper.publicationDate) {
    publicationDetails.push(`**Publication Date:** ${paper.publicationDate}`);
  }

  if (paper.citationCount !== undefined) {
    publicationDetails.push(`**Citations:** ${paper.citationCount}`);
  }

  if (paper.referenceCount !== undefined) {
    publicationDetails.push(`**References:** ${paper.referenceCount}`);
  }

  if (paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0) {
    publicationDetails.push(`**Fields of Study:** ${paper.fieldsOfStudy.join(', ')}`);
  }

  const publicationSection =
    publicationDetails.length > 0
      ? `## Publication Details\n\n${publicationDetails.join('\n\n')}`
      : '';

  // Abstract section
  const abstract = paper.abstract ? `## Abstract\n\n${paper.abstract}` : '';

  // TL;DR section (if available)
  const tldr = paper.tldr?.text ? `## TL;DR\n\n${paper.tldr.text}` : '';

  // Links section
  const links = [
    `**Semantic Scholar:** [View Paper](${paper.url})`,
    paper.openAccessPdf?.url ? `**PDF:** [Download](${paper.openAccessPdf.url})` : '',
    paper.externalIds?.DOI
      ? `**DOI:** [${paper.externalIds.DOI}](https://doi.org/${paper.externalIds.DOI})`
      : '',
    paper.externalIds?.ArXiv
      ? `**arXiv:** [${paper.externalIds.ArXiv}](https://arxiv.org/abs/${paper.externalIds.ArXiv})`
      : '',
  ].filter(Boolean);

  const linksSection = links.length > 0 ? `## Links\n\n${links.join('\n\n')}` : '';

  // Citation section
  let citation = '## Citation\n\n';

  // APA style citation
  const apaAuthors =
    paper.authors?.length > 0
      ? paper.authors
          .map((a) => {
            const nameParts = a.name.split(' ');
            if (nameParts.length > 1) {
              const lastName = nameParts.pop();
              const initials = nameParts.map((n) => `${n.charAt(0)}.`).join(' ');
              return `${lastName}, ${initials}`;
            }
            return a.name;
          })
          .join(', ')
      : 'Unknown';

  const apaYear = paper.year || 'n.d.';
  const apaTitle = paper.title;
  const apaVenue = paper.venue || 'Unpublished';
  const apaDoi = paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : '';

  citation += `**APA:** ${apaAuthors} (${apaYear}). ${apaTitle}. *${apaVenue}*. ${apaDoi}\n\n`;

  // BibTeX citation
  const bibtexId = paper.paperId.replace(/[^a-zA-Z0-9]/g, '');
  const bibtexAuthors =
    paper.authors?.length > 0 ? paper.authors.map((a) => a.name).join(' and ') : 'Unknown';

  citation += '**BibTeX:**\n```bibtex\n';
  citation += `@article{${bibtexId},\n`;
  citation += `  author = {${bibtexAuthors}},\n`;
  citation += `  title = {${paper.title}},\n`;
  if (paper.venue) citation += `  journal = {${paper.venue}},\n`;
  if (paper.year) citation += `  year = {${paper.year}},\n`;
  if (paper.externalIds?.DOI) citation += `  doi = {${paper.externalIds.DOI}},\n`;
  citation += `  url = {${paper.url}}\n`;
  citation += '}\n```';

  // Combine all sections and return
  const attribution = `\n\n---\n\nData from [Semantic Scholar](https://www.semanticscholar.org), a free, AI-powered research tool by the Allen Institute for AI.`;

  return [title, authors, publicationSection, tldr, abstract, linksSection, citation, attribution]
    .filter(Boolean)
    .join('\n\n');
}
