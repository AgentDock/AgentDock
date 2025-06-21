# Qdrant Vector Database Adapter

Qdrant storage adapter for AgentDock that provides both key-value storage and native vector database capabilities. Qdrant is an open-source vector database with excellent performance and can be self-hosted or used as a managed service.

## Features

- 🚀 **High Performance**: Optimized for real-time vector search
- 📊 **Multiple Metrics**: Euclidean, Cosine, and Dot Product distance
- 🔍 **Rich Filtering**: Advanced payload filtering with complex conditions
- 🏷️ **Metadata Support**: Store arbitrary JSON payloads with vectors
- 🔄 **Hybrid Storage**: KV operations via payload storage
- 🏠 **Self-Hosted**: Can run on your own infrastructure
- 🌐 **Cloud Option**: Managed service available
- 📈 **Scalable**: Horizontal scaling with sharding

## Prerequisites

1. **Qdrant Instance**: Either self-hosted or cloud
   - Docker: `docker run -p 6333:6333 qdrant/qdrant`
   - Cloud: Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. **API Access**: Default port 6333 (HTTP) or 6334 (gRPC)

## Installation

```bash
npm install agentdock-core
```

Note: The Qdrant adapter uses the REST API directly, no additional SDK required.

## Configuration

```typescript
import { createStorageProvider } from 'agentdock-core';

// Self-hosted Qdrant
const storage = createStorageProvider({
  type: 'qdrant',
  namespace: 'my-app',
  config: {
    host: 'localhost',                // Qdrant host
    port: 6333,                       // Default port
    https: false,                     // Use HTTPS
    defaultCollection: 'agentdock',   // Default collection name
    timeout: 30000,                   // Request timeout in ms
    maxRetries: 3,                    // Max retry attempts
    batchSize: 100                    // Batch operation size
  }
});

// Qdrant Cloud
const cloudStorage = createStorageProvider({
  type: 'qdrant',
  namespace: 'my-app',
  config: {
    host: 'YOUR-CLUSTER.aws.cloud.qdrant.io',
    port: 6333,
    https: true,
    apiKey: process.env.QDRANT_API_KEY,  // Required for cloud
    defaultCollection: 'agentdock'
  }
});
```

## Storage Operations

### Key-Value Storage

Qdrant adapter implements KV storage by:
- Generating deterministic vectors from keys
- Storing values in point payloads
- Supporting TTL via payload fields
- Using filters for namespace isolation

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

Due to Qdrant's vector-first design, some operations have limitations:

```typescript
// List operations - Uses client-side filtering
// Less efficient than dedicated KV stores
const keys = await storage.list('user:');

// Clear operations
await storage.clear(); // Clears entire namespace
await storage.clear('prefix'); // Uses list + batch delete

// List data structures - NOT SUPPORTED
await storage.saveList('items', [1, 2, 3]); // Logs warning
```

## Vector Operations

The adapter provides full access to Qdrant's vector capabilities:

### Collection Management

```typescript
// Create a collection
await storage.createCollection({
  name: 'embeddings',
  vectors: {
    size: 1536,                      // Vector dimension
    distance: 'Cosine'               // 'Cosine', 'Euclid', or 'Dot'
  },
  // Optional optimizations
  shard_number: 2,                   // Number of shards
  replication_factor: 2,             // Replication factor
  on_disk_payload: true,             // Store payload on disk
  hnsw_config: {                     // HNSW index configuration
    m: 16,                           // Number of edges per node
    ef_construct: 100,               // Size of dynamic candidate list
    full_scan_threshold: 10000       // Threshold for switching to flat index
  }
});

// List collections
const collections = await storage.listCollections();

// Get collection info
const info = await storage.getCollectionInfo('embeddings');
console.log(`Vectors: ${info.vectors_count}`);
console.log(`Status: ${info.status}`); // 'green', 'yellow', or 'red'

// Delete a collection
await storage.deleteCollection('embeddings');
```

### Vector Operations

```typescript
// Upsert points (vectors with metadata)
await storage.upsertPoints('embeddings', [
  {
    id: 'doc1',                      // Can be string or number
    vector: [0.1, 0.2, 0.3, ...],    // 1536-dimensional vector
    payload: {
      text: 'Original text',
      source: 'document.pdf',
      page: 1,
      category: 'technical'
    }
  },
  {
    id: 'doc2',
    vector: [0.4, 0.5, 0.6, ...],
    payload: {
      text: 'Another text',
      source: 'article.md',
      tags: ['ai', 'ml']
    }
  }
]);

// Search for similar vectors
const results = await storage.searchPoints(
  'embeddings',
  [0.2, 0.3, 0.4, ...], // Query vector
  {
    limit: 10,                       // Number of results
    score_threshold: 0.7,            // Minimum similarity score
    with_payload: true,              // Include payload
    with_vector: false,              // Don't include vectors
    filter: {                        // Advanced filtering
      must: [
        {
          key: 'category',
          match: { value: 'technical' }
        },
        {
          key: 'page',
          range: { gte: 1, lte: 5 }
        }
      ],
      should: [
        {
          key: 'tags',
          match: { any: ['ai', 'ml'] }
        }
      ]
    },
    params: {
      hnsw_ef: 128,                  // Search precision
      exact: false                   // Use approximate search
    }
  }
);

// Retrieve specific points
const points = await storage.retrievePoints(
  'embeddings',
  ['doc1', 'doc2'],
  true,  // with payload
  false  // without vector
);

// Update payloads
await storage.updatePayload('embeddings', [
  {
    id: 'doc1',
    payload: {
      processed: true,
      timestamp: new Date().toISOString()
    }
  }
]);

// Delete points
await storage.deletePoints('embeddings', ['doc1', 'doc2']);

// Count points with filter
const count = await storage.countPoints('embeddings', {
  must: [{
    key: 'category',
    match: { value: 'technical' }
  }]
});
```

### Scroll API

For iterating through large collections:

```typescript
let offset = undefined;
const allPoints = [];

do {
  const response = await storage.scrollPoints('embeddings', {
    offset,
    limit: 100,
    with_payload: true,
    filter: {
      must: [{
        key: 'processed',
        match: { value: false }
      }]
    }
  });
  
  allPoints.push(...response.points);
  offset = response.next_page_offset;
} while (offset !== null && offset !== undefined);
```

## Advanced Filtering

Qdrant supports complex filter conditions:

```typescript
const filter = {
  must: [
    // Exact match
    { key: 'status', match: { value: 'active' } },
    
    // Text match
    { key: 'description', match: { text: 'machine learning' } },
    
    // Range
    { key: 'price', range: { gte: 10, lte: 100 } },
    
    // Array contains any
    { key: 'tags', match: { any: ['ai', 'ml', 'nlp'] } },
    
    // Array contains all (not in example)
    { key: 'features', match: { except: ['deprecated'] } },
    
    // Nested filter
    {
      filter: {
        should: [
          { key: 'priority', match: { value: 'high' } },
          { key: 'deadline', range: { lt: Date.now() } }
        ]
      }
    }
  ],
  
  must_not: [
    // Exclude deleted items
    { key: 'deleted', match: { value: true } }
  ],
  
  should: [
    // Boost recent items
    { key: 'created_at', range: { gte: Date.now() - 86400000 } }
  ]
};
```

## Best Practices

### 1. Collection Configuration
```typescript
// For OpenAI embeddings
await storage.createCollection({
  name: 'openai-embeddings',
  vectors: {
    size: 1536,
    distance: 'Cosine' // Best for normalized embeddings
  },
  // Optimize for large collections
  on_disk_payload: true,
  hnsw_config: {
    m: 16,
    ef_construct: 200,
    full_scan_threshold: 20000
  }
});

// For smaller, frequently accessed collections
await storage.createCollection({
  name: 'cache-embeddings',
  vectors: {
    size: 384,
    distance: 'Euclid'
  },
  on_disk_payload: false // Keep in memory
});
```

### 2. Batch Operations
```typescript
// Efficient batch upserts
const points = generatePoints(); // Your points
const batchSize = 100;

for (let i = 0; i < points.length; i += batchSize) {
  await storage.upsertPoints(
    'embeddings',
    points.slice(i, i + batchSize)
  );
}
```

### 3. Payload Design
```typescript
// Structure payload for efficient filtering
const point = {
  id: 'doc123_chunk5',
  vector: embedding,
  payload: {
    // Indexed fields (create field indexes for these)
    doc_id: 'doc123',
    chunk_index: 5,
    category: 'technical',
    status: 'published',
    created_at: Date.now(),
    
    // Non-indexed fields
    text: 'Original text content',
    metadata: {
      author: 'John Doe',
      source_url: 'https://example.com/doc'
    }
  }
};

// Create field indexes for faster filtering
await storage.client.createFieldIndex('embeddings', 'category', 'keyword');
await storage.client.createFieldIndex('embeddings', 'created_at', 'integer');
```

## Performance Considerations

1. **KV Operations**: Competitive with dedicated KV stores for small datasets
2. **List Operations**: Use pagination and filters to improve performance
3. **Payload Size**: No hard limit, but large payloads affect performance
4. **Batch Size**: Optimal batch size is 100-1000 points
5. **Indexing**: Create field indexes for frequently filtered fields

## When to Use Qdrant Adapter

### Good For:
- AI/ML applications with vector search
- Semantic search with metadata filtering
- Recommendation systems
- Hybrid search (vector + attribute filtering)
- Self-hosted vector database needs
- Applications requiring complex filtering

### Not Ideal For:
- Pure KV workloads without vector search
- Applications requiring native list operations
- Extremely large payloads (>1MB per item)
- Simple key-value caching

## Docker Deployment

```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__GRPC_PORT=6334
```

## Migration from Other Stores

```typescript
// Migrate from Pinecone to Qdrant
const pinecone = createStorageProvider({
  type: 'pinecone',
  config: { apiKey: PINECONE_API_KEY }
});

const qdrant = createStorageProvider({
  type: 'qdrant',
  config: { host: 'localhost' }
});

// Create collection with same configuration
await qdrant.createCollection({
  name: 'migrated-vectors',
  vectors: { size: 1536, distance: 'Cosine' }
});

// Migrate vectors in batches
let offset = 0;
const batchSize = 100;

while (true) {
  const vectors = await pinecone.fetchVectors('index', ids.slice(offset, offset + batchSize));
  if (Object.keys(vectors).length === 0) break;
  
  const points = Object.entries(vectors).map(([id, vec]) => ({
    id,
    vector: vec.values,
    payload: vec.metadata
  }));
  
  await qdrant.upsertPoints('migrated-vectors', points);
  offset += batchSize;
}
```

## Error Handling

```typescript
try {
  await storage.upsertPoints('collection', points);
} catch (error) {
  if (error.message.includes('dimension')) {
    console.error('Vector dimension mismatch');
  } else if (error.message.includes('not found')) {
    console.error('Collection does not exist');
  } else {
    console.error('Qdrant error:', error);
  }
}
```

## Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [API Reference](https://qdrant.github.io/qdrant/redoc/index.html)
- [Docker Hub](https://hub.docker.com/r/qdrant/qdrant)
- [Cloud Console](https://cloud.qdrant.io)
- [Client Libraries](https://qdrant.tech/documentation/libraries/)
- [Benchmarks](https://qdrant.tech/benchmarks/) 