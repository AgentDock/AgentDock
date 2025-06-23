# SQLite-vec Adapter

SQLite storage adapter with vector similarity search capabilities using the sqlite-vec extension.

## Features

- All standard SQLite adapter features (KV, lists, namespaces, TTL)
- Vector similarity search with multiple metrics (Euclidean, Cosine, Dot Product)
- Metadata filtering on vector searches
- Zero-config local vector database
- Ideal for development and small-scale deployments

## Prerequisites

Install the sqlite-vec extension:

```bash
# macOS
brew install sqlite-vec

# Linux (download from releases)
wget https://github.com/asg017/sqlite-vec/releases/download/v0.1.0/vec0.so
# Place in your library path or specify vecExtensionPath

# Windows
# Download vec0.dll from releases and place in PATH
```

## Usage

```typescript
import { SQLiteVecAdapter } from 'agentdock-core/storage/adapters/sqlite-vec';

// Create adapter
const adapter = new SQLiteVecAdapter({
  path: './vectors.db', // or ':memory:' for in-memory
  enableVector: true,
  defaultDimension: 1536, // OpenAI embedding dimension
  defaultMetric: VectorMetric.COSINE
});

// Initialize
await adapter.initialize();

// Create a collection
await adapter.createCollection({
  name: 'memories',
  dimension: 1536,
  metric: VectorMetric.COSINE
});

// Insert vectors
await adapter.insertVectors('memories', [
  {
    id: 'memory-1',
    vector: embeddingVector, // number[]
    metadata: {
      content: 'User likes pizza',
      timestamp: Date.now(),
      importance: 0.8
    }
  }
]);

// Search for similar vectors
const results = await adapter.searchVectors(
  'memories',
  queryVector,
  {
    k: 10, // Top 10 results
    threshold: 0.7, // Minimum similarity
    filter: { importance: { $gte: 0.5 } } // Metadata filter
  }
);

// Also supports all standard SQLite operations
await adapter.set('key', 'value');
const value = await adapter.get('key');
```

## Configuration

```typescript
interface SQLiteVecAdapterOptions {
  // Standard SQLite options
  path?: string;              // Database file path (default: './agentdock.db')
  namespace?: string;         // Default namespace
  verbose?: boolean;          // Enable verbose logging
  walMode?: boolean;          // Enable WAL mode (default: true)
  
  // Vector-specific options
  enableVector?: boolean;     // Enable vector operations (default: true)
  defaultDimension?: number;  // Default vector dimension (default: 1536)
  defaultMetric?: VectorMetric; // Default similarity metric (default: COSINE)
  vecExtensionPath?: string;  // Path to vec0 extension if not in PATH
}
```

## Vector Metrics

- **COSINE**: Cosine similarity (best for normalized embeddings)
- **EUCLIDEAN**: L2 distance (good for dense vectors)
- **DOT_PRODUCT**: Dot product (fastest, good for sparse vectors)

## Performance Considerations

- SQLite-vec is single-threaded but very fast for small to medium datasets
- Recommended for up to 1M vectors
- For larger scale, consider PostgreSQL Vector or dedicated vector databases
- Indexes are created automatically for vector columns

## Memory System Integration

Perfect for AgentDock's memory system in development:

```typescript
// In development
KV_STORE_PROVIDER=sqlite-vec

// Handles both KV storage and vector search in one database
// No external services required
```

## Limitations

- Single-threaded (SQLite limitation)
- No distributed/replicated support
- Limited to local file system
- Requires sqlite-vec extension to be installed

## Migration Path

Start with SQLite-vec for development, then migrate to PostgreSQL Vector for production:

```typescript
// Development
const dev = new SQLiteVecAdapter({ path: './dev.db' });

// Production (same API)
const prod = new PostgreSQLVectorAdapter({ 
  connectionString: process.env.DATABASE_URL 
});
```

Both adapters implement the same `VectorOperations` interface, making migration seamless. 