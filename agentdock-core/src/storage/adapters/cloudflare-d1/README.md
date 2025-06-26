# Cloudflare D1 Storage Adapter

Edge SQL database storage adapter for Cloudflare Workers D1, providing SQLite-compatible storage with global distribution and ACID compliance.

## Features

- 🌐 **Global Distribution**: Data replicated across Cloudflare's edge network
- 🚀 **SQLite API**: Familiar SQLite-compatible interface
- ⚡ **Edge Performance**: Low-latency queries from edge locations
- 🔄 **ACID Transactions**: Full transaction support with batch operations
- ⏱️ **TTL Support**: Automatic expiration with cleanup
- 📦 **Dual Storage**: Optimized tables for KV and list operations
- 🏷️ **Namespace Support**: Built-in multi-tenancy
- 🔧 **Raw SQL Access**: Execute custom queries when needed
- 📊 **Schema Management**: Automatic table creation and migration

## Installation

The Cloudflare D1 adapter is included with AgentDock Core but requires a Cloudflare Workers environment:

```bash
npm install agentdock-core
```

## Configuration

```typescript
import { createStorageProvider } from 'agentdock-core';

// In your Cloudflare Worker
export default {
  async fetch(request, env) {
    const storage = createStorageProvider({
      type: 'cloudflare-d1',
      namespace: 'my-app',
      config: {
        d1Database: env.MY_D1_DATABASE, // Your D1 binding
        kvTableName: 'agentdock_kv',    // Optional, default: 'agentdock_kv'
        listTableName: 'agentdock_lists', // Optional, default: 'agentdock_lists'
        enableCleanup: true,             // Optional, default: true
        cleanupInterval: 3600            // Optional, default: 3600 seconds
      }
    });

    // Storage is ready to use
    await storage.set('key', 'value');
  }
}
```

## Usage Examples

### Basic Operations

```typescript
// Set a value
await storage.set('user:123', { name: 'John', age: 30 });

// Get a value
const user = await storage.get('user:123');
// { name: 'John', age: 30 }

// Check existence
const exists = await storage.exists('user:123');
// true

// Delete a value
await storage.delete('user:123');
```

### TTL Support

```typescript
// Set with TTL (expires in 1 hour)
await storage.set('session:abc', sessionData, { ttlSeconds: 3600 });

// Value automatically expires
// Cleanup runs periodically to remove expired entries
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
// { 'user:1': { name: 'Alice' }, 'user:2': { name: 'Bob' }, ... }

// Delete multiple values
const deleted = await storage.deleteMany(['user:1', 'user:2']);
// 2 (number of deleted items)
```

### List Operations

```typescript
// Save a list
await storage.saveList('recent:posts', [
  { id: 1, title: 'First Post' },
  { id: 2, title: 'Second Post' },
  { id: 3, title: 'Third Post' }
]);

// Get entire list
const posts = await storage.getList('recent:posts');

// Get range (0-based indexing)
const firstTwo = await storage.getList('recent:posts', 0, 2);
// [{ id: 1, title: 'First Post' }, { id: 2, title: 'Second Post' }]

// Delete list
await storage.deleteList('recent:posts');
```

### Namespace Isolation

```typescript
// Create isolated storage instances
const userStorage = storage.withNamespace('users');
const sessionStorage = storage.withNamespace('sessions');

// Operations are isolated by namespace
await userStorage.set('123', userData);
await sessionStorage.set('123', sessionData);

// No collision between namespaces
```

### Raw SQL Access (D1-specific)

```typescript
// Execute raw SQL
const result = await storage.exec(`
  SELECT COUNT(*) as total 
  FROM agentdock_kv 
  WHERE namespace = 'users'
`);

// Prepare statements
const stmt = await storage.prepare(
  'SELECT * FROM agentdock_kv WHERE key LIKE ?'
);
const results = await stmt.bind('user:%').all();
```

## Schema

The adapter automatically creates two tables:

### KV Table (agentdock_kv)
```sql
CREATE TABLE agentdock_kv (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace, key)
);
```

### List Table (agentdock_lists)
```sql
CREATE TABLE agentdock_lists (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  position INTEGER NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(namespace, key, position)
);
```

## Performance Considerations

1. **Edge Proximity**: Queries execute at the nearest edge location
2. **Read Consistency**: Eventually consistent across regions
3. **Write Performance**: Writes are synchronous within a region
4. **Batch Operations**: Use batch methods for bulk operations
5. **Cleanup**: Automatic cleanup runs periodically (configurable)

## D1 Limitations

- 10MB per database (beta limit, will increase)
- 1000 databases per account
- SQLite feature set (no stored procedures, limited data types)
- No real-time subscriptions

## Best Practices

1. **Use Batch Operations**: Minimize round trips with batch methods
2. **Namespace Design**: Plan namespace strategy for multi-tenancy
3. **TTL Strategy**: Use TTL for temporary data to manage storage
4. **Index Usage**: D1 automatically creates indexes on primary keys
5. **Query Optimization**: Use prepared statements for repeated queries

## Migration from Other Adapters

```typescript
// Easy migration from SQLite
const d1Storage = createStorageProvider({
  type: 'cloudflare-d1',
  config: { d1Database: env.DB }
});

// Same API as other adapters
await d1Storage.set('key', 'value');
```

## Error Handling

```typescript
try {
  await storage.set('key', 'value');
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    // Handle constraint violations
  } else if (error.message.includes('database is locked')) {
    // Handle concurrent access issues
  }
}
```

## Testing

```typescript
// Use in-memory D1 for testing
import { D1Database } from '@miniflare/d1';

const testDb = new D1Database(':memory:');
const storage = new CloudflareD1Adapter({
  d1Database: testDb,
  namespace: 'test'
});

// Run tests...
```

## Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [SQLite Documentation](https://www.sqlite.org/docs.html) 