/**
 * @fileoverview Formatters for converting PubMed data to Markdown
 */

import { PubMedArticle } from '../component';

/**
 * Format PubMed search results as Markdown
 */
export function formatSearchResultsAsMarkdown(
  query: string,
  results: { articles: PubMedArticle[]; total: number },
): string {
  const { articles, total } = results;

  if (articles.length === 0) {
    return `## PubMed Search: "${query}"\n\nNo results found.`;
  }

  let markdown = `## PubMed Search: "${query}"\n\nFound ${total} results, showing ${articles.length}:\n\n`;

  articles.forEach((article, index) => {
    markdown += `### ${index + 1}. ${article.title}\n`;

    if (article.authors.length > 0) {
      const authorText =
        article.authors.length > 3
          ? `${article.authors.slice(0, 3).join(', ')} et al.`
          : article.authors.join(', ');
      markdown += `**Authors:** ${authorText}\n\n`;
    }

    if (article.journal) {
      markdown += `**Journal:** ${article.journal}`;
      if (article.pubDate) {
        markdown += ` (${article.pubDate})`;
      }
      markdown += '\n\n';
    }

    if (article.abstract) {
      markdown += `**Abstract:** ${article.abstract.substring(0, 200)}${article.abstract.length > 200 ? '...' : ''}\n\n`;
    }

    markdown += `**PMID:** ${article.pmid}`;

    if (article.doi) {
      markdown += ` | **DOI:** ${article.doi}`;
    }

    markdown += `\n[View on PubMed](https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/)\n\n`;

    if (index < articles.length - 1) {
      markdown += '---\n\n';
    }
  });

  return markdown;
}

/**
 * Format a single PubMed article as Markdown
 */
export function formatArticleAsMarkdown(article: PubMedArticle): string {
  let markdown = `## ${article.title}\n\n`;

  if (article.authors.length > 0) {
    markdown += `**Authors:** ${article.authors.join(', ')}\n\n`;
  }

  if (article.journal) {
    markdown += `**Journal:** ${article.journal}`;
    if (article.pubDate) {
      markdown += ` (${article.pubDate})`;
    }
    markdown += '\n\n';
  }

  if (article.abstract) {
    markdown += `### Abstract\n${article.abstract}\n\n`;
  }

  if (article.keywords && article.keywords.length > 0) {
    markdown += `**Keywords:** ${article.keywords.join(', ')}\n\n`;
  }

  markdown += `**PMID:** ${article.pmid}`;

  if (article.doi) {
    markdown += ` | **DOI:** ${article.doi}`;
  }

  markdown += `\n[View on PubMed](https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/)\n`;

  return markdown;
}
