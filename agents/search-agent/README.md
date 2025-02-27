# Search Agent

A simple search agent that uses the Firecrawl API to perform web searches.

## Features

- Web search capability via Firecrawl API
- Caching of search results to improve performance
- Automatic retry on failures
- Powered by Claude 3 Sonnet for natural language understanding

## Configuration

### Required Environment Variables

- `FIRECRAWL_API_KEY`: Your Firecrawl API key

### Model Settings

- Model: claude-3-7-sonnet-20250219
- Temperature: 0.7
- Max Tokens: 4096

### Search Settings

- Cache enabled with 1-hour TTL
- 3 retry attempts with exponential backoff
- 10-second timeout for search requests

## Usage

This agent is designed for simple web searches. You can ask it questions like:

- "What is the current weather in New York?"
- "Find information about quantum computing"
- "Search for the latest news about artificial intelligence"
- "What are the best restaurants in San Francisco?"

The agent will use the Firecrawl API to search the web and return relevant results.

## Example Prompts

- "Search for the latest developments in renewable energy"
- "Find information about the health benefits of meditation"
- "What are the top tourist attractions in Tokyo?"
- "Search for recipes for vegetarian lasagna"

## Notes

- This agent uses a simple search approach without deep research capabilities
- Search results are presented with source citations
- The agent will automatically retry failed searches up to 3 times 