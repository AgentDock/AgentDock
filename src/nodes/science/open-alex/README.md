# OpenAlex Tools

This directory contains tools for accessing the OpenAlex API, which provides access to an open and comprehensive catalog of scholarly papers, authors, institutions, and more.

## Available Tools

### `openAlex_search`

Search for scholarly literature across all disciplines.

**Parameters:**
- `query` (string, required): The search term to look for
- `maxResults` (number, optional): Maximum number of results to return (default: 10, max: 100)
- `filter` (string, optional): Filter to apply - "open_access", "recent", "highly_cited"
- `sort` (string, optional): Sort order - "relevance", "date", "citations"

**Example Usage:**
```javascript
const result = await openAlex_search({
  query: "quantum computing",
  maxResults: 5,
  sort: "citations",
  filter: "open_access"
});
```

### `openAlex_fetch`

Retrieve detailed information about a specific scholarly work.

**Parameters:**
- `id` (string, required): The OpenAlex ID or DOI of the work to retrieve
- `format` (string, optional): Level of detail - "summary" or "full" (default: "summary")

**Example Usage:**
```javascript
const result = await openAlex_fetch({
  id: "W2741809807",
  format: "full"
});

// Or with a DOI
const result = await openAlex_fetch({
  id: "10.1038/s41586-021-03819-2",
  format: "full"
});
```

## API Limits

OpenAlex API has the following limits:
- No authentication required
- Rate limit: 100,000 requests per day
- Higher rate limits available by providing an email in the `OPENALEX_EMAIL` environment variable

## References

- [OpenAlex Documentation](https://docs.openalex.org)
- [OpenAlex Website](https://openalex.org)

## Environment Variables

- `OPENALEX_EMAIL`: (Optional) Your email address for higher rate limits 