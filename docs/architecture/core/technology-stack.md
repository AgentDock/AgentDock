# Technology Stack

This document outlines the core technologies used in AgentDock Core and its reference implementation.

## Core Framework

- **TypeScript**: Primary language, providing type safety and modern JavaScript features
- **Node.js**: Server-side runtime (>= 20.11.0)
- **Vercel AI SDK**: For LLM provider integrations

## State Management

- **Zod**: Schema validation and runtime type checking
- **Zustand**: UI state management in the reference implementation

## Development Environment

- **pnpm**: Package manager (>= 9.15.0)
- **ESLint & TypeScript-ESLint**: Code quality and type checking
- **Jest**: Testing framework
- **Husky**: Git hooks for code quality

## Reference Implementation

For details about the open source client implementation built with Next.js, see [Next.js Implementation](../../oss-client/nextjs-implementation.md).

### Key Technologies

- **Next.js**: React framework with App Router
- **React**: UI library (^18.2.0)
- **Shadcn/ui & Radix UI**: Component primitives
- **Tailwind CSS**: Utility-first styling
- **React Hook Form**: Form handling
- **React Markdown**: Documentation rendering

## AgentDock Core

-   **Language:** TypeScript
    -   Provides strong typing, compile-time checks, and improved maintainability for the core library.
-   **Runtime:** Node.js (LTS versions recommended)
    -   The primary execution environment for the core logic when run server-side.
-   **LLM Interaction:** Vercel AI SDK (`ai` package)
    -   Provides a unified, stream-first interface to interact with various LLM providers (OpenAI, Anthropic, Google Gemini, Groq, etc.).
    -   Handles the complexities of different provider APIs for text generation, streaming, and function/tool calling.
-   **Storage (Defaults & Included):**
    -   In-Memory: Default key-value store for sessions/orchestration if no external provider is configured.
    -   Redis (`@upstash/redis`): Included provider for persistent key-value storage, often used with Docker for development.
    -   Vercel KV (`@vercel/kv`): Included provider for Vercel's key-value store.
-   **Schema Validation (for Tools):** Zod
    -   Used within tool definitions to define and validate input parameters expected from the LLM, ensuring type safety and providing clear error messages.
-   **Logging:** Custom logger utilities (`agentdock-core/src/logging`)
    -   Provides structured logging capabilities within the core library.
-   **Package Manager:** pnpm
    -   Used for managing dependencies and ensuring efficient installation. AgentDock Core will be released as a separate NPM package when it's ready for release.

## Open Source Client (Reference Implementation)

This web application demonstrates how to use AgentDock Core.

-   **Framework:** Next.js (App Router)
    -   Provides the foundation for the web application, including routing, server components, client components, and API routes.
-   **UI Components:** Shadcn/ui & Radix UI
    -   Used for building the user interface components (buttons, inputs, layout, etc.). Built on top of Tailwind CSS.
-   **Styling:** Tailwind CSS
    -   A utility-first CSS framework for styling the application.
-   **State Management (UI):** Primarily React state/context, potentially Zustand for more complex global state if needed.
-   **Client-Side Storage:** `localStorage` (potentially secured via `SecureStorage` from Core for sensitive items like API keys).

## Development & Build Tools

-   **Package Management:** pnpm
    -   Manages dependencies with efficient node_modules structure and consistent installs.
-   **Task Running/Scripting:** pnpm scripts (defined in `package.json`)
    -   Used for build, test, dev, linting, and other development tasks.
-   **Testing:** Vitest
    -   Used for running unit and integration tests.
-   **Linting/Formatting:** ESLint & Prettier
    -   Ensures code quality and consistent formatting.

## Optional Backend Services (for Development)

-   **Redis:** (As mentioned in Core) Typically run via Docker Compose (`docker-compose.yaml`) for persistent session/orchestration state during development.
-   **Redis Commander:** A simple web UI (included in `docker-compose.yaml`) for inspecting data stored in the development Redis instance. 