# Custom Tool Contributions Guide

This guide explains how to create and contribute custom tools to AgentDock. Tools are specialized nodes that can be used by AI agents to perform specific tasks.

## Core Concepts

- **Nodes**: Foundational building blocks of the system architecture
- **Tools**: Specialized nodes that can be used by AI agents
- **Component-Based Output**: Each tool formats its output using components

## Quick Start

1. Create a new folder in `src/nodes/` for your tool (e.g., `src/nodes/my-tool/`)
2. Implement your tool following the pattern below
3. Export your tool for auto-registration

```typescript
// index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { MyComponent } from './components';

// 1. Define parameters schema with zod
const myToolSchema = z.object({
  input: z.string().describe('What this input does')
});

// 2. Create and export your tool
export const myTool: Tool = {
  name: 'my_tool',
  description: 'What this tool does',
  parameters: myToolSchema,
  async execute({ input }, options) {
    // 3. Get your data
    const data = await fetchData(input);
    
    // 4. Use your component to format output
    return MyComponent(data);
  }
};

// 5. Export for auto-registration
export const tools = {
  my_tool: myTool
};
```

## Tool Implementation Details

### 1. Parameter Schema

Use Zod to define your tool's parameters with clear descriptions:

```typescript
// From search/index.ts
const searchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  limit: z.number().optional().default(8).describe('Maximum number of results to return')
});
```

### 2. Error Handling

Always implement proper error handling in your tools:

```typescript
// From search/index.ts
try {
  // Tool logic here...
} catch (error: unknown) {
  logger.error(LogCategory.NODE, '[Search]', 'Search execution error:', { error });
  
  // Return a formatted error message
  const errorMessage = error instanceof Error ? error.message : String(error);
  return createToolResult('search_error', formatErrorMessage('Error', errorMessage));
}
```

### 3. Component-Based Output

Create components to format your tool's output:

```typescript
// components.ts
import { formatBold, formatHeader, joinSections, createToolResult } from '@/lib/utils/markdown-utils';

export function MyComponent(props: MyComponentProps) {
  return createToolResult(
    'my_component',
    joinSections(
      formatHeader(`Results for "${props.query}"`),
      props.results.map(result => `${formatBold(result.title)}`).join('\n\n')
    )
  );
}
```

## Using LLM in Custom Tools

Tools can access the agent's LLM instance through the `options.llmContext` parameter:

```typescript
// Example from deep-research
async execute({ query }, options) {
  // Default content (fallback)
  let dynamicContent = "Default content based on the data";
  
  // Use LLM to generate dynamic content if available
  if (options.llmContext?.llm) {
    try {
      // Create messages for LLM
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates content based on data.'
        },
        {
          role: 'user',
          content: `Generate a summary of this data about "${query}": ${JSON.stringify(data)}`
        }
      ];
      
      // Use the agent's LLM instance
      const result = await options.llmContext.llm.generateText({ 
        messages,
        temperature: 0.3  // Lower temperature for more factual responses
      });
      
      dynamicContent = result.text;
    } catch (error) {
      // Fall back to default content
    }
  }
  
  return MyComponent({ query, dynamicContent });
}
```

### Best Practices for LLM Usage

1. **Always check availability**: Use `if (options.llmContext?.llm)` before using the LLM
2. **Implement fallbacks**: Have a non-LLM approach as backup
3. **Use try/catch blocks**: Handle errors gracefully
4. **Keep prompts focused**: Create clear, concise prompts
5. **Set appropriate temperature**: Lower for factual tasks, higher for creative ones

## API Access and Security

When implementing tools that access external APIs:

```typescript
// utils.ts
export async function fetchFromExternalAPI(params: APIParams): Promise<APIResponse> {
  // Use environment variables for API keys
  const apiKey = process.env.MY_API_KEY;
  
  // Make API calls server-side only
  const response = await fetch(`https://api.example.com/data?key=${apiKey}&param=${params.value}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
}
```

### Security Best Practices

- Make API calls server-side in the tool's execute function
- Store API keys in environment variables, never hardcode them
- Implement proper error handling for API failures
- Consider rate limiting for APIs with usage restrictions

## Real Examples from AgentDock

### Search Tool

```typescript
// search/index.ts
export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web for information on any topic',
  parameters: searchSchema,
  async execute({ query, limit = 5 }, options) {
    try {
      const results = await searchWeb(query, limit);
      return SearchResults({ query, results });
    } catch (error) {
      return createToolResult(
        'search_error',
        formatErrorMessage('Error', `Unable to search for "${query}": ${error.message}`)
      );
    }
  }
};
```

### Weather Tool

```typescript
// weather/index.ts
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Get weather forecast for any location worldwide',
  parameters: weatherSchema,
  async execute({ location }) {
    try {
      const coords = parseCoordinates(location);
      // Get coordinates or geocode the location
      // Get weather forecast from API
      // Format the response
      return Weather(weatherData);
    } catch (error) {
      return createToolResult(
        'weather_error',
        formatErrorMessage('Error', `Unable to get weather for "${location}": ${error.message}`)
      );
    }
  }
};
```

## Multi-Step Tool Sequences

AgentDock supports multi-step tool calls, allowing the AI to make multiple tool calls in sequence before returning a final response. This is particularly useful for complex tasks that require multiple steps to complete.

For example, the `deep_research` tool simulates a multi-step research process:

```typescript
// Example of a tool that would benefit from multi-step calls
export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic with multiple search iterations and summarization',
  parameters: deepResearchSchema,
  async execute({ query, depth = 1, breadth = 3 }, options) {
    // Step 1: Initial search
    // Step 2: Follow-up searches based on initial results
    // Step 3: Summarize findings
    // ...
  }
};
```

When creating tools that might be used in multi-step sequences:

1. Design your tools to be composable – each tool should do one thing well
2. Consider how your tool might be used in a sequence with other tools
3. Return clear, structured data that can be easily used by subsequent tool calls
4. Test your tools in multi-step scenarios to ensure they work as expected

The AgentDock framework automatically handles the multi-step tool call flow, allowing the AI to make up to 5 sequential tool calls by default. This can be configured through the agent configuration.

## Tool Registration

Tools are automatically registered in the registry:

```typescript
// registry.ts
import { tools as stockTools } from './stock-price';
import { tools as weatherTools } from './weather';
import { tools as searchTools } from './search';
// ...

// Combined tools registry
export const allTools: ToolRegistry = {
  ...stockTools,
  ...weatherTools,
  ...searchTools,
  // ...
};
```

## Contribution Process

1. **Fork** the repository on GitHub
2. **Create a new branch** in your fork
3. **Create a new folder** within `src/nodes/` for your custom tool
4. **Add implementation files**:
   - `index.ts` - Main tool implementation and exports
   - `components.ts` - UI components and rendering logic
   - `README.md` - Tool documentation (recommended)
5. **Commit** changes and **push** to your fork
6. **Open a pull request** to the main branch of `agentdock`

## Summary

This architecture ensures:
- Core framework stability
- Isolated custom tool contributions
- Simple, consistent tool implementation
- Component-based UI rendering
- Automatic registration through the NodeRegistry
- Secure handling of external API calls 