# Storage System Overview

AgentDock Core provides a flexible and extensible storage abstraction layer designed to handle various data persistence needs. This abstraction layer enables switching between different storage backends without changing application code.

## Core Concepts

-   **Abstraction:** A primary goal is to abstract the underlying storage mechanism, allowing developers to choose the backend that best fits their deployment needs (e.g., in-memory for development, Redis for scalable deployments, Vercel KV for Vercel hosting).
-   **Purpose-Driven Configuration:** Different types of data (Key-Value, Vector, Relational) will ideally be configurable with distinct providers based on their requirements (e.g., using Redis for session KV and pgvector for Vector storage).
-   **Session Scoping:** Much of the core storage usage revolves around managing session-specific data with appropriate isolation and lifecycle management (TTL).
-   **Security:** Includes components like `SecureStorage` for handling sensitive data client-side.

## Key Components (`agentdock-core/src/storage`)

1.  **Storage Abstraction Layer (SAL):**
    -   **Interface (`StorageProvider`):** Defines the standard contract for Key-Value storage operations (`get`, `set`, `delete`, `exists`, etc.).
    -   **Factory (`StorageFactory`, `getStorageFactory`):** Instantiates the configured `StorageProvider` based on environment variables (`KV_STORE_PROVIDER`, `REDIS_URL`, etc.). Manages provider instances.
    -   **Implementations (`/providers` and `/adapters`):**
        -   `MemoryStorageProvider`: Default in-memory KV store.
        -   `RedisStorageProvider`: Uses `@upstash/redis` for Redis/Upstash KV storage.
        -   `VercelKVProvider`: Uses `@vercel/kv` for Vercel KV storage.
        -   Plus 12 additional adapters for various backends (SQLite, PostgreSQL, MongoDB, S3, etc.)
    -   **Vector Support:** PostgreSQL Vector, Pinecone, Qdrant, ChromaDB, and SQLite-vec for AI/embeddings.

2.  **Secure Storage (`SecureStorage`):**
    -   A separate utility class designed for **client-side (browser)** secure storage.
    -   Uses the Web Crypto API (AES-GCM) for encryption and HMAC for integrity checking.
    -   Typically used for storing sensitive browser-side data like user-provided API keys in `localStorage`.
    -   **Note:** This is distinct from the server-side Storage Abstraction Layer used by `SessionManager`, etc.

## Integration with Other Subsystems

-   **Session Management:** `SessionManager` relies *directly* on the SAL (`StorageProvider` via `StorageFactory`) to persist session state.
-   **Orchestration Framework:** `OrchestrationStateManager` uses `SessionManager`, thus indirectly depending on the SAL for persisting orchestration state.
-   **Advanced Memory / RAG:** Vector storage adapters (pgvector, Pinecone, etc.) are ready for AI memory implementation.

## Current Status & Usage

-   The Key-Value part of the Storage Abstraction Layer is implemented and stable, supporting 15 different adapters.
-   This KV storage is actively used by `SessionManager` and `OrchestrationStateManager` for persistence when configured (defaults to Memory).
-   `SecureStorage` is available for client-side use cases.
-   Vector storage abstractions are implemented and ready for AI memory features.

## Further Reading

Dive deeper into specific storage aspects:

-   [Getting Started Guide](./getting-started.md)
-   [Storage Abstraction Layer (Roadmap)](../roadmap/storage-abstraction.md) - Implementation completed Q2 2025
-   [Advanced Memory Systems (Roadmap)](../roadmap/advanced-memory.md)
-   [Session Management](../architecture/sessions/session-management.md) (Details usage of storage)

# Storage Abstraction Layer

AgentDock provides a unified storage interface that allows you to switch between different storage backends without changing your application code.

## Overview

The storage abstraction layer enables:
- **Unified Interface**: Single API for all storage operations
- **Multiple Backends**: Support for 15 storage providers  
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

## Current Implementation Status

### What's Actually Built
- **Storage Abstraction Layer**: Complete with 15 adapters
- **Session Management**: Working with any storage backend (requires persistent storage for survival across restarts)
- **Orchestration State**: Persisted via SessionManager
- **Client-Side Chat History**: Stored in browser localStorage only

### What's NOT Built Yet
- **Server-Side Chat Persistence**: Messages are only in localStorage, not persisted server-side
- **AI Memory System**: Storage adapters support vectors, but no memory implementation exists
- **User Accounts**: No authentication or user management
- **Multi-Tenancy**: Basic namespace support exists, but no tenant management
- **Automatic Backups**: Depends on your storage provider (e.g., Supabase has backups)

### Architecture for Future Features

When these features are built, the architecture would support:

```mermaid
graph LR
    subgraph "Future State - Local Development"
        A1[AgentDock App] --> B1[SQLite<br/>Everything]
        B1 --> C1[Sessions<br/>Messages<br/>History]
    end
    
    subgraph "Future State - Production"
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

### Current Implementation
- **Default Storage**: Memory (non-persistent, resets on restart)
- **Chat Messages**: Browser localStorage only
- **Sessions**: Can persist with configured storage backend
- **Development**: SQLite auto-enabled for persistence

## Available Storage Adapters

### Core Adapters (Always Available)
These three adapters are built into the core and always available:
1. **Memory** - In-memory storage (default, non-persistent)
2. **Redis/Upstash** - Redis-compatible storage via Upstash client
3. **Vercel KV** - Vercel's KV storage (Redis under the hood)

### Auto-Registered Adapters
These adapters are automatically registered by the application when conditions are met:
4. **SQLite** - Auto-registered when `NODE_ENV=development` or `ENABLE_SQLITE=true`
5. **SQLite-vec** - Auto-registered when `NODE_ENV=development` or `ENABLE_SQLITE_VEC=true`
6. **PostgreSQL** - Auto-registered when `DATABASE_URL` is set
7. **PostgreSQL Vector** - Auto-registered when `DATABASE_URL` is set and `ENABLE_PGVECTOR=true`

### Additional Adapters (Manual Registration Required)
These adapters require manual registration in your API routes:
8. **MongoDB** - Document storage (optional, not recommended for memory systems)
9. **S3** - Object storage for files
10. **DynamoDB** - AWS NoSQL database
11. **Cloudflare KV** - Edge key-value storage
12. **Cloudflare D1** - Edge SQL database
13. **Pinecone** - Vector database
14. **Qdrant** - Vector database
15. **ChromaDB** - Vector database

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
| KV Operations | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Batch Ops | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| List Storage | Yes | Yes | Yes | Yes | Yes | Yes | Limited* | Yes | Yes | Yes | Limited** |
| TTL Support | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Namespaces | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Persistence | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Transactions | No | Partial | Partial | Yes | Yes | Yes | No | Yes | No | Yes | No |

*S3 has limited list operations due to object storage nature  
**Vector databases have limited list operations, optimized for vector search instead

## Quick Start

### 1. Local Development

```bash
# Run the app
pnpm dev

# Automatically enabled:
# - SQLite storage adapter registered
# - Sessions persist to ./agentdock.db
# - SQLite-vec adapter registered (vector operations available)
```

What's actually persisted:
- Session state (orchestration state, temporary data)
- Any data you explicitly store via the storage API

What's NOT persisted yet:
- Chat messages (only in browser localStorage)
- User accounts (not implemented)
- AI memory (storage ready, but memory system not built)

### 2. Production Setup (PostgreSQL/Supabase)

For production, you can use any PostgreSQL database. Supabase is a popular choice:

**Step 1: Database Setup**
1. Create a PostgreSQL database (Supabase, Neon, Railway, or self-hosted)
2. Get your connection string

**Step 2: Configure Storage**
```bash
# Add to .env.local
DATABASE_URL=postgresql://user:password@host:5432/dbname
KV_STORE_PROVIDER=postgresql

# Optional: Enable pgvector for future AI features
ENABLE_PGVECTOR=true
```

**Step 3: Enable pgvector (Optional)**
If you plan to use vector features later:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 4: Deploy**
```bash
pnpm build
pnpm start
```

What this enables:
- Session persistence across restarts
- Storage API with PostgreSQL backend
- Vector operations ready (if pgvector enabled)

What still requires implementation:
- Server-side chat persistence
- User authentication
- AI memory system

### 3. Vercel Deployment

```bash
# Both work identically (Upstash under the hood)
KV_STORE_PROVIDER=redis      # Direct Upstash
# OR
KV_STORE_PROVIDER=vercel-kv  # Vercel wrapper
```

## Production Architecture Patterns

### Current Capabilities

```typescript
// What's actually implemented:
{
  sessions: StorageProvider,    // Any configured backend
  orchestration: StorageProvider // Same backend as sessions
}

// What's NOT implemented yet:
{
  messages: undefined,          // Only in browser localStorage
  memory: undefined,            // Storage ready, system not built
  accounts: undefined           // No user management
}
```

### Future Architecture Pattern

When these features are implemented, the recommended architecture would be:

```typescript
// Development
{
  everything: SQLite           // Simple local persistence
}

// Production
{
  sessions: Redis,             // Fast access
  data: PostgreSQL,            // Persistent storage
  vectors: PostgreSQLVector    // AI features
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

## Quick Reference: Storage Configuration

### For AI Chat Applications (Character.AI Style)

#### Development = Zero Config
```bash
# Nothing to configure!
pnpm dev
# SQLite enabled automatically
# Data persists in ./agentdock.db
```

#### Production = 3 Lines in .env.local
```bash
# Step 1: Add these to .env.local
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql

# Step 2: Run
pnpm build && pnpm start
```

### For Basic Applications (No AI Memory)

```bash
# Choose one:
KV_STORE_PROVIDER=memory        # Development only
KV_STORE_PROVIDER=redis         # With Redis/Upstash
KV_STORE_PROVIDER=vercel-kv     # For Vercel deployments
```

### Registering Additional Storage

```typescript
// Only if you need S3, DynamoDB, or vector DBs
import { registerCloudAdapters, registerVectorAdapters } from 'agentdock-core/storage';

// In your API route
const factory = getStorageFactory();
await registerCloudAdapters(factory);     // S3, DynamoDB, Cloudflare
await registerVectorAdapters(factory);    // Pinecone, Qdrant, ChromaDB
```

## Related Documentation

- [Getting Started Guide](./getting-started.md)
- [Advanced Memory Systems](../roadmap/advanced-memory.md)
- [Session Management](../architecture/sessions/session-management.md)

## Complete .env.local Examples

### For Local Development
```bash
# Storage is auto-configured in development
# No .env.local changes needed for storage
```

### For Production
```bash
# PostgreSQL/Supabase Configuration
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
KV_STORE_PROVIDER=postgresql

# Optional: Enable vector extension
ENABLE_PGVECTOR=true

# Alternative: Redis/Upstash for sessions only
REDIS_URL=https://[YOUR-URL].upstash.io
REDIS_TOKEN=[YOUR-TOKEN]
KV_STORE_PROVIDER=redis
```

## Detailed Configuration Reference

### 1. Environment Variables

All storage options you can set in `.env.local`:

```bash
# ==============================================================================
# OFFICIALLY SUPPORTED STORAGE (Auto-registered in app)
# ==============================================================================

# SQLite - Local Development (default in development)
ENABLE_SQLITE=true              # Enable SQLite adapter
ENABLE_SQLITE_VEC=true          # Enable SQLite with vector search for AI memory
SQLITE_PATH=./agentdock.db      # Optional: Custom database path

# PostgreSQL - Production (enabled when DATABASE_URL is set)
DATABASE_URL=postgresql://user:password@localhost:5432/agentdock
ENABLE_PGVECTOR=true            # Enable pgvector extension for AI memory

# Key-Value Storage Provider Selection
KV_STORE_PROVIDER=sqlite        # Options: memory, redis, vercel-kv, sqlite, postgresql

# ==============================================================================
# OPTIONAL STORAGE ADAPTERS (Manual registration required)
# ==============================================================================

# MongoDB (Document storage - not recommended for memory system)
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock

# Redis/Upstash (Session caching)
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=optional-auth-token

# Vercel KV (auto-configured on Vercel)
KV_URL=https://...
KV_REST_API_TOKEN=...

# For other adapters (S3, DynamoDB, vector DBs), see full list in .env.example
```

### 2. Using Auto-Registered Adapters

The app automatically registers these adapters based on environment variables:
- **SQLite**: When `NODE_ENV=development` or `ENABLE_SQLITE=true`
- **SQLite-vec**: When `NODE_ENV=development` or `ENABLE_SQLITE_VEC=true`
- **PostgreSQL**: When `DATABASE_URL` is set
- **PostgreSQL Vector**: When `DATABASE_URL` is set and `ENABLE_PGVECTOR=true`
- **MongoDB**: When `ENABLE_MONGODB=true` and `MONGODB_URI` is set

### 3. Using Additional Storage Adapters (S3, DynamoDB, etc.)

These adapters are NOT auto-registered to keep your app fast. Here's how to use them:

**Step 1: Set Environment Variables**
```bash
# In .env.local, enable what you need:
ENABLE_S3=true
S3_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

**Step 2: Register the Adapter in Your Code**
```typescript
// In app/api/your-route/route.ts
import { getStorageFactory } from 'agentdock-core';
import { registerCloudAdapters } from 'agentdock-core/storage';

export async function POST(req: Request) {
  // Step 2a: Get the factory
  const factory = getStorageFactory();
  
  // Step 2b: Register adapters you need
  if (process.env.ENABLE_S3 === 'true') {
    await registerCloudAdapters(factory);
  }
  
  // Step 3: Use the adapter
  const s3Storage = factory.getProvider({ type: 's3' });
  await s3Storage.set('my-file', fileData);
}
```

**Available Registration Functions:**
- `registerCloudAdapters()` - S3, DynamoDB, Cloudflare
- `registerVectorAdapters()` - Pinecone, Qdrant, ChromaDB
- `registerMongoDBAdapter()` - MongoDB only

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