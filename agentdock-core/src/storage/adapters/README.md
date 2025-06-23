# Storage Adapters

## Overview

Storage adapters provide database-specific implementations of the storage abstraction layer. Each adapter follows a consistent architecture pattern for maintainability and extensibility.

## Architecture Pattern

Each adapter is organized into focused modules:

```
adapter-name/
├── index.ts              # Main adapter class (delegates to operations)
├── connection.ts         # Connection/pool management
├── operations/
│   ├── kv.ts            # Key-value operations
│   ├── list.ts          # List operations
│   └── batch.ts         # Batch operations
├── schema.ts            # Schema initialization & migrations
└── types.ts             # Adapter-specific types
```

## File Size Guidelines

Following best practices, each file should be:
- **Under 400 lines** maximum
- **Ideally 100-300 lines** for optimal maintainability
- Focused on a single responsibility

## Module Responsibilities

### `index.ts` (Main Adapter)
- Extends `BaseStorageAdapter`
- Coordinates all operations
- Delegates to operation modules
- ~150 lines

### `connection.ts`
- Database connection/pool management
- Connection lifecycle (create, close)
- Resource cleanup
- ~100-150 lines

### `operations/kv.ts`
- Key-value CRUD operations
- Namespace management
- Serialization/deserialization
- ~250 lines

### `operations/list.ts`
- List-specific operations
- Range queries
- ~150 lines

### `operations/batch.ts`
- Batch operations with transactions
- Bulk optimizations
- ~150-200 lines

### `schema.ts`
- Table/collection creation
- Index management
- Schema migrations
- ~100-150 lines

### `types.ts`
- Adapter configuration interfaces
- Internal types
- Row/document types
- ~50-100 lines

## Implementation Example

```typescript
// Main adapter delegates to operations
export class SQLiteAdapter extends BaseStorageAdapter {
  private connection: SQLiteConnection;
  private kv: KVOperations;
  private listOps: ListOperations;
  private batch: BatchOperations;

  constructor(options: SQLiteAdapterOptions) {
    super();
    this.connection = createConnection(options);
    this.kv = new KVOperations(this.connection);
    this.listOps = new ListOperations(this.connection);
    this.batch = new BatchOperations(this.connection);
  }

  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    return this.kv.get<T>(key, options);
  }
  // ... other delegated methods
}
```

## Creating a New Adapter

1. **Create folder structure**
   ```bash
   mkdir -p adapters/your-adapter/operations
   ```

2. **Define types** (`types.ts`)
   - Configuration options interface
   - Connection wrapper interface
   - Internal types

3. **Implement connection** (`connection.ts`)
   - Connection creation
   - Resource management
   - Cleanup logic

4. **Implement schema** (`schema.ts`)
   - Initial setup
   - Table/collection creation
   - Indexes

5. **Implement operations**
   - `operations/kv.ts` - Basic CRUD
   - `operations/list.ts` - List operations
   - `operations/batch.ts` - Batch operations

6. **Create main adapter** (`index.ts`)
   - Extend `BaseStorageAdapter`
   - Initialize operations
   - Delegate method calls

## Testing

Each module should have corresponding tests:

```
adapter-name/
├── __tests__/
│   ├── connection.test.ts
│   ├── operations/
│   │   ├── kv.test.ts
│   │   ├── list.test.ts
│   │   └── batch.test.ts
│   └── schema.test.ts
```

## Common Patterns

### Key Management
```typescript
private getFullKey(key: string, namespace?: string): string {
  const ns = namespace || this.connection.defaultNamespace;
  return ns ? `${ns}:${key}` : key;
}
```

### Serialization
```typescript
private serializeValue<T>(value: T): string {
  return JSON.stringify(value);
}

private deserializeValue<T>(value: string): T {
  try {
    return JSON.parse(value);
  } catch {
    return value as unknown as T;
  }
}
```

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  logger.error(LogCategory.STORAGE, 'AdapterName', 'Operation failed', {
    key,
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
```

## Performance Considerations

1. **Connection Pooling**: Reuse connections where possible
2. **Batch Operations**: Use transactions for multiple operations
3. **Prepared Statements**: Use parameterized queries
4. **Cleanup**: Implement TTL cleanup efficiently
5. **Indexes**: Create appropriate indexes for common queries

## Current Adapters

- **SQLite** ✅: Default adapter for OSS, zero-config persistent storage
  - In-memory and file-based storage
  - Automatic cleanup for expired items
  - Full namespace support
  - Batch operations with transactions
  
- **PostgreSQL** ✅: Production-ready with ACID compliance
  - Connection pooling with configurable limits
  - JSONB storage for complex data types
  - Schema support for multi-tenant applications
  - Prepared statements for performance

## Planned Adapters

- **MongoDB**: Document-based storage
- **S3**: Object storage for large values
- **DynamoDB**: Serverless key-value storage
- **Cloudflare KV/D1**: Edge storage solutions
- **Vector Databases**: For AI/ML workloads

## Available Adapters

### Core Storage Adapters

#### SQLite Adapter
- **Module**: `sqlite/`
- **Use Case**: Default storage for open-source, local development
- **Features**: Zero-config, file-based persistence, in-memory option
- **External Dependency**: `better-sqlite3`

#### SQLite-vec Adapter ✨ NEW
- **Module**: `sqlite-vec/`
- **Use Case**: Local development with vector search capabilities
- **Features**: All SQLite features + vector similarity search
- **External Dependencies**: `better-sqlite3`, `sqlite-vec` extension
- **Note**: Requires sqlite-vec extension to be installed

### Production Adapters

#### PostgreSQL Adapter  
- **Module**: `postgresql/`
- **Use Case**: Production deployments, ACID compliance
- **Features**: Connection pooling, transactions, JSON/JSONB support
- **External Dependency**: `pg`

#### PostgreSQL Vector Adapter
- **Module**: `postgresql-vector/`
- **Use Case**: Production AI/ML workloads with vector search
- **Features**: All PostgreSQL features + pgvector extension
- **External Dependencies**: `pg`, pgvector extension

#### MongoDB Adapter
- **Module**: `mongodb/`
- **Use Case**: Document storage, flexible schemas
- **Features**: Native TTL indexes, change streams, text search
- **External Dependency**: `mongodb`

### Cloud Storage Adapters

#### S3 Adapter
- **Module**: `s3/`
- **Use Case**: Large object storage, blob storage
- **Features**: Presigned URLs, metadata-based TTL, S3-compatible services
- **External Dependencies**: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`

#### DynamoDB Adapter
- **Module**: `dynamodb/`
- **Use Case**: Serverless key-value storage on AWS
- **Features**: Auto-scaling, TTL support, global tables
- **External Dependency**: `@aws-sdk/client-dynamodb`

#### Cloudflare KV Adapter
- **Module**: `cloudflare-kv/`
- **Use Case**: Edge key-value storage
- **Features**: Global distribution, Workers integration
- **External Dependency**: Cloudflare Workers runtime

#### Cloudflare D1 Adapter
- **Module**: `cloudflare-d1/`
- **Use Case**: Edge SQL database
- **Features**: SQLite-compatible, Workers integration
- **External Dependency**: Cloudflare Workers runtime

### Vector Database Adapters

#### Pinecone Adapter
- **Module**: `pinecone/`
- **Use Case**: Managed vector database for AI applications
- **Features**: Similarity search, metadata filtering, namespaces
- **External Dependency**: `@pinecone-database/pinecone`

#### Qdrant Adapter
- **Module**: `qdrant/`
- **Use Case**: Open-source vector database
- **Features**: Rich filtering, payload storage, batch operations
- **External Dependency**: HTTP client (built-in)

#### ChromaDB Adapter
- **Module**: `chromadb/`
- **Use Case**: Open-source embedding database
- **Features**: Multi-modal embeddings, metadata filtering
- **External Dependency**: `chromadb`

### Summary

**Total Adapters**: 15 (including 3 built-in providers)
- **Built-in Providers**: Memory, Redis, Vercel KV (in `/providers`)
- **Storage Adapters**: 12 database/cloud adapters (in `/adapters`)
- **Vector-capable**: 5 adapters (SQLite-vec, PostgreSQL Vector, Pinecone, Qdrant, ChromaDB) 