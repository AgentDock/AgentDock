# Open Source Client (Next.js Implementation)

This reference implementation, built with Next.js and the App Router, serves as a practical example of how to consume and interact with the AgentDock Core framework to build a full-featured web application for conversational AI agents.

## Core Purpose

-   **Demonstrate Core Integration:** Showcases how to connect a frontend application to AgentDock Core's capabilities (agents, tools, session management, orchestration).
-   **Provide a User Interface:** Offers a functional chat interface, agent selection, and settings management.
-   **Reference Architecture:** Provides patterns for handling API communication, streaming responses, state management, and configuration in a web context.

## Key Features & Implementation Details

-   **Framework:** Next.js (App Router)
    -   Utilizes Server Components, Client Components, and API Routes.
    -   Leverages file-based routing (`/app` directory).
-   **API Routes (`/app/api`):**
    -   `/api/chat/[agentId]/route.ts`: The primary endpoint for handling chat messages. It receives messages, instantiates the corresponding `AgentNode` from AgentDock Core, manages the `sessionId`, handles streaming responses, and potentially returns session/token usage information.
    -   Other routes might exist for configuration, image handling, etc.
-   **AgentDock Core Integration (`/lib/agent-adapter.ts` or similar):**
    -   Contains logic to load agent templates (`template.json`).
    -   Instantiates `AgentNode` with appropriate configuration (API keys, provider settings).
    -   Calls `AgentNode.handleMessage` to process user input and generate responses.
    -   Manages the flow of data (messages, session IDs) between the API route and the Core library.
-   **Session ID Handling:**
    -   The API route handler is responsible for extracting the `sessionId` from request headers/body or generating a new one if needed (maintaining the Single Source of Truth principle).
    -   The `sessionId` is passed to `AgentNode` and potentially returned in response headers for the client to persist (e.g., in `localStorage` or session storage) for subsequent requests.
-   **Session Management:**
    -   The API route handler manages the `sessionId` (extracting or generating).
    -   The `sessionId` is passed to `AgentNode` and returned in response headers.
    -   **Session TTL** is configured via the `SESSION_TTL_SECONDS` environment variable, as detailed in the [Next.js Session Integration docs](../architecture/sessions/nextjs-integration.md#environment-based-ttl-configuration).
-   **UI Components (`/components`):**
    -   Built using React, Shadcn/ui, Radix UI, and Tailwind CSS.
    -   Includes components for the chat interface (message display, input, streaming), agent selection, settings panels, etc.
-   **State Management (UI):**
    -   Uses standard React state and context management.
    -   May use libraries like Zustand for more complex global UI state if necessary.
-   **Client-Side Storage:**
    -   Uses `localStorage` or `sessionStorage` to store user preferences, potentially the current `sessionId`, and user-provided API keys (ideally secured using `SecureStorage` from Core).
-   **BYOK (Bring Your Own Key) Mode:** Includes functionality to allow users to input their own LLM API keys, which are then securely stored (using `SecureStorage`) and passed to the backend API routes/AgentDock Core during requests.
-   **Image Generation:** Includes a dedicated page for image generation and editing using Gemini, demonstrating advanced feature integration. Image persistence uses Vercel Blob when deployed and `localStorage` locally. See the [Image Generation docs](./image-generation.md) for details.

## File Structure (`/src`)

```
/src
├── app/                  # Next.js App Router
│   ├── api/              # API routes interfacing with Core
│   ├── chat/             # Main chat page components/logic
│   ├── docs/             # Documentation site pages
│   └── settings/         # User settings pages
├── components/           # Reusable React components
│   ├── chat/             # Components specific to the chat UI
│   ├── ui/               # Base UI elements (from shadcn/ui)
│   └── layout/           # Page layout components
├── lib/                  # Shared utilities, config, core integration
│   ├── agent-adapter.ts  # Logic for interacting with AgentNode
│   ├── docs-config.ts    # Documentation sidebar config
│   └── store/            # UI state management stores (if any)
├── public/               # Static assets (images, fonts)
└── templates/            # Agent template definitions (e.g., *.json)
```

## Using This Implementation

Refer to the [Getting Started Guide](../getting-started.md) for instructions on setting up, configuring (including environment variables for API keys and storage), and running the Open Source Client locally. 