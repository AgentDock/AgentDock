# Core Architecture Overview

**AgentDock Core** provides the foundational libraries and systems for building stateful, tool-using AI agents. It emphasizes modularity, type safety, and extensibility.

## Guiding Principles

-   **Modularity:** Key concerns (LLM interaction, state, storage, orchestration) are handled by distinct, often replaceable components.
-   **Extensibility:** Designed to easily incorporate new LLM providers, storage backends, custom tools, and agent logic.
-   **Type Safety:** Leverages TypeScript for robust typing throughout the core library.
-   **Provider Agnosticism:** Aims to abstract common functionalities across different LLM providers and storage systems.
-   **State Management:** Central focus on reliably managing conversational state across multiple interactions.

## Key Subsystems & Components

AgentDock Core comprises several interacting subsystems:

1.  **LLM Abstraction (`/llm`):**
    -   `CoreLLM`: Central class providing a unified interface to interact with various LLM providers (via Vercel AI SDK).
    -   Handles streaming, function/tool calling API translation, and basic token usage reporting.

2.  **Node System (`/nodes`):**
    -   `AgentNode`: The primary node type responsible for orchestrating agent interactions, integrating LLM calls, tool execution, and state management.
    -   Defines the main processing logic for conversational agents.

3.  **Storage Abstraction (`/storage`):**
    -   Provides interfaces (`StorageProvider`) and implementations (Memory, Redis, Vercel KV) for persistent Key-Value storage.
    -   `StorageFactory`: Manages provider instantiation based on configuration.
    -   `SecureStorage`: Client-side encrypted storage for browsers.
    -   Foundation for planned Vector and Relational storage.

4.  **Session Management (`/session`):**
    -   `SessionManager`: Manages session state lifecycle (creation, retrieval, update, TTL cleanup) using the Storage Abstraction layer.
    -   Ensures conversational context is maintained and isolated between different sessions.

5.  **Orchestration Framework (`/orchestration`):**
    -   `OrchestrationStateManager`: Manages session-specific orchestration state (active step, tool history, sequence progress) using `SessionManager`.
    -   `StepSequencer`: Enforces defined tool execution order within steps.
    -   Condition Logic: Evaluates configured conditions to control transitions between steps.
    -   Controls tool availability based on the active step and sequence.

6.  **Tool System (`/tools`, integrated in `/nodes`, `/llm`):**
    -   Defines tool structures and execution logic.
    -   Integrates with `CoreLLM` for function/tool calling.
    -   `AgentNode` handles tool loading, filtering (via Orchestration), and execution.

7.  **Configuration System (`/config`, `/templates`):**
    -   Loads agent definitions from template files (`template.json`).
    -   Manages environment variables for API keys and storage configuration.

8.  **Error Handling (`/errors`):**
    -   Provides standardized error types and a factory for consistent error reporting.

9.  **Evaluation Framework (`/evaluation`):**
    -   Provides tools for systematic evaluation of agent performance.
    -   Includes `EvaluationRunner`, various `Evaluators` (RuleBased, LLMJudge, NLP, Lexical, ToolUsage), `EvaluationCriteria` definition, and `EvaluationStorageProvider` for results persistence.

## Core Components

AgentDock Core consists of several key components:

- **Node System** - A flexible, modular framework for building AI agents
- **LLM Providers** - Unified interfaces to multiple LLM providers
- **Tool Framework** - Standardized way to define and use tools with agents
- **Orchestration** - Manages multi-step agent workflows
- **Response Streaming** - Enhanced streaming capabilities built on Vercel AI SDK
- **LLM Orchestration Service** - Bridges AgentNode and CoreLLM with orchestration capabilities

For more details on specific components:

- [Request Flow](./request-flow.md)
- [Technology Stack](./technology-stack.md)
- [Response Streaming](./response-streaming.md)

## Core Interaction Summary

The subsystems work in concert: An `AgentNode` uses `CoreLLM` for language tasks, relies on `SessionManager` and `OrchestrationStateManager` (backed by `Storage`) to maintain context and control flow, and executes `Tools` as directed by the LLM and permitted by Orchestration rules defined in the agent's `Configuration`.

See [Architecture Overview](../README.md) for links to detailed documentation on each subsystem. 