# AgentDock Storage Abstraction

The storage abstraction provides a unified interface for key-value storage across different backends, enabling AgentDock to work with various storage providers from local development to production deployments.

## Current Providers

### Production Ready
- **SQLite** (default) - Zero-config local storage with file persistence
- **PostgreSQL** - Production-ready with ACID compliance and connection pooling
- **MongoDB** - Document-based NoSQL storage with native TTL support
- **Memory** - In-memory storage for development and testing
- **Redis** - Distributed caching and session storage  
- **Vercel KV** - For Vercel deployments

### Additional Providers

Currently implemented:
- **S3** - Object storage for large files and backups
- **DynamoDB** - AWS serverless NoSQL database
- **Cloudflare KV** - Edge key-value storage
- **Cloudflare D1** - Edge SQL database
- **PostgreSQL Vector** - pgvector extension for embeddings
- **Pinecone** - Managed vector database
- **Qdrant** - Open-source vector database
- **ChromaDB** - Open-source embeddings database

### Coming Soon
- **Weaviate** - Additional vector database option

## Quick Start

### SQLite (Default)

```typescript
import { getStorageFactory } from '@agentdock/core';

// Uses SQLite by default
const storage = getStorageFactory().getDefaultProvider();

// Or explicitly
const sqliteStorage = getStorageFactory().getProvider({
  type: 'sqlite',
  namespace: 'myapp',
  config: {
    path: './data/myapp.db', // Default: ./agentdock.db
    walMode: true           // Default: true
  }
});

// In-memory SQLite for testing
const memoryDb = getStorageFactory().getProvider({
  type: 'sqlite',
  config: {
    path: ':memory:'
  }
});
```

### PostgreSQL

```typescript
const pgStorage = getStorageFactory().getProvider({
  type: 'postgresql',
  namespace: 'myapp',
  config: {
    connectionString: 'postgresql://user:password@localhost:5432/mydb',
    // Or individual options
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'user',
      password: 'password'
    },
    pool: {
      max: 20,                // Max connections
      idleTimeoutMillis: 30000
    },
    schema: 'myapp',         // Default: 'public'
    ssl: true                // For production
  }
});
```

### MongoDB

```typescript
const mongoStorage = getStorageFactory().getProvider({
  type: 'mongodb',
  namespace: 'myapp',
  config: {
    uri: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'agentdock_kv',  // Optional
    options: {
      maxPoolSize: 10,
      minPoolSize: 2
    },
    indexes: [
      // Custom indexes
      { key: { 'metadata.userId': 1 }, options: { sparse: true } }
    ]
  }
});

// Or use environment variable
// MONGODB_URI=mongodb://localhost:27017
const mongoStorage = getStorageFactory().getProvider({
  type: 'mongodb',
  config: { database: 'myapp' }
});
```

## Supported Storage Adapters

### Built-in Adapters

**Key-Value Storage:**
1. **Memory** - In-memory storage for development and testing
2. **SQLite** (default) - Zero-config local file-based storage with SQL capabilities
3. **PostgreSQL** - Production-ready RDBMS with full ACID compliance
4. **MongoDB** - Document database for flexible schemas
5. **Redis** - High-performance distributed key-value store
6. **Vercel KV** - Serverless Redis-compatible storage
7. **Cloudflare KV** - Edge key-value storage
8. **Cloudflare D1** - Edge SQL database
9. **DynamoDB** - AWS managed NoSQL database

**Object Storage:**
10. **S3** - AWS S3 and compatible object storage for large files

**Vector Storage:**
11. **PostgreSQL Vector** - pgvector extension for embeddings
12. **Pinecone** - Managed vector database service
13. **Qdrant** - Open-source vector database
14. **ChromaDB** - Open-source embeddings database

## Usage Examples

### Basic Operations

```typescript
// Set a value
await storage.set('user:123', { 
  name: 'Alice', 
  email: 'alice@example.com' 
});

// Get a value
const user = await storage.get('user:123');

// Check existence
const exists = await storage.exists('user:123');

// Delete a value
await storage.delete('user:123');
```

### TTL Support

```typescript
// Set with expiration
await storage.set('session:abc', sessionData, {
  ttlSeconds: 3600  // Expires in 1 hour
});
```

### Batch Operations

```typescript
// Set multiple values
await storage.setMany({
  'user:1': { name: 'Alice' },
  'user:2': { name: 'Bob' },
  'user:3': { name: 'Charlie' }
});

// Get multiple values
const users = await storage.getMany(['user:1', 'user:2', 'user:3']);

// Delete multiple values
const deletedCount = await storage.deleteMany(['user:1', 'user:2']);
```

### List Operations

```typescript
// Save a list
await storage.saveList('recent-searches', [
  'typescript tutorial',
  'agentdock storage',
  'ai agents'
]);

// Get list items
const searches = await storage.getList('recent-searches', 0, 2);
// Returns: ['typescript tutorial', 'agentdock storage']

// Delete a list
await storage.deleteList('recent-searches');
```

### Namespace Support

```typescript
// Create isolated storage instances
const userStorage = getStorageFactory().getProvider({
  type: 'sqlite',
  namespace: 'users'
});

const sessionStorage = getStorageFactory().getProvider({
  type: 'sqlite',
  namespace: 'sessions'
});

// Keys are automatically prefixed with namespace
await userStorage.set('alice', userData);     // Stored as 'users:alice'
await sessionStorage.set('alice', sessionData); // Stored as 'sessions:alice'
```

### DynamoDB Adapter

```typescript
import { createStorage } from '@agentdock/core/storage';

const storage = await createStorage({
  provider: 'dynamodb',
  config: {
    tableName: 'agentdock-storage',
    region: 'us-east-1',
    // Optional: provide credentials
    credentials: {
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
    },
    // Optional: for local DynamoDB
    endpoint: 'http://localhost:8000',
    // Optional: create table if it doesn't exist
    createTableIfNotExists: true,
    billingMode: 'PAY_PER_REQUEST',
  },
});
```

## Creating Custom Adapters

```typescript
import { BaseStorageAdapter, StorageOptions } from '@agentdock/core';

export class CustomAdapter extends BaseStorageAdapter {
  async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const fullKey = this.getFullKey(key, options?.namespace);
    // Your implementation
  }
  
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.getFullKey(key, options?.namespace);
    const serialized = this.serializeValue(value);
    // Your implementation
  }
  
  // Implement other required methods...
}

// Register your adapter
const factory = getStorageFactory();
factory.registerProvider('custom', () => new CustomAdapter());
```

## Multi-Tenancy Pattern

While not built into core, you can easily add multi-tenancy:

```typescript
function createTenantStorage(tenantId: string) {
  return getStorageFactory().getProvider({
    type: 'postgresql',
    namespace: `tenant:${tenantId}`
  });
}

// Usage
const tenant1 = createTenantStorage('acme-corp');
const tenant2 = createTenantStorage('globex-inc');

// Complete isolation between tenants
await tenant1.set('config', { theme: 'blue' });
await tenant2.set('config', { theme: 'green' });
```

## Migration Between Providers

```typescript
// Future: StorageMigrator utility
const migrator = new StorageMigrator();

await migrator.migrate({
  source: sqliteStorage,
  target: pgStorage,
  onProgress: (progress) => console.log(`${progress.percent}% complete`)
});
```

## Performance Tips

1. **Use batch operations** when working with multiple keys
2. **Enable connection pooling** for PostgreSQL in production
3. **Use namespaces** to organize data and improve query performance
4. **Set appropriate TTLs** to automatically clean up expired data
5. **Consider SQLite for single-server deployments** (can handle thousands of requests/second)
6. **Use PostgreSQL for multi-server deployments** requiring consistency

## Environment Variables

```bash
# PostgreSQL (if not using explicit config)
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# MongoDB
MONGODB_URI=mongodb://localhost:27017

# Redis
REDIS_URL=redis://localhost:6379
REDIS_TOKEN=your-token

# Vercel KV (auto-detected in Vercel environment)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

## Testing

### Quick Start

```bash
# Test SQLite (in-memory) and Memory adapters
npx tsx test-storage.ts
```

### Test with PostgreSQL/Supabase

```bash
# Set your database URL (local or Supabase)
export DATABASE_URL="postgresql://user:password@localhost:5432/agentdock"

# Run tests
npx tsx test-storage.ts
```

### What Gets Tested?

Our test suite covers real-world scenarios for character.ai-like applications:

1. **Basic Operations** - Set/get/delete for agent responses
2. **Thread Storage** - Conversation history management
3. **Multi-tenancy** - Namespace isolation for different users
4. **Session Management** - TTL support for expiring data
5. **User Agents** - Listing user's characters/bots
6. **Bulk Operations** - Import/export character data
7. **Concurrent Access** - Multiple users accessing simultaneously

### Production Testing with Jest

For production applications:

```bash
# Run adapter-specific tests
npm test sqlite.test.ts

# Run all storage tests
npm test src/storage/__tests__
```

## Implementation Status

### Core Adapters (14 Total)
- ✅ **SQLite** - Default local storage
- ✅ **PostgreSQL** - Production-ready with pooling
- ✅ **MongoDB** - Document storage with TTL
- ✅ **S3** - Large object storage
- ✅ **DynamoDB** - AWS serverless NoSQL database
- ✅ **Cloudflare KV/D1** - Edge storage
- ✅ **Vector DBs** - PostgreSQL Vector, Pinecone, Qdrant, ChromaDB

### Production Notes
- SQLite has been tested with thousands of requests/second for single-server deployments
- PostgreSQL is recommended for multi-server deployments
- Vector databases are experimental and need production validation
- All adapters follow consistent error handling and retry patterns

**Note:** While core functionality is complete, production testing for newer adapters (S3, MongoDB, Vector DBs, DynamoDB, Cloudflare) is still TBD. We recommend thorough testing in your specific use case before production deployment. 