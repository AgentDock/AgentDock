# NextJS Session Integration

This document explains how AgentDock's session management integrates with Next.js applications, focusing on API routes, client-side handling, and runtime considerations.

## Orchestration Adapter (`src/lib/orchestration-adapter.ts`)

The core integration logic connecting the Next.js application to `agentdock-core`'s orchestration capabilities resides in `src/lib/orchestration-adapter.ts`. This adapter handles initializing the core `OrchestrationManager` with the correct environment configuration (storage provider, session TTL) and provides helper functions for interacting with it from API routes.

```typescript
// Simplified structure from src/lib/orchestration-adapter.ts

import {
    createOrchestrationManager,
    OrchestrationManager,
    // ... other agentdock-core imports
} from 'agentdock-core';

// Singleton pattern using globalThis for Node/Serverless environments
declare global {
  var __orchestrationManagerInstance: OrchestrationManager | null | undefined;
}

export function getOrchestrationManagerInstance(): OrchestrationManager {
  if (globalThis.__orchestrationManagerInstance) {
    return globalThis.__orchestrationManagerInstance;
  }

  // Determine storage provider (using getConfiguredStorageProvider helper)
  const storageProvider = getConfiguredStorageProvider();
  // Determine TTL from environment (SESSION_TTL_SECONDS)
  const sessionTtlMs = /* ... logic to parse env var ... */;

  // Create and store the single instance
  const newInstance = createOrchestrationManager({
      storageProvider: storageProvider,
      cleanup: { enabled: false, ttlMs: sessionTtlMs }
  });
  globalThis.__orchestrationManagerInstance = newInstance;
  return newInstance;
}
```

Key aspects of this adapter:

1.  **Singleton Instance:** Uses `globalThis` to ensure only one `OrchestrationManager` instance is created per server process. This is crucial for serverless/edge environments to reuse the manager instance across invocations where possible.
2.  **Environment Configuration:** Reads environment variables (`KV_STORE_PROVIDER`, `SESSION_TTL_SECONDS`, etc.) to dynamically configure the storage provider and session TTL when creating the singleton instance.
3.  **Standard Core Components:** Uses the standard `createOrchestrationManager` function and other components imported directly from `agentdock-core`.

### Environment-Based TTL Configuration

The `getOrchestrationManagerInstance` function within `src/lib/orchestration-adapter.ts` handles reading the `SESSION_TTL_SECONDS` environment variable.

```typescript
// Simplified logic from src/lib/orchestration-adapter.ts

import {
  createOrchestrationManager,
  getStorageFactory,
  OrchestrationManager,
  // ... other imports
} from 'agentdock-core';

declare global {
  var __orchestrationManagerInstance: OrchestrationManager | null | undefined;
}

export function getOrchestrationManagerInstance() {
  // Use global singleton
  if (globalThis.__orchestrationManagerInstance) {
    return globalThis.__orchestrationManagerInstance;
  }

  // Determine storage provider based on ENV (KV_STORE_PROVIDER, etc.)
  const storageProvider = getConfiguredStorageProvider(); // Internal helper function

  // Read and calculate TTL from ENV
  const sessionTtlSeconds = process.env.SESSION_TTL_SECONDS
    ? parseInt(process.env.SESSION_TTL_SECONDS, 10)
    : undefined;
  let sessionTtlMs: number | undefined = undefined;
  if (sessionTtlSeconds && sessionTtlSeconds > 0) {
    sessionTtlMs = sessionTtlSeconds * 1000; // Convert to ms
  }

  // Create the manager instance
  const newInstance = createOrchestrationManager({
    storageProvider: storageProvider,
    // Pass configured TTL (undefined lets core use its 24h default)
    cleanup: {
      enabled: false, // Cleanup timer managed within core if needed
      ttlMs: sessionTtlMs,
    },
  });

  // Store globally and return
  globalThis.__orchestrationManagerInstance = newInstance;
  return newInstance;
}
```

This ensures that the session TTL configured in the environment dictates the actual session lifespan managed by `agentdock-core`.

## API Route Integration

### Lazy Initialization

The `OrchestrationManager` instance itself is initialized lazily on the first call to `getOrchestrationManagerInstance()` within a server process. However, the decision to _use_ orchestration features (like getting state) typically happens within the API route handler based on the specific agent's configuration:

```typescript
// Example check within an API Route Handler (e.g., /api/chat/[agentId]/route.ts)
if (template && 'orchestration' in template && template.orchestration) {
  logger.debug(
    LogCategory.API,
    'ChatRoute',
    'Initializing orchestration for agent with orchestration',
    { agentId },
  );

  // Get the manager instance (initializes on first call)
  const manager = getOrchestrationManagerInstance();

  // Ensure orchestration state exists
  if (finalSessionId) {
    await getOrchestrationState(finalSessionId, template);
  }
}
```

This ensures that orchestration state operations (`getOrchestrationState`) are only performed for agents configured to use orchestration, even though the manager instance might have already been created by a previous request in the same process.

Benefits:

1. Orchestration logic is only engaged for relevant agents.
2. No resources are wasted on non-orchestrated agents
3. Cold starts are faster for simple agents

### Session ID Management

Session ID creation and management happens at the route handler level:

```typescript
// Get session ID from various sources with priority
const headerSessionId = request.headers.get('x-session-id');
const requestSessionId = requestJson.sessionId;

// Use existing session ID or create a new one
const finalSessionId =
  headerSessionId || requestSessionId || `session-${agentId}-${Date.now()}-${crypto.randomUUID()}`;
```

The session ID is then passed to the agent adapter:

```typescript
// Process the message using the adapter
const result = await processAgentMessage({
  agentId,
  messages,
  sessionId: finalSessionId, // Always provide a valid session ID
  apiKey,
  fallbackApiKey,
  provider: llmInfo.provider,
  system,
  config,
});
```

### Response Headers

Session state is included in response headers for client tracking:

```typescript
// Create and return the response with proper headers
return createAgentResponse(result, finalSessionId);

// Implementation of createAgentResponse
function createAgentResponse(result: any, sessionId: string): Response {
  // Convert the result to a stream
  const stream = streamText(() => result);
  const response = toDataStreamResponse(stream);

  // Add orchestration state to response - required for session continuity
  const orchestrationState = result._orchestrationState;
  if (orchestrationState) {
    response.headers.set('x-orchestration-state', JSON.stringify(orchestrationState));
  }

  // Always ensure the session ID is present in the response headers
  response.headers.set('x-session-id', sessionId);

  return response;
}
```

This approach:

- Ensures clients can maintain session continuity
- Provides access to orchestration state when needed
- Follows HTTP standards for custom headers

## Client-Side State Management

On the client side, we use a simple cache to maintain state between requests:

```typescript
// Cache to store user session information
const sessionCache = new Map<string, OrchestrationState>();

/**
 * Update orchestration state in the cache
 */
export function updateOrchestrationCache(
  sessionId: string,
  state: OrchestrationState | Partial<OrchestrationState>,
): void {
  if (!sessionId) return;

  // Update the cache with the new state
  const existing = sessionCache.get(sessionId);
  if (existing) {
    sessionCache.set(sessionId, { ...existing, ...state });
  } else {
    sessionCache.set(sessionId, state as OrchestrationState);
  }
}
```

The client component then handles this state:

```typescript
// In the chat component
useEffect(() => {
  // Extract orchestration state from headers
  const orchestrationStateHeader = response.headers.get('x-orchestration-state');
  if (orchestrationStateHeader) {
    try {
      const stateData = JSON.parse(orchestrationStateHeader);
      updateOrchestrationCache(stateData.sessionId, stateData);
    } catch (e) {
      console.error('Failed to parse orchestration state:', e);
    }
  }
}, [response]);
```

## Agent Adapter Integration

The agent adapter in Next.js uses the orchestration wrapper:

```typescript
// Import helper functions directly from the adapter
import { getOrchestrationState } from '@/lib/orchestration-adapter';

// ...

export async function processAgentMessage(options: {
  agentId: string;
  messages: CoreMessage[];
  sessionId: string;
  // ...
}) {
  // ...

  // Get orchestration state if needed
  if (config.orchestration) {
    const orchestrationState = await getOrchestrationState(sessionId, config);

    if (orchestrationState) {
      logger.debug(LogCategory.ADAPTER, 'AgentAdapter', 'Using orchestration', {
        sessionId,
        activeStep: orchestrationState.activeStep,
      });
    }
  }

  // ...
}
```

## Edge Runtime Considerations

The suitability and performance in Edge Runtime environments depend on:

- The inherent efficiency of the core `OrchestrationManager` and `SessionManager`.
- The chosen **Storage Provider**: Using providers compatible with the Edge runtime (like Vercel KV via `@vercel/kv`, or potentially Redis via `@upstash/redis`) is crucial. In-memory storage will not persist between Edge function invocations.

Key optimizations:

- Minimized dependency loading
- Efficient state structures
- No cleanup timers in Edge mode
- Simplified operations

## Deployment Considerations

Different deployment environments have different requirements:

### Vercel and Edge Functions

For Vercel and other serverless/Edge environments:

1. **Configure Appropriate Cleanup Options**

   ```typescript
   // Configure manager with cleanup disabled for edge environments
   orchestrationManager = createOrchestrationManager({
     cleanup: { enabled: false },
   });
   ```

2. **Rely on Client Caching**

   ```typescript
   // Client-side: Use cache for state
   if (typeof window !== 'undefined') {
     return sessionCache.get(sessionId) || null;
   }
   ```

3. **Minimize State Transfer**
   - Send only essential state in headers
   - Parse and store on client

### Multi-Region Deployments

For multi-region deployments:

1. **Consider External State Store**

   - Redis or similar for shared state
   - Keep state minimal for performance

2. **Proper Session Routing**
   - Use sticky sessions if possible
   - Include region info in session IDs

## Debugging Support

### Debugging Tools

For debugging session and orchestration state:

```tsx
function ChatDebug({
  sessionId,
  orchestrationState,
}: {
  sessionId: string;
  orchestrationState: OrchestrationState | null;
}) {
  if (!orchestrationState) return null;

  return (
    <div className="debug-panel">
      <h3>Session Debug</h3>
      <div>Session ID: {sessionId}</div>
      <div>Active Step: {orchestrationState.activeStep || 'None'}</div>
      <div>Tools Used: {orchestrationState.recentlyUsedTools.join(', ')}</div>
      <div>Sequence Position: {orchestrationState.sequenceIndex}</div>
    </div>
  );
}
```

This helps with:

- Verifying state persistence
- Checking sequence progression
- Identifying orchestration issues

## Best Practices

1. **Initialize Only When Needed**

   - Check `template.orchestration` before calling orchestration-specific functions like `getOrchestrationState`.

2. **Configure for Environment**

   - Set appropriate cleanup options based on your deployment environment
   - Disable cleanup timers in serverless environments

3. **Client-Side Caching**

   - Store state in client-side cache
   - Update from response headers
   - Handle expired or invalid state gracefully

4. **Clean Session IDs**

   - Use a consistent format with sufficient entropy
   - Never expose sensitive information in session IDs
   - Include timestamps for debugging

5. **Error Handling**
   - Have fallbacks for orchestration failures
   - Parse state carefully with try/catch
   - Log orchestration errors but continue if possible

### Environment-Based TTL Configuration

The `src/lib/orchestration-adapter.ts` file handles reading environment variables to configure the `agentdock-core` `OrchestrationManager` instance. It ensures a single instance (singleton) is used per server process.

```typescript
// Simplified logic from src/lib/orchestration-adapter.ts

import {
  createOrchestrationManager,
  getStorageFactory,
  OrchestrationManager,
  // ... other imports
} from 'agentdock-core';

declare global {
  var __orchestrationManagerInstance: OrchestrationManager | null | undefined;
}

export function getOrchestrationManagerInstance() {
  // Use global singleton
  if (globalThis.__orchestrationManagerInstance) {
    return globalThis.__orchestrationManagerInstance;
  }

  // Determine storage provider based on ENV (KV_STORE_PROVIDER, etc.)
  const storageProvider = getConfiguredStorageProvider(); // Internal helper function

  // Read and calculate TTL from ENV
  const sessionTtlSeconds = process.env.SESSION_TTL_SECONDS
    ? parseInt(process.env.SESSION_TTL_SECONDS, 10)
    : undefined;
  let sessionTtlMs: number | undefined = undefined;
  if (sessionTtlSeconds && sessionTtlSeconds > 0) {
    sessionTtlMs = sessionTtlSeconds * 1000; // Convert to ms
  }

  // Create the manager instance
  const newInstance = createOrchestrationManager({
    storageProvider: storageProvider,
    // Pass configured TTL (undefined lets core use its 24h default)
    cleanup: {
      enabled: false, // Cleanup timer managed within core if needed
      ttlMs: sessionTtlMs,
    },
  });

  // Store globally and return
  globalThis.__orchestrationManagerInstance = newInstance;
  return newInstance;
}
```

This ensures that the session TTL configured in the environment dictates the actual session lifespan managed by `agentdock-core`.
