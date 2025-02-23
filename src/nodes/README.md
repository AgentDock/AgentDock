# AgentDock Node System

The AgentDock framework uses a hybrid node system that combines robust core nodes with simple custom tools. This design provides the best of both worlds: powerful framework features and easy extensibility.

## Architecture Overview

### Core Nodes (agentdock-core)
Core nodes handle complex framework features and are implemented in `agentdock-core`:
- Full lifecycle management
- State handling
- Message routing
- Complex orchestration

```typescript
// Example core node (in agentdock-core)
export class ChatNode extends BaseNode<ChatConfig> {
  private messages: Message[] = [];
  
  async execute(input: Message): Promise<Message> {
    // Complex chat handling with state
  }
}
```

### Custom Tools (src/nodes)
Custom tools are simple, function-based implementations following Vercel AI SDK patterns:
- Stateless operations
- Direct execution
- Simple schema validation
- Easy to create and test

```typescript
// Example custom tool (in src/nodes)
export const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  parameters: z.object({
    input: z.string()
  }),
  async execute({ input }) {
    return { result: input.toUpperCase() };
  }
};
```

## Creating Custom Tools

1. Create a new directory in `src/nodes/your-tool-name/`
2. Define your tool interface and schema:
```typescript
import { z } from 'zod';
import { Tool } from '../types';

const toolSchema = z.object({
  // Your parameters here
});

export const myTool: Tool = {
  name: 'tool_name',
  description: 'Tool description',
  parameters: toolSchema,
  async execute(params) {
    // Your implementation here
  }
};

export const tools = {
  'tool_name': myTool
};
```

3. The tool will be automatically registered and available to agents that include it in their template.

## Example Implementation

See `src/nodes/stock-price/` for a complete example of a custom tool implementation:
- Clean interface definition
- Parameter validation
- Error handling
- Testing approach

## Best Practices

1. Core vs Custom:
   - Use core nodes for framework features
   - Use custom tools for specific functionalities
   - Don't mix concerns between the two

2. Tool Design:
   - Keep tools simple and focused
   - Use clear parameter schemas
   - Handle errors gracefully
   - Return structured results

3. Testing:
   - Write unit tests for your tools
   - Test parameter validation
   - Test error cases
   - Test expected outputs

## Integration with Templates

Tools are enabled via agent templates:

```json
{
  "modules": [
    "llm.anthropic",    // Core node
    "your_custom_tool"  // Custom tool
  ],
  "nodeConfigurations": {
    "your_custom_tool": {
      // Tool-specific config
    }
  }
}
```

## Type Safety

The system provides full TypeScript support:
- Parameter validation with Zod
- Result type inference
- Tool registry typing
- Template validation

## See Also
- [Stock Price Example](./examples/stock-price/README.md)
- [Core Node Documentation](../agentdock-core/src/nodes/README.md)
- [Template System](../templates/README.md) 