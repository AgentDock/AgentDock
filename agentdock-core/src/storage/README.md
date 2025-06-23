# AgentDock Storage Abstraction

The storage abstraction provides a unified interface for key-value storage across different backends, enabling AgentDock to work with various storage providers from local development to production deployments.

## Quick Start: Step-by-Step Setup

### For Local Development (SQLite - Persistent Storage)

**Step 1: No configuration needed!**
```bash
# Just run the app - SQLite is auto-enabled in development
pnpm dev
```

That's it! Your data is automatically saved to `./agentdock.db`

### For Production (Supabase/PostgreSQL)

**Step 1: Get your Supabase database URL**
- Go to [supabase.com](https://supabase.com)
- Create a project
- Go to Settings → Database
- Copy your connection string

**Step 2: Add to your .env.local**
```bash
# Add these lines to .env.local
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql
```

**Step 3: Enable pgvector in Supabase**
```sql
-- Run this in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 4: Deploy**
```bash
pnpm build
pnpm start
```

## Current Providers

### Core Adapters (Always Available)
These adapters are built into the core package:

- **Memory** - In-memory storage (default, non-persistent)
- **Redis** - Distributed caching via Upstash client
- **Vercel KV** - Vercel's KV storage

### Auto-Registered by App
These adapters are automatically registered by the app when conditions are met:

- **SQLite** - Auto-registered when `NODE_ENV=development` or `ENABLE_SQLITE=true`
- **SQLite-vec** - Auto-registered when `NODE_ENV=development` or `ENABLE_SQLITE_VEC=true`
- **PostgreSQL** - Auto-registered when `DATABASE_URL` is set
- **PostgreSQL Vector** - Auto-registered when `DATABASE_URL` is set and `ENABLE_PGVECTOR=true`

### Additional Providers (Not Auto-registered)

To keep the build size small, these adapters are available but not automatically registered. You can manually register them if needed:

- **MongoDB** - Document-based NoSQL storage (optional, enable with `ENABLE_MONGODB=true`)
- **S3** - Object storage for large files and backups
- **DynamoDB** - AWS serverless NoSQL database
- **Cloudflare KV** - Edge key-value storage
- **Cloudflare D1** - Edge SQL database
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

## Environment Variables

### Officially Supported Storage (Auto-registered in App)

```bash
# SQLite - Local Development (Enabled by default in development)
ENABLE_SQLITE=true              # Enable SQLite adapter
ENABLE_SQLITE_VEC=true          # Enable SQLite with vector search
SQLITE_PATH=./agentdock.db      # Optional: Custom database path

# PostgreSQL - Production (Enabled when DATABASE_URL is set)
DATABASE_URL=postgresql://user:password@localhost:5432/agentdock
ENABLE_PGVECTOR=true            # Enable pgvector extension for AI memory
```

### Key-Value Storage Selection

```bash
# Choose your KV storage provider (default: memory)
KV_STORE_PROVIDER=memory        # Options: memory, redis, vercel-kv, sqlite, postgresql

# Redis Configuration
REDIS_URL=http://localhost:8079
REDIS_TOKEN=your-token          # Optional

# Vercel KV (auto-configured on Vercel)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

### Optional Storage Adapters

These adapters are not auto-registered to keep build size small. You must manually register them:

```bash
# MongoDB
ENABLE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/agentdock

# AWS S3
ENABLE_S3=true
S3_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# AWS DynamoDB
ENABLE_DYNAMODB=true
DYNAMODB_TABLE_NAME=agentdock-storage

# Cloudflare (requires wrangler.toml bindings)
ENABLE_CLOUDFLARE=true

# Vector Databases
ENABLE_VECTOR_DBS=true

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX=agentdock

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=...              # For Qdrant Cloud

# ChromaDB
CHROMADB_HOST=http://localhost:8000
CHROMADB_AUTH_TOKEN=...         # Optional
```

## How to Enable Additional Storage Adapters

### Step 1: Install Dependencies (if needed)

Some adapters require additional packages:

```bash
# For MongoDB
pnpm add mongodb

# For AWS (S3, DynamoDB)
pnpm add @aws-sdk/client-s3 @aws-sdk/client-dynamodb

# For ChromaDB
pnpm add chromadb
```

### Step 2: Register the Adapter

In your API route or server-side code:

```typescript
// app/api/your-route/route.ts
import { getStorageFactory } from 'agentdock-core';
import { 
  registerMongoDBAdapter,
  registerCloudAdapters,
  registerVectorAdapters 
} from 'agentdock-core/storage';

// Register the adapters you need
const factory = getStorageFactory();

// For MongoDB
if (process.env.ENABLE_MONGODB === 'true') {
  await registerMongoDBAdapter(factory);
}

// For Cloud Storage (S3, DynamoDB, Cloudflare)
if (process.env.ENABLE_S3 === 'true' || 
    process.env.ENABLE_DYNAMODB === 'true' || 
    process.env.ENABLE_CLOUDFLARE === 'true') {
  await registerCloudAdapters(factory);
}

// For Vector Databases (Pinecone, Qdrant, ChromaDB)
if (process.env.ENABLE_VECTOR_DBS === 'true') {
  await registerVectorAdapters(factory);
}
```

### Step 3: Use the Adapter

```typescript
// After registration, use it like any other storage
const storage = factory.getProvider({
  type: 'mongodb',  // or 's3', 'dynamodb', 'pinecone', etc.
  namespace: 'myapp'
});

await storage.set('key', 'value');
```

### App Default Registration

The AgentDock app automatically registers these adapters in `src/lib/storage-init.ts`:
- SQLite (development or ENABLE_SQLITE=true)
- SQLite-vec (development or ENABLE_SQLITE_VEC=true)
- PostgreSQL (when DATABASE_URL is set)
- PostgreSQL Vector (when ENABLE_PGVECTOR=true)

MongoDB and other adapters require manual registration in your API routes.

## Supported Storage Adapters

AgentDock supports 15 storage adapters for different use cases:

### Core Adapters (Built into Package)
1. **Memory** - In-memory storage (default, non-persistent)
2. **Redis** - High-performance distributed key-value store
3. **Vercel KV** - Serverless Redis-compatible storage

### Auto-Registered Adapters (App Level)
4. **SQLite** - Zero-config local file-based storage with SQL capabilities
5. **SQLite-vec** - SQLite with vector search for local AI features
6. **PostgreSQL** - Production-ready RDBMS with full ACID compliance
7. **PostgreSQL Vector** - pgvector extension for production AI/embeddings

### Additional Storage (Manual Registration)
Optional adapters kept separate to minimize build size:

8. **MongoDB** - Document database for flexible schemas
9. **S3** - AWS S3 and compatible object storage for large files
10. **DynamoDB** - AWS managed NoSQL database
11. **Cloudflare KV** - Edge key-value storage
12. **Cloudflare D1** - Edge SQL database
13. **Pinecone** - Managed vector database service
14. **Qdrant** - Open-source vector database
15. **ChromaDB** - Open-source embeddings database

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

### Core Adapters (15 Total)
- ✅ **SQLite + SQLite-vec** - Default local storage with optional vector support
- ✅ **PostgreSQL + pgvector** - Production-ready with pooling and vector support
- ✅ **Redis/Vercel KV** - Session caching and temporary data
- ✅ **MongoDB** - Document storage with TTL (optional, not auto-registered)
- ✅ **S3** - Large object storage
- ✅ **DynamoDB** - AWS serverless NoSQL database
- ✅ **Cloudflare KV/D1** - Edge storage
- ✅ **Vector DBs** - Pinecone, Qdrant, ChromaDB

### Current Use Cases
- **Session Persistence**: Store orchestration state across requests
- **Namespace Isolation**: Basic multi-tenancy support via namespaces
- **TTL Support**: Automatic expiration for temporary data

### Future Use Cases (Not Yet Implemented)
- **Chat Persistence**: Server-side message storage (currently localStorage only)
- **Authentication**: User accounts and permissions
- **AI Memory**: Vector storage for semantic search (adapters ready, system not built)
- **File Storage**: S3 for attachments and media

### Production Notes
- SQLite has been tested with thousands of requests/second for single-server deployments
- PostgreSQL is recommended for multi-server deployments requiring consistency
- Additional adapters (S3, MongoDB, DynamoDB, Cloudflare, vector DBs) are not auto-registered to keep build size small
- All adapters follow consistent error handling and retry patterns 