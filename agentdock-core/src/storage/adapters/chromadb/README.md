# ChromaDB Storage Adapter

The ChromaDB adapter provides storage capabilities using the open-source ChromaDB vector database. While primarily designed for vector embeddings and semantic search, this adapter emulates key-value storage on top of ChromaDB's document store.

## Features

- **Open-Source**: Self-hostable vector database
- **Vector Search**: Native support for semantic search and embeddings
- **Rich Filtering**: Complex metadata filtering capabilities
- **REST API**: Simple HTTP-based API (no SDK required)
- **TTL Support**: Automatic expiration via metadata tracking
- **Batch Operations**: Efficient bulk operations

## Limitations

- **No Native KV**: Key-value operations are emulated using documents
- **No Lists**: List operations are not supported efficiently
- **Client-Side Filtering**: Prefix matching requires client-side filtering
- **Embedding Required**: All documents require vector embeddings (auto-generated)

## Installation

```bash
# Run ChromaDB server
docker run -p 8000:8000 chromadb/chroma
```

## Configuration

```typescript
const adapter = new ChromaDBAdapter({
  host: 'http://localhost:8000',    // ChromaDB server URL
  authToken: 'your-token',          // Optional auth token
  defaultCollection: 'storage',      // Default collection name
  namespace: 'default',             // Namespace for isolation
  timeout: 30000,                   // Request timeout in ms
  maxRetries: 3,                    // Max retry attempts
  batchSize: 100,                   // Batch operation size
  embeddingFunction: customEmbed    // Optional custom embedder
});
```

## Usage Examples

### Basic KV Operations

```typescript
// Set a value
await adapter.set('user:123', { name: 'John', age: 30 });

// Get a value
const user = await adapter.get('user:123');

// Delete a value
await adapter.delete('user:123');

// Check existence
const exists = await adapter.exists('user:123');
```

### Vector Operations

```typescript
// Create a collection
await adapter.createCollection('documents', {
  description: 'My document collection'
});

// Add documents with embeddings
await adapter.addDocuments('documents', [
  {
    id: 'doc1',
    document: 'This is a sample document',
    metadata: { category: 'example', author: 'John' }
  }
]);

// Query by text (uses embedding function)
const results = await adapter.queryByText('documents', 
  ['sample document'],
  { nResults: 5 }
);

// Query by embeddings
const embeddings = [[0.1, 0.2, 0.3, ...]];
const results = await adapter.queryDocuments('documents',
  embeddings,
  { 
    nResults: 10,
    where: { category: { $eq: 'example' } }
  }
);
```

### Metadata Filtering

```typescript
// Complex metadata queries
const results = await adapter.queryDocuments('documents',
  queryEmbeddings,
  {
    where: {
      $and: [
        { category: { $eq: 'tech' } },
        { score: { $gte: 0.8 } },
        { tags: { $in: ['ai', 'ml'] } }
      ]
    }
  }
);

// Document content filtering
const results = await adapter.queryDocuments('documents',
  queryEmbeddings,
  {
    whereDocument: {
      $contains: 'machine learning'
    }
  }
);
```

## Default Embedding Function

The adapter includes a default embedding function that generates zero vectors. In production, replace this with a real embedding model:

```typescript
class MyEmbeddingFunction implements ChromaEmbeddingFunction {
  async generate(documents: string[]): Promise<number[][]> {
    // Use your embedding model here
    // e.g., OpenAI, Cohere, local model, etc.
    return await myEmbeddingModel.embed(documents);
  }
}

const adapter = new ChromaDBAdapter({
  embeddingFunction: new MyEmbeddingFunction()
});
```

## Distance Metrics

ChromaDB supports multiple distance metrics:

- **L2** (Euclidean): Default metric, good for general use
- **Cosine**: Normalized similarity, good for text
- **IP** (Inner Product): Dot product similarity

## Best Practices

1. **Use Collections**: Organize data into logical collections
2. **Index Metadata**: Use metadata for efficient filtering
3. **Batch Operations**: Process documents in batches for performance
4. **Custom Embeddings**: Use appropriate embedding models for your use case
5. **Regular Cleanup**: The adapter runs TTL cleanup every 5 minutes

## When to Use ChromaDB

✅ **Good for:**
- Applications already using ChromaDB for vectors
- Semantic search and AI applications
- Development and prototyping
- Small to medium datasets

❌ **Not ideal for:**
- Pure key-value workloads
- High-frequency updates
- Large-scale production KV storage
- Applications requiring list operations

## Server Requirements

- ChromaDB server running (Docker or local)
- Network access to ChromaDB API
- Sufficient memory for embeddings
- Optional: GPU for embedding generation 