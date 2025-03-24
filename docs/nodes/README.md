# Node System

AgentDock is built around a powerful **node-based architecture** that provides the foundation for all agent functionality. This design makes the system modular, extensible, and highly configurable.

## Core Node Types

### BaseNode

The `BaseNode` is the foundation of AgentDock's architecture, provided by **AgentDock Core**. It creates a consistent interface and core functionality for all node types:

- **Metadata Management**: Each node provides detailed metadata about its inputs, outputs, and capabilities
- **Message Passing**: Built-in system for inter-node communication
- **Port System**: Type-safe inputs and outputs for connecting nodes
- **Lifecycle Management**: Initialization, execution, and cleanup phases

```typescript
// From AgentDock Core
export abstract class BaseNode<TConfig = unknown> {
  readonly id: string;
  abstract readonly type: string;
  protected config: TConfig;
  readonly metadata: NodeMetadata;
  
  abstract execute(input: unknown): Promise<unknown>;
  async initialize(): Promise<void>;
  async cleanup(): Promise<void>;
}
```

### AgentNode

The `AgentNode` is a specialized node type in **AgentDock Core** that provides a clean abstraction for AI agent functionality:

- **LLM Integration**: Direct connection to language model providers
- **Tool Calling**: Support for agent-tool interaction
- **Orchestration**: Dynamic control of agent behavior and tool availability
- **Error Handling**: Robust error management with fallback mechanisms

```typescript
// From AgentDock Core
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';
  
  async handleMessage(options: AgentNodeOptions): Promise<any>;
  async execute(input: unknown): Promise<unknown>;
  getLastTokenUsage(): TokenUsage | null;
}
```

### Tools as Nodes

Tools in AgentDock are implemented as specialized node types:

- **Tool Registry**: Central system for registering and retrieving tools
- **Consistent Interface**: Tools follow the same node patterns as other components
- **Dynamic Availability**: Tools can be dynamically enabled/disabled based on context
- **Stateful Processing**: Tools can maintain state across calls within a session

## Node Registration System

AgentDock uses a registry system to manage all node types:

### Node Registry

The `NodeRegistry` from **AgentDock Core** provides a central system for registering and retrieving node types:

- **Type Management**: Register and retrieve node types by unique identifiers
- **Metadata Access**: Get information about node capabilities without instantiation
- **Factory Pattern**: Create node instances with proper configuration

### Tool Registry

The `ToolRegistry` from **AgentDock Core** is a specialized version of the node registry focused on tools:

- **Tool Filtering**: Get available tools for specific agents
- **Tool Configuration**: Configure tools for different agents
- **Dynamic Availability**: Control which tools are available in different contexts

## Custom Node Development

In the **open source reference client implementation** (NextJS), custom tools are implemented as nodes following the Vercel AI SDK pattern:

### Implementation Pattern

Each custom tool follows a consistent pattern:

```typescript
// From the NextJS reference implementation
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

### Component-Based Output

In the NextJS implementation, tools use component-based output:

- Each tool provides UI components for rendering results
- Components ensure consistent presentation across the application
- Results can include rich formatting and interactive elements

### Auto-Registration

Tools in the reference implementation are automatically registered:

- Tools are registered when imported by `src/nodes/init.ts`
- No manual registration code is required
- This simplifies the development process

### Security Best Practices

When implementing custom nodes, follow these security practices:

- Make API calls server-side in the tool's execute function
- Store API keys in environment variables, never hardcode them
- Implement proper error handling for API failures
- Consider rate limiting for APIs with usage restrictions

## Design Patterns

The node system implements several key design patterns:

1. **Factory Pattern**: Nodes are created through factory methods that ensure proper configuration
2. **Registry Pattern**: Central registries manage node and tool types
3. **Observer Pattern**: Message passing system for inter-node communication
4. **Strategy Pattern**: Different node implementations for different strategies

## Node Lifecycle

Nodes go through a defined lifecycle:

1. **Registration**: Node type is registered with the NodeRegistry
2. **Instantiation**: Node instance is created with a unique ID and configuration
3. **Initialization**: Node's `initialize()` method is called
4. **Execution**: Node's `execute()` method is called multiple times
5. **Cleanup**: Node's `cleanup()` method is called when done

## Node Relationships

Nodes can be connected in various ways:

- **Message Passing**: Nodes communicate through the message bus
- **Direct Calling**: One node directly calls another's methods
- **Port Connections**: Outputs from one node connect to inputs of another

## Future Enhancements

The node system is designed to support future enhancements:

- **Visual Node Editor**: Drag-and-drop interface for node configuration
- **Node Versioning**: Support for multiple versions of the same node
- **Node Marketplace**: Community sharing of custom node implementations
- **Hot-swapping**: Runtime replacement of node implementations

## Documentation and Examples

For detailed guidance on creating custom nodes:

- See `src/nodes/custom-tool-contributions.md` in the reference implementation
- Examine existing custom tools in the `src/nodes/` directory
- Review the AgentDock Core documentation for base node interfaces 