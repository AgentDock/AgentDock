# arXiv API Integration

This module provides integration with arXiv, an open-access archive for scholarly articles in physics, mathematics, computer science, and related fields.

## Features

- **Search arXiv Papers**: Search for scientific papers across various categories
- **Fetch Paper Details**: Retrieve detailed information about specific papers

## Tools

### arxiv_search

Search for scientific papers on arXiv.

```typescript
// Example usage
const result = await tools.arxiv_search.execute(
  {
    query: 'quantum computing',
    maxResults: 10,
    sortBy: 'relevance',
    category: 'cs.AI',
    searchIn: 'title',
  },
  options,
);
```

**Parameters:**

- `query` (string): The search term or phrase to look for
- `maxResults` (optional number): Maximum results to return (default: 10, max: 50)
- `sortBy` (optional string): Sort order - "relevance" (default), "lastUpdated", or "submitted"
- `category` (optional string): arXiv category to search within (e.g., 'cs.AI', 'physics')
- `searchIn` (optional string): Where to search - "all" (default), "title", "abstract", or "author"

### arxiv_fetch

Retrieve detailed information about a specific paper from arXiv.

```typescript
// Example usage
const result = await tools.arxiv_fetch.execute(
  {
    id: '2302.13971',
    format: 'full',
  },
  options,
);
```

**Parameters:**

- `id` (string): The arXiv ID of the paper to retrieve (e.g., "2302.13971" or full URL)
- `format` (optional string): Level of detail - "summary" (default) or "full"

## Rate Limits

The arXiv API has rate limits of 1 request per 3 seconds. The implementation automatically throttles requests to respect this limit.

## Data Format

The arXiv API returns data in XML format, which is parsed into structured objects:

### ArxivPaper

```typescript
interface ArxivPaper {
  id: string; // arXiv ID (e.g., 2302.13971)
  title: string; // Paper title
  summary: string; // Abstract text
  authors: string[]; // List of author names
  categories: string[]; // List of arXiv categories
  pdfUrl: string; // URL to PDF
  htmlUrl: string; // URL to HTML abstract page
  published: string; // Publication date
  updated: string; // Last updated date
  doi?: string; // DOI if available
  comment?: string; // Author comment if available
  journalRef?: string; // Journal reference if available
}
```

## Categories

arXiv organizes papers into various categories, such as:

- Computer Science (CS)
- Mathematics (MATH)
- Physics (PHYSICS)
- Economics (ECON)
- Electrical Engineering and Systems Science (EESS)
- Quantitative Biology (QUANT_BIO)
- Quantitative Finance (QUANT_FIN)
- Statistics (STAT)

For more detailed categories, refer to the [arXiv taxonomy](https://arxiv.org/category_taxonomy).

## Important Notes

- No API key is required for basic usage of arXiv
- Always respect the rate limits to avoid being blocked
- The API has limited search capabilities compared to commercial APIs
- PDF downloads should be used responsibly and in accordance with arXiv's terms of service
