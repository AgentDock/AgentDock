# HTTP Adapter Framework Abstraction

**Status**: Critical Prerequisite  
**Priority**: Urgent  
**Complexity**: Medium

## Overview

HTTP adapters provide framework-agnostic HTTP handling for AgentDock Core, enabling a single codebase to work across different HTTP frameworks like NextJS, Hono, Express, and others. This eliminates code duplication and creates the foundation for Platform Integration.

## Current Blocker

The open source client contains NextJS-specific logic that must be duplicated for each framework. Without HTTP adapters:

- Developers using Hono, Express, or other frameworks must rewrite all HTTP handling logic
- Platform Integration (Telegram, WhatsApp, Slack) cannot be implemented
- Each new framework deployment requires custom implementations

## Architecture

### Component Structure

```
agentdock-core/src/
├── adapters/
│   ├── index.ts
│   └── http/
│       ├── index.ts           # HTTP adapter exports
│       ├── base.ts            # Base interfaces
│       ├── factory.ts         # createHTTPAdapter()
│       ├── nextjs.ts          # NextJS implementation
│       ├── hono.ts            # Hono implementation
│       └── express.ts         # Express implementation
```

### Core Interface

```typescript
// Parsed request in framework-agnostic format
interface ParsedHTTPRequest {
  messages: Message[];
  agentId: string;
  sessionId?: string;
  apiKey?: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: any;
}

// Base adapter interface
interface HTTPAdapter {
  parseRequest(request: any): Promise<ParsedHTTPRequest>;
  createStreamResponse(stream: ReadableStream): any;
  createErrorResponse(error: Error): any;
  createSuccessResponse(data?: any): any;
}
```

### Factory Function

```typescript
export function createHTTPAdapter(type: 'nextjs' | 'hono' | 'express'): HTTPAdapter {
  switch (type) {
    case 'nextjs': return new NextJSAdapter();
    case 'hono': return new HonoAdapter();
    case 'express': return new ExpressAdapter();
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure
- Base interfaces and types
- Factory system with adapter registry
- Generic HTTP adapter for fallback

### Phase 2: Framework Adapters
- NextJS adapter (handle NextRequest/NextResponse)
- Hono adapter (handle Context objects)
- Express adapter (handle Request/Response)

### Phase 3: Agent Integration
- Unified processing pipeline
- Integration with AgentNode.handleMessage()
- Session and orchestration manager support

### Phase 4: Testing & Migration
- Comprehensive testing suite
- Open source client migration
- Documentation and examples

## Usage Examples

### Open Source Client (Before)
```typescript
// src/app/api/chat/[agentId]/route.ts - 120+ lines
export async function POST(request: NextRequest) {
  const body = await request.json();
  const agentId = request.nextUrl.pathname.split('/')[3];
  // ... complex NextJS-specific logic
  const agent = new AgentNode(agentId, config);
  const result = await agent.handleMessage(options);
  return new Response(result.fullStream);
}
```

### Open Source Client (After)
```typescript
// src/app/api/chat/[agentId]/route.ts - 5 lines
export async function POST(request: NextRequest) {
  const adapter = createHTTPAdapter('nextjs');
  return processAgentHTTPRequest(adapter, request, {
    fallbackApiKey: process.env.FALLBACK_API_KEY
  });
}
```

### Other Framework Deployments (New)
```typescript
// Hono route using same core logic
app.post('/chat/:agentId', async (c) => {
  const adapter = createHTTPAdapter('hono');
  return processAgentHTTPRequest(adapter, c, {
    fallbackApiKey: process.env.FALLBACK_API_KEY
  });
});

// Express route using same core logic
app.post('/chat/:agentId', async (req, res) => {
  const adapter = createHTTPAdapter('express');
  return processAgentHTTPRequest(adapter, { req, res });
});
```

## Integration Details

### Unified Processing Pipeline

```typescript
export async function processAgentHTTPRequest(
  adapter: HTTPAdapter,
  request: any,
  options?: { fallbackApiKey?: string }
) {
  // Parse request using framework adapter
  const parsed = await adapter.parseRequest(request);
  
  // Load agent configuration
  const agentConfig = await loadAgentConfig(parsed.agentId);
  
  // Initialize orchestration
  const orchestrationManager = getOrchestrationManagerInstance();
  await orchestrationManager.ensureStateExists(parsed.sessionId);
  
  // Create and run agent
  const agent = new AgentNode(parsed.agentId, {
    agentConfig,
    apiKey: parsed.apiKey || options?.fallbackApiKey,
    provider: agentConfig.provider
  });
  
  const result = await agent.handleMessage({
    messages: parsed.messages,
    sessionId: parsed.sessionId,
    orchestrationManager
  });
  
  return adapter.createStreamResponse(result.fullStream);
}
```

### Framework Implementations

**NextJS Adapter:**
```typescript
export class NextJSAdapter implements HTTPAdapter {
  async parseRequest(request: NextRequest): Promise<ParsedHTTPRequest> {
    const body = await request.json();
    return {
      messages: body.messages || [],
      agentId: request.nextUrl.pathname.split('/').pop() || '',
      sessionId: body.sessionId,
      apiKey: request.headers.get('x-api-key') || undefined,
      headers: Object.fromEntries(request.headers.entries()),
      params: {},
      body
    };
  }
  
  createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
```

**Hono Adapter:**
```typescript
export class HonoAdapter implements HTTPAdapter {
  async parseRequest(c: Context): Promise<ParsedHTTPRequest> {
    const body = await c.req.json();
    return {
      messages: body.messages || [],
      agentId: c.req.param('agentId') || '',
      sessionId: body.sessionId,
      apiKey: c.req.header('x-api-key'),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      params: c.req.param(),
      body
    };
  }
  
  createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
}
```

## Migration Impact

### Open Source Client Changes

**Files to Remove:**
- `src/lib/agent-adapter.ts` (logic moves to agentdock-core)
- `src/lib/orchestration-adapter.ts` (logic moves to agentdock-core)

**Files to Update:**
- `src/app/api/chat/[agentId]/route.ts` (simplified to 5 lines)
- Any remaining imports from removed files

**New Capabilities:**
- Foundation for platform webhook routes
- Consistent behavior across frameworks
- Easier testing and debugging

### Framework Flexibility Benefits

**Before HTTP Adapters:**
- Must rewrite all NextJS logic for each framework
- Different error handling and response formats
- Separate maintenance burden per framework

**After HTTP Adapters:**
- Direct reuse of core logic across all frameworks
- Identical behavior and error handling
- Single codebase works everywhere

## Dependencies

### Blocks These Features
- **Platform Integration** - Cannot implement Telegram/WhatsApp/Slack webhooks
- **Voice AI Agents** - Requires webhook handling for phone integrations
- **Alternative Frameworks** - Hono, Express, and other deployments need abstraction

### Required By These Use Cases
- **Platform Integration** - Foundation for webhook handling
- **Framework Flexibility** - Support for Hono, Express, and other frameworks
- **Open Source Maintenance** - Simplified route updates

## Technical Requirements

### Must Support
- Streaming responses for agent messages
- Session management integration
- Orchestration state handling
- Error response formatting
- CORS configuration
- Header management

### Performance Targets
- Zero latency overhead vs current implementation
- Memory usage identical to current NextJS routes
- Support for concurrent requests

### Compatibility
- NextJS 14+ (current open source client)
- Hono (for developers preferring Hono)
- Express 4+ (for developers preferring Express)
- Node.js runtime support

## Success Criteria

### Code Metrics
- 80% reduction in framework-specific HTTP code
- Single implementation supports 3+ frameworks
- 95% test coverage for all adapters

### Development Velocity
- New framework support becomes trivial
- Platform webhook implementation unblocked
- Alternative framework deployments enabled

### Maintenance Benefits
- HTTP bugs fixed once, applied everywhere
- Consistent error handling across platforms
- Unified testing strategy

## Risk Mitigation

### Performance Risk
- **Concern**: Additional abstraction layer
- **Mitigation**: Benchmark against current implementation
- **Fallback**: Direct framework integration if needed

### Compatibility Risk  
- **Concern**: Framework version changes
- **Mitigation**: Comprehensive test suite with CI/CD
- **Fallback**: Quick adapter updates

### Migration Risk
- **Concern**: Open source client disruption
- **Mitigation**: Gradual rollout with extensive testing
- **Fallback**: Immediate rollback capability

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `adapters/http/base.ts` with interfaces
- [ ] Implement factory function and registry
- [ ] Add comprehensive TypeScript types
- [ ] Create generic adapter fallback

### Phase 2: Framework Adapters
- [ ] NextJS adapter with streaming support
- [ ] Hono adapter with Context handling
- [ ] Express adapter with middleware support
- [ ] Adapter-specific error handling

### Phase 3: Integration
- [ ] Unified `processAgentHTTPRequest()` function
- [ ] Session manager integration
- [ ] Orchestration manager integration
- [ ] Error handling and logging

### Phase 4: Testing & Migration
- [ ] Unit tests for all adapters
- [ ] Integration tests with AgentDock Core
- [ ] Open source client migration
- [ ] Documentation and examples