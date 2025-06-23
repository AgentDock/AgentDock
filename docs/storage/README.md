# Storage Documentation

This document provides comprehensive information about AgentDock's storage abstraction layer.

## Overview

AgentDock uses a storage abstraction layer that supports multiple providers through a common interface. This design enables flexibility in deployment scenarios and clean separation of storage concerns from business logic.

## Architecture

### Storage Provider Interface

All storage adapters implement the `StorageProvider` interface:

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

### Adapter Registration Hierarchy

Storage adapters are registered at different levels:

1. **Core Factory Auto-Registration** (built into factory.ts):
   - Memory (always available)
   - Redis (when REDIS_URL configured)
   - Vercel KV (when Vercel environment detected)

2. **Application Auto-Registration** (via storage-init.ts):
   - SQLite (development or ENABLE_SQLITE=true)
   - SQLite-vec (development or ENABLE_SQLITE_VEC=true)
   - PostgreSQL (when DATABASE_URL configured)
   - PostgreSQL Vector (when ENABLE_PGVECTOR=true)
   - MongoDB (when ENABLE_MONGODB=true AND MONGODB_URI configured)

3. **Manual Registration Required**:
   - All cloud storage providers (S3, Azure, GCS)
   - All Cloudflare adapters (KV, D1, R2)
   - All vector databases (ChromaDB, Pinecone, Qdrant)
   - DynamoDB

## Available Storage Adapters

### Core Adapters (Auto-registered at factory level)

1. **Memory** - In-memory storage, no persistence
2. **Redis/Upstash** - High-performance cache with persistence
3. **Vercel KV** - Vercel's managed Redis service

### Application-Registered Adapters

These are automatically registered by the application based on environment configuration:

4. **SQLite** - File-based relational database for local development
5. **SQLite-vec** - SQLite with vector search extension
6. **PostgreSQL** - Production-grade relational database
7. **PostgreSQL Vector** - PostgreSQL with pgvector extension
8. **MongoDB** - Document database (optional, requires explicit enable flag)

### Additional Adapters (Manual Registration)

These adapters are available but require manual registration to minimize build size:

9. **S3** - Object storage for large files
10. **DynamoDB** - AWS NoSQL database
11. **Cloudflare KV** - Edge key-value storage
12. **Cloudflare D1** - Edge SQL database
13. **Cloudflare R2** - S3-compatible object storage
14. **Azure Table Storage** - NoSQL key-value store
15. **Azure Blob Storage** - Object storage
16. **Google Cloud Storage** - Object storage
17. **Google Firestore** - NoSQL document database
18. **ChromaDB** - Vector database for embeddings
19. **Pinecone** - Managed vector database
20. **Qdrant** - Vector similarity search engine

## Adapter Capabilities Matrix

| Feature | Memory | Redis | Vercel KV | SQLite | PostgreSQL | MongoDB | S3 | DynamoDB | CF KV | CF D1 | Vector DBs |
|---------|--------|-------|-----------|---------|------------|---------|-----|----------|-------|-------|------------|
| KV Operations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch Ops | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List Storage | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| TTL Support | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Namespaces | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Persistence | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transactions | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Vector Ops | ❌ | ❌ | ❌ | ✅* | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

*With extensions: SQLite requires sqlite-vec, PostgreSQL requires pgvector

## Configuration

### Environment Variables

```bash
# Storage Provider Selection
KV_STORE_PROVIDER=sqlite  # Options: memory, redis, vercel-kv, sqlite, postgresql, mongodb

# SQLite Configuration
ENABLE_SQLITE=true              # Enable SQLite adapter
ENABLE_SQLITE_VEC=true          # Enable SQLite vector extension
SQLITE_PATH=./agentdock.db      # Database file path

# PostgreSQL Configuration
DATABASE_URL=postgresql://user:password@host:port/database
ENABLE_POSTGRESQL=true          # Explicit enable flag
ENABLE_PGVECTOR=true           # Enable pgvector extension

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=optional-auth-token

# MongoDB Configuration (Optional)
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock

# Session Configuration
SESSION_TTL_SECONDS=1800        # Default: 30 minutes
```

### Registration Examples

#### Using Auto-Registered Adapters

```typescript
// These work automatically in API routes
import { getStorageFactory } from 'agentdock-core';

const factory = getStorageFactory();
const storage = factory.getProvider({ type: 'sqlite' });
```

#### Registering Additional Adapters

```typescript
import { getStorageFactory } from 'agentdock-core';
import { registerS3Adapter, registerMongoDBAdapter } from 'agentdock-core/storage';

export async function POST(req: Request) {
  const factory = getStorageFactory();
  
  // Register adapters as needed
  await registerS3Adapter(factory);
  await registerMongoDBAdapter(factory);
  
  // Use them
  const s3 = factory.getProvider({ type: 's3' });
  const mongo = factory.getProvider({ type: 'mongodb' });
}
```

## Development Guidelines

### Local Development

For local development, SQLite is automatically configured:

```bash
pnpm dev
# Automatically uses SQLite at ./agentdock.db
```

### Production Deployment

For production, PostgreSQL with Supabase is recommended:

```bash
# Configure environment
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql

# Enable pgvector in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### Edge Deployment

For edge environments (Vercel Edge Functions, Cloudflare Workers):
- Use Memory, Redis (via HTTP), or platform-specific adapters
- Avoid Node.js-dependent adapters (SQLite, file system)

## Implementation Notes

### Current Implementation

The storage abstraction layer provides:
- Unified interface across all storage providers
- Namespace isolation for multi-tenancy
- TTL support for automatic expiration
- Batch operations for performance
- Type-safe TypeScript implementation

### Planned Features

The following features are planned but not yet implemented:
- Persistent chat history
- Advanced AI memory system
- Automatic backup mechanisms
- Cross-region replication

The current implementation provides the foundation for these future features.

## MongoDB Clarification

MongoDB is **not** automatically registered at the core factory level. It requires:
1. Setting `ENABLE_MONGODB=true` in environment variables
2. Providing `MONGODB_URI` configuration
3. The application's storage initialization to register it

MongoDB is considered optional and is not the recommended storage for the planned memory system. The recommended stack is:
- **Development**: SQLite with sqlite-vec extension
- **Production**: PostgreSQL with pgvector extension

## Troubleshooting

### Module Not Found Errors
- Ensure Node.js adapters are only used server-side
- Check that required environment variables are set

### Storage Not Persisting
- Verify you're not using the default Memory provider
- Check `KV_STORE_PROVIDER` configuration

### MongoDB Not Working
- Confirm `ENABLE_MONGODB=true` is set
- Verify `MONGODB_URI` is properly configured
- Check that MongoDB adapter registration is successful

### Vector Operations Not Available
- For SQLite: Install sqlite-vec extension
- For PostgreSQL: Enable pgvector extension
- For dedicated vector DBs: Register appropriate adapter

## See Also

- [Getting Started Guide](./getting-started.md)
- [Advanced Memory System](../roadmap/advanced-memory.md)
- [Storage Tests](../../agentdock-core/src/storage/__tests__) 