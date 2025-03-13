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
  async execute({ input }) {
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

### 5. Shared Markdown Utilities

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

### 6. API Access and Security

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
  async execute({ input }) {
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

### 7. Real Examples

#### Search Tool
```typescript
// search/index.ts
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';

export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web for information',
  parameters: searchSchema,
  async execute({ query, limit = 5 }) {
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

#### Stock Price Tool
```typescript
// stock-price/index.ts
import { createToolResult } from '@/lib/utils/markdown-utils';

export const stockPriceTool: Tool = {
  name: 'stock_price',
  description: 'Get stock price',
  parameters: stockPriceSchema,
  async execute({ symbol, currency = 'USD' }) {
    const data = await getStockPrice(symbol, currency);
    return StockPrice(data);  // Uses StockPrice component
  }
};

export const tools = { stock_price: stockPriceTool };

// stock-price/components.ts
import { formatBold, createToolResult } from '@/lib/utils/markdown-utils';

export function StockPrice(props: StockPriceProps) {
  return createToolResult(
    'stock_price',
    `📈 ${formatBold(props.symbol)} Stock Price\nPrice: ${formatCurrency(props.price, props.currency)}`
  );
}
```

#### Weather Tool (with API access)
```typescript
// weather/index.ts
import { formatErrorMessage, createToolResult } from '@/lib/utils/markdown-utils';

export const weatherTool: Tool = {
  name: 'weather',
  description: 'Get weather forecast',
  parameters: weatherSchema,
  async execute({ location }) {
    try {
      // 1. Parse or geocode the location
      const [lat, lon, name] = await getCoordinates(location);
      
      // 2. Get weather data (API call happens server-side)
      const forecast = await getWeatherForecast(lat, lon);
      
      // 3. Format with component
      return Weather({ location: name, forecast });
    } catch (error) {
      return createToolResult(
        'weather_error',
        formatErrorMessage('Error', `Unable to get weather for "${location}": ${error.message}`)
      );
    }
  }
};

// weather/components.ts
import { formatBold, formatHeader, formatSubheader, joinSections, createToolResult } from '@/lib/utils/markdown-utils';

export function Weather(props: WeatherProps) {
  const current = formatCurrentWeather(props.current);
  const forecast = formatForecast(props.forecast);
  
  return createToolResult(
    'weather_complete',
    joinSections(
      current,
      formatHeader('7-Day Forecast'),
      forecast,
      `Last updated: ${new Date().toLocaleString()}`
    )
  );
}
```

### 4. Multi-Step Tool Calls

AgentDock supports multi-step tool calls, allowing the AI to make multiple tool calls in sequence before returning a final response. This is particularly useful for complex tasks that require multiple steps to complete.

For example, the `deep_research` tool simulates a multi-step research process:

```typescript
// Example of a tool that would benefit from multi-step calls
export const deepResearchTool: Tool = {
  name: 'deep_research',
  description: 'Perform in-depth research on a topic with multiple search iterations and summarization',
  parameters: deepResearchSchema,
  async execute({ query, depth = 1, breadth = 3 }) {
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