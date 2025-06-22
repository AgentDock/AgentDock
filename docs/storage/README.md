# Storage System Overview

AgentDock Core provides a flexible and extensible storage system designed to handle various data persistence needs, from session state to configuration and potentially large-scale memory or vector data in the future.

## Core Concepts

-   **Abstraction:** A primary goal is to abstract the underlying storage mechanism, allowing developers to choose the backend that best fits their deployment needs (e.g., in-memory for development, Redis for scalable deployments, Vercel KV for Vercel hosting).
-   **Purpose-Driven Configuration:** Different types of data (Key-Value, Vector, Relational) will ideally be configurable with distinct providers based on their requirements (e.g., using Redis for session KV and pgvector for Vector storage).
-   **Session Scoping:** Much of the core storage usage revolves around managing session-specific data with appropriate isolation and lifecycle management (TTL).
-   **Security:** Includes components like `SecureStorage` for handling sensitive data client-side.

## Key Components (`agentdock-core/src/storage`)

1.  **Storage Abstraction Layer (SAL):**
    -   **Interface (`StorageProvider`):** Defines the standard contract for Key-Value storage operations (`get`, `set`, `delete`, `exists`, etc.).
    -   **Factory (`StorageFactory`, `getStorageFactory`):** Instantiates the configured `StorageProvider` based on environment variables (`KV_STORE_PROVIDER`, `REDIS_URL`, etc.). Manages provider instances.
    -   **Implementations (`/providers`):**
        -   `MemoryStorageProvider`: Default in-memory KV store.
        -   `RedisStorageProvider`: Uses `@upstash/redis` for Redis/Upstash KV storage.
        -   `VercelKVProvider`: Uses `@vercel/kv` for Vercel KV storage.
    -   *(Planned: Interfaces and providers for Vector and Relational storage)*

2.  **Secure Storage (`SecureStorage`):**
    -   A separate utility class designed for **client-side (browser)** secure storage.
    -   Uses the Web Crypto API (AES-GCM) for encryption and HMAC for integrity checking.
    -   Typically used for storing sensitive browser-side data like user-provided API keys in `localStorage`.
    -   **Note:** This is distinct from the server-side Storage Abstraction Layer used by `SessionManager`, etc.

## Integration with Other Subsystems

-   **Session Management:** `SessionManager` relies *directly* on the SAL (`StorageProvider` via `StorageFactory`) to persist session state.
-   **Orchestration Framework:** `OrchestrationStateManager` uses `SessionManager`, thus indirectly depending on the SAL for persisting orchestration state.
-   **(Planned) Advanced Memory / RAG:** Will likely leverage both the Key-Value SAL (for metadata) and the future Vector Storage components.

## Current Status & Usage

-   The Key-Value part of the Storage Abstraction Layer is implemented and stable, supporting Memory, Redis, and Vercel KV.
-   This KV storage is actively used by `SessionManager` and `OrchestrationStateManager` for persistence when configured (defaults to Memory).
-   `SecureStorage` is available for client-side use cases.
-   Vector and Relational storage abstractions are planned but not yet implemented.

## Further Reading

Dive deeper into specific storage aspects:

-   [Storage Abstraction Layer (Roadmap)](../roadmap/storage-abstraction.md)
-   [Vector Storage Integration (Roadmap)](../roadmap/vector-storage.md)
-   [Advanced Memory Systems (Roadmap)](../roadmap/advanced-memory.md)
-   [Session Management](../architecture/sessions/session-management.md) (Details usage of storage)

# Storage Abstraction Layer

AgentDock provides a unified storage interface that allows you to switch between different storage backends without changing your application code.

## Overview

The storage abstraction layer enables:
- **Unified Interface**: Single API for all storage operations
- **Multiple Backends**: Support for 14+ storage providers  
- **Session Management**: Store orchestration state and session data
- **TTL Support**: Built-in expiration for all adapters
- **Environment Configuration**: Simple setup via environment variables

## Why This Architecture?

### Open Source First, Commercial Ready

AgentDock Core is designed with a clear separation between open source and commercial concerns:

- **Open Source Core**: The storage abstraction layer and all adapters remain fully open source
- **Commercial Independence**: AgentDock's commercial products (Pro, Enterprise) are built ON TOP of the core, not inside it
- **No Vendor Lock-in**: Core consumers can use AgentDock without any commercial features interfering
- **Clean Architecture**: Commercial features like advanced multi-tenancy, billing, and enterprise auth layer cleanly on top

This design ensures that:
1. Open source users get a complete, production-ready storage system
2. Commercial features never pollute or complicate the core
3. Both open source and commercial products can evolve independently
4. The community benefits from enterprise-grade storage patterns without enterprise complexity

### Multi-Tenancy Considerations

The storage layer supports multi-tenancy through namespace isolation:
- **Open Source**: Single-tenant or simple namespace-based isolation
- **Commercial Products**: Advanced multi-tenancy with organization-level isolation
- **Same Core**: Both use the exact same storage adapters and patterns

## Storage Architecture

```mermaid
graph TD
    subgraph "Client Browser"
        A[AgentDock UI] --> B[localStorage<br/>Chat Messages]
    end
    
    subgraph "API Routes"
        A --> C[Chat API]
        C --> D[Session Manager]
        D --> E[Storage Factory]
        
        E --> F{Storage Provider}
        F --> G[Memory<br/>Development]
        F --> H[Redis/Upstash<br/>Session Cache]
        F --> I[Vercel KV<br/>Vercel Deployments]
        F --> J[SQLite<br/>Local Default]
        F --> K[PostgreSQL/Supabase<br/>Production Data]
        F --> L[PG Vector<br/>AI Memory]
    end
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style J fill:#9f9,stroke:#333,stroke-width:2px
    style K fill:#99f,stroke:#333,stroke-width:2px
    style H fill:#9ff,stroke:#333,stroke-width:2px
```

## Character.AI Style Architecture

For building character.ai-style applications with persistent conversations:

```mermaid
graph LR
    subgraph "Local Development"
        A1[AgentDock App] --> B1[SQLite<br/>Everything]
        B1 --> C1[Sessions<br/>Messages<br/>History]
    end
    
    subgraph "Production"
        A2[AgentDock App] --> B2[Redis/Upstash<br/>Sessions]
        A2 --> B3[PostgreSQL/Supabase<br/>Accounts & Messages]
        A2 --> B4[PG Vector<br/>AI Memory]
        
        B2 --> C2[Fast Session Access]
        B3 --> C3[Persistent Data]
        B4 --> C4[Semantic Search]
    end
    
    style A1 fill:#f9f,stroke:#333,stroke-width:2px
    style A2 fill:#f9f,stroke:#333,stroke-width:2px
    style B3 fill:#99f,stroke:#333,stroke-width:2px
    style B2 fill:#9ff,stroke:#333,stroke-width:2px
```

## Storage Defaults

### Open Source Client
- **Local Development**: SQLite (all data in one place)
- **Production**: Redis (sessions) + PostgreSQL/Supabase (data) + PG Vector (memory)
- **Current State**: Browser localStorage (will migrate to SQLite)

## Available Storage Adapters

### Always Available (Auto-registered)
1. **Memory** - In-memory storage for quick demos
2. **Redis/Upstash** - High-performance session cache
3. **Vercel KV** - Vercel's Redis wrapper (same as Upstash)

### Optional Server-Side Adapters
4. **SQLite** - Local file-based storage (recommended for development)
5. **PostgreSQL/Supabase** - Production-grade relational storage (recommended for production)
6. **PostgreSQL Vector** - Vector embeddings with pgvector for AI memory
7. **MongoDB** - Document storage (requires `ENABLE_MONGODB=true`)

### Additional Adapters (In Core)
- **S3**, **DynamoDB**, **Cloudflare KV/D1** - Cloud storage options
- **Pinecone**, **Qdrant**, **ChromaDB** - Vector databases for advanced AI features

## Adapter Pattern Compliance

### StorageProvider Interface

All storage adapters in AgentDock Core implement the `StorageProvider` interface, ensuring consistent behavior across different backends:

```typescript
interface StorageProvider {
  // Core KV Operations
  get<T>(key: string, options?: StorageOptions): Promise<T | null>
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>
  delete(key: string, options?: StorageOptions): Promise<boolean>
  exists(key: string, options?: StorageOptions): Promise<boolean>
  
  // Batch Operations
  getMany<T>(keys: string[], options?: StorageOptions): Promise<Record<string, T | null>>
  setMany<T>(items: Record<string, T>, options?: StorageOptions): Promise<void>
  deleteMany(keys: string[], options?: StorageOptions): Promise<number>
  
  // List Operations
  getList<T>(key: string, start?: number, end?: number, options?: StorageOptions): Promise<T[] | null>
  saveList<T>(key: string, values: T[], options?: StorageOptions): Promise<void>
  deleteList(key: string, options?: StorageOptions): Promise<boolean>
  
  // Management Operations
  list(prefix: string, options?: ListOptions): Promise<string[]>
  clear(prefix?: string): Promise<void>
  destroy?(): Promise<void>
}
```

### Implementation Standards

Every adapter follows these standards:

1. **Namespace Isolation**: All operations respect namespace boundaries for multi-tenancy
2. **TTL Support**: Optional time-to-live for automatic expiration
3. **Type Safety**: Full TypeScript coverage with zero `any` types
4. **Error Handling**: Consistent error patterns and recovery strategies
5. **Performance**: Batch operations for efficiency
6. **Modularity**: Clean separation of concerns, max 250 lines per module

### Adapter Capabilities Matrix

| Feature | Memory | Redis | Vercel KV | SQLite | PostgreSQL | MongoDB | S3 | DynamoDB | CF KV | CF D1 | Vector DBs |
|---------|--------|-------|-----------|---------|------------|---------|-----|----------|-------|-------|------------|
| KV Operations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch Ops | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List Storage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️* | ✅ | ✅ | ✅ | ⚠️** |
| TTL Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Namespaces | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Persistence | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transactions | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |

*S3 has limited list operations due to object storage nature  
**Vector databases have limited list operations, optimized for vector search instead

## Quick Start

### 1. Local Development (Character.AI Style)

```bash
# .env.local
KV_STORE_PROVIDER=sqlite  # Everything in SQLite
# Automatic: ./agentdock.db file created

# All data persisted locally:
# - User sessions
# - Chat messages  
# - Conversation history
```

### 2. Production Setup (Recommended)

```bash
# .env.local
# Session caching (fast access)
KV_STORE_PROVIDER=redis
REDIS_URL=https://your-instance.upstash.io
REDIS_TOKEN=your-token

# Primary data storage (accounts, messages, history)
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres
ENABLE_POSTGRESQL=true

# AI memory (semantic search)
ENABLE_PGVECTOR=true
```

### 3. Vercel Deployment

```bash
# Both work identically (Upstash under the hood)
KV_STORE_PROVIDER=redis      # Direct Upstash
# OR
KV_STORE_PROVIDER=vercel-kv  # Vercel wrapper
```

## Production Architecture

### For Character.AI Style Apps

```typescript
// Development: Single SQLite database
{
  sessions: SQLite,     // User sessions
  messages: SQLite,     // Chat history
  memory: SQLite,       // Agent memory
  accounts: SQLite      // User data
}

// Production: Optimized storage mix
{
  sessions: Redis,      // Fast session access
  messages: PostgreSQL, // Persistent chat history
  memory: PGVector,     // Semantic AI memory
  accounts: PostgreSQL  // User data with Supabase
}
```

## Design Decisions Explained

### Why This Architecture?

1. **Separation of Concerns**: Storage is independent of business logic
2. **Flexibility**: Switch backends without code changes
3. **Performance**: Use the right storage for each data type
4. **Scalability**: From local SQLite to distributed systems
5. **Multi-tenancy Ready**: Namespace isolation built-in

### Future-Proofing

The storage layer is designed to support:
- **Open Source Growth**: Community can add adapters without touching core
- **Commercial Features**: Enterprise features layer on top cleanly
- **AI Evolution**: Vector storage ready for advanced AI features
- **Global Scale**: From single-user to millions of concurrent sessions

## Next Steps

### Benchmarks (Priority)
- Performance testing across all adapters
- Optimization recommendations
- Best practices guide

### Future Features
- Admin dashboard for multi-tenancy
- Traceability and observability
- Advanced memory modules
- Vertical-specific optimizations

## Configuration Reference

### Environment Variables

```bash
# Storage Selection
KV_STORE_PROVIDER=sqlite  # memory, redis, vercel-kv, sqlite, postgresql, mongodb

# SQLite (auto-configured)
# No additional config needed

# Redis/Upstash
REDIS_URL=https://...
REDIS_TOKEN=...

# PostgreSQL/Supabase
DATABASE_URL=postgresql://...
ENABLE_POSTGRESQL=true
ENABLE_PGVECTOR=true  # For AI memory

# Session Configuration
SESSION_TTL_SECONDS=1800  # 30 minutes default

# Optional Adapters
ENABLE_MONGODB=true
MONGODB_URI=mongodb://...
```

## Migration Path

### Current → Future
1. **Now**: Browser localStorage for chat UI
2. **Next**: SQLite for local persistence
3. **Production**: Redis + PostgreSQL + PG Vector

### Simple Demo Setup
```bash
# One command, everything works
KV_STORE_PROVIDER=sqlite
# SQLite handles sessions, messages, and history
```

## Related Documentation

- [Getting Started Guide](./getting-started.md)
- [Advanced Memory Systems](../roadmap/advanced-memory.md)
- [Session Management](../architecture/sessions/session-management.md)

## Configuration

### 1. Environment Variables

Set these in your `.env.local` file (main app directory):

```bash
# Storage Type Selection
KV_STORE_PROVIDER=redis  # Options: memory, redis, vercel-kv, sqlite, postgresql

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=optional-auth-token

# PostgreSQL Configuration  
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# MongoDB Configuration (optional)
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock

# Vercel KV (auto-configured on Vercel)
KV_URL=https://...
KV_REST_API_TOKEN=...
```

### 2. Enabling Node.js Adapters

Node.js adapters (SQLite, PostgreSQL, MongoDB) must be registered server-side. This happens automatically in the orchestration adapter, but if you need them elsewhere:

```typescript
// In any API route file
import { registerNodeAdapters } from 'agentdock-core/storage';

// Call once at module level
if (typeof window === 'undefined') {
  await registerNodeAdapters();
}
```

### 3. Storage Selection Logic

The system selects storage based on:

1. **Environment Variable**: `KV_STORE_PROVIDER`
2. **Fallback Logic**: 
   - If Redis URL exists → Use Redis
   - If on Vercel → Use Vercel KV
   - Otherwise → Use Memory (with warning)

## Usage Examples

### Character.AI Style App (Redis)

For a character.ai style app with persistent conversations:

```bash
# .env.local
KV_STORE_PROVIDER=redis
REDIS_URL=redis://localhost:6379
```

### Production with PostgreSQL

```bash
# .env.local
KV_STORE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/agentdock
```

### Development with SQLite

```bash
# .env.local
KV_STORE_PROVIDER=sqlite
# No DATABASE_URL needed - uses local file
```

## Architecture Decision

- **Client-side**: Only Memory storage (no direct DB access)
- **API Routes**: All storage adapters available
- **Edge Functions**: Memory, Redis (Upstash), Vercel KV

## Troubleshooting

### "Module not found" errors
- Node.js adapters aren't available client-side
- Ensure you're only using them in API routes

### Storage not persisting
- Check if you're using Memory storage (default)
- Set `KV_STORE_PROVIDER` to a persistent option

### MongoDB not working
- Ensure `ENABLE_MONGODB=true` is set
- MongoDB adapter is optional to reduce dependencies 