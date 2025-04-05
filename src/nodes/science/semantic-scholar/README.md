# Semantic Scholar API Integration

This module provides integration with Semantic Scholar, a free, AI-powered research tool for scientific literature developed by the Allen Institute for AI.

## Features

- **Search Papers**: Search for scientific papers across various fields
- **Fetch Paper Details**: Retrieve detailed information about specific papers
- **Fetch Author Details**: Get information about researchers and their publications

## Tools

### semantic_scholar_search

Search for scientific papers on Semantic Scholar.

```typescript
// Example usage
const result = await tools.semantic_scholar_search.execute({
  query: "machine learning",
  maxResults: 10,
  year: 2023,
  openAccess: true,
  venue: "NeurIPS",
  fieldsOfStudy: "Computer Science"
}, options);
```

**Parameters:**
- `query` (string): The search term or phrase to look for
- `maxResults` (optional number): Maximum results to return (default: 10, max: 50)
- `year` (optional number): Filter by publication year
- `openAccess` (optional boolean): Only include open access papers
- `venue` (optional string): Filter by publication venue (journal or conference)
- `fieldsOfStudy` (optional string): Filter by field of study

### semantic_scholar_paper

Retrieve detailed information about a specific paper from Semantic Scholar.

```typescript
// Example usage
const result = await tools.semantic_scholar_paper.execute({
  paperId: "10.18653/v1/N18-3011", // DOI
  includeCitations: true,
  includeReferences: false
}, options);
```

**Parameters:**
- `paperId` (string): The Semantic Scholar Paper ID, DOI, or arXiv ID
- `includeCitations` (optional boolean): Include top citations
- `includeReferences` (optional boolean): Include references

### semantic_scholar_author

Retrieve information about a researcher from Semantic Scholar.

```typescript
// Example usage
const result = await tools.semantic_scholar_author.execute({
  authorId: "3324024", // Semantic Scholar Author ID
  includePapers: true,
  paperLimit: 15
}, options);
```

**Parameters:**
- `authorId` (string): The Semantic Scholar Author ID or ORCID
- `includePapers` (optional boolean): Include the author's papers
- `paperLimit` (optional number): Maximum number of papers to return (default: 10, max: 100)

## Rate Limits

Semantic Scholar has rate limits that depend on whether you're using an API key:

- Without API key: 100 requests per 5 minutes (~3 requests/second)
- With API key: Higher limits available by request

This implementation automatically throttles requests to avoid rate limit issues.

## API Key (Optional)

To use a Semantic Scholar API key, set the environment variable:

```
SEMANTIC_SCHOLAR_API_KEY=your_api_key_here
```

API keys are available by request from Semantic Scholar.

## Data Format

The Semantic Scholar API returns data in JSON format, which is parsed into structured objects:

### SemanticScholarPaper

```typescript
interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  url: string;
  year?: number;
  venue?: string;
  publicationDate?: string;
  authors: SemanticScholarAuthor[];
  citationCount?: number;
  referenceCount?: number;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  fieldsOfStudy?: string[];
  externalIds?: Record<string, string>;
}
```

### SemanticScholarAuthor

```typescript
interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  url?: string;
  affiliations?: string[];
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}
```

## Important Notes

- The API may return different information depending on whether you have an API key
- External IDs like DOI and arXiv ID can be used to lookup papers
- Semantic Scholar provides a TL;DR feature for some papers, which summarizes the abstract
- Links to open access PDFs are provided when available 