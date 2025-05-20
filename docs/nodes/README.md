# Node System

AgentDock is built around a powerful **node-based architecture** using `BaseNode` as the foundation for all functionality. This design allows for modular, extensible, and highly configurable systems. `BaseNode` supports various node categories, including core functionalities like LLM interaction (`AgentNode`) and callable tools, forming the basis for sophisticated agent behaviors.

**Looking Ahead: The Workflow Vision**

The underlying structure, with defined `input`/`output` ports and `MessageBus` integration, provides the core capabilities necessary to build complex workflow engines and chained execution patterns directly using the open-source library. While the reference client currently focuses on `AgentNode` orchestrating individual tool executions, the architecture is designed for much more.

We are actively developing a richer set of node types to unlock true workflow automation, including:

- **Event Nodes**: To trigger workflows from external sources or schedules.
- **Transform & AI Inference Nodes**: For powerful data manipulation and specialized AI tasks.
- **Connector & Action Nodes**: To seamlessly integrate with external services and databases.
- **Logic Nodes**: For sophisticated flow control like branching and looping.

These planned additions, detailed further in the [Workflow Nodes Roadmap](./../roadmap/workflow-nodes.md), will empower users to build complex, multi-step automations visually and programmatically, extending far beyond the current agent-tool interaction model.

AgentDock Pro aims to enhance this capability by providing advanced tooling, such as visual workflow builders and management interfaces, built upon this expanding core open-source node system.

## Core Node Types

While developers can create many types of custom nodes, AgentDock Core provides key foundational types:

### BaseNode

The `BaseNode` is the foundation of AgentDock's architecture, provided by **AgentDock Core**. It creates a consistent interface and core functionality for all node types:

- **Metadata Management**: Each node provides detailed, immutable `NodeMetadata` including:
  - `category`: 'core' or 'custom'
  - `label`: Display name
  - `description`: Functionality overview
  - `inputs`/`outputs`: Defined ports (see below)
  - `version`: Semantic version string
  - `compatibility`: Flags indicating core/pro/custom environment support
- **Port System**: Type-safe `inputs` and `outputs` defined using the `NodePort` interface:
  - `id`: Unique port identifier
  - `type`: Data type string
  - `label`: Display name
  - `schema`: Optional Zod schema for validation
  - `required`: Boolean flag
  - `defaultValue`: Optional default value
- **Validation Hooks**: Provides methods like `validateInput`, `validateOutput`, and `validateConnection` for ensuring data integrity and connection validity (subclasses can override).
- **Message Passing**: Integrates with a `MessageBus` (set via `setMessageBus`). Nodes can send messages (`sendMessage`) and register handlers (`addMessageHandler`, `removeMessageHandler`), enabling potential asynchronous coordination between nodes.
- **Lifecycle Management**: `initialize()` for setup, `execute()` for core logic, and `cleanup()` for resource disposal.
- **Serialization**: Includes a `toJSON()` method for converting the node's state (ID, type, config, metadata) to a JSON representation.

```typescript
// From AgentDock Core
export abstract class BaseNode<TConfig = unknown> {
  readonly id: string;
  abstract readonly type: string; // e.g., 'core.agent'
  protected config: TConfig; // Static configuration
  readonly metadata: NodeMetadata;

  // Core execution
  abstract execute(input: unknown): Promise<unknown>;

  // Lifecycle
  async initialize(): Promise<void>;
  async cleanup(): Promise<void>;

  // Validation
  validateInput(input: unknown): boolean;
  validateOutput(output: unknown): boolean;
  validateConnection(sourcePort: string, targetPort: string): boolean;

  // Messaging
  setMessageBus(messageBus: MessageBus): void;
  protected async sendMessage<T>(targetId: string, type: string, payload: T): Promise<string>;
  protected addMessageHandler<T>(type: string, handler: MessageHandler<T>): void;
  protected removeMessageHandler(type: string): void;

  // Serialization
  toJSON(): { id: string; type: string; config: TConfig; metadata: NodeMetadata };
}
```

### AgentNode

The `AgentNode` (`type: 'core.agent'`) is a specialized node in **AgentDock Core** orchestrating conversational AI interactions:

- **Configuration (`AgentNodeConfig`)**: Initialized with provider details, API keys (primary and fallback), LLM options, and the crucial `agentConfig` object containing the full agent definition (personality, nodes, orchestration rules).
- **LLM Integration**: Manages `CoreLLM` instances (primary and optional fallback), handling provider/model derivation logic via `createLLMInstance` if not explicitly configured.
- **Dynamic Tool Selection**: Determines available tools for each turn via `getAvailableTools`, consulting the `ToolRegistry` and the agent's `orchestration` rules via an injected `OrchestrationManager`.
- **Runtime Execution (`handleMessage`)**: Requires `AgentNodeHandleMessageOptions` including conversation `messages`, the `OrchestrationManager`, `sessionId`, and optional overrides for system prompts or LLM configuration.
- **Stream Delegation**: Sets up the LLM call (using `streamText` from the LLM service) and returns the `AgentDockStreamResult` (containing the stream and promises) immediately. _It delegates the consumption of the stream and handling of tool calls/results to the calling adapter/API route._
- **Error Handling**: Implements fallback mechanisms for LLM provider issues.

```typescript
// From AgentDock Core
export class AgentNode extends BaseNode<AgentNodeConfig> {
  readonly type = 'core.agent';

  // Main entry point for conversational turns
  async handleMessage(options: AgentNodeHandleMessageOptions): Promise<AgentDockStreamResult>;

  // Direct execution (less common for conversational flow)
  async execute(input: unknown): Promise<unknown>;

  // Retrieve token usage from the last interaction
  getLastTokenUsage(): LanguageModelUsage | null;
}
```

### Tools as Nodes

Tools in AgentDock are implemented as specialized node types, registered in the `NodeRegistry` with `isTool: true`:

- **Registration**: Registered like any other node but with additional tool-specific options (see `NodeRegistry` below).
- **Schema & Description**: Require a `parameters` (Zod schema) and `description` during registration, used for LLM interaction.
- **Consistent Interface**: Follow the same `BaseNode` pattern (`execute`, `initialize`, `cleanup`). The `NodeRegistry` can wrap them to fit the standard AI SDK `Tool` interface.
- **Dynamic Availability**: Availability during a conversation is managed by the `AgentNode` using the `ToolRegistry` and `OrchestrationManager`.

## Node Registration System

AgentDock uses registry systems to manage node and tool types:

### Node Registry

The `NodeRegistry` from **AgentDock Core** provides a central system for discovering and instantiating node types:

- **Type Management**: Registers `NodeRegistration` objects (containing `nodeClass`, `version`, `isTool`, `parameters`, `description`) mapped by a unique type string (e.g., `'core.agent'`).
- **Core vs. Custom**: Uses separate methods (`register` for 'core', `registerCustomNode` for 'custom') enforcing category constraints.
- **Instantiation (`create`)**: Creates node instances, performing version compatibility checks between the registered version and the node class's reported version.
- **Tool Definition Generation (`getToolDefinitions`)**: Generates an object mapping tool node types to AI SDK-compatible `Tool` objects, automatically wrapping the node's `execute` method.
- **Metadata Access (`getNodeMetadata`)**: Returns comprehensive metadata for all registered core and custom nodes.

### Tool Registry

The `ToolRegistry` from **AgentDock Core** manages the _runtime availability_ of tools for specific agent interactions:

- **Purpose**: Primarily used by `AgentNode` to determine which tools (identified by their node type strings) are available _for a given agent configuration_ during a specific turn.
- **Filtering (`getToolsForAgent`)**: Takes a list of node names (from agent config) and returns the corresponding tool objects registered globally.
- **Global Instance**: Typically accessed via a singleton pattern (`getToolRegistry()`).

## Custom Node Development

(This section primarily describes the pattern in the NextJS reference implementation, which uses a simplified tool definition format compared to the core `NodeRegistry` registration.)

In the **open source reference client implementation** (NextJS), custom tools are implemented slightly differently, often directly defining objects conforming to the Vercel AI SDK `Tool` interface:

### Implementation Pattern (Reference Client)

```typescript
// Example from the NextJS reference implementation (src/nodes/tools)
import { z } from 'zod';
import { Tool } from 'ai'; // Vercel AI SDK Tool type
// ... potentially import React components ...

const myToolSchema = z.object({
  /* ... */
});

export const myTool: Tool = {
  name: 'my_tool_id', // Matches the key in the tools object
  description: 'What this tool does',
  parameters: myToolSchema,
  execute: async (args) => {
    /* ... server-side logic ... */
  },
  // Optional: render function for UI display in NextJS client
  // render: (props) => <MyComponent {...props} />
};

// Exported for auto-registration via src/nodes/init.ts
export const tools = {
  my_tool_id: myTool,
};
```

_(Note: This reference implementation pattern bypasses direct registration with `agentdock-core`'s `NodeRegistry` for simpler tool definition, relying on its own loading mechanism.)_

### Security Best Practices

(These apply regardless of the implementation pattern)

- Keep API calls server-side within the tool's `execute` function.
- Use environment variables for secrets (API keys).
- Implement robust error handling.
- Consider rate limiting.

## Design Patterns

The node system implements several key design patterns:

1.  **Factory Pattern**: `NodeRegistry.create` acts as a factory for node instances.
2.  **Registry Pattern**: `NodeRegistry` and `ToolRegistry` manage node/tool types.
3.  **Observer Pattern (Potential)**: The `MessageBus` integration allows for observer-like patterns between nodes.
4.  **Strategy Pattern**: Different node implementations can represent different strategies for achieving a task.

## Node Lifecycle

Nodes go through a defined lifecycle managed by the system interacting with them (e.g., an agent runner or workflow engine):

1.  **Registration**: Node _type_ is registered with `NodeRegistry`.
2.  **Instantiation**: Node _instance_ is created via `NodeRegistry.create`.
3.  **Initialization**: Node's `initialize()` method is called (e.g., before first use).
4.  **Execution**: Node's `execute()` (or `handleMessage` for `AgentNode`) is called potentially multiple times.
5.  **Cleanup**: Node's `cleanup()` method is called when the instance is no longer needed.

## Node Relationships

Nodes can interact or be connected conceptually:

- **Message Passing**: Asynchronous communication via the `MessageBus` enables decoupled interactions, suitable for complex event-driven workflows.
- **Tool Invocation**: `AgentNode` invokes tool nodes based on LLM requests, orchestrated via `ToolRegistry` and `OrchestrationManager`.
- **Workflow Connections**: The `input`/`output` port system and `validateConnection` method provide the foundation for defining explicit data flow chains between diverse node types (Event, Transform, Action, Logic, etc.), enabling the construction of complex, automated processes and future visual workflow builders.

## Future Enhancements

The node system is designed to support future enhancements:

- **Rich Workflow Node Library**: Expanding the core library with robust implementations of Event, Transform, AI Inference, Connector, Action, and Logic nodes.
- **Visual Node Editor**: Leveraging `NodeMetadata` (ports, descriptions) for a UI to connect the full range of workflow nodes.
- **Node Versioning**: Core registry already supports versioning checks.
- **Node Marketplace**: Sharing custom node implementations.
- **Workflow Engine**: Building upon the message bus and port connections.

## Documentation and Examples

For detailed guidance:

- Review `agentdock-core` source code in `src/nodes/`.
- See `src/nodes/custom-tool-contributions.md` in the reference implementation for client-specific tool patterns.
- Examine existing tools in the reference implementation's `src/nodes/tools/` directory.
