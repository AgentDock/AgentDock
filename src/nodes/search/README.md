# Search Tool

The Search tool provides web search functionality for AI agents, allowing them to retrieve information from the internet.

## Overview

This tool uses the [Serper API](https://serper.dev/) to perform Google searches and return formatted results. It's designed to be used by AI agents to gather information about any topic.

## Configuration

To use this tool, you need to set up the following environment variable:

```
SERPER_API_KEY=your_api_key_here
```

You can get an API key by signing up at [Serper.dev](https://serper.dev/).

## Usage

The search tool accepts the following parameters:

- `query` (required): The search query to execute
- `limit` (optional): Maximum number of results to return (default: 5)

Example usage in an agent:

```typescript
const results = await agent.executeTool('search', {
  query: 'AgentDock framework',
  limit: 3,
});
```

## Implementation

The tool follows the standard AgentDock tool pattern:

1. `index.ts`: Main tool implementation
2. `components.ts`: Output formatting components
3. `utils.ts`: API integration and utility functions

## Features

- **Rich Result Types**: Supports organic results, featured snippets, and knowledge graph information
- **Error Handling**: Provides detailed error messages for different failure scenarios
- **Input Validation**: Validates search queries before making API calls
- **Robust Parsing**: Handles various response formats from the Serper API
- **Fallback Handling**: Provides helpful messages when no results are found

## Response Format

The tool returns search results formatted as markdown, including:

- Search query
- Featured snippets (if available)
- Knowledge graph information (if available)
- List of organic results with:
  - Title (as a link)
  - URL
  - Snippet/description

Example response:

```markdown
## Search Results for "AgentDock framework"

### Featured Snippet: What is AgentDock?

AgentDock is a framework for building and deploying AI agents with custom tools and capabilities.

### 1. [AgentDock: Build AI Agents with Ease](https://agentdock.ai)

AgentDock is a framework for building and deploying AI agents with custom tools and capabilities.

### 2. [Getting Started with AgentDock](https://docs.agentdock.ai/getting-started)

Learn how to create your first AI agent with AgentDock. This guide covers installation, configuration, and deployment.
```

## Error Handling

The tool provides detailed error messages for different scenarios:

1. **Configuration Errors**: When the API key is missing
2. **API Errors**: When the Serper API returns an error
3. **Empty Queries**: When the search query is empty
4. **No Results**: When no results are found for the query

Each error includes helpful information about how to resolve the issue.

## Dependencies

- `agentdock-core`: For logging and error handling
- `zod`: For parameter validation
