# DeepResearchNode

The `DeepResearchNode` provides advanced research capabilities within the AgentDock framework by combining web search functionality with LLM-powered summarization.

## Overview

The `DeepResearchNode` is a core tool node that leverages both the `SerpNode` for web searches and an LLM provider for summarizing and extracting key insights from search results. This combination enables more comprehensive and contextual research capabilities than simple web searches alone.

## Configuration

The `DeepResearchNode` requires the following configuration parameters:

```typescript
{
  // The SERP provider to use (e.g., "firecrawl")
  serpProvider: string;
  
  // Configuration for the SERP provider
  serpConfig: {
    apiKey: string;
    // Other provider-specific options
  };
  
  // The LLM provider to use (e.g., "anthropic")
  llmProvider: string;
  
  // Configuration for the LLM provider
  llmConfig: {
    apiKey: string;
    // Other provider-specific options
  };
  
  // Optional: Maximum number of search results to process
  maxResults?: number; // Default: 10
  
  // Optional: Maximum depth for follow-up searches
  maxDepth?: number; // Default: 1, Max: 5
  
  // Optional: Whether to include source citations
  includeCitations?: boolean; // Default: true
  
  // Optional: Maximum number of retries for failed operations
  maxRetries?: number; // Default: 3, Max: 5
  
  // Optional: Retry delay in milliseconds
  retryDelay?: number; // Default: 1000
}
```

## Usage

### Basic Usage

```typescript
import { NodeRegistry } from '@agentdock/core';

// Create a DeepResearchNode instance
const researchNode = NodeRegistry.create('core.tool.deep-research', 'my-research-node', {
  serpProvider: 'firecrawl',
  serpConfig: {
    apiKey: process.env.FIRECRAWL_API_KEY
  },
  llmProvider: 'anthropic',
  llmConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  maxResults: 5,
  maxDepth: 1,
  includeCitations: true
});

// Initialize the node
await researchNode.initialize();

// Execute a research query
const results = await researchNode.execute('quantum computing advancements');

// Or with options
const resultsWithOptions = await researchNode.execute({
  query: 'quantum computing advancements',
  options: {
    maxResults: 10,
    maxDepth: 2,
    includeCitations: true
  }
});
```

### In Agent Templates

When using the `DeepResearchNode` in agent templates, reference it as `core.tool.deep-research`:

```json
{
  "tools": [
    {
      "id": "core.tool.deep-research",
      "config": {
        "serpProvider": "firecrawl",
        "serpConfig": {
          "apiKey": "${env.FIRECRAWL_API_KEY}"
        },
        "llmProvider": "anthropic",
        "llmConfig": {
          "apiKey": "${env.ANTHROPIC_API_KEY}"
        },
        "maxResults": 5,
        "maxDepth": 1
      }
    }
  ]
}
```

## Research Options

The `DeepResearchNode` supports the following research options:

| Option | Type | Description |
|--------|------|-------------|
| `maxResults` | number | Maximum number of search results to process |
| `maxDepth` | number | Maximum depth for follow-up searches (1-5) |
| `includeCitations` | boolean | Whether to include source citations in the output |
| `searchParams` | object | Additional parameters to pass to the SERP provider |
| `llmParams` | object | Additional parameters to pass to the LLM provider |

## Response Format

The `DeepResearchNode` returns research results in the following format:

```typescript
{
  // The original query
  query: string;
  
  // The summary of the research
  summary: string;
  
  // Key findings from the research
  keyFindings: string[];
  
  // Source citations
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
    date?: string;
  }>;
  
  // Metadata about the research
  metadata: {
    // The total number of sources processed
    totalSources: number;
    
    // The depth of the research
    depth: number;
    
    // The time taken to complete the research in milliseconds
    researchTime: number;
    
    // The providers used for the research
    providers: {
      serp: string;
      llm: string;
    };
  };
}
```

## Internal Architecture

The `DeepResearchNode` works by:

1. Initializing both a `SerpNode` and an LLM node based on the provided configuration
2. Executing search queries through the `SerpNode`
3. Processing search results to extract relevant information
4. Generating a comprehensive summary and key findings using the LLM
5. Compiling the results into a structured research report

## Error Handling

The `DeepResearchNode` handles various error scenarios:

- Initialization errors: Proper error messages for failed node creation
- Search errors: Retries with exponential backoff
- LLM errors: Graceful fallback to partial results when possible
- Network issues: Automatic retry logic with configurable parameters

## Performance Considerations

- **Result Limits**: Use the `maxResults` option to control processing time
- **Depth Control**: Higher depth values increase processing time significantly
- **LLM Costs**: Be aware that summarization involves LLM API calls, which may incur costs

## Examples

### Basic Research

```typescript
const results = await researchNode.execute('latest AI research papers');
console.log(results.summary); // Comprehensive summary
console.log(results.keyFindings); // Array of key findings
console.log(results.sources.length); // Number of sources
```

### Research with Options

```typescript
const results = await researchNode.execute({
  query: 'climate change solutions',
  options: {
    maxResults: 15,
    maxDepth: 2,
    includeCitations: true,
    searchParams: {
      timeframe: 'month'
    }
  }
});
```

### Error Handling

```typescript
try {
  const results = await researchNode.execute('quantum computing');
} catch (error) {
  console.error('Research failed:', error.message);
  // Handle specific error types
  if (error.code === 'NODE_EXECUTION') {
    // Handle execution errors
  }
}
```

## Integration with Other Nodes

The `DeepResearchNode` can be used in conjunction with other nodes in the AgentDock framework:

- **AgentNode**: Provide research capabilities to agents
- **ChatNode**: Enhance chat interactions with research-backed responses
- **Custom Nodes**: Extend with domain-specific research capabilities 