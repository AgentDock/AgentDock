# PubMed API Tools

These tools provide access to the PubMed database through the NCBI E-utilities API, allowing agents to search for and retrieve biomedical literature.

## Available Tools

### `pubmed_search`

Search for biomedical literature in PubMed.

**Parameters:**

- `query` (required): The search term or phrase (e.g., "cancer treatment")
- `maxResults` (optional): Maximum number of results to return (default: 10, max: 100)
- `sort` (optional): Sort order - either "relevance" (default) or "date" (newest first)
- `filter` (optional): Additional PubMed filters in standard PubMed syntax

**Example:**

```javascript
const result = await pubmed_search({
  query: 'diabetes treatment metformin',
  maxResults: 5,
  sort: 'date',
});
```

### `pubmed_fetch`

Retrieve detailed information about a specific article from PubMed.

**Parameters:**

- `pmid` (required): The PubMed ID (PMID) of the article to retrieve
- `format` (optional): The level of detail - "summary" (default), "abstract", or "full"

**Example:**

```javascript
const result = await pubmed_fetch({
  pmid: '33782455',
  format: 'abstract',
});
```

## Implementation Details

The PubMed tools use the following E-utilities endpoints:

- ESearch: For searching the database and retrieving article IDs
- ESummary: For retrieving summary information for articles
- EFetch: For retrieving detailed article information

All API calls are made to NCBI's public E-utilities API without requiring an API key. However, for higher rate limits, users can register for an API key through NCBI.

## Rate Limits

Without an API key, the NCBI E-utilities API is limited to:

- 3 requests per second
- A maximum of 100 results per request

## References

- [NCBI E-utilities Documentation](https://www.ncbi.nlm.nih.gov/books/NBK25501/)
- [PubMed Database](https://pubmed.ncbi.nlm.nih.gov/)
- [NCBI Developer Resources](https://www.ncbi.nlm.nih.gov/home/develop/)
