/**
 * @fileoverview Firecrawl UI components for rendering search results.
 * These components are used by the firecrawl tool to display information.
 */

import {
  createToolResult,
  formatHeader,
  formatSubheader,
  formatLink,
  joinSections,
  formatBold,
  formatListItem,
} from '@/lib/utils/markdown-utils';

/**
 * Search result interface
 */
export interface FirecrawlResult {
  title: string;
  url: string;
  snippet: string;
  isFeatured?: boolean;
  isKnowledgeGraph?: boolean;
}

/**
 * Scrape result interface
 */
export interface FirecrawlScrapeResult {
  url: string;
  title: string;
  content: string;
  metadata: any;
}

/**
 * Crawl result interface
 */
export interface FirecrawlCrawlResult {
  url: string;
  pages: number;
  crawlId: string;
  status: string;
  results: {
    url: string;
    title: string;
    content: string;
  }[];
}

/**
 * Map result interface
 */
export interface FirecrawlMapResult {
  url: string;
  urlCount: number;
  urls: string[];
}

/**
 * Extract result interface
 */
export interface FirecrawlExtractResult {
  url: string;
  title: string;
  data: any;
  metadata: any;
}

/**
 * Props for the FirecrawlResults component
 */
export interface FirecrawlResultsProps {
  query: string;
  results: FirecrawlResult[];
}

/**
 * Props for the FirecrawlScrapeResults component
 */
export interface FirecrawlScrapeResultsProps {
  url: string;
  result: FirecrawlScrapeResult;
}

/**
 * Props for the FirecrawlCrawlResults component
 */
export interface FirecrawlCrawlResultsProps {
  url: string;
  result: FirecrawlCrawlResult;
}

/**
 * Props for the FirecrawlMapResults component
 */
export interface FirecrawlMapResultsProps {
  url: string;
  result: FirecrawlMapResult;
}

/**
 * Props for the FirecrawlExtractResults component
 */
export interface FirecrawlExtractResultsProps {
  url: string;
  result: FirecrawlExtractResult;
}

/**
 * Formats a single search result as markdown
 */
function formatResult(result: FirecrawlResult, index: number): string {
  const title =
    result.isFeatured || result.isKnowledgeGraph
      ? `${result.title} ${result.isFeatured ? '(Featured Snippet)' : '(Knowledge Graph)'}`
      : result.title;

  const titleLink = result.url !== '#' ? formatLink(title, result.url) : `**${title}**`;

  return `**${index + 1}. ${titleLink}**\n${result.snippet}`;
}

/**
 * Firecrawl results component
 * Renders search results in a consistent format
 */
export function FirecrawlResults(props: FirecrawlResultsProps) {
  // Format the header with the query
  const header = formatHeader(`Firecrawl Search Results for "${props.query}"`, 2);

  // If no results, return a message
  if (!props.results || props.results.length === 0) {
    return createToolResult(
      'firecrawl_results',
      joinSections(header, 'No results found. Try a different search query.'),
    );
  }

  // Format each result
  const formattedResults = props.results.map(formatResult).join('\n\n');

  // Create the content with header and results
  const content = joinSections(header, formattedResults);

  // Return the formatted content
  return createToolResult('firecrawl_results', content);
}

/**
 * Firecrawl scrape results component
 * Renders scrape results in a consistent format
 */
export function FirecrawlScrapeResults(props: FirecrawlScrapeResultsProps) {
  // Format the header with the URL
  const header = formatHeader(
    `Firecrawl Scrape Results for ${formatLink(props.result.title, props.result.url)}`,
    2,
  );

  // Format metadata
  const metadata = props.result.metadata
    ? `${formatSubheader('Metadata')}\n\n` +
      `- **Title**: ${props.result.metadata.title || 'N/A'}\n` +
      `- **Description**: ${props.result.metadata.description || 'N/A'}\n` +
      `- **Language**: ${props.result.metadata.language || 'N/A'}\n` +
      `- **Source URL**: ${formatLink(props.result.metadata.sourceURL || props.result.url, props.result.metadata.sourceURL || props.result.url)}`
    : '';

  // Format content preview (first 500 characters)
  const contentPreview = props.result.content
    ? `${formatSubheader('Content Preview')}\n\n${props.result.content.substring(0, 500)}${props.result.content.length > 500 ? '...' : ''}`
    : 'No content available.';

  // Create the content with header, metadata, and content preview
  const content = joinSections(header, metadata, contentPreview);

  // Return the formatted content
  return createToolResult('firecrawl_scrape_results', content);
}

/**
 * Firecrawl crawl results component
 * Renders crawl results in a consistent format
 */
export function FirecrawlCrawlResults(props: FirecrawlCrawlResultsProps) {
  // Format the header with the URL
  const header = formatHeader(`Firecrawl Crawl Results for ${formatLink(props.url, props.url)}`, 2);

  // Format status information
  const statusInfo = joinSections(
    `${formatBold('Status')}: ${props.result.status}`,
    `${formatBold('Pages')}: ${props.result.pages}`,
    `${formatBold('Crawl ID')}: ${props.result.crawlId}`,
  );

  // If pending, return status only
  if (props.result.status === 'pending') {
    return createToolResult(
      'firecrawl_crawl_results',
      joinSections(
        header,
        statusInfo,
        'The crawl is still in progress. You can check the status later using the crawl ID.',
      ),
    );
  }

  // Format results
  const resultsSection =
    props.result.results && props.result.results.length > 0
      ? `${formatSubheader('Pages Found')}\n\n` +
        props.result.results
          .map(
            (item, index) =>
              `${formatBold(`${index + 1}. ${formatLink(item.title, item.url)}`)}\n${item.content}`,
          )
          .join('\n\n')
      : 'No pages found.';

  // Create the content with header, status, and results
  const content = joinSections(header, statusInfo, resultsSection);

  // Return the formatted content
  return createToolResult('firecrawl_crawl_results', content);
}

/**
 * Firecrawl map results component
 * Renders map results in a consistent format
 */
export function FirecrawlMapResults(props: FirecrawlMapResultsProps) {
  // Format the header with the URL
  const header = formatHeader(`Firecrawl Map Results for ${formatLink(props.url, props.url)}`, 2);

  // Format summary
  const summary = `Found ${formatBold(props.result.urlCount.toString())} URLs on this website.`;

  // Format URLs
  const urlsSection =
    props.result.urls && props.result.urls.length > 0
      ? `${formatSubheader('URLs Found')}\n\n` +
        props.result.urls
          .map((url, index) => formatListItem(formatLink(url, url), index, true))
          .join('\n')
      : 'No URLs found.';

  // Create the content with header, summary, and URLs
  const content = joinSections(header, summary, urlsSection);

  // Return the formatted content
  return createToolResult('firecrawl_map_results', content);
}

/**
 * Firecrawl extract results component
 * Renders extract results in a consistent format
 */
export function FirecrawlExtractResults(props: FirecrawlExtractResultsProps) {
  // Format the header with the URL
  const header = formatHeader(
    `Firecrawl Extract Results for ${formatLink(props.result.title, props.result.url)}`,
    2,
  );

  // Format extracted data
  const dataSection = props.result.data
    ? `${formatSubheader('Extracted Data')}\n\n` +
      Object.entries(props.result.data)
        .map(
          ([key, value]) =>
            `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`,
        )
        .join('\n')
    : 'No data extracted.';

  // Format metadata
  const metadata = props.result.metadata
    ? `${formatSubheader('Metadata')}\n\n` +
      `- **Title**: ${props.result.metadata.title || 'N/A'}\n` +
      `- **Description**: ${props.result.metadata.description || 'N/A'}\n` +
      `- **Source URL**: ${formatLink(props.result.metadata.sourceURL || props.result.url, props.result.metadata.sourceURL || props.result.url)}`
    : '';

  // Create the content with header, data, and metadata
  const content = joinSections(header, dataSection, metadata);

  // Return the formatted content
  return createToolResult('firecrawl_extract_results', content);
}
