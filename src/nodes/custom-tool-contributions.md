# Custom Tool Contributions Guide

This guide explains how custom tool contributions are integrated into AgentDock. This is a crucial aspect of our architecture that ensures stability and maintainability.

## Understanding Nodes and Tools

In AgentDock:
- **Nodes** are the foundational building blocks of the system architecture
- **Tools** are a specialized type of node that can be used by AI agents
- The tools in this directory are implemented as nodes that follow the Vercel AI SDK pattern

## Core Principles

### 1. Simplified Architecture

- Contributors creating custom tools work **exclusively** within the `src/nodes/` directory
- Each tool follows the Vercel AI SDK pattern
- This approach maintains core framework stability and simplifies the codebase

### 2. Contribution Process (Pull Requests)

Contributors should follow these steps when adding a custom tool:

1. **Fork** the repository on GitHub
2. **Create a new branch** in their fork
3. **Create a new folder** within `src/nodes/` for their custom tool
   - Example: `src/nodes/my-awesome-tool/`
4. **Add implementation files**:
   - `index.ts` - Main tool implementation and exports
   - `components.ts` - UI components and rendering logic (required)
   - `README.md` - Tool documentation (recommended)
5. **Commit** changes and **push** to their fork
6. **Open a pull request** to the main branch of `agentdock`

### 3. Tool Implementation

Each custom tool should follow this simple pattern:

```typescript
// index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { MyComponent } from './components';

// 1. Define your parameters schema
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

### 4. Component-Based Architecture

Each tool MUST have components that format its output:

```typescript
// components.ts
import { formatBold, formatHeader, joinSections, createToolResult } from '@/lib/utils/markdown-utils';

export interface MyComponentProps {
  result: string;
  timestamp: string;
}

export function MyComponent(props: MyComponentProps) {
  return createToolResult(
    'my_component',
    joinSections(
      formatHeader('Result'),
      `${formatBold('Value')}: ${props.result}`,
      `Last Updated: ${new Date(props.timestamp).toLocaleString()}`
    )
  );
}
```

### 5. Using LLM in Custom Tools

Tools can access the agent's LLM instance through the `options.llmContext` parameter. This allows tools to generate dynamic content or process data using the same LLM that powers the agent.

```typescript
// Example of using LLM in a custom tool
import { CoreMessage } from 'ai';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'A tool that uses LLM for dynamic content generation',
  parameters: myToolSchema,
  async execute({ input }, options) {
    // Get your data
    const data = await fetchData(input);
    
    // Use LLM to generate dynamic content if available
    let dynamicContent = "Default content";
    
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
            content: `Generate a summary of this data: ${JSON.stringify(data)}`
          }
        ];
        
        // Use the agent's LLM instance
        const result = await options.llmContext.llm.generateText({ messages });
        
        // Use the generated text
        dynamicContent = result.text;
        
      } catch (error) {
        // Handle errors gracefully
        console.error('Error using LLM:', error);
        // Continue with default content
      }
    }
    
    // Use your component to format output with dynamic content
    return MyComponent({
      result: data.result,
      dynamicContent,
      timestamp: data.timestamp
    });
  }
};
```

Key points for using LLM in tools:

1. **Always check if LLM is available**: Use `if (options.llmContext?.llm)` to check if the LLM instance is available before attempting to use it.
2. **Implement fallbacks**: Always have a fallback mechanism in case the LLM is not available or encounters an error.
3. **Use proper error handling**: Wrap LLM calls in try/catch blocks to handle errors gracefully.
4. **Keep messages focused**: Create clear system and user messages that focus on the specific task.
5. **Use the result wisely**: Process the LLM result to extract the information you need.
6. **Respect rate limits**: Be mindful of LLM usage to avoid excessive API calls.

### 6. Shared Markdown Utilities

AgentDock provides shared markdown utilities to ensure consistent formatting across all tools. These utilities are available in `src/lib/utils/markdown-utils.ts` and should be used for all markdown formatting:

```typescript
// Example of using shared markdown utilities
import { 
  formatBold, 
  formatHeader, 
  formatLink, 
  joinSections, 
  createToolResult 
} from '@/lib/utils/markdown-utils';

export function MyComponent(props: MyComponentProps) {
  // Format a header
  const header = formatHeader(`Results for "${props.query}"`);
  
  // Format items with consistent styling
  const items = props.results.map((result, index) => {
    return `${formatBold(`${index + 1}.`)} ${result.title} - ${formatLink('Source', result.url)}`;
  }).join('\n\n');
  
  // Join sections with proper spacing
  return createToolResult(
    'my_component',
    joinSections(header, items)
  );
}
```

Available markdown utilities include:
- `cleanText(text)` - Clean text by removing excessive newlines, markdown formatting, and HTML tags
- `cleanUrl(url)` - Clean a URL by removing tracking parameters
- `formatHeader(text, level)` - Format a header with consistent styling
- `formatSubheader(text)` - Format a subheader with consistent styling
- `formatBold(text)` - Format text as bold
- `formatItalic(text)` - Format text as italic
- `formatLink(text, url)` - Format a link with proper markdown
- `formatListItem(text, index, ordered)` - Format a list item with proper indentation
- `formatErrorMessage(type, message, details)` - Format an error message with consistent styling
- `createToolResult(type, content)` - Create a standard tool result object
- `joinSections(...sections)` - Join multiple sections with proper spacing

### 7. API Access and Security

When implementing tools that access external APIs, follow these best practices:

```typescript
// utils.ts - Encapsulate API access in utility functions
export async function fetchFromExternalAPI(params: APIParams): Promise<APIResponse> {
  // 1. All API calls should be made server-side (in the execute function)
  // 2. Never expose API calls directly to the client/browser
  
  // For APIs requiring authentication:
  const apiKey = process.env.MY_API_KEY; // Use environment variables
  
  const response = await fetch(`https://api.example.com/data?key=${apiKey}&param=${params.value}`);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
}

// index.ts - Use the utility function in your tool
export const myTool: Tool = {
  // ...
  async execute({ input }, options) {
    // API calls happen here on the server, not in the browser
    const data = await fetchFromExternalAPI({ value: input });
    return MyComponent(data);
  }
};
```

Key security principles:
- API calls should always be made server-side in the tool's execute function
- Store API keys in environment variables, never hardcode them
- Encapsulate API access logic in utility functions for reusability
- Implement proper error handling for API failures
- Consider implementing rate limiting for APIs with usage restrictions

### 8. Real Examples

#### Search Tool
```typescript
// search/index.ts
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';

export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web for information',
  parameters: searchSchema,
  async execute({ query, limit = 5 }, options) {
    try {
      const results = await performSearch(query, limit);
      return SearchResults({ query, results });  // Uses SearchResults component
    } catch (error) {
      return createToolResult(
        'search_error',
        formatErrorMessage('Error', `Unable to search for "${query}": ${error.message}`)
      );
    }
  }
};

export const tools = { search: searchTool };

// search/components.ts
import { formatBold, formatHeader, formatLink, joinSections, createToolResult } from '@/lib/utils/markdown-utils';

export function SearchResults(props: SearchResultsProps) {
  const resultsMarkdown = props.results.map((result, index) => {
    return `${formatBold(`${index + 1}.`)} ${formatBold(result.title)} - ${formatLink('Source', result.url)}\n${result.snippet}`;
  }).join('\n\n');
  
  return createToolResult(
    'search_results',
    joinSections(formatHeader(`Search Results for "${props.query}"`), resultsMarkdown)
  );
}
```

#### Deep Research Tool with LLM
```typescript
// deep-research/index.ts
import { CoreMessage } from 'ai';

export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic',
  parameters: deepResearchSchema,
  async execute({ query, depth = 2, breadth = 3 }, options) {
    // Perform research and gather data
    const searchResult = await performSearch(query, breadth);
    const findings = extractKeyFindings(searchResult);
    
    // Format the research data with LLM-generated headings
    const summary = await formatResearchData(query, findings, options);
    
    // Return the formatted report
    return DeepResearchReport({ query, summary, sources });
  }
};

// Helper function using LLM for dynamic content
async function formatResearchData(query, findings, options) {
  // Default headings
  let headings = {
    keyFindings: "## Key Findings",
    detailedFindings: "## Detailed Findings"
  };
  
  // Use LLM to generate emoji headings if available
  if (options.llmContext?.llm) {
    try {
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content: 'Generate emoji-enhanced headings for a research report.'
        },
        {
          role: 'user',
          content: `Add relevant emojis to these headings for a report on "${query}": Key Findings, Detailed Findings`
        }
      ];
      
      const result = await options.llmContext.llm.generateText({ messages });
      
      // Parse the result to extract emoji headings
      const lines = result.text.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length >= 2) {
        headings = {
          keyFindings: lines[0].includes('Key Findings') ? lines[0] : headings.keyFindings,
          detailedFindings: lines[1].includes('Detailed Findings') ? lines[1] : headings.detailedFindings
        };
      }
    } catch (error) {
      // Continue with default headings on error
    }
  }
  
  // Format the report with the headings
  return `# Research Report: "${query}"\n\n${headings.keyFindings}\n\n${findings.map(f => `- ${f}`).join('\n')}\n\n${headings.detailedFindings}\n\n...`;
}
```

### 9. Multi-Step Tool Calls

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

1. Design your tools to be composable - each tool should do one thing well
2. Consider how your tool might be used in a sequence with other tools
3. Return clear, structured data that can be easily used by subsequent tool calls
4. Test your tools in multi-step scenarios to ensure they work as expected

The AgentDock framework automatically handles the multi-step tool call flow, allowing the AI to make up to 5 sequential tool calls by default. This can be configured through the agent configuration.

## Best Practices

### 1. Keep It Simple
- One tool per directory
- Clear parameter schemas
- Component-based output formatting
- Export tools object for auto-registration

### 2. Type Safety
- Use zod for parameters
- Define clear interfaces
- Export types when needed

### 3. Error Handling
- Format errors as markdown
- Include helpful messages
- Log for debugging

### 4. API Security
- Make API calls server-side only
- Use environment variables for API keys
- Encapsulate API logic in utility functions
- Implement proper error handling
- Consider rate limiting for APIs with usage restrictions

### 5. Testing
- Test components independently
- Verify markdown formatting
- Check error cases
- Mock API responses for testing

## Summary

This architecture ensures:
- Core framework stability
- Isolated custom tool contributions
- Proper review process through GitHub
- Simple, consistent tool implementation
- Component-based UI rendering
- Automatic registration through the NodeRegistry
- Secure handling of external API calls 