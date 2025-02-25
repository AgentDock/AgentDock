# Custom Node Contributions Guide

This guide explains how custom node contributions are integrated into AgentDock without directly modifying the `agentdock-core` folder. This is a crucial aspect of our architecture that ensures stability and maintainability.

## Core Principles

### 1. No Direct Modification of `agentdock-core`

- Contributors creating custom nodes work **exclusively** within the `agentdock/src/nodes/` directory
- The `agentdock-core` directory remains untouched during custom node development
- This separation maintains core framework stability

### 2. Contribution Process (Pull Requests)

Contributors should follow these steps when adding a custom node:

1. **Fork** the `agentdock` repository on GitHub
2. **Create a new branch** in their fork
3. **Create a new folder** within `agentdock/src/nodes/` for their custom node
   - Example: `agentdock/src/nodes/my-awesome-node/`
4. **Add implementation files**:
   - `index.ts` - Main node implementation and exports
   - `components.ts` - UI components and rendering logic (if needed)
   - `types.ts` - TypeScript interfaces and type definitions
   - `utils.ts` - Helper functions and utilities
   - `README.md` - Node documentation
5. **Update** `agentdock/src/nodes/index.ts` to register their node
6. **Commit** changes and **push** to their fork
7. **Open a pull request** to the main branch of `agentdock`

### 3. `agentdock-core` as a Local Package

- `agentdock-core` functions as a local package with its own:
  - `package.json`
  - `tsconfig.json`
- Components are imported using package-style imports:
  ```typescript
  import { AgentNode } from 'agentdock-core';
  ```
- Core changes follow a separate development and release process

### 4. Integration Point: `src/nodes/index.ts`

This file serves as the central registration point for custom nodes:

```typescript
// src/nodes/index.ts
import { NodeRegistry } from 'agentdock-core';

// Import custom nodes
import { weatherTool } from './weather';
import { stockPriceTool } from './stock-price';

export const tools = {
  weather: weatherTool,
  stock_price: stockPriceTool,
};
```

## Best Practices for Custom Node Implementation

Based on our experience with the weather node and other tools, here are key recommendations:

### 1. Modular File Structure

Organize your node implementation across multiple files for better maintainability:

```
/nodes/my-tool/
  ├── index.ts       # Main implementation and exports
  ├── components.ts  # UI/rendering components
  ├── types.ts       # Type definitions
  └── utils.ts       # Helper functions
```

### 2. Clear Type Definitions

Define explicit interfaces for all API responses and tool parameters:

```typescript
// types.ts
export interface MyApiResponse {
  data: {
    result: string;
    timestamp: number;
  };
}

export interface MyToolParams {
  query: string;
  options?: {
    limit?: number;
    filter?: string;
  };
}
```

### 3. API Request Handling

When making external API requests:

```typescript
// utils.ts
export async function fetchWithErrorHandling<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store', // Important for Edge runtime
      next: { revalidate: 0 } // Disable caching in Edge runtime
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    console.error('Fetch error:', error);
    throw new Error(`Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### 4. Edge Runtime Compatibility

For tools that need to work in the Edge runtime environment:

```typescript
// In Next.js API routes (app/api/tools/my-tool/route.ts)
export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Implementation...
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
```

### 5. Absolute URL Construction

Always use absolute URLs for API endpoints, especially in Edge environments:

```typescript
// In your tool's execute function
const url = new URL('/api/tools/my-tool', 
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://your-production-domain.com');

url.searchParams.set('param1', value1);
```

### 6. Well-Structured Response Format

Format your tool's output to match the expected format:

```typescript
// index.ts
return {
  type: 'tool_result',
  content: markdownContent, // String in markdown format
  metadata: {
    data: processedData,
    timestamp: new Date().toISOString()
  }
};
```

## Testing Custom Nodes

We recommend thorough testing of your node implementation:

1. **Local Testing**: Test your node with a local development server
2. **Edge Testing**: Verify functionality in the Edge runtime environment
3. **Production Testing**: Verify correct behavior when deployed to production
4. **Error Handling**: Test various error scenarios and ensure proper error messages

## Summary

- Custom node contributions **never** modify `agentdock-core` directly
- Development occurs exclusively in `agentdock/src/nodes/`
- Follow modular file structure and best practices for API interactions
- Ensure Edge runtime compatibility for production environments
- Thoroughly test all functionality in different environments
- Use proper error handling and logging

This architecture ensures:
- Core framework stability
- Isolated custom node contributions
- Proper review process
- Controlled functionality extension 