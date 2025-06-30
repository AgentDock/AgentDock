# Vector Storage Integration

Vector storage provides embedding-based retrieval for memories, documents, and semantic search across the AgentDock platform.

## Current Status

**Status: ✅ Implemented**

AgentDock includes a complete vector storage system with multiple production-ready adapters and full AI SDK integration.

## Implemented Features

### Vector Storage Adapters

1. **PostgreSQL + pgvector** (Production)
   - Full vector similarity search
   - Scales to millions of vectors
   - HNSW and IVFFlat indexes
   - Hybrid search capabilities

2. **SQLite + sqlite-vec** (Development)
   - Local vector search
   - Zero external dependencies
   - Perfect for development
   - 768-dimension support

3. **ChromaDB** (Specialized)
   - Dedicated vector database
   - Built-in collections
   - Metadata filtering
   - REST API interface

4. **Qdrant** (High Performance)
   - Production vector search
   - Advanced filtering
   - Batch operations
   - Clustering support

5. **Pinecone** (Managed Service)
   - Serverless vector search
   - Auto-scaling
   - Global replication
   - Enterprise support

### AI SDK Integration

AgentDock exports AI SDK's embedding functions directly:

```typescript
import { embed, embedMany } from 'agentdock-core/llm';
import { createOpenAIModel } from 'agentdock-core/llm';

// Create embedding model
const embeddingModel = createOpenAIModel({
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY
});

// Generate single embedding
const result = await embed({
  model: embeddingModel,
  value: 'Your text to embed'
});

// Generate batch embeddings
const results = await embedMany({
  model: embeddingModel,
  values: ['Text 1', 'Text 2', 'Text 3']
});
```

## Architecture

### Storage Layer Integration

```typescript
// Vector operations are part of storage adapters
import { getStorageFactory } from 'agentdock-core';

const factory = getStorageFactory();
const vectorStorage = factory.getProvider({
  type: 'postgresql-vector',
  config: {
    connectionString: process.env.DATABASE_URL,
    enableVector: true,
    defaultDimension: 1536
  }
});
```

### Vector Operations Interface

All vector-enabled adapters implement:

```typescript
interface VectorOperations {
  // Collection management
  createCollection(config: VectorCollectionConfig): Promise<void>;
  dropCollection(name: string): Promise<void>;
  
  // Vector CRUD
  insertVectors(collection: string, vectors: VectorData[]): Promise<void>;
  updateVectors(collection: string, vectors: VectorData[]): Promise<void>;
  deleteVectors(collection: string, ids: string[]): Promise<void>;
  
  // Search
  searchVectors(
    collection: string,
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>;
}
```

## Memory System Integration

### 1. Memory Embeddings

```typescript
// Generate embeddings for memories
const memoryEmbedding = await embed({
  model: embeddingModel,
  value: memory.content
});

// Store in vector collection
await vectorStorage.insertVectors('memories', [{
  id: memory.id,
  vector: memoryEmbedding.embedding,
  metadata: {
    agentId: memory.agentId,
    type: memory.type,
    importance: memory.importance
  }
}]);
```

### 2. Semantic Memory Recall

```typescript
// Generate query embedding
const queryEmbedding = await embed({
  model: embeddingModel,
  value: userQuery
});

// Search similar memories
const similarMemories = await vectorStorage.searchVectors(
  'memories',
  queryEmbedding.embedding,
  {
    k: 10,
    filter: { agentId: currentAgentId },
    includeScore: true
  }
);
```

### 3. Batch Processing

```typescript
// Batch embed memories for efficiency
const memoryTexts = memories.map(m => m.content);
const embeddings = await embedMany({
  model: embeddingModel,
  values: memoryTexts
});

// Batch insert
const vectorData = memories.map((memory, i) => ({
  id: memory.id,
  vector: embeddings.embeddings[i],
  metadata: {
    agentId: memory.agentId,
    type: memory.type,
    createdAt: memory.createdAt
  }
}));

await vectorStorage.insertVectors('memories', vectorData);
```

## Production Configurations

### PostgreSQL + pgvector (Recommended)

```typescript
// Production setup with pgvector
const vectorStorage = factory.getProvider({
  type: 'postgresql-vector',
  config: {
    connectionString: process.env.DATABASE_URL,
    enableVector: true,
    defaultDimension: 1536,
    defaultMetric: VectorMetric.COSINE,
    ivfflat: {
      lists: 100,  // For 1M vectors
      probes: 10   // Query accuracy
    }
  }
});
```

### Embedding Model Selection

```typescript
// Cost-optimized embedding
const smallModel = createOpenAIModel({
  model: 'text-embedding-3-small',  // $0.02/1M tokens
  apiKey: process.env.OPENAI_API_KEY
});

// Quality-optimized embedding
const largeModel = createOpenAIModel({
  model: 'text-embedding-3-large',  // $0.13/1M tokens
  apiKey: process.env.OPENAI_API_KEY
});
```

## Performance Optimization

### 1. Batch Operations
- Process embeddings in batches of 100-1000
- Use `embedMany` for multiple texts
- Batch vector insertions

### 2. Caching Strategy
```typescript
// Cache embeddings to avoid re-computation
const embeddingCache = new Map<string, number[]>();

async function getCachedEmbedding(text: string): Promise<number[]> {
  const hash = createHash(text);
  if (embeddingCache.has(hash)) {
    return embeddingCache.get(hash)!;
  }
  
  const result = await embed({ model, value: text });
  embeddingCache.set(hash, result.embedding);
  return result.embedding;
}
```

### 3. Index Optimization
- Use IVFFlat for large datasets (>100K vectors)
- Tune `lists` parameter: sqrt(num_vectors)
- Increase `probes` for better accuracy

## Cost Management

### Embedding Costs (OpenAI)
- text-embedding-3-small: $0.02 per 1M tokens
- text-embedding-3-large: $0.13 per 1M tokens
- ada-002: $0.10 per 1M tokens (legacy)

### Cost Optimization Strategies
1. Use smaller models for non-critical content
2. Cache embeddings aggressively
3. Batch operations to reduce API calls
4. Filter content before embedding
5. Use dimension reduction when appropriate

## Common Use Cases

### 1. Semantic Memory Search
Find memories related to current context

### 2. Document Retrieval
RAG implementation for knowledge bases

### 3. Similarity Matching
Find similar conversations or patterns

### 4. Concept Clustering
Group related memories automatically

### 5. Context Building
Retrieve relevant history for agents

## Migration Guide

### From Placeholder to Real Embeddings

```typescript
// Before: ChromaDB placeholder
const embeddingFunction = new DefaultEmbeddingFunction();

// After: Real embeddings
const embeddingFunction = {
  async generate(documents: string[]): Promise<number[][]> {
    const result = await embedMany({
      model: embeddingModel,
      values: documents
    });
    return result.embeddings;
  }
};
```

## Monitoring and Debugging

### Vector Storage Metrics
- Index size and performance
- Query latency (p50, p95, p99)
- Embedding generation time
- Cache hit rates

### Debug Utilities
```typescript
// Check vector similarity
import { cosineSimilarity } from 'agentdock-core/evaluation';

const similarity = cosineSimilarity(vector1, vector2);
console.log(`Similarity: ${similarity}`);
```

## Next Steps

With vector storage fully implemented, the memory system can now:
1. Generate real embeddings for all memory types
2. Perform semantic search at scale
3. Build memory networks with vector similarity
4. Enable hybrid search (vector + metadata)
5. Support multi-modal embeddings (future)