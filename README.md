# AgentDock Core

AgentDock Core is an open-source TypeScript framework for building, managing, and deploying AI agents. It emphasizes simplicity, extensibility, and deterministic behavior, providing a solid foundation for creating robust and reliable agent-based applications. AgentDock Core is built with Next.js and utilizes the Vercel AI SDK for streamlined LLM interactions.

## Features

*   **Node-Based Architecture:**  Build agents using modular, reusable nodes.  Nodes represent individual units of functionality, such as interacting with LLMs, accessing data sources, or executing custom logic.
*   **Extensible Design:** Easily add new capabilities by creating custom nodes.  AgentDock's architecture promotes clean separation of concerns and encourages community contributions.
*   **LLM Integration (via Vercel AI SDK):**  Leverage the power of leading language models through a thin, well-defined adapter (`AISDKAdapter`).  This provides access to streaming, provider configuration, and other benefits of the Vercel AI SDK, without tightly coupling AgentDock to it.
*   **Provider Registry:**  Manage configurations for multiple LLM providers (Anthropic, OpenAI, Google, and OpenRouter are supported out of the box).  AgentDock prioritizes Bring Your Own Key (BYOK) for enhanced control and security.
*   **`orchestrateAgent` Function:**  The core of AgentDock, this function manages the agent's workflow, handling message processing, node execution, and error handling.
*   **Robust Error Handling:**  A comprehensive error handling system with specific error codes (`ErrorCode`), `AgentError`, and `APIError` ensures predictable behavior and simplifies debugging.
*   **Structured Logging:**  A built-in logging system (`Logger` singleton) provides detailed insights into agent execution and facilitates troubleshooting.
*   **In-Memory Message Handling:** AgentDock Core focuses on in-memory operations for V1, providing a streamlined and efficient experience.
*   **TypeScript First:** Built with TypeScript for type safety, improved code quality, and enhanced developer experience.

## Getting Started

### Requirements

*   Node.js ≥ 20.11.0 (LTS)
*   pnpm ≥ 9.15.0 (Required)

### Installation

1.  **Install pnpm:**

    ```bash
    corepack enable
    corepack prepare pnpm@latest --activate
    ```
2.  **Install Dependencies:**

    ```bash
    pnpm install
    ```

3.  **Start Development Server:**

    ```bash
    pnpm dev
    ```

## Core Components

AgentDock's modular architecture is built upon these key components:

*   **Nodes:** The fundamental building blocks of agents. Each node performs a specific task.
*   **Tools:** A specialized type of Node representing a function callable by an LLM.
*   **LLM Adapter (`AISDKAdapter`):**  A thin abstraction layer for interacting with LLMs via the Vercel AI SDK.
*   **Provider Registry:** Manages LLM provider configurations and API key resolution.
*   **Node Registry:** Registers and retrieves Node instances, enabling extensibility.
*   **`orchestrateAgent`:** The core function that orchestrates the agent's workflow.
*   **Error Handling:**  A robust system for handling errors and ensuring predictable behavior.
*   **Logging:** A structured logging system for monitoring and debugging.

## Package Manager

This project *requires* the use of `pnpm` for consistent dependency management.  `npm` and `yarn` are not supported.

## Future Direction (AgentDock Pro)

AgentDock Core serves as the foundation for AgentDock Pro, a planned commercial offering. AgentDock Pro will build upon the Core's architecture, adding a visual, drag-and-drop agent builder (using React Flow), managed execution, and other advanced features. The open-source AgentDock Core will remain actively maintained and will continue to benefit from advancements in the Pro version.

## Contributing

We welcome contributions to AgentDock Core!  Please see the `.agentdock/docs/` folder for detailed documentation, including guidelines for creating custom nodes.