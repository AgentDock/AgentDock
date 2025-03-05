# Custom Tools for AgentDock

This directory contains custom tool implementations for AgentDock. These tools follow the Vercel AI SDK pattern and are automatically registered with the NodeRegistry.

## Architecture

In AgentDock, **nodes** are the foundational building blocks of the system architecture, while **tools** are a specialized type of node that can be used by AI agents. The custom tools in this directory are implemented as nodes that follow the Vercel AI SDK pattern.

The custom tools system follows these principles:

1. **Simplified Architecture**: Tools are implemented as nodes within the `src/nodes/` directory.
2. **Component-Based Output**: Each tool has components that format its output.
3. **Auto-Registration**: Tools are automatically registered with the NodeRegistry.
4. **Server-Side Execution**: All tool logic runs on the server, including API calls.
5. **Multi-Step Tool Calls**: Tools can be called in sequence by the AI.

## Architecture Principles

### 1. Simplified Architecture
- Custom tools follow the Vercel AI SDK pattern
- Each tool is self-contained in its own directory
- Tools are automatically registered at runtime

### 2. Component-Based Output
- Each tool provides its own UI components for rendering results
- Components are exported from the tool's directory
- This ensures consistent rendering across the application

### 3. Auto-Registration
- Tools are automatically registered when imported
- No manual registration is required
- This simplifies the development process

### 4. Server-Side Execution
- Tools are executed on the server side
- Results are streamed to the client
- This ensures security and performance

### 5. Multi-Step Tool Calls
- Tools can be called in sequence by the AI
- The framework supports up to 5 sequential tool calls by default
- This enables complex workflows and reasoning chains
- Particularly useful for research, analysis, and multi-stage tasks

## Implementation Pattern

Each tool follows a consistent pattern:

```typescript
// index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { MyComponent } from './components';

// 1. Define parameters schema
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

## Available Tools

- **Search**: Search the web for information
- **Deep Research**: Perform in-depth research with multiple search iterations
- **Stock Price**: Get current stock price information
- **Weather**: Get weather forecast for any location

## Contributing

For detailed information on how to contribute custom tools, please refer to the [Custom Tool Contributions Guide](./custom-tool-contributions.md).

The guide covers:
- Core principles
- Contribution process
- Tool implementation pattern
- Component-based architecture
- API access and security
- Best practices
- Real examples 