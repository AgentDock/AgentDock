# AgentDock Architecture

This section provides an overview of the architecture of AgentDock Core, the foundation library that powers all AgentDock functionality.

## Core Philosophy

AgentDock Core is designed with the following principles:

-   **Modularity:** Components like LLM interaction, session management, storage, and orchestration are distinct and replaceable.
-   **Extensibility:** Easy to add new LLM providers, storage backends, tools, or custom agent logic.
-   **Type Safety:** Comprehensive TypeScript types ensure developer confidence and reduce runtime errors.
-   **Provider Agnosticism:** Abstracting away differences between LLM providers and storage systems where possible.
-   **State Management Focus:** Robust mechanisms for managing conversational state across interactions.

## Key Subsystems

AgentDock Core is composed of several interconnected subsystems:

1.  **LLM Abstraction (`/llm`):** Provides a consistent interface (`CoreLLM`) for interacting with different LLM providers (OpenAI, Anthropic, Gemini via Vercel AI SDK). Handles API calls, streaming, and basic token usage reporting.
2.  **Storage Abstraction Layer (`/storage`):** Offers a pluggable system for Key-Value storage (Memory, Redis, Vercel KV implemented) with plans for Vector and Relational storage. See [Storage Overview](../storage/README.md).
3.  **Session Management (`/session`):** Manages isolated conversational state using the Storage Abstraction Layer. Ensures context preservation and handles state lifecycle (creation, updates, TTL-based cleanup). See [Session Management](./sessions/session-management.md).
4.  **Orchestration Framework (`/orchestration`):** Controls agent behavior by managing steps (modes), conditional transitions, tool availability, and optional tool sequencing based on session state. See [Orchestration Overview](./orchestration/orchestration-overview.md).
5.  **Node System (`/nodes`):** Defines the core execution units and modular architecture. Based on `BaseNode`, it includes the primary `AgentNode` (integrating LLM, tools, session, orchestration), tool nodes, and potentially custom nodes. Managed by `NodeRegistry` (for types) and `ToolRegistry` (for runtime availability). See [Node System Overview](../nodes/README.md).
6.  **Tool System (Integrated within `/nodes`):** Tools are implemented as specialized nodes. Their definition, registration (`NodeRegistry`), runtime availability (`ToolRegistry`), and execution (triggered by `AgentNode` via LLM function/tool calling) are integral parts of the Node System.
7.  **Error Handling (`/errors`):** Standardized error types and handling mechanisms.
8.  **Configuration (`/config`, Agent Templates):** Agent behavior is defined via template files (`template.json`) specifying LLM, tools, prompts, orchestration rules, etc.

## High-Level Interaction Flow

A typical interaction involves:

1.  **Request:** An incoming request (e.g., from the Open Source Client) hits an API endpoint.
2.  **Session Handling:** The endpoint retrieves or establishes a `SessionId`.
3.  **Agent Instantiation:** An `AgentNode` instance is created based on the agent template configuration.
4.  **State Retrieval:** Relevant session state (e.g., `OrchestrationState`) is loaded via `SessionManager` / `OrchestrationStateManager`.
5.  **Orchestration Check:** The orchestration logic determines the active step and filters available tools based on conditions and sequences.
6.  **LLM Call:** `AgentNode` uses `CoreLLM` to interact with the LLM provider, passing the message history, system prompt, and filtered tools.
7.  **Tool Execution (if needed):** If the LLM requests a tool, `AgentNode` executes it, potentially updating session state.
8.  **Response Streaming:** The LLM response (text or tool calls) is streamed back.
9.  **State Update:** Session state (message history, token usage, orchestration state) is updated via the respective managers.
10. **Response Completion:** The stream ends, and the final state is persisted.

See [Request Flow](./core/request-flow.md) for more details.

## Directory Structure (`agentdock-core/src`)

```
/src
├── client/         # (Primarily for Open Source Client integration)
├── config/         # Configuration loading utilities
├── errors/         # Custom error types and factory
├── llm/            # CoreLLM abstraction, provider specifics
├── logging/        # Logging utilities
├── nodes/          # AgentNode, tool execution logic
├── orchestration/  # State management, sequencing, conditions
├── session/        # SessionManager implementation
├── storage/        # Storage abstraction, providers (KV, Secure)
├── tools/          # Base tool definitions and specific tool implementations
├── types/          # Core TypeScript type definitions
└── utils/          # General utility functions
```

## Further Reading

-   [Core Architecture Overview](./core/overview.md)
-   [Node System Overview](../nodes/README.md)
-   [Technology Stack](./core/technology-stack.md)

## Evaluation Framework

A crucial component of AgentDock is its **Evaluation Framework**, designed to systematically measure, analyze, and improve agent quality. This framework resides within `agentdock-core` and provides a comprehensive suite of tools for assessing various aspects of agent performance.

Key aspects include:

*   **Modular Evaluators**: A collection of diverse evaluators (e.g., `RuleBasedEvaluator`, `LLMJudgeEvaluator`, `NLPAccuracyEvaluator`, Lexical Suite, `ToolUsageEvaluator`) allow for targeted assessment of different quality dimensions.
*   **`EvaluationRunner`**: Orchestrates the execution of evaluation runs based on defined criteria and configurations.
*   **Configurable Criteria**: Enables developers to define specific `EvaluationCriteria` (name, description, scale, weight) against which agents are assessed.
*   **Result Aggregation & Storage**: Provides mechanisms for aggregating results (e.g., weighted scoring) and persisting them via `EvaluationStorageProvider` implementations.
*   **Extensibility**: Designed with interfaces like `Evaluator` and `EvaluationStorageProvider` to allow for easy custom extensions.

The Evaluation Framework is integral to maintaining high standards of agent reliability and performance, facilitating data-driven development and iterative improvement. For more details, see the [Evaluation Framework Documentation](../evaluations/README.md). 