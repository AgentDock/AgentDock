# AgentDock: Build Anything with AI Agents

AgentDock consists of two main components:

1. **AgentDock Core**: An open-source, backend-first framework for building and deploying sophisticated AI agents. It's designed to be framework-agnostic and provider-independent, giving you complete control over your agent's implementation.

2. **Next.js Implementation**: This repository includes a complete Next.js application that serves as a reference implementation and consumer of the AgentDock Core framework. You can see it in action at [https://hub.agentdock.ai](https://hub.agentdock.ai).

Built with TypeScript, AgentDock emphasizes simplicity, extensibility, and deterministic behavior.

## 🧠 Design Principles

AgentDock is built on these core principles:

- **Simplicity First**: Minimal code required to create functional agents
- **Node-Based Architecture**: All capabilities implemented as nodes
- **Tools as Specialized Nodes**: Tools extend the node system for agent capabilities
- **Configurable Determinism**: Control the predictability of agent behavior
- **Type Safety**: Comprehensive TypeScript types throughout

### Configurable Determinism

AgentDock balances deterministic and non-deterministic elements:
- AgentNodes are inherently non-deterministic as LLMs may generate different responses each time
- Workflows can be made more deterministic through defined tool execution paths
- Developers can control the level of determinism by configuring which parts of the system use LLM inference
- Even with LLM components, the overall system behavior remains predictable through structured tool interactions

## 🏗️ Core Architecture

The framework is built around a powerful node-based system:

- **BaseNode**: Foundation for all nodes, providing core functionality
- **AgentNode**: Specialized node for LLM-powered agents
- **Tools as Nodes**: Custom capabilities implemented as specialized nodes
- **Node Registry**: Central system for managing and connecting nodes

This architecture provides a consistent foundation for all capabilities while enabling extensibility through specialized node types.

For detailed documentation on AgentDock Core's architecture, design philosophy, and contribution guidelines, see [agentdock-core/README.md](agentdock-core/README.md).

## 💡 What You Can Build

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

## ✨ Key Features

- 🔌 **Framework Agnostic**: AgentDock Core works with any tech stack
- 🧩 **Modular Design**: Build complex systems from simple nodes
- 🛠️ **Extensible**: Create custom nodes for any functionality
- 🔒 **Secure**: Built-in security features for API keys and data
- 🔑 **BYOK (Bring Your Own Key)**: Use your own API keys for LLM providers
- 📦 **Self-Contained**: Core framework has minimal dependencies
- 🔄 **Multi-Step Tool Calls**: Support for complex reasoning chains
- 📊 **Structured Logging**: Detailed insights into agent execution
- 🛡️ **Robust Error Handling**: Predictable behavior and simplified debugging
- 📝 **TypeScript First**: Type safety and enhanced developer experience
- 🌐 **Reference Implementation**: Complete Next.js application included

## 🧰 Components

AgentDock's modular architecture is built upon these key components:

* **BaseNode**: The foundation for all nodes in the system
* **AgentNode**: The primary abstraction for agent functionality
* **Tools**: Functions callable by an LLM through the AgentNode
* **Node Registry**: Manages the registration and retrieval of all node types
* **Tool Registry**: Manages tool availability for agents
* **LLM Adapter**: Abstraction layer for interacting with LLMs
* **Provider Registry**: Manages LLM provider configurations
* **Error Handling**: System for handling errors and ensuring predictable behavior
* **Logging**: Structured logging system for monitoring and debugging

For detailed technical documentation on these components, see the [agentdock-core/README.md](agentdock-core/README.md).

## 📝 Agent Templates

AgentDock includes several pre-configured agent templates in the `agents/` directory:

- **chat-agent**: General-purpose conversational assistant
- **research-agent**: Specialized assistant with search capabilities
- **example-agent**: Demonstrates core capabilities
- **Character-based agents**: Several personality-based agents (Chandler Bing, Dr. House, etc.)

Each agent is defined by a `template.json` file that specifies its configuration, personality, and available nodes.

## 💾 Storage System

AgentDock Core includes a secure storage system with ongoing development for advanced features:

* **Current Capabilities**: Secure encrypted storage for sensitive data
* **In Development**: Vector storage, pluggable backends, and working memory

See the [agentdock-core/README.md](agentdock-core/README.md#storage-system-development) for details on the storage system.

## 🚀 Getting Started

### Requirements

* Node.js ≥ 20.11.0 (LTS)
* pnpm ≥ 9.15.0 (Required)
* API keys for LLM providers (Anthropic, OpenAI, etc.)

### Installation

1. **Install pnpm**:

   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

2. **Install Dependencies**:

   ```bash
   pnpm install
   ```

3. **Start Development Server**:

   ```bash
   pnpm dev
   ```

4. **Create Your First Agent**:
   - Configure your agent in the `agents` directory
   - Add custom nodes for your specific needs
   - Deploy anywhere

### Using Your Own API Keys

AgentDock follows a BYOK (Bring Your Own Key) model:

1. Add your API keys in the settings page of the application
2. Alternatively, provide keys via request headers for direct API usage
3. Keys are securely stored using the built-in encryption system
4. No API keys are shared or stored on our servers

## 📂 Repository Structure

This repository contains:

1. **AgentDock Core**: The core framework located in `agentdock-core/`
2. **Next.js Implementation**: A complete reference implementation and consumer of the AgentDock Core framework
3. **Example Agents**: Ready-to-use agent configurations in the `agents/` directory

You can use AgentDock Core independently in your own applications, or use this repository as a starting point for building your own agent-powered applications.

## 🗺️ Roadmap

Our development roadmap includes:

- **Advanced Tool Orchestration**: Multi-step reasoning and tool composition
- **Multi-Agent Collaboration**: Enable agents to work together
- **Storage Abstraction**: Flexible storage system with pluggable providers
- **Enhanced Memory Systems**: Long-term context management

## 📦 Package Manager

This project *requires* the use of `pnpm` for consistent dependency management. `npm` and `yarn` are not supported.

## 👥 Contributing

We welcome contributions to AgentDock! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines and the `.agentdock/docs/` folder for detailed documentation, including guidelines for creating custom nodes.