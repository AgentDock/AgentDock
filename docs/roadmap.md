# Roadmap

This document outlines the planned features and future direction for AgentDock. Most improvements target the core AgentDock framework (`agentdock-core`), which is under active development and will be published as a versioned NPM package upon reaching a stable release. Some items may also involve the open-source client.

## Completed

| Feature | Description |
|---------|-------------|
| [**Storage Abstraction Layer**](../storage/storage-abstraction.md) | ✅ Flexible storage system with 15 production-ready adapters |
| [**Advanced Memory Systems**](../memory/README.md) | ✅ Four-layer cognitive architecture with PRIME extraction, hybrid search, and memory connections |
| [**Vector Storage Integration**](../storage/vector-storage.md) | ✅ Embedding-based retrieval for documents and memory (PostgreSQL + pgvector, SQLite + sqlite-vec fully integrated) |

## In Progress

| Feature | Description |
|---------|-------------|
| [**Evaluation for AI Agents**](./roadmap/evaluation-framework.md) | Comprehensive testing and evaluation framework |

## Planned

| Feature | Description |
|---------|-------------|
| [**Platform Integration**](./roadmap/platform-integration.md) | Support for Telegram, WhatsApp, and other messaging platforms |
| [**Multi-Agent Collaboration**](./roadmap/multi-agent-collaboration.md) | Enable agents to work together |
| [**Model Context Protocol (MCP) Integration**](./roadmap/mcp-integration.md) | Support for discovering and using external tools via MCP |
| [**Voice AI Agents**](./roadmap/voice-agents.md) | AI agents using voice interfaces and phone numbers via AgentNode |
| [**Telemetry and Traceability**](./roadmap/telemetry.md) | Advanced logging and performance tracking |

## Advanced Agent Applications

| Feature | Description |
|---------|-------------|
| [**Code Playground**](./roadmap/code-playground.md) | Sandboxed code generation and execution with rich visualization capabilities |

## Workflow System

| Feature | Description |
|---------|-------------|
| [**Workflow Runtime & Nodes**](./roadmap/workflow-nodes.md) | Core runtime, node types, and orchestration logic for complex automations |

## Cloud Deployment

| Feature | Description |
|---------|-------------|
| [**AgentDock Pro**](/docs/agentdock-pro) | Comprehensive enterprise cloud platform for scaling AI agents & workflows, with visual tools and autoscaling |
| [**Natural Language AI Agent Builder**](./roadmap/nl-agent-builder.md) | Visual builder + natural language agent and workflow construction |
| [**Agent Marketplace**](./roadmap/agent-marketplace.md) | Monetizable agent templates |

## Open Source Client Enhancements

-   Improved UI/UX for agent management and chat.
-   Enhanced visualization for orchestration steps.
-   More robust BYOK (Bring Your Own Key) management.
-   Multi-modal input/output support (beyond basic image generation).
-   Example implementations for multi-threading/background tasks (where applicable in Next.js).
-   Exploration of patterns for multi-tenancy support within the client architecture.

## Community & Ecosystem

-   Grow the library of community-contributed agents.
-   Develop more example projects and tutorials.
-   Establish clearer contribution guidelines.

## AgentDock Repository Improvements

-   Complete test suite (Unit, Integration, E2E).
-   Expand core capabilities with workflow node types and runtime enhancements.

*This roadmap is indicative and subject to change.*

