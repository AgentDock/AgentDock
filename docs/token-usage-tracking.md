# Token Usage Tracking in AgentDock

This document explains how token usage tracking is implemented in AgentDock and how to implement it in a Hono-based API.

## Overview

Token usage tracking in AgentDock follows a three-layer architecture:

1. **Capture Layer (CoreLLM)**: Captures token usage from LLM responses
2. **Logging Layer (AgentNode)**: Logs token usage for debugging and monitoring
3. **API Response Layer (Route Handler)**: Adds token usage to response headers

The first two layers are framework-agnostic and part of the `agentdock-core` package. Only the third layer is framework-specific (NextJS in the reference implementation).

## Implementation Details

### 1. Capture Layer (CoreLLM)

The `CoreLLM` class in `agentdock-core/src/llm/core-llm.ts` captures token usage in the `onFinish` callback of both `streamText` and `streamObject` methods:

```typescript
// In streamText method
const wrappedOnFinish = options.onFinish 
  ? (completion: any) => {
      if (completion.usage) {
        this.lastTokenUsage = {
          promptTokens: completion.usage.prompt_tokens || completion.usage.promptTokens,
          completionTokens: completion.usage.completion_tokens || completion.usage.completionTokens,
          totalTokens: completion.usage.total_tokens || completion.usage.totalTokens,
          provider: this.getProvider()
        };
      }
      options.onFinish!(completion.text || completion);
    }
  : (completion: any) => {
      // Even if no onFinish is provided, we still want to capture token usage
      if (completion.usage) {
        this.lastTokenUsage = {
          promptTokens: completion.usage.prompt_tokens || completion.usage.promptTokens,
          completionTokens: completion.usage.completion_tokens || completion.usage.completionTokens,
          totalTokens: completion.usage.total_tokens || completion.usage.totalTokens,
          provider: this.getProvider()
        };
      }
    };
```

The `CoreLLM` class provides a `getLastTokenUsage()` method to retrieve the captured token usage:

```typescript
getLastTokenUsage(): TokenUsage | null {
  return this.lastTokenUsage;
}
```

### 2. Logging Layer (AgentNode)

The `AgentNode` class in `agentdock-core/src/nodes/agent-node.ts` logs token usage at INFO level in the `onFinish` callback after the stream completes:

```typescript
onFinish: (completion: any) => {
  // Ensure token usage is captured when the stream is complete
  if (completion && typeof completion === 'object' && completion.usage) {
    // The token usage will be captured by the CoreLLM class
  }
  
  // Log token usage after the stream completes and CoreLLM has had a chance to update it
  const tokenUsage = activeLlm.getLastTokenUsage();
  if (tokenUsage) {
    logger.info(
      LogCategory.NODE,
      'AgentNode',
      'Token usage',
      {
        nodeId: this.id,
        provider: tokenUsage.provider,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
        totalTokens: tokenUsage.totalTokens,
        usedFallback: useFallback && !!this.fallbackLlm
      }
    );
  } else {
    logger.warn(
      LogCategory.NODE,
      'AgentNode',
      'No token usage available after completion',
      {
        nodeId: this.id,
        provider: activeLlm.getProvider(),
        model: activeLlm.getModelId()
      }
    );
  }
}
```

The `AgentNode` class provides a `getLastTokenUsage()` method that returns token usage from the primary or fallback LLM:

```typescript
getLastTokenUsage(): TokenUsage | null {
  const primaryTokenUsage = this.llm.getLastTokenUsage();
  if (primaryTokenUsage) {
    return primaryTokenUsage;
  }
  
  // If no primary token usage, try fallback
  if (this.fallbackLlm) {
    return this.fallbackLlm.getLastTokenUsage();
  }
  
  return null;
}
```

### 3. API Response Layer (Route Handler)

In the NextJS reference implementation, the chat route in `src/app/api/chat/[agentId]/route.ts` adds token usage to response headers:

```typescript
// Get token usage directly from the agent
const tokenUsage = agent.getLastTokenUsage();

if (tokenUsage) {
  await logger.info(
    LogCategory.API,
    'ChatRoute',
    'Token usage for request',
    {
      agentId,
      ...tokenUsage // Spread the token usage object for cleaner logging
    }
  );
  
  // Add token usage to response headers
  const headers = new Headers(response.headers);
  headers.set('x-token-usage', JSON.stringify(tokenUsage));
  
  // Create a new response with the updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
```

## Implementing Token Usage Tracking in Hono

To implement token usage tracking in a Hono-based API, you only need to implement the third layer (API Response Layer) in your Hono route handlers. The first two layers are already provided by `agentdock-core`.

Here's an example of how to implement token usage tracking in a Hono route handler:

```typescript
import { Hono } from 'hono';
import { AgentNode } from 'agentdock-core';
import { logger, LogCategory } from 'agentdock-core';

const app = new Hono();

app.post('/api/chat/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  
  // Create agent and handle message (implementation details omitted)
  const agent = new AgentNode(/* ... */);
  const result = await agent.handleMessage(/* ... */);
  
  // Get token usage directly from the agent
  const tokenUsage = agent.getLastTokenUsage();
  
  // Create the response
  const response = result.toResponse(); // Convert your stream result to a Hono response
  
  if (tokenUsage) {
    await logger.info(
      LogCategory.API,
      'ChatRoute',
      'Token usage for request',
      {
        agentId,
        ...tokenUsage
      }
    );
    
    // Add token usage to response headers
    response.headers.set('x-token-usage', JSON.stringify(tokenUsage));
  }
  
  return response;
});

export default app;
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each layer has a clear responsibility
2. **Framework Agnostic Core**: The core functionality is in `agentdock-core` and works with any framework
3. **Consistent Logging**: Token usage is logged consistently at the AgentNode level
4. **Client Access**: Client applications can access token usage via response headers
5. **Extensibility**: Easy to add additional token usage tracking features

## Troubleshooting

If token usage is not being captured or logged:

1. Check that the LLM provider is returning token usage in the completion object
2. Ensure that the `onFinish` callback is being called after the stream completes
3. Verify that the token usage property names match what's expected (`prompt_tokens`/`promptTokens`, etc.)
4. Check the logs for any warnings about missing token usage 