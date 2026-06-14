# CRW (fastCRW) Tools

This set of tools provides comprehensive web interaction capabilities using the [fastCRW](https://fastcrw.com) API. It allows agents to search the web, scrape webpages, crawl websites, map site structures, and extract structured data.

fastCRW is a Firecrawl-compatible web scraper distributed as a single ~8MB binary. You can self-host it (AGPL open core) or use the managed cloud at [fastcrw.com](https://fastcrw.com). Because the API is Firecrawl-compatible, these tools mirror the Firecrawl tools with the fastCRW base URL.

## Configuration

To use these tools, you need to set up the following environment variable:

```
CRW_API_KEY="your-api-key"
```

You can get an API key from [fastcrw.com](https://fastcrw.com).

Optionally, you can override the API base URL (for example, to point at a self-hosted instance):

```
CRW_BASE_URL="https://fastcrw.com/api/v1"
```

## Available Tools

### 1. CRW Search

Search the web for information on any topic.

#### Parameters

```typescript
{
  query: string; // The search query to look up
  limit?: number; // Maximum number of results to return (default: 5)
}
```

#### Example

```typescript
const result = await crwSearchTool.execute({
  query: "climate change solutions",
  limit: 3
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Search Results for "climate change solutions"

**1. [Title of the first result](https://example.com/result1)**
Snippet text for the first result...

**2. [Title of the second result](https://example.com/result2)**
Snippet text for the second result...

**3. [Title of the third result](https://example.com/result3)**
Snippet text for the third result...
```

### 2. CRW Scrape

Scrape a webpage and extract its content.

#### Parameters

```typescript
{
  url: string; // The URL to scrape
  formats?: string[]; // Formats to return (markdown, html, etc.) (default: ['markdown'])
}
```

#### Example

```typescript
const result = await crwScrapeTool.execute({
  url: "https://example.com",
  formats: ["markdown", "html"]
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Scrape Results for [Example Website](https://example.com)

### Metadata

- **Title**: Example Website
- **Description**: This is an example website
- **Language**: en
- **Source URL**: [https://example.com](https://example.com)

### Content Preview

Content of the webpage...
```

### 3. CRW Crawl

Crawl a website and extract content from multiple pages.

#### Parameters

```typescript
{
  url: string; // The URL to crawl
  limit?: number; // Maximum number of pages to crawl (default: 10)
  maxDepth?: number; // Maximum crawl depth (default: 2)
}
```

#### Example

```typescript
const result = await crwCrawlTool.execute({
  url: "https://example.com",
  limit: 5,
  maxDepth: 1
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Crawl Results for [Example Website](https://example.com)

**Status**: completed
**Pages**: 5
**Crawl ID**: abc-123-xyz

### Pages Found

**1. [Home Page](https://example.com)**
Content preview...

**2. [About Page](https://example.com/about)**
Content preview...

...
```

### 4. CRW Crawl Status

Check the status of a crawl job.

#### Parameters

```typescript
{
  crawlId: string; // The crawl job ID to check
}
```

#### Example

```typescript
const result = await crwCrawlStatusTool.execute({
  crawlId: "abc-123-xyz"
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Crawl Results

**Status**: completed
**Pages**: 5
**Crawl ID**: abc-123-xyz

### Pages Found

**1. [Home Page](https://example.com)**
Content preview...

**2. [About Page](https://example.com/about)**
Content preview...

...
```

### 5. CRW Map

Map a website and get a list of all URLs.

#### Parameters

```typescript
{
  url: string; // The URL to map
  maxDepth?: number; // Maximum crawl depth (default: 2)
}
```

#### Example

```typescript
const result = await crwMapTool.execute({
  url: "https://example.com",
  maxDepth: 1
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Map Results for [Example Website](https://example.com)

Found **10** URLs on this website.

### URLs Found

1. [https://example.com](https://example.com)
2. [https://example.com/about](https://example.com/about)
3. [https://example.com/contact](https://example.com/contact)
...
```

### 6. CRW Extract

Extract structured data from a webpage.

#### Parameters

```typescript
{
  url: string; // The URL to extract data from
  prompt?: string; // Prompt to use for extraction
}
```

#### Example

```typescript
const result = await crwExtractTool.execute({
  url: "https://example.com",
  prompt: "Extract the company name, founding year, and main products"
}, { toolCallId: "some-id" });
```

#### Response Format

```markdown
## CRW Extract Results for [Example Website](https://example.com)

### Extracted Data

- **company_name**: Example Company
- **founding_year**: 2005
- **main_products**: ["Product A", "Product B", "Product C"]

### Metadata

- **Title**: Example Website
- **Description**: This is an example website
- **Source URL**: [https://example.com](https://example.com)
```

## Error Handling

All tools handle various error scenarios:

1. Empty input - Returns an error message asking for non-empty input
2. Missing configuration - Returns an error if CRW_API_KEY is not set
3. API errors - Returns a formatted error message with details about the API error
4. No results - Returns a message indicating no results were found

## Implementation Details

The tools are implemented using three main files:

- `index.ts` - Main tool implementations and exports
- `components.ts` - UI components for rendering results
- `utils.ts` - Utility functions for making API calls to fastCRW

The tools follow the Vercel AI SDK patterns and integrate with the AgentDock tool registry.
