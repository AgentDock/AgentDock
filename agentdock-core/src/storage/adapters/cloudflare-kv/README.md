# Cloudflare KV Storage Adapter

Edge-native key-value storage adapter for Cloudflare Workers KV, providing globally distributed, eventually consistent storage with low-latency reads.

## Features

- 🌐 **Global Distribution**: Data replicated across Cloudflare's edge network
- ⚡ **Low-latency Reads**: Sub-millisecond reads from edge locations
- ⏱️ **Native TTL**: Built-in expiration support via `expirationTtl`
- 📦 **Metadata Storage**: Type preservation and custom metadata
- 🔄 **Batch Operations**: Efficient parallel operations
- 🏷️ **Namespace Support**: Logical data isolation
- 📄 **Cursor Pagination**: Efficient listing of large datasets
- 🔧 **Workers Integration**: Seamless Cloudflare Workers support

## Installation

The Cloudflare KV adapter works with the Cloudflare Workers runtime. No additional dependencies are needed as the KV namespace is provided by the Workers environment.

```bash
# AgentDock Core includes the adapter
npm install agentdock-core
```

## Configuration

### In Cloudflare Workers

```typescript
import { StorageFactory } from 'agentdock-core';

export default {
  async fetch(request: Request, env: Env) {
    // env.MY_KV is your KV namespace binding
    const storage = StorageFactory.getInstance().createProvider({
      type: 'cloudflare-kv',
      config: {
        kvNamespace: env.MY_KV,
        defaultTtl: 3600, // Optional: default TTL in seconds
        storeTypeMetadata: true // Optional: preserve types
      }
    });

    // Use storage...
  }
}
```

### Local Development

For local development with Wrangler:

```typescript
// In your worker
const storage = StorageFactory.getInstance().createProvider({
  type: 'cloudflare-kv',
  config: {
    kvNamespace: env.MY_KV,
    namespace: 'development'
  }
});
```

```toml
# wrangler.toml
name = "my-worker"
kv_namespaces = [
  { binding = "MY_KV", id = "your-kv-namespace-id" }
]
```

## Usage

### Basic Operations

```typescript
// Set a value
await storage.set('user:123', { 
  name: 'John Doe',
  email: 'john@example.com'
});

// Get a value
const user = await storage.get('user:123');

// Set with TTL (60 seconds)
await storage.set('session:abc', { token: 'xyz' }, { 
  ttlSeconds: 60 
});

// Check existence
const exists = await storage.exists('user:123');

// Delete a value
await storage.delete('user:123');
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
// { 'user:1': { name: 'Alice' }, ... }

// Delete multiple values
const deleted = await storage.deleteMany(['user:1', 'user:2']);
console.log(`Deleted ${deleted} users`);
```

### List Operations

```typescript
// Save a list
await storage.saveList('recent-searches', [
  'cloudflare workers',
  'edge computing',
  'kv storage'
]);

// Get entire list
const searches = await storage.getList('recent-searches');

// Get range (index 0-2)
const topSearches = await storage.getList('recent-searches', 0, 2);

// Delete list
await storage.deleteList('recent-searches');
```

### Namespace Isolation

```typescript
// Create namespace-specific instances
const userStorage = storage.withNamespace('users');
const sessionStorage = storage.withNamespace('sessions');

// Keys are automatically prefixed
await userStorage.set('alice', userData);     // Stored as 'users:alice'
await sessionStorage.set('alice', sessionData); // Stored as 'sessions:alice'
```

### Listing Keys

```typescript
// List all keys with prefix
const userKeys = await storage.list('user:');
// ['user:123', 'user:456', ...]

// List with pagination
const page1 = await storage.list('user:', { 
  limit: 100,
  offset: 0 
});

// List in specific namespace
const adminKeys = await storage.list('', { 
  namespace: 'admin' 
});
```

## Metadata Support

The adapter can store type information to preserve data types:

```typescript
const storage = StorageFactory.getInstance().createProvider({
  type: 'cloudflare-kv',
  config: {
    kvNamespace: env.MY_KV,
    storeTypeMetadata: true // Enable type preservation
  }
});

// These types are preserved
await storage.set('string', 'hello');        // Retrieved as string
await storage.set('number', 42);             // Retrieved as number
await storage.set('boolean', true);          // Retrieved as boolean
await storage.set('null', null);             // Retrieved as null
await storage.set('array', [1, 2, 3]);       // Retrieved as array
await storage.set('object', { a: 1 });       // Retrieved as object
```

## Custom Metadata

Store custom metadata with values:

```typescript
await storage.set('document:123', documentData, {
  metadata: {
    author: 'John Doe',
    version: 2,
    tags: ['important', 'draft']
  }
});

// Metadata is accessible via the KV API directly if needed
```

## TTL and Expiration

Cloudflare KV supports automatic expiration:

```typescript
// Expire after specific time
await storage.set('cache:data', data, {
  ttlSeconds: 300 // Expires in 5 minutes
});

// Default TTL for all operations
const storage = StorageFactory.getInstance().createProvider({
  type: 'cloudflare-kv',
  config: {
    kvNamespace: env.MY_KV,
    defaultTtl: 3600 // 1 hour default
  }
});
```

## Limitations

### Cloudflare KV Limits
- Key size: max 512 bytes
- Value size: max 25 MB
- Metadata size: max 1024 bytes
- List operations: max 1000 keys per request
- Write rate: 1 write per second per key

### Consistency Model
- **Eventual Consistency**: Writes propagate globally within 60 seconds
- **Read-after-write**: Not guaranteed globally
- **Best for**: Cache, configuration, user preferences

### No Transaction Support
Cloudflare KV doesn't support transactions. Operations are atomic at the individual key level only.

## Performance Tips

1. **Batch Operations**: Use batch methods to reduce latency
   ```typescript
   // Good: Single batch operation
   await storage.setMany(items);
   
   // Avoid: Multiple individual operations
   for (const [key, value] of Object.entries(items)) {
     await storage.set(key, value);
   }
   ```

2. **Namespace Organization**: Use namespaces to organize data
   ```typescript
   const cache = storage.withNamespace('cache');
   const config = storage.withNamespace('config');
   ```

3. **TTL Strategy**: Use appropriate TTLs for different data types
   ```typescript
   // Short TTL for cache
   await cache.set('api-response', data, { ttlSeconds: 300 });
   
   // Longer TTL for user preferences
   await config.set('user-prefs', prefs, { ttlSeconds: 86400 });
   ```

## Error Handling

```typescript
try {
  await storage.set('key', value);
} catch (error) {
  if (error.message.includes('quota exceeded')) {
    // Handle storage quota errors
  } else if (error.message.includes('key too large')) {
    // Handle key size errors
  }
  // Other error handling
}
```

## Development and Testing

### With Wrangler

```bash
# Start local development
wrangler dev

# Deploy to Cloudflare
wrangler deploy
```

### Mock for Testing

```typescript
// Create a mock KV namespace for tests
const mockKV = {
  store: new Map(),
  
  async get(key: string, options?: any) {
    const value = this.store.get(key);
    if (!value) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  },
  
  async put(key: string, value: string) {
    this.store.set(key, value);
  },
  
  async delete(key: string) {
    this.store.delete(key);
  },
  
  async list(options?: any) {
    const keys = Array.from(this.store.keys())
      .filter(k => !options?.prefix || k.startsWith(options.prefix));
    return { 
      keys: keys.map(name => ({ name })), 
      list_complete: true 
    };
  }
};

const storage = new CloudflareKVAdapter({ 
  kvNamespace: mockKV 
});
```

## Migration from Other Adapters

```typescript
import { StorageMigrator } from 'agentdock-core';

// Migrate from Redis to Cloudflare KV
const migrator = new StorageMigrator({
  source: redisStorage,
  destination: cloudflareStorage,
  batchSize: 100 // KV has rate limits
});

await migrator.migrate({
  filter: (key) => key.startsWith('user:')
});
```

## Best Practices

1. **Use for Edge Data**: Configuration, user preferences, cache
2. **Avoid for**: Real-time data, high-write workloads, transactional data
3. **Key Design**: Keep keys short and hierarchical
4. **Value Size**: Prefer smaller values for better performance
5. **TTL Usage**: Always set TTL for cache data
6. **Namespace Strategy**: Organize data logically with namespaces 