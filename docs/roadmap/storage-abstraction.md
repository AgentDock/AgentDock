# Storage Abstraction

**Status**: Implemented  
**Priority**: High  
**Complexity**: Medium  
**Target**: Q2 2025

## Overview

AgentDock now includes a comprehensive storage abstraction layer that provides a unified interface for multiple storage backends, enabling developers to switch between different storage solutions without changing application code.

## Phase Status

### Phase 1: Core Implementation (Complete)
- Created unified `StorageProvider` interface
- Implemented factory pattern with environment-based configuration
- Built essential adapters: Memory, Redis, Vercel KV
- Integrated with SessionManager and OrchestrationManager
- Added TTL support across all providers

### Phase 2: Extended Adapters (Complete)
- Added SQLite for local persistence
- Added PostgreSQL for production deployments
- Added PostgreSQL Vector for AI/embeddings
- Added MongoDB as optional document store
- Implemented automatic Node.js adapter registration

### Phase 3: Advanced Features (Complete)
- S3, DynamoDB, Cloudflare KV/D1 adapters ready
- Pinecone, Qdrant, ChromaDB for vector operations
- SQLite-vec for local vector search
- All adapters follow consistent patterns

## Available Adapters (15 Total)

### Always Available (Auto-registered)
1. **Memory** - Default, in-memory storage
2. **Redis/Upstash** - High-performance distributed cache
3. **Vercel KV** - Vercel's Redis-compatible service

### Core Storage (Server-side)
4. **SQLite** - File-based local storage
5. **SQLite-vec** - SQLite with vector search capabilities
6. **PostgreSQL** - Production relational database
7. **PostgreSQL Vector** - pgvector for embeddings
8. **MongoDB** - Document storage (enable with `ENABLE_MONGODB=true`)

### Additional Adapters (Not Auto-registered)
To keep build size small:
- S3, DynamoDB, Cloudflare KV/D1, Pinecone, Qdrant, ChromaDB

## Implementation Details

### Architecture
```typescript
// Unified interface
interface StorageProvider {
  get(key: string): Promise<any>
  set(key: string, value: any, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  list(pattern?: string): Promise<string[]>
}
```

### Configuration
```bash
# Simple env-based setup
KV_STORE_PROVIDER=redis
REDIS_URL=https://your-instance.upstash.io
REDIS_TOKEN=your-token
```

### Usage
```typescript
// Automatic adapter selection
const storage = getStorageFactory().getProvider();
await storage.set('key', 'value');
```

## Key Achievements

1. **Zero Breaking Changes**: Default memory storage maintains compatibility
2. **Simple Configuration**: Environment variables control everything
3. **Production Ready**: Battle-tested adapters for all use cases (15 total)
4. **Developer Friendly**: Single API to learn, works everywhere
5. **Flexible Architecture**: Easy to add new storage backends
6. **Build Optimization**: Non-essential adapters not auto-registered to keep builds small

## Technical Decisions

1. **Factory Pattern**: Centralized adapter management
2. **Dynamic Imports**: Node.js adapters load only when needed
3. **TTL First-class**: Built into core interface
4. **Environment Config**: Simple setup via env vars

## Use Cases

### Current
- **Session Management**: Redis for distributed sessions
- **Message History**: PostgreSQL for durability
- **Vector Search**: pgvector for semantic search
- **Development**: SQLite for local persistence

### Future Considerations
- Storage migration utilities
- Multi-provider sync capabilities
- Compression middleware
- Encryption at rest

## Documentation

- [Storage Overview](../storage/README.md)
- [Getting Started Guide](../storage/getting-started.md)
- [Architecture Docs](../architecture/sessions/session-management.md)

## Success Metrics

- 15 production-ready adapters (including SQLite-vec)
- Zero-config memory storage  
- < 5 min setup for any adapter
- No client-side bundling issues
- Backward compatible

---

**Status Update**: The storage abstraction layer is fully implemented and production-ready. All planned adapters are complete. Focus has shifted to building features on top of this foundation. 