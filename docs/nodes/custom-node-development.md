# Custom Node Development

This guide explains how to create custom nodes for AgentDock Core.

## Overview

AgentDock provides two main approaches to extending its capabilities through custom nodes:

1. **Core Extension**: Extending BaseNode from AgentDock Core (covered in this guide)
2. **Tool Implementation**: Creating tools in the open source reference implementation (see [Custom Tool Development](./custom-tool-development.md))

## Advanced Node Development

For extending the AgentDock Core directly:

### Extending BaseNode

```typescript
import { BaseNode, NodeMetadata, NodePort } from 'agentdock-core';
import { NodeCategory } from 'agentdock-core/types/node-category';

interface MyNodeConfig {
  parameter: string;
}

export class MyCustomNode extends BaseNode<MyNodeConfig> {
  readonly type = 'custom.myNode';
  
  constructor(id: string, config: MyNodeConfig) {
    super(id, config);
  }
  
  protected getCategory(): NodeCategory {
    return NodeCategory.CUSTOM;
  }
  
  protected getLabel(): string {
    return 'My Custom Node';
  }
  
  protected getDescription(): string {
    return 'Description of what my node does';
  }
  
  protected getVersion(): string {
    return '1.0.0';
  }
  
  protected getCompatibility() {
    return {
      core: true,
      pro: false,
      custom: true
    };
  }
  
  protected getInputs(): NodePort[] {
    return [
      {
        id: 'input',
        type: 'string',
        label: 'Input',
        required: true
      }
    ];
  }
  
  protected getOutputs(): NodePort[] {
    return [
      {
        id: 'output',
        type: 'string',
        label: 'Output'
      }
    ];
  }
  
  async execute(input: unknown): Promise<unknown> {
    // Implementation goes here
    return `Processed: ${input}`;
  }
}
```

### Registering Custom Nodes

```typescript
import { getNodeRegistry } from 'agentdock-core';
import { MyCustomNode } from './my-custom-node';

// Register your custom node
getNodeRegistry().registerNode(MyCustomNode);

// Create an instance
const myNode = getNodeRegistry().createNode('custom.myNode', 'instance-id', {
  parameter: 'value'
});
```

## Custom Tools

For developing tools that can be used by AI agents (which is a more common use case), please refer to the [Custom Tool Development](./custom-tool-development.md) guide, which covers:

- Tool implementation patterns
- Parameter schemas with Zod
- Error handling
- API access
- Component-based output formatting
- Complete examples