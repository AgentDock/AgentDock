# PostgreSQL Vector Storage Adapter

PostgreSQL storage adapter with vector similarity search capabilities using [pgvector](https://github.com/pgvector/pgvector). This adapter extends our base PostgreSQL adapter with vector operations while maintaining all standard storage features.

## Features

- 🚀 **pgvector Extension**: Native PostgreSQL vector operations
- 📊 **Multiple Metrics**: Euclidean, Cosine, and Inner Product distance
- 🔍 **Efficient Indexing**: IVF Flat and HNSW index support
- 🏷️ **Metadata Filtering**: Hybrid search with metadata queries
- 🔄 **Seamless Integration**: All PostgreSQL adapter features included
- 🔐 **ACID Compliance**: Full transactional support
- 🌐 **Production Ready**: Battle-tested pgvector extension

## Prerequisites

1. **PostgreSQL 13+** installed
2. **pgvector extension** installed in your database

### Installing pgvector

#### Ubuntu/Debian
```bash
sudo apt install postgresql-15-pgvector
```

#### macOS (Homebrew)
```bash
brew install pgvector
```

#### From Source
```bash
cd /tmp
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install # may need sudo
```

#### Cloud Providers
Most cloud PostgreSQL services now include pgvector:
- AWS RDS PostgreSQL
- Google Cloud SQL
- Azure Database for PostgreSQL
- Supabase
- Neon
- Timescale

## Installation

The PostgreSQL Vector adapter is included with AgentDock Core:

```bash
npm install agentdock-core pg
```

## Configuration

```typescript
import { createStorageProvider } from 'agentdock-core';

const storage = createStorageProvider({
  type: 'postgresql-vector',
  namespace: 'my-app',
  config: {
    // PostgreSQL connection options
    connectionString: process.env.DATABASE_URL,
    // or individual options
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'user',
    password: 'password',
    
    // Vector-specific options
    enableVector: true,              // Enable vector operations (default: true)
    defaultDimension: 1536,          // Default vector dimension (default: 1536)
    defaultMetric: 'cosine',         // Default similarity metric (default: 'cosine')
    defaultIndexType: 'ivfflat',     // Default index type (default: 'ivfflat')
    
    // IVF Flat configuration
    ivfflat: {
      lists: 100,    // Number of lists for IVF index (default: dimension/16)
      probes: 10     // Number of probes for searches (default: 1)
    }
  }
});
```

## Vector Operations

### Creating a Collection

```typescript
// Create a vector collection with specific configuration
await storage.createCollection({
  name: 'embeddings',
  dimension: 1536,                    // Vector dimension (must match your model)
  metric: 'cosine',                   // 'euclidean', 'cosine', or 'ip' (inner product)
  index: {
    type: 'ivfflat',                  // or 'hnsw' (if available)
    lists: 100                        // Number of clusters for IVF
  }
});
```

### Inserting Vectors

```typescript
// Insert vectors with metadata
await storage.insertVectors('embeddings', [
  {
    id: 'doc1',
    vector: [0.1, 0.2, 0.3, ...],    // 1536-dimensional vector
    metadata: {
      title: 'Introduction to AI',
      author: 'John Doe',
      category: 'AI',
      timestamp: new Date().toISOString()
    }
  },
  {
    id: 'doc2',
    vector: [0.4, 0.5, 0.6, ...],
    metadata: {
      title: 'Machine Learning Basics',
      author: 'Jane Smith',
      category: 'ML'
    }
  }
]);
```

### Searching Vectors

```typescript
// Basic similarity search
const results = await storage.searchVectors(
  'embeddings',
  queryVector,  // Your query vector
  {
    k: 10,                           // Return top 10 results
    includeScore: true,              // Include similarity scores
    includeVector: false             // Don't return vectors (save bandwidth)
  }
);

// Search with metadata filtering
const filteredResults = await storage.searchVectors(
  'embeddings',
  queryVector,
  {
    k: 5,
    filter: {
      category: 'AI',                // Only search AI documents
      author: 'John Doe'
    },
    threshold: 0.8                   // Minimum similarity threshold
  }
);

// Hybrid search (vector + metadata)
const hybridResults = await storage.hybridSearch(
  'embeddings',
  queryVector,
  {
    category: 'ML',
    year: 2024
  },
  {
    k: 20,
    includeScore: true
  }
);
```

### Managing Vectors

```typescript
// Get vector by ID
const vector = await storage.getVector('embeddings', 'doc1');

// Update vectors
await storage.updateVectors('embeddings', [
  {
    id: 'doc1',
    vector: newVector,
    metadata: updatedMetadata
  }
]);

// Delete vectors
await storage.deleteVectors('embeddings', ['doc1', 'doc2']);

// Upsert (insert or update)
await storage.upsertVectors('embeddings', vectors);
```

### Collection Management

```typescript
// Check if collection exists
const exists = await storage.collectionExists('embeddings');

// List all collections
const collections = await storage.listCollections();

// Drop collection
await storage.dropCollection('embeddings');
```

## Distance Metrics

### Cosine Distance (Default)
Best for normalized embeddings, measures angle between vectors.
- Range: [0, 2]
- 0 = identical, 2 = opposite

### Euclidean Distance (L2)
Measures straight-line distance between vectors.
- Range: [0, ∞)
- 0 = identical

### Inner Product
Dot product of vectors (use negative for similarity).
- Range: (-∞, ∞)
- Higher = more similar

## Indexing Strategies

### IVF Flat (Default)
Inverted File Flat - good balance of speed and recall.

```typescript
await storage.createCollection({
  name: 'my_vectors',
  dimension: 1536,
  index: {
    type: 'ivfflat',
    lists: 100  // Number of clusters (default: sqrt(number of vectors))
  }
});

// Configure search probes (more probes = better recall, slower search)
const storage = createStorageProvider({
  type: 'postgresql-vector',
  config: {
    ivfflat: {
      probes: 10  // Check 10 clusters during search
    }
  }
});
```

### HNSW (If Available)
Hierarchical Navigable Small World - better recall but more memory.

```typescript
await storage.createCollection({
  name: 'my_vectors',
  dimension: 1536,
  index: {
    type: 'hnsw',
    m: 16,              // Number of connections per layer
    efConstruction: 64  // Size of dynamic candidate list
  }
});
```

## Standard Storage Operations

The PostgreSQL Vector adapter includes all standard storage operations:

```typescript
// Key-value operations
await storage.set('key', { data: 'value' });
const value = await storage.get('key');
await storage.delete('key');

// List operations
await storage.saveList('mylist', [1, 2, 3, 4, 5]);
const items = await storage.getList('mylist', 0, 3);

// Batch operations
await storage.setMany({
  'key1': 'value1',
  'key2': 'value2'
});

// TTL support
await storage.set('session', data, { ttlSeconds: 3600 });
```

## Performance Optimization

### 1. Index Configuration
```sql
-- Adjust IVF lists based on dataset size
-- lists = sqrt(number of rows) is a good starting point
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);
```

### 2. Query Optimization
```typescript
// Increase probes for better accuracy
const storage = createStorageProvider({
  type: 'postgresql-vector',
  config: {
    ivfflat: { probes: 50 }  // Default is 1
  }
});
```

### 3. Batch Operations
```typescript
// Insert in batches for better performance
const batchSize = 1000;
for (let i = 0; i < vectors.length; i += batchSize) {
  await storage.insertVectors('embeddings', 
    vectors.slice(i, i + batchSize)
  );
}
```

## Best Practices

1. **Normalize Vectors**: For cosine similarity, normalize your vectors
2. **Choose Appropriate Dimensions**: Balance between accuracy and performance
3. **Index After Bulk Insert**: Create indexes after inserting large datasets
4. **Monitor Performance**: Use `EXPLAIN ANALYZE` for query optimization
5. **Regular Maintenance**: Run `VACUUM` and `ANALYZE` periodically

## Migration from Other Vector Stores

```typescript
// Easy migration from standalone vector databases
const pgVector = createStorageProvider({
  type: 'postgresql-vector',
  config: { connectionString: process.env.DATABASE_URL }
});

// Same API as other vector stores
await pgVector.createCollection({ name: 'vectors', dimension: 1536 });
await pgVector.insertVectors('vectors', embeddings);
const results = await pgVector.searchVectors('vectors', query);
```

## Troubleshooting

### Extension Not Found
```sql
-- Check if pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Install if missing (requires permissions)
CREATE EXTENSION vector;
```

### Performance Issues
```sql
-- Check index usage
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM embeddings 
ORDER BY embedding <=> '[...]'::vector 
LIMIT 10;

-- Increase work_mem for large operations
SET work_mem = '256MB';
```

### Dimension Mismatch
Ensure all vectors have the same dimension as specified in the collection.

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vector Similarity Search Guide](https://www.timescale.com/blog/postgresql-as-a-vector-database-using-pgvector)
- [pgvector Performance Tuning](https://github.com/pgvector/pgvector/blob/master/README.md#performance) 