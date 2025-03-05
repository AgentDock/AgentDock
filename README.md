# AgentDock: Build Anything with AI Agents

AgentDock consists of two main components:

1. **AgentDock Core**: An open-source, backend-first framework for building and deploying sophisticated AI agents. It's designed to be framework-agnostic and provider-independent, giving you complete control over your agent's implementation.

2. **Next.js Implementation**: This repository includes a complete Next.js application that serves as a reference implementation and consumer of the AgentDock Core framework. You can see it in action at [https://hub.agentdock.ai](https://hub.agentdock.ai).

Built with TypeScript, AgentDock emphasizes simplicity, extensibility, and deterministic behavior.

## Core Architecture

The framework is built around a powerful node-based system:

- **Core Nodes**: Handle fundamental operations like conversation management and service interactions
- **Custom Nodes**: Extend functionality by creating your own nodes for any specific task
- **Node Registry**: Central system for managing and connecting nodes
- **Configuration**: Simple JSON-based agent definitions

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

- 🔌 **Framework Agnostic**: AgentDock Core works with any tech stack
- 🧩 **Modular Design**: Build complex systems from simple nodes
- 🛠️ **Extensible**: Create custom nodes for any functionality
- 🔒 **Secure**: Built-in security features for API keys and data
- 📦 **Self-Contained**: Core framework has minimal dependencies
- 🔄 **Multi-Step Tool Calls**: Support for complex reasoning chains
- 📊 **Structured Logging**: Detailed insights into agent execution
- 🛡️ **Robust Error Handling**: Predictable behavior and simplified debugging
- 📝 **TypeScript First**: Type safety and enhanced developer experience
- 🌐 **Reference Implementation**: Complete Next.js application included

## Getting Started

### Requirements

* Node.js ≥ 20.11.0 (LTS)
* pnpm ≥ 9.15.0 (Required)

### Installation

1. **Install pnpm:**

   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

2. **Install Dependencies:**

   ```bash
   pnpm install
   ```

3. **Start Development Server:**

   ```bash
   pnpm dev
   ```

4. **Create Your First Agent:**
   - Configure your agent in the `agents` directory
   - Add custom nodes for your specific needs
   - Deploy anywhere

## Core Components

AgentDock's modular architecture is built upon these key components:

* **Nodes:** The fundamental building blocks of agents. Each node performs a specific task.
* **Tools:** A specialized type of Node representing a function callable by an LLM.
* **LLM Adapter:** A thin abstraction layer for interacting with LLMs via the Vercel AI SDK.
* **Provider Registry:** Manages LLM provider configurations and API key resolution.
* **Node Registry:** Registers and retrieves Node instances, enabling extensibility.
* **Error Handling:** A robust system for handling errors and ensuring predictable behavior.
* **Logging:** A structured logging system for monitoring and debugging.

## Storage Abstraction (Coming Soon)

AgentDock Core will soon include a flexible storage abstraction layer that provides a consistent interface for data persistence:

* **Pluggable Storage Interface:** A clean, consistent interface that allows swapping storage implementations without changing application code.
* **Built-in Adapters:** Memory adapter for ephemeral storage, Secure adapter for encrypted storage, and SQLite adapter for simple file-based persistence.
* **Vector Storage:** Efficient vector storage and similarity search for building memory-enabled agents.

Example usage:

```typescript
// Get the default storage adapter
const storage = getAppStorage();

// Store a value with 1-hour TTL
await storage.set('user:preferences', userPrefs, { ttl: 3600 });

// Retrieve the value
const preferences = await storage.get('user:preferences');

// Store vector embeddings for semantic search
const memoryProvider = createMemoryProvider({
  type: 'sqlite-vector',
  options: { dimension: 1536 }
});

// Store and search by text with automatic embedding
await memoryProvider.storeText("User prefers dark mode", { source: "preferences" });
const results = await memoryProvider.searchText("What are the UI preferences?", { topK: 3 });
```

## Repository Structure

This repository contains:

1. **AgentDock Core**: The core framework located in `agentdock-core/`
2. **Next.js Implementation**: A complete reference implementation and consumer of the AgentDock Core framework
3. **Example Agents**: Ready-to-use agent configurations in the `agents/` directory

You can use AgentDock Core independently in your own applications, or use this repository as a starting point for building your own agent-powered applications.

## Future Possibilities

- Visual agent builders
- Natural language agent creation
- Advanced agent templates
- Enhanced execution systems
- Managed integrations

## Package Manager

This project *requires* the use of `pnpm` for consistent dependency management. `npm` and `yarn` are not supported.

## Contributing

We welcome contributions to AgentDock! Please see the `.agentdock/docs/` folder for detailed documentation, including guidelines for creating custom nodes.