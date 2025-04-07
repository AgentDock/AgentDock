/**
 * @fileoverview Formatter for Semantic Scholar search results
 */

import { SemanticScholarSearchResult, SemanticScholarPaper } from '../component';

/**
 * Format a paper's summary for inclusion in search results
 * @param paper The paper to format
 * @returns Markdown formatted paper summary
 */
function formatPaperSummary(paper: SemanticScholarPaper): string {
  const title = `### ${paper.title}`;
  
  const authors = paper.authors?.length > 0
    ? `**Authors:** ${paper.authors.map(a => a.name).join(', ')}`
    : '';
  
  const venue = paper.venue
    ? `**Venue:** ${paper.venue}`
    : '';
  
  const year = paper.year
    ? `**Year:** ${paper.year}`
    : '';
  
  const citations = paper.citationCount !== undefined
    ? `**Citations:** ${paper.citationCount}`
    : '';
  
  const pubInfo = [year, venue, citations].filter(Boolean).join(' | ');
  
  const abstract = paper.abstract
    ? `**Abstract:** ${paper.abstract.substring(0, 200)}${paper.abstract.length > 200 ? '...' : ''}`
    : '';
  
  const tldr = paper.tldr?.text
    ? `**TL;DR:** ${paper.tldr.text}`
    : '';
  
  const links = [
    `[View on Semantic Scholar](${paper.url})`,
    paper.openAccessPdf?.url ? `[Download PDF](${paper.openAccessPdf.url})` : '',
    paper.externalIds?.DOI ? `[DOI: ${paper.externalIds.DOI}](https://doi.org/${paper.externalIds.DOI})` : ''
  ].filter(Boolean).join(' | ');
  
  // Combine all sections
  return [
    title,
    authors,
    pubInfo,
    tldr || abstract,
    links,
    '---'
  ].filter(Boolean).join('\n\n');
}

/**
 * Format search results as Markdown
 * @param query The search query
 * @param results The search results
 * @returns Markdown formatted search results
 */
export function formatSearchResultsAsMarkdown(query: string, results: SemanticScholarSearchResult): string {
  // Create the header with query and result count
  const header = `# Semantic Scholar Search Results: "${query}"`;
  const resultCount = `Found ${results.total} results${results.total > results.papers.length ? `, showing top ${results.papers.length}` : ''}`;
  
  // Format search filters if any are applied
  const filters = [];
  if (results.searchParams.year) filters.push(`Year: ${results.searchParams.year}`);
  if (results.searchParams.venue) filters.push(`Venue: ${results.searchParams.venue}`);
  if (results.searchParams.openAccess) filters.push(`Open Access Only`);
  if (results.searchParams.fieldsOfStudy) filters.push(`Field: ${results.searchParams.fieldsOfStudy}`);
  
  const filterText = filters.length > 0
    ? `**Filters:** ${filters.join(' | ')}`
    : '';
  
  // No results
  if (results.papers.length === 0) {
    return [
      header,
      resultCount,
      filterText,
      '',
      'No papers found matching your search criteria.',
      '',
      'Try broadening your search or using different keywords.'
    ].filter(Boolean).join('\n');
  }
  
  // Format each paper
  const paperSummaries = results.papers.map(formatPaperSummary).join('\n\n');
  
  // Add attribution
  const attribution = `Data from [Semantic Scholar](https://www.semanticscholar.org), a free, AI-powered research tool by the Allen Institute for AI.`;
  
  // Combine all sections
  return [
    header,
    resultCount,
    filterText,
    '',
    paperSummaries,
    '',
    attribution
  ].filter(Boolean).join('\n');
} 