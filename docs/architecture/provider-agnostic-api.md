# Provider-Agnostic API Architecture

This document outlines the architecture and implementation of the provider-agnostic API layer in AgentDock that fully leverages the agentdock-core library.

## Goals

1. Create a unified API layer that has no knowledge of specific providers
2. Simplify the addition of new LLM providers
3. Establish a consistent pattern for both Next.js and HonoJS implementations
4. Improve code maintainability through better separation of concerns
5. Ensure consistent security and validation practices

## Implementation Status

✅ **COMPLETED**: The provider-agnostic API architecture has been fully implemented and tested with the Gemini provider.

## Before & After

### Before: Provider-Specific Implementation

The original implementation had provider-specific directories in the API layer:

```
/api/
  /providers/
    /anthropic/
      /models/
        route.ts
    /deepseek/
      /models/
        route.ts
    /gemini/
      /models/
        route.ts
    /groq/
      /models/
        route.ts
    /openai/
      /models/
        route.ts
```

Each provider directory contained very similar implementations for validating API keys and fetching models, repeating logic that should be centralized.

### After: Provider-Agnostic Implementation

The new implementation uses a dynamic route structure:

```
/api/
  /providers/
    /[providerId]/
      /models/
        route.ts
```

This approach uses Next.js dynamic route segments to handle any provider supported by agentdock-core without hardcoding provider names. All provider-specific logic has been moved into the agentdock-core library.

The existing chat implementation (`/api/chat/[agentId]/route.ts`) already used the AgentNode abstraction from agentdock-core, which internally handles provider-specific details and properly integrates with Vercel AI SDK's streaming capabilities.

## agentdock-core Structure

The agentdock-core library is organized to support the provider-agnostic approach:

```
/agentdock-core/
  /src/
    /llm/
      index.ts                   # Main exports including provider-agnostic functions
      types.ts                   # LLM-related type definitions
      /providers/
        index.ts                 # Provider-agnostic adapter functions
        /anthropic-adapter.ts    # Anthropic-specific implementation
        /deepseek-adapter.ts     # DeepSeek-specific implementation
        /gemini-adapter.ts       # Gemini-specific implementation
        /groq-adapter.ts         # Groq-specific implementation
        /openai-adapter.ts       # OpenAI-specific implementation
      /nodes/
        AgentNode.ts             # Core agent node implementation
    /logging/                    # Logging infrastructure
    /utils/                      # Utility functions
```

Key components:

1. **Provider-Agnostic Adapter Functions**: 
   - `validateProviderApiKey`: Validates an API key for any supported provider
   - `fetchProviderModels`: Fetches models for any supported provider

2. **AgentNode**:
   - Handles chat conversations with any provider
   - Integrates with streaming APIs
   - Manages model selection and fallbacks

## Next.js Reference Implementation

### Dynamic Provider Route

The provider-agnostic route for models is implemented at `src/app/api/providers/[providerId]/models/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { 
  ProviderRegistry, 
  validateProviderApiKey, 
  fetchProviderModels,
  LLMProvider
} from 'agentdock-core';

export async function GET(
  req: NextRequest,
  { params }: { params: { providerId: string } }
) {
  const providerId = params.providerId as LLMProvider;
  
  // Validate provider exists
  const provider = ProviderRegistry.getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }
  
  const apiKey = req.headers.get('x-api-key');
  
  if (!apiKey) {
    return NextResponse.json({ 
      valid: false,
      error: 'API key is required' 
    }, { status: 400 });
  }

  try {
    // Validate the API key
    const isValid = await validateProviderApiKey(providerId, apiKey);
    
    if (!isValid) {
      return NextResponse.json({ 
        valid: false,
        error: 'Invalid API key' 
      }, { status: 401 });
    }
    
    // Fetch models using the provider-agnostic adapter
    const models = await fetchProviderModels(providerId, apiKey);

    return NextResponse.json({ 
      valid: true,
      models
    });
  } catch (error) {
    return NextResponse.json({ 
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
```

### Chat Implementation

The chat implementation is already provider-agnostic at `src/app/api/chat/[agentId]/route.ts`:

```typescript
// Simplified for clarity
import { AgentNode } from 'agentdock-core';
import { streamText } from 'ai';

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const agentId = params.agentId;
  
  // Template validation, API key retrieval...
  
  // Create AgentNode with provider-agnostic approach
  const agent = new AgentNode(`agent-${agentId}`, {
    agentConfig: template,
    apiKey,
    fallbackApiKey,
    provider: providerId // Determined from template
  });
  
  // Parse request body
  const { messages, system } = await req.json();
  
  // Get the result from AgentNode
  const result = await agent.handleMessage({
    messages,
    system
  });
  
  // Return streaming response using Vercel AI SDK
  return streamText(result.getStream()).toDataStreamResponse();
}
```

## HONO Pro Implementation

### Architecture

The HONO Pro implementation follows the same provider-agnostic approach while adhering to the Pro architecture patterns outlined in the project documentation. It integrates with the larger Pro system architecture including Supabase for persistent storage and proper multi-tenant design.

```
/packages/
  /api/                        # Hono API package in monorepo
    /src/
      /routes/
        /providers/
          /[providerId]/
            /models.ts         # Provider models endpoint
        /chat/
          /[agentId].ts        # Chat endpoint
      /middleware/             # Shared middleware
      /utils/                  # API utilities
      /index.ts                # Main app entry point
```

### HONO Provider Models Route

```typescript
// packages/api/src/routes/providers/[providerId]/models.ts
import { Hono } from 'hono';
import { 
  ProviderRegistry, 
  validateProviderApiKey, 
  fetchProviderModels,
  LLMProvider
} from 'agentdock-core';
import { authMiddleware } from '../../middleware/auth';

export default new Hono()
  .use('*', authMiddleware())
  .get('/', async (c) => {
    const providerId = c.req.param('providerId') as LLMProvider;
    
    // Validate provider exists
    const provider = ProviderRegistry.getProvider(providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }
    
    const apiKey = c.req.header('x-api-key');
    
    if (!apiKey) {
      return c.json({ 
        valid: false,
        error: 'API key is required' 
      }, 400);
    }

    try {
      // Use the same provider-agnostic core functions
      const isValid = await validateProviderApiKey(providerId, apiKey);
      
      if (!isValid) {
        return c.json({ 
          valid: false,
          error: 'Invalid API key' 
        }, 401);
      }
      
      const models = await fetchProviderModels(providerId, apiKey);

      return c.json({ 
        valid: true,
        models
      });
    } catch (error) {
      return c.json({ 
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  });
```

### HONO Chat Implementation

The chat implementation leverages the AgentNode abstraction from agentdock-core while integrating with the Pro architecture's multi-tenant design and persistent storage:

```typescript
// packages/api/src/routes/chat/[agentId].ts
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { 
  AgentNode,
  ProviderRegistry,
  LLMProvider
} from 'agentdock-core';
import { authMiddleware } from '../../middleware/auth';
import { getAgentTemplate, getChatHistory } from '../../utils/database';

export default new Hono()
  .use('*', authMiddleware())
  .post('/', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const userId = c.get('userId');
      const orgId = c.get('orgId');
      
      // Get agent template using Supabase integration
      const template = await getAgentTemplate(agentId, orgId);
      if (!template) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      // Get API keys from secure storage
      const providerId = template.provider;
      const apiKey = await getProviderApiKey(orgId, providerId);
      
      if (!apiKey) {
        return c.json({ error: 'API key not configured' }, 400);
      }
      
      // Create AgentNode with persistent memory
      const agent = new AgentNode(`agent-${agentId}`, {
        agentConfig: template,
        apiKey,
        provider: providerId,
        // Pass storage callbacks for persistent memory
        storage: {
          getMemory: async () => await getAgentMemory(agentId, userId),
          saveMemory: async (memory) => await saveAgentMemory(agentId, userId, memory)
        }
      });
      
      // Parse request body
      const { messages, system } = await c.req.json();
      
      // Get chat history for this user
      const history = await getChatHistory(agentId, userId);
      
      // Get the result from AgentNode
      const result = await agent.handleMessage({
        messages,
        system,
        history
      });
      
      // Stream response back to client
      return streamResponse(c, result.getStream());
    } catch (error) {
      return c.json({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

// Utility for streaming responses
function streamResponse(c, readableStream) {
  return stream(c, async (streamingResponse) => {
    const reader = readableStream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert value to string and send to client
        const chunk = new TextDecoder().decode(value);
        await streamingResponse.write(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  });
}
```

### Main App Configuration

The main application integrates all routes and applies proper middleware for authentication, logging, and CORS:

```typescript
// packages/api/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

// Import routes
import providerModelsRoute from './routes/providers/[providerId]/models';
import chatRoute from './routes/chat/[agentId]';

// Create main app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://agentdock.ai', /\.agentdock\.ai$/],
  credentials: true
}));
app.use('*', prettyJSON());

// Register routes
app.route('/api/providers/:providerId/models', providerModelsRoute);
app.route('/api/chat/:agentId', chatRoute);

export default {
  fetch: app.fetch,
};
```

## Integration with Pro Architecture

The provider-agnostic API layer integrates with the broader Pro architecture:

1. **Multi-tenant Support**:
   - All routes include tenant isolation via the authentication middleware
   - Agent data is scoped to organizations and users
   - API keys are stored securely per organization

2. **Persistent Storage with Supabase**:
   - Agent templates stored in Supabase
   - Chat history persisted per user
   - Agent memory maintained across sessions

3. **Direct Execution Path**:
   - The implementation follows the "Direct Execution Path" for Phase 1 
   - Real-time interactive operations with immediate streaming response
   - Future Phase 2 will add support for queued execution with BullMQ

4. **Security**:
   - Proper authentication and authorization via middleware
   - API keys securely stored and never exposed to clients
   - Rate limiting based on organization tier (implemented separately)

## Benefits of Provider-Agnostic Architecture

### For Next.js Reference Implementation

1. **Simplified API Layer**: The API layer no longer needs to know about specific providers for model fetching.
2. **DRY Code**: No duplication of provider validation and model fetching logic.
3. **Maintainability**: Provider-specific logic is isolated to the core library.
4. **Easier Testing**: Provider-agnostic interfaces are easier to mock and test.

### For HONO Pro Implementation

1. **Code Reuse**: The same agentdock-core functions power both implementations.
2. **Framework Independence**: Core business logic remains independent of web framework.
3. **Consistent API Design**: API endpoints maintain consistency across implementations.
4. **Separation of Concerns**: Clear boundaries between core logic, API handling, and storage.
5. **Turborepo Integration**: Clean fit into the monorepo structure outlined in Pro architecture.

## Future Enhancements

### Improvements for agentdock-core

1. **Type Safety Enhancements**:
   - Define standardized response types for all provider operations
   - Implement consistent error types across all provider adapters
   - Add proper TypeScript discriminated unions for provider-specific configurations
   - Example:
   ```typescript
   // Enhanced types in agentdock-core/src/llm/types.ts
   export type ProviderValidationResult = {
     valid: boolean;
     error?: string;
     provider: LLMProvider;
   };

   export type ModelFetchResult = {
     models: ModelMetadata[];
     provider: LLMProvider;
   };
   ```

2. **Internal Validation**:
   - Add robust input validation inside provider adapter functions
   - Implement consistent error handling patterns across all providers
   - Validate model names before attempting to use them
   - Example:
   ```typescript
   // Enhanced validation in provider adapters
   export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
     if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
       logger.warn(LogCategory.LLM, 'GeminiAdapter', 'Invalid API key format');
       return false;
     }
     // Continue with actual validation...
   }
   ```

3. **Caching Layer**:
   - Implement an optional provider-agnostic caching layer in agentdock-core
   - Add cache control parameters to allow custom TTL settings
   - Support both in-memory caching and pluggable cache providers
   - Example:
   ```typescript
   // New caching layer in agentdock-core/src/llm/cache.ts
   export class ModelCache {
     private cache = new Map<string, {data: any, expiry: number}>();
     private defaultTTL = 3600 * 1000; // 1 hour in ms

     async getOrFetch(
       key: string, 
       fetchFn: () => Promise<any>, 
       ttl = this.defaultTTL
     ): Promise<any> {
       const cached = this.cache.get(key);
       if (cached && Date.now() < cached.expiry) {
         return cached.data;
       }
       
       const data = await fetchFn();
       this.cache.set(key, { data, expiry: Date.now() + ttl });
       return data;
     }
   }
   ```

4. **Telemetry Integration**:
   - Add optional telemetry hooks in core provider functions
   - Implement performance tracking for provider API calls
   - Create standardized logging patterns for all provider operations
   - Example:
   ```typescript
   // Telemetry integration in agentdock-core
   export async function fetchProviderModels(
     providerId: LLMProvider, 
     apiKey: string,
     options?: { telemetry?: boolean }
   ): Promise<ModelMetadata[]> {
     const startTime = Date.now();
     try {
       // Existing implementation...
       const result = /* ... */;
       
       // Optional telemetry
       if (options?.telemetry) {
         recordProviderOperation({
           type: 'fetch_models',
           provider: providerId,
           duration: Date.now() - startTime,
           success: true
         });
       }
       
       return result;
     } catch (error) {
       // Optional telemetry for errors
       if (options?.telemetry) {
         recordProviderOperation({
           type: 'fetch_models',
           provider: providerId,
           duration: Date.now() - startTime,
           success: false,
           error: error instanceof Error ? error.message : String(error)
         });
       }
       throw error;
     }
   }
   ```

5. **Documentation**:
   - Add comprehensive JSDoc comments to all provider-agnostic functions
   - Create usage examples for each provider adapter
   - Document error handling patterns and expected behaviors
   - Example:
   ```typescript
   /**
    * Validates an API key for the specified provider.
    * 
    * This function delegates to provider-specific validation functions and
    * handles error cases consistently.
    * 
    * @param providerId - The provider to validate the API key for
    * @param apiKey - The API key to validate
    * @returns A boolean indicating whether the API key is valid
    * 
    * @example
    * ```ts
    * const isValid = await validateProviderApiKey('openai', 'sk-...');
    * if (isValid) {
    *   // Use the API key...
    * }
    * ```
    */
   export async function validateProviderApiKey(
     providerId: LLMProvider, 
     apiKey: string
   ): Promise<boolean> {
     // Implementation...
   }
   ```

### Future Improvements for Hono API Layer (Pro)

Once the agentdock-core improvements are in place and we begin implementing the Hono API layer, these enhancements should be considered:

1. **Request Validation with Zod**:
   - Implement Zod schemas for all API endpoints
   - Validate route parameters, query parameters, and request bodies
   - Return consistent, structured validation errors

2. **Rate Limiting**:
   - Implement tenant-aware rate limiting based on subscription tier
   - Track usage for credit-based consumption model
   - Apply different limits for different API operations

3. **Advanced Caching Strategies**:
   - Implement Redis-based caching for model lists and other suitable data
   - Support cache invalidation on certain events
   - Implement tenant-specific caching policies

4. **Metrics and Observability**:
   - Add request/response logging
   - Implement performance metrics collection
   - Create structured error tracking

5. **OpenAPI Documentation**:
   - Generate OpenAPI documentation from route definitions
   - Provide interactive API explorer
   - Include request/response examples

## Conclusion

The provider-agnostic API architecture provides a clean abstraction layer that simplifies adding new LLM providers and ensures consistency between implementations. The Next.js reference implementation demonstrates the pattern in a simpler context, while the HONO Pro implementation shows how it integrates with a more complex, multi-tenant system with persistent storage. 

By focusing first on improving agentdock-core with better typing, validation, caching, telemetry, and documentation, we establish a solid foundation for both the open-source implementation and the future Hono-based Pro version. These improvements enhance developer experience, ensure consistency across providers, and prepare the core library for integration into more advanced architectures. 