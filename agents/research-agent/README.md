# Research Assistant Agent

An AI research assistant powered by Claude 3 Sonnet, designed to help users with research tasks, analysis, and information gathering.

## Features

- Powered by Claude 3 Sonnet for efficient research
- Advanced research capabilities with DeepResearchNode
- Web search integration via SERP API with LLM-powered summarization
- Structured response format with citations and key findings
- Extended chat history for research context

## Configuration

The agent uses the following modules:
- `llm.anthropic`: Claude 3 Sonnet model for text generation
- `core.tool.deep-research`: Advanced research capabilities combining web search with LLM summarization

### Model Settings
- Model: claude-3-sonnet-20240229
- Temperature: 0.7 (balanced accuracy and exploration)
- Max Tokens: 4096 (suitable for detailed research responses)

### Deep Research Settings
- SERP Provider: Firecrawl
- LLM Provider: Anthropic
- Max Results: 5 (configurable)
- Max Depth: 1 (configurable)
- Citations: Enabled by default

### Chat Settings
- History Policy: lastN (maintains research context)
- History Length: 100 messages (extended for research sessions)
- Research-focused initial greeting

## Research Capabilities

1. Information Gathering
   - Web search integration
   - Multiple source synthesis
   - Citation tracking
   - Automatic summarization

2. Analysis
   - Structured response format
   - Key finding extraction
   - Pattern recognition
   - Cross-source analysis

3. Documentation
   - Citation management
   - Source verification
   - Fact-checking
   - Comprehensive summaries

## Usage Example

```typescript
const agent = new AgentNode('research', config);
await agent.initialize();

const response = await agent.execute('Research the latest developments in quantum computing.');
console.log(response);
```

## Best Practices

1. Research Tasks
   - Be specific with research questions
   - Provide context when needed
   - Ask for citations when important

2. Source Management
   - Configure SERP API key
   - Verify source reliability
   - Cross-reference important findings

3. Response Format
   - Request structured formats when needed
   - Ask for summaries of long research
   - Use follow-up questions for clarity 
 