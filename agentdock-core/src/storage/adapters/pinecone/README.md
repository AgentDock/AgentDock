# Pinecone Vector Database Adapter

Pinecone storage adapter for AgentDock that provides both key-value storage and native vector database capabilities. While Pinecone is primarily a vector database, this adapter enables using it as a general-purpose storage backend.

## Features

- 🚀 **Managed Vector Database**: Fully managed service with global availability
- 📊 **Multiple Metrics**: Euclidean, Cosine, and Dot Product similarity
- 🔍 **High Performance**: Optimized for real-time vector search at scale
- 🏷️ **Metadata Filtering**: Filter results by metadata attributes
- 🔄 **Hybrid Storage**: KV operations via metadata storage
- 🌐 **Serverless Option**: Pay-per-use serverless indexes
- 🔐 **Enterprise Ready**: SOC2, HIPAA compliant

## Prerequisites

1. **Pinecone Account**: Sign up at [pinecone.io](https://www.pinecone.io)
2. **API Key**: Get from Pinecone console
3. **Environment**: Note your environment (e.g., `us-west1-gcp`)

## Installation

```bash
npm install agentdock-core
```

Note: The Pinecone adapter uses the REST API directly, no additional SDK required.

## Configuration

```typescript
import { createStorageProvider } from 'agentdock-core';

const storage = createStorageProvider({
  type: 'pinecone',
  namespace: 'my-app',
  config: {
    apiKey: process.env.PINECONE_API_KEY,        // Required
    environment: 'us-west1-gcp',                 // Your Pinecone environment
    defaultIndex: 'agentdock-storage',           // Default index name
    timeout: 30000,                              // Request timeout in ms
    maxRetries: 3,                               // Max retry attempts
    batchSize: 100                               // Batch operation size
  }
});
```

## Storage Operations

### Key-Value Storage

Pinecone adapter implements KV storage by:
- Generating deterministic vectors from keys
- Storing values in vector metadata
- Supporting TTL via metadata timestamps

```typescript
// Set a value
await storage.set('user:123', {
  name: 'John Doe',
  email: 'john@example.com'
}, { ttlSeconds: 3600 });

// Get a value
const user = await storage.get('user:123');

// Check existence
const exists = await storage.exists('user:123');

// Delete a value
await storage.delete('user:123');

// Batch operations
await storage.setMany({
  'config:theme': 'dark',
  'config:lang': 'en'
});

const configs = await storage.getMany(['config:theme', 'config:lang']);
```

### Limitations

Due to Pinecone's vector-first design, some operations have limitations:

```typescript
// List operations - NOT EFFICIENT
// Returns empty array with warning
const keys = await storage.list('user:');

// Clear operations
await storage.clear(); // Clears entire namespace
await storage.clear('prefix'); // NOT SUPPORTED - logs warning

// List data structures - NOT SUPPORTED
await storage.saveList('items', [1, 2, 3]); // Logs warning
```

## Vector Operations

The adapter provides full access to Pinecone's vector capabilities:

### Index Management

```typescript
// Create an index
await storage.createIndex({
  name: 'embeddings',
  dimension: 1536,                   // Must match your embedding model
  metric: 'cosine',                  // 'euclidean', 'cosine', or 'dotproduct'
  cloud: 'aws',                      // Cloud provider
  region: 'us-east-1',              // Region
  pods: 1,                          // Number of pods (for pod-based indexes)
  replicas: 1,                      // Number of replicas
  podType: 'p1.x1'                  // Pod type
});

// List indexes
const indexes = await storage.listIndexes();

// Get index statistics
const stats = await storage.getIndexStats('embeddings');
console.log(`Total vectors: ${stats.totalVectorCount}`);
console.log(`Index fullness: ${stats.indexFullness}`);

// Delete an index
await storage.deleteIndex('embeddings');
```

### Vector Operations

```typescript
// Upsert vectors
await storage.upsertVectors('embeddings', [
  {
    id: 'vec1',
    values: [0.1, 0.2, 0.3, ...], // 1536-dimensional vector
    metadata: {
      text: 'Original text',
      source: 'document.pdf',
      page: 1
    }
  },
  {
    id: 'vec2',
    values: [0.4, 0.5, 0.6, ...],
    metadata: {
      text: 'Another text',
      source: 'article.md'
    }
  }
], 'my-namespace'); // Optional namespace

// Query vectors
const results = await storage.queryVectors(
  'embeddings',
  [0.2, 0.3, 0.4, ...], // Query vector
  {
    topK: 10,                        // Number of results
    includeMetadata: true,           // Include metadata
    includeValues: false,            // Don't include vectors
    filter: {                        // Metadata filter
      source: 'document.pdf',
      page: { $gte: 1, $lte: 5 }
    },
    namespace: 'my-namespace'
  }
);

// Fetch specific vectors
const vectors = await storage.fetchVectors(
  'embeddings',
  ['vec1', 'vec2'],
  'my-namespace'
);

// Update vector metadata
await storage.updateVectors('embeddings', [
  {
    id: 'vec1',
    setMetadata: {
      processed: true,
      timestamp: new Date().toISOString()
    }
  }
]);

// Delete vectors
await storage.deleteVectors(
  'embeddings',
  ['vec1', 'vec2'],
  'my-namespace'
);

// Delete all vectors in namespace
await storage.deleteAllVectors('embeddings', 'my-namespace');
```

## Namespaces

Pinecone supports namespaces for data isolation:

```typescript
// Operations in different namespaces
await storage.set('key', 'value1', { namespace: 'tenant1' });
await storage.set('key', 'value2', { namespace: 'tenant2' });

// Vector operations with namespaces
await storage.upsertVectors('index', vectors, 'tenant1');
const results = await storage.queryVectors('index', query, {
  namespace: 'tenant1'
});
```

## Best Practices

### 1. Index Configuration
```typescript
// For OpenAI embeddings
await storage.createIndex({
  name: 'openai-embeddings',
  dimension: 1536,
  metric: 'cosine' // Best for normalized embeddings
});

// For sentence transformers
await storage.createIndex({
  name: 'sentence-embeddings',
  dimension: 384,
  metric: 'cosine'
});
```

### 2. Batch Operations
```typescript
// Efficient batch upserts
const vectors = generateVectors(); // Your vectors
const batchSize = 100;

for (let i = 0; i < vectors.length; i += batchSize) {
  await storage.upsertVectors(
    'embeddings',
    vectors.slice(i, i + batchSize)
  );
}
```

### 3. Metadata Design
```typescript
// Structure metadata for efficient filtering
const vector = {
  id: 'doc123_chunk5',
  values: embedding,
  metadata: {
    // Searchable fields
    docId: 'doc123',
    chunkIndex: 5,
    category: 'technical',
    createdAt: Date.now(),
    
    // Content fields
    text: 'Original text content',
    title: 'Document Title'
  }
};
```

## Performance Considerations

1. **KV Operations**: Less efficient than dedicated KV stores
2. **List Operations**: Not supported efficiently
3. **Metadata Limits**: 40KB per vector metadata
4. **Batch Size**: Optimal batch size is 100 vectors
5. **Query Performance**: Use metadata filters to improve query speed

## When to Use Pinecone Adapter

### Good For:
- AI/ML applications with vector search
- Semantic search implementations
- Recommendation systems
- When you need both vectors and some KV storage
- Serverless applications (with serverless indexes)

### Not Ideal For:
- Heavy KV workloads without vector search
- Applications requiring list operations
- Large value storage (>40KB per item)
- Applications needing prefix-based queries

## Cost Optimization

1. **Use Serverless Indexes** for variable workloads
2. **Optimize Metadata** - only store what you'll filter on
3. **Batch Operations** to reduce API calls
4. **Delete Unused Vectors** to reduce storage costs
5. **Use Appropriate Dimensions** - smaller vectors cost less

## Migration from Other Stores

```typescript
// Migrate from PostgreSQL Vector to Pinecone
const pgVector = createStorageProvider({
  type: 'postgresql-vector',
  config: { connectionString: DATABASE_URL }
});

const pinecone = createStorageProvider({
  type: 'pinecone',
  config: { apiKey: PINECONE_API_KEY }
});

// Create index with same dimensions
await pinecone.createIndex({
  name: 'migrated-vectors',
  dimension: 1536
});

// Migrate vectors (simplified)
const vectors = await pgVector.searchVectors('embeddings', query, { k: 1000 });
await pinecone.upsertVectors('migrated-vectors', vectors);
```

## Error Handling

```typescript
try {
  await storage.upsertVectors('index', vectors);
} catch (error) {
  if (error.message.includes('dimension')) {
    console.error('Vector dimension mismatch');
  } else if (error.message.includes('quota')) {
    console.error('Quota exceeded');
  } else {
    console.error('Pinecone error:', error);
  }
}
```

## Resources

- [Pinecone Documentation](https://docs.pinecone.io)
- [Pinecone Console](https://app.pinecone.io)
- [API Reference](https://docs.pinecone.io/reference)
- [Best Practices](https://docs.pinecone.io/docs/best-practices)
- [Pricing Calculator](https://www.pinecone.io/pricing/) 