# Open Source Client (Next.js Implementation)

This reference implementation, built with Next.js and the App Router, serves as a practical example of how to consume and interact with the AgentDock Core framework to build a full-featured web application for conversational AI agents.

**Important Note:**
*   AgentDock Core is currently in a pre-release stage. We are treating it as a local package (`file:./agentdock-core`) within this repository for now. It will be published as a versioned NPM package once it reaches a stable release.
*   As Core evolves, the separation of concerns between the framework and this Next.js Client implementation is actively being improved.
*   If you notice areas where the integration could be cleaner or have suggestions, please don't hesitate to reach out or open an issue on GitHub!

See the main [AgentDock Roadmap](./../roadmap.md) for planned features across both Core and the Client.

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
-   **Client-Side Storage & API Keys (BYOK):**
    -   This open source client uses `localStorage` or `sessionStorage` for user preferences and potentially the session ID.
    -   For Bring Your Own Key (BYOK) mode, user-provided API keys are stored client-side using the `SecureStorage` utility from `agentdock-core`.
    -   **Security Considerations (`SecureStorage`):** `SecureStorage` enhances security by encrypting API keys using AES-GCM and adding an HMAC signature to detect tampering before use. However, to decrypt the data, the necessary encryption keys are also stored within the browser's `localStorage`. This is a standard technique for client-side encryption but carries an inherent risk: if a Cross-Site Scripting (XSS) vulnerability exists in *any* part of the application (or potentially a browser extension), malicious JavaScript could gain access to `localStorage`, read the encryption keys, and potentially decrypt the stored API keys.
    -   **Risk Context:** The practical risk depends on the overall security of the user's browser environment and the application itself against XSS attacks. If the browser and application environment are secure (e.g., up-to-date browser, no malicious extensions, robust application XSS defenses), the likelihood of exploitation is lower. However, the vulnerability exists if an XSS attack *can* be successfully executed.
    -   **Recommendation:** Users employing BYOK mode should be aware of this XSS risk associated with storing sensitive data like API keys in `localStorage`, even when encrypted. Evaluate this risk based on your specific security requirements and environment. For maximum security, configuring API keys server-side via environment variables is the preferred approach. If using client-side storage, ensuring the application is well-protected against XSS vulnerabilities is crucial.
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