# MongoDB Storage Adapter

A document-based storage adapter for AgentDock using MongoDB with support for TTL expiration, batch operations, namespaces, and more.

## Features

- 🚀 **High Performance**: Leverages MongoDB's native indexing and query optimization
- ⏱️ **Native TTL**: Uses MongoDB's built-in TTL indexes for automatic expiration
- 🔄 **Batch Operations**: Efficient bulk reads and writes
- 🏷️ **Namespace Support**: Isolate data by organization/tenant
- 📊 **Document Storage**: Store complex objects without serialization limitations
- 🔍 **Full-text Search**: Built-in text indexes for search capabilities
- 🔔 **Change Streams**: Real-time notifications (future feature)

## Installation

```bash
# Install the MongoDB driver as a peer dependency
npm install mongodb
# or
pnpm add mongodb
# or
yarn add mongodb
```

## Configuration

```typescript
import { StorageFactory } from 'agentdock-core';

// Using connection string
const storage = StorageFactory.getInstance().createProvider({
  type: 'mongodb',
  config: {
    uri: 'mongodb://localhost:27017',
    database: 'myapp',
    collection: 'agentdock_kv', // Optional, defaults to 'agentdock_kv'
    options: {
      // MongoDB connection options
      maxPoolSize: 10,
      minPoolSize: 2,
    },
    indexes: [
      // Additional custom indexes
      {
        key: { 'metadata.userId': 1 },
        options: { sparse: true }
      }
    ]
  }
});

// Using environment variables
// Set MONGODB_URI in your environment
const storage = StorageFactory.getInstance().createProvider({
  type: 'mongodb',
  config: {
    database: 'myapp'
  }
});
```

## Usage

### Basic Operations

```typescript
// Set a value
await storage.set('user:123', { name: 'John', age: 30 });

// Get a value
const user = await storage.get('user:123');

// Set with TTL (in seconds)
await storage.set('session:abc', { token: 'xyz' }, { ttlSeconds: 3600 });

// Check existence
const exists = await storage.exists('user:123');

// Delete
await storage.delete('user:123');
```

### Batch Operations

```typescript
// Get multiple values
const users = await storage.getMany(['user:1', 'user:2', 'user:3']);

// Set multiple values
await storage.setMany({
  'user:1': { name: 'Alice' },
  'user:2': { name: 'Bob' },
  'user:3': { name: 'Charlie' }
});

// Delete multiple
const deletedCount = await storage.deleteMany(['user:1', 'user:2']);

// MongoDB-specific batch operations
const adapter = storage as MongoDBAdapter;
await adapter.batch([
  { type: 'insert', key: 'doc:1', value: { data: 'value1' } },
  { type: 'update', key: 'doc:2', value: { data: 'value2' } },
  { type: 'delete', key: 'doc:3' }
]);
```

### List Operations

```typescript
// Save a list
await storage.saveList('todos:user:123', [
  { id: 1, text: 'Buy milk', done: false },
  { id: 2, text: 'Write code', done: true }
]);

// Get entire list
const todos = await storage.getList('todos:user:123');

// Get range
const firstTwo = await storage.getList('todos:user:123', 0, 1);

// MongoDB-specific list operations
const adapter = storage as MongoDBAdapter;

// Push to start
await adapter.lpush('queue:tasks', { task: 'process-1' });

// Push to end
await adapter.rpush('queue:tasks', { task: 'process-2' });

// Pop from start
const firstTask = await adapter.lpop('queue:tasks');

// Pop from end
const lastTask = await adapter.rpop('queue:tasks');

// Get list length
const length = await adapter.llen('queue:tasks');

// Get range
const tasks = await adapter.lrange('queue:tasks', 0, -1);

// Set by index
await adapter.lset('queue:tasks', 0, { task: 'updated' });

// Get by index
const task = await adapter.lindex('queue:tasks', 0);

// Remove occurrences
const removed = await adapter.lrem('queue:tasks', 1, { task: 'process-1' });

// Trim list
await adapter.ltrim('queue:tasks', 0, 9); // Keep only first 10
```

### Namespace Support

```typescript
// Create namespaced instance
const userStorage = storage.withNamespace('user-data');
const adminStorage = storage.withNamespace('admin-data');

// Operations are isolated
await userStorage.set('config', { theme: 'dark' });
await adminStorage.set('config', { level: 'super' });

// Different values for same key
const userConfig = await userStorage.get('config'); // { theme: 'dark' }
const adminConfig = await adminStorage.get('config'); // { level: 'super' }
```

### Pattern Matching

```typescript
// List keys by pattern
const adapter = storage as MongoDBAdapter;

// Get all user keys
const userKeys = await adapter.keys('user:*');

// Get all session keys
const sessionKeys = await adapter.keys('session:*');

// Get all keys
const allKeys = await adapter.keys('*');
```

## Indexes

The adapter automatically creates the following indexes:

1. **Namespace + ID compound index**: For efficient namespace queries
2. **TTL index on expiresAt**: For automatic document expiration
3. **Text index on metadata._search**: For full-text search (if needed)
4. **List collection indexes**: For list operations

You can add custom indexes via the configuration:

```typescript
{
  indexes: [
    {
      key: { 'metadata.category': 1, 'metadata.priority': -1 },
      options: { 
        name: 'category_priority_idx',
        sparse: true 
      }
    }
  ]
}
```

## Connection Management

The adapter uses MongoDB's connection pooling:

```typescript
const storage = StorageFactory.getInstance().createProvider({
  type: 'mongodb',
  config: {
    uri: 'mongodb://localhost:27017',
    database: 'myapp',
    options: {
      maxPoolSize: 20,        // Maximum connections
      minPoolSize: 5,         // Minimum connections
      maxIdleTimeMS: 60000,   // Close idle connections after 1 minute
      serverSelectionTimeoutMS: 5000,
    }
  }
});

// Get connection stats
const stats = await (storage as MongoDBAdapter).getStats();
console.log(stats);
// {
//   connected: true,
//   collections: {
//     kv: { count: 1234, size: 5678900 },
//     lists: { count: 56 }
//   }
// }

// Clean shutdown
await storage.destroy();
```

## Performance Considerations

1. **Indexes**: Ensure proper indexes for your query patterns
2. **Batch Operations**: Use batch methods for multiple operations
3. **Connection Pooling**: Configure pool size based on load
4. **TTL Cleanup**: MongoDB handles TTL cleanup automatically
5. **Document Size**: MongoDB has a 16MB document size limit

## Error Handling

The adapter maps MongoDB errors to standard storage errors:

```typescript
try {
  await storage.set('key', value);
} catch (error) {
  if (error.code === 'CONNECTION_ERROR') {
    // Handle connection issues
  } else if (error.code === 'VALIDATION_ERROR') {
    // Handle validation errors
  }
}
```

## Differences from Other Adapters

1. **TTL in milliseconds**: While the StorageProvider interface uses seconds, MongoDB internally uses milliseconds
2. **Native batch operations**: Uses MongoDB's bulkWrite for efficiency
3. **Document-based**: Can store complex nested objects without serialization
4. **Automatic ID**: Uses MongoDB's _id field for key storage
5. **No explicit transactions**: Uses MongoDB's atomic operations where possible

## Migration from Other Adapters

```typescript
// From Redis
// Before: storage.set('key', value, 'EX', 3600)
// After:
await storage.set('key', value, { ttlSeconds: 3600 });

// From SQL adapters
// Lists are stored as documents, not in separate tables
// This provides better performance for list operations
```

## Monitoring

Use MongoDB's built-in monitoring tools:

```bash
# Monitor operations
mongotop

# Monitor statistics
mongostat

# View slow queries
db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
```

## Best Practices

1. **Use namespaces** for multi-tenant applications
2. **Set appropriate TTLs** for temporary data
3. **Use batch operations** when working with multiple keys
4. **Monitor document sizes** to stay under 16MB limit
5. **Create indexes** for frequently queried fields
6. **Use connection pooling** for production applications 