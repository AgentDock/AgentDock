# AgentDock: Build Anything with AI Agents

AgentDock is an open-source, backend-first framework for building and deploying sophisticated AI agents. It's designed to be framework-agnostic and provider-independent, giving you complete control over your agent's implementation.

## Core Architecture

The framework is built around a powerful node-based system:

- **AgentNode**: The primary abstraction for agent functionality, encapsulating LLM interaction and tool integration
- **BaseNode**: The foundation for all nodes, providing core functionality and a consistent interface
- **Node Registry**: Central system for registering and retrieving all node types, including both regular nodes and tools
- **Tool Registry**: Focused abstraction for managing tool availability for agents, working with the Node Registry
- **Custom Tools**: Specialized nodes that can be called by LLMs to perform specific tasks
- **Configuration**: Simple JSON-based agent definitions
- **Orchestration Framework**: Dynamic control of agent behavior based on conversation context
- **Session Management**: Isolated state management for concurrent conversations

### Advanced Subsystems

#### Session Management

The [session management system](./sessions/README.md) provides isolation between concurrent conversations and maintains state across multiple requests. Key capabilities include:

- **Stateful Conversations**: Maintain conversation context and history
- **Tool Context Persistence**: Enable tools to store and access stateful information
- **Memory Efficiency**: Optimized storage with automatic cleanup
- **Single Source of Truth**: Consistent session state across components

For more details, see the [Session Management Overview](./sessions/session-overview.md).

#### Orchestration Framework

The [orchestration framework](./orchestration/README.md) enables dynamic control of agent behavior and tool availability based on conversation context:

- **Context-Aware Steps**: Transition between different modes based on conversation content
- **Dynamic Tool Availability**: Control which tools are available in different steps
- **Conditional Logic**: Activate steps based on message content or previous tool usage
- **Tool Sequences**: Define specific tool ordering for complex workflows

For more details, see the [Orchestration Framework Overview](./orchestration/orchestration-overview.md).

### Registry Relationship

The Node Registry and Tool Registry work together to provide a comprehensive system for managing nodes and tools:

- **Node Registry**: Handles the broader node ecosystem, including registration, creation, metadata, and versioning
- **Tool Registry**: Provides a focused interface specifically for making tools available to agents
- **Tools as Nodes**: Tools are registered in the Node Registry with the `isTool` flag set to `true`
- **Dual Purpose**: This architecture supports both the current OSS implementation and the future Pro implementation

## What You Can Build

1. **AI-Powered Applications**
   - Custom chatbots with any frontend
   - Command-line AI assistants
   - Automated data processing pipelines
   - Backend service integrations

2. **Integration Capabilities**
   - Any AI provider (OpenAI, Anthropic, etc.)
   - Any frontend framework
   - Any backend service
   - Custom data sources and APIs

3. **Automation Systems**
   - Data processing workflows
   - Document analysis pipelines
   - Automated reporting systems
   - Task automation agents

## Key Features

- 🔌 **Framework Agnostic**: Use with any tech stack
- 🧩 **Modular Design**: Build complex systems from simple nodes
- 🛠️ **Extensible**: Create custom nodes for any functionality
- 🔒 **Secure**: Built-in security features for API keys and data
- 📦 **Self-Contained**: Core framework has minimal dependencies
- 🔄 **Orchestration**: Control agent behavior dynamically
- 💾 **Session Management**: Support concurrent conversations

## Architecture Documentation

For more detailed documentation on specific architecture components:

| Component | Documentation |
|-----------|---------------|
| Agent Node | [Agent Node Architecture](./agent_node.md) |
| Error Handling | [Core Error Handling](./core-error-handling.md) |
| Provider Abstraction | [Provider-Agnostic API](./provider-agnostic-api.md) |
| Orchestration | [Orchestration Framework](./orchestration/README.md) |
| Sessions | [Session Management](./sessions/README.md) |

## Getting Started

1. Install the framework
2. Create your first agent configuration
3. Add custom nodes for your specific needs
4. Deploy anywhere

## Future Possibilities

- Visual agent builders
- Natural language agent creation
- Advanced agent templates
- Enhanced execution systems
- Managed integrations

AgentDock provides the foundation for building sophisticated AI agent systems while maintaining complete control over your implementation and infrastructure. 