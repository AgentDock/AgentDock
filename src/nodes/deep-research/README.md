# Deep Research Tool

The Deep Research tool provides in-depth research capabilities with search and content extraction. It leverages Firecrawl for search and content retrieval, and uses the agentdock-core LLM for generating comprehensive research reports.

## Features

- **Web Search**: Performs web searches using Firecrawl to find relevant information
- **Content Extraction**: Extracts detailed content from the most relevant sources
- **Key Findings Extraction**: Identifies the most informative paragraphs from search results
- **Structured Report Generation**: Creates well-organized research reports with key findings and methodology
- **Source Tracking**: Maintains a list of all sources used in the research

## Parameters

- **query** (string, required): The research query to investigate
- **depth** (number, optional, default: 2): Depth of research (1-3)
  - 1: Basic search only
  - 2: Basic search + content extraction from top sources
  - 3: Basic search + more extensive content extraction
- **breadth** (number, optional, default: 5): Breadth of research (3-15)
  - Controls how many sources to explore and extract content from

## How It Works

1. **Initial Search**: Performs a web search using Firecrawl based on the query
2. **Source Extraction**: Extracts sources from the search results
3. **Deep Content Retrieval**: If depth > 1, retrieves detailed content from the top sources
4. **Key Findings Extraction**: Identifies the most informative paragraphs from all content
5. **Report Generation**: Formats the findings into a structured report with clear sections

## LLM Integration

The tool uses the agentdock-core LLM for enhancing the research report:

- **Improved Findings**: Uses LLM to generate more coherent and informative key findings
- **Context-Aware Analysis**: The LLM analyzes the content to extract the most relevant information
- **Fallback Mechanism**: If LLM generation fails, falls back to rule-based extraction

## Example Usage

```typescript
const result = await deepResearchTool.execute({
  query: "Latest advancements in quantum computing",
  depth: 2,
  breadth: 4
}, options);
```

## Implementation Details

- **KISS Principle**: Keeps the implementation simple and focused on core functionality
- **DRY Principle**: Avoids code duplication by using helper functions
- **First Principles**: Designed to be modular and extensible
- **Framework Agnostic**: Core functionality is independent of the UI framework

## Report Structure

The generated research report includes:

1. **Title**: Clear identification of the research topic
2. **Research Status**: Indication if the research is complete or needs further investigation
3. **Key Findings**: Concise list of the most important discoveries
4. **Detailed Findings**: Comprehensive list of all relevant information
5. **Research Methodology**: Description of the approach used, including depth and breadth
6. **Sources**: List of all sources referenced in the research

## Integration with Agent

The tool is designed to work well with agents that want to perform research:

1. The agent can call the tool with an initial query
2. The tool returns structured findings and sources
3. The agent can analyze the findings and decide on follow-up queries
4. The agent can make additional tool calls with refined queries

This approach allows for iterative, agent-driven research rather than trying to handle all recursion internally. 