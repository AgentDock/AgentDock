# SerpNode

The `SerpNode` provides search engine functionality within the AgentDock framework, allowing agents to search the web for information using various search providers.

## Overview

The `SerpNode` is a core tool node that interfaces with different search engine providers through adapters. It currently supports the Firecrawl provider, which offers robust web search capabilities.

## Configuration

The `SerpNode` requires the following configuration parameters:

```typescript
{
  // The search provider to use (e.g., "firecrawl")
  provider: string;
  
  // Configuration specific to the provider
  config: {
    // For Firecrawl provider
    apiKey: string;
    
    // Optional: Cache settings
    cache?: {
      enabled?: boolean;
      ttl?: number;
    };
    
    // Optional: Retry settings
    retry?: {
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
    };
  };
}
```

## Usage

### Basic Usage

```typescript
import { NodeRegistry } from '@agentdock/core';

// Create a SerpNode instance
const serpNode = NodeRegistry.create('core.tool.serp', 'my-serp-node', {
  provider: 'firecrawl',
  config: {
    apiKey: process.env.FIRECRAWL_API_KEY,
    cache: {
      enabled: true,
      ttl: 3600000 // 1 hour
    }
  }
});

// Initialize the node
await serpNode.execute();

// Execute a search
const results = await serpNode.execute('quantum computing advancements');

// Or with options
const resultsWithOptions = await serpNode.execute({
  query: 'quantum computing advancements',
  options: {
    limit: 5,
    safeSearch: true
  }
});
```

### In Agent Templates

When using the `SerpNode` in agent templates, reference it as `core.tool.serp`:

```json
{
  "tools": [
    {
      "id": "core.tool.serp",
      "config": {
        "provider": "firecrawl",
        "config": {
          "apiKey": "${env.FIRECRAWL_API_KEY}"
        }
      }
    }
  ]
}
```

## Search Options

The `SerpNode` supports the following search options:

| Option | Type | Description |
|--------|------|-------------|
| `limit` | number | Maximum number of results to return |
| `safeSearch` | boolean | Whether to enable safe search filtering |
| `region` | string | Geographic region for search results |
| `language` | string | Language for search results |
| `timeframe` | string | Time range for search results (e.g., "day", "week", "month") |

## Response Format

The `SerpNode` returns search results in the following format:

```typescript
{
  // Formatted results as markdown
  formatted: string;
  
  // Raw search results
  raw: {
    query: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      position: number;
      metadata?: {
        lastUpdated?: string;
        contentType?: string;
        [key: string]: any;
      };
    }>;
    metadata: {
      totalResults: number;
      searchTime: number;
      provider: string;
    };
  };
}
```

## Adapters

### FirecrawlAdapter

The `FirecrawlAdapter` integrates with the Firecrawl search API, providing high-quality search results with features like caching and retry logic.

#### Configuration

```typescript
{
  apiKey: string;
  cache?: {
    enabled?: boolean;
    ttl?: number;
  };
  retry?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}
```

## Error Handling

The `SerpNode` handles various error scenarios:

- Invalid configuration: Returns detailed validation errors
- API errors: Includes error codes and messages from the provider
- Rate limiting: Implements retry logic with exponential backoff
- Network issues: Retries failed requests with appropriate delays

## Performance Considerations

- **Caching**: Enable caching to improve performance and reduce API calls
- **Result Limits**: Use the `limit` option to control the number of results
- **Rate Limiting**: Be aware of provider-specific rate limits

## Examples

### Basic Search

```typescript
const results = await serpNode.execute('latest AI research papers');
console.log(results.formatted); // Markdown-formatted results
console.log(results.raw.results.length); // Number of results
```

### Search with Options

```typescript
const results = await serpNode.execute({
  query: 'climate change solutions',
  options: {
    limit: 10,
    timeframe: 'month',
    safeSearch: true
  }
});
```

### Error Handling

```typescript
try {
  const results = await serpNode.execute('quantum computing');
} catch (error) {
  console.error('Search failed:', error.message);
  // Handle specific error types
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Wait and retry
  }
}
``` 