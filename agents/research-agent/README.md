# Research Agent

AI research assistant for information gathering and analysis.

## Description

This agent specializes in research tasks, helping users gather and analyze information from various sources.

## Features

- Advanced information gathering
- Web search capabilities
- Structured analysis and reporting

## Nodes

The agent uses the following nodes:
- llm.anthropic: Advanced language model for analysis
- tool.serp: Web search capabilities

## Configuration

See `template.json` for the full configuration.

## Research Capabilities

1. Information Gathering
   - Web search integration
   - Multiple source synthesis
   - Citation tracking

2. Analysis
   - Structured response format
   - Key point identification
   - Pattern recognition

3. Documentation
   - Citation management
   - Source verification
   - Fact-checking

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
 