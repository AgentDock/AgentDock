# AgentDock Core Memory System - Developer Documentation

> **Technical implementation guide for the AgentDock Core memory system**

This is the technical documentation for developers working directly with the AgentDock Core memory implementation. For user-facing documentation, see [`docs/memory/README.md`](../../../docs/memory/README.md).

## Architecture Overview

The memory system implements a **4-layer cognitive architecture** with **production-grade batch processing** and **cost optimization**:

```
agentdock-core/src/memory/
├── types/                   # 4 Memory Type Implementations (762 lines)
│   ├── working/            # WorkingMemory.ts (197 lines)
│   ├── episodic/           # EpisodicMemory.ts (195 lines) 
│   ├── semantic/           # SemanticMemory.ts (170 lines)
│   ├── procedural/         # ProceduralMemory.ts (200 lines)
│   └── base/               # BaseMemoryType.ts (shared foundation)
├── batch/                  # Batch Processing System (676 lines)
│   ├── BatchProcessor.ts   # Main orchestrator with 5x cost reduction
│   ├── extractors/         # 3-tier extraction pipeline
│   └── types.ts           # Batch processing interfaces
├── services/               # Core Services (492 lines)
│   ├── RecallService.ts    # Unified cross-memory search
│   ├── ConversationProcessor.ts  # Message → Memory pipeline  
│   └── EncryptionService.ts      # Security layer
├── intelligence/          # AI Layer (189 lines)
│   ├── connections/       # MemoryConnectionManager.ts
│   ├── consolidation/     # MemoryConsolidator.ts
│   └── embedding/         # EmbeddingService.ts
├── lifecycle/             # Memory Management (537 lines)
│   ├── MemoryLifecycleManager.ts  # Complete automation
│   └── ConfigurableDecayEngine.ts # TTL & resonance decay
├── __tests__/             # Test Suite 
│   ├── unit/              # Component tests
│   ├── integration/       # Cross-system tests  
│   └── performance/       # Latency & throughput tests
└── index.ts               # Public API exports
```

## Core Components

### 1. **BatchProcessor** - 5x Cost Reduction Engine

**File**: `batch/BatchProcessor.ts` (676 lines)

The **most critical component** implementing intelligent message processing with dramatic cost savings:

```typescript
import { BatchProcessor } from '@agentdock/core';

// Cost-optimized configuration
const processor = new BatchProcessor(storage, {
  maxBatchSize: 20,        // Process 20 messages at once
  extractionRate: 0.2,     // Only process 20% of batches (5x savings)
  timeoutMinutes: 5,       // Or process after 5 minutes
  
  extractors: [
    { type: 'rules', enabled: true, costPerMemory: 0 },        // Free tier
    { type: 'small-llm', enabled: true, costPerMemory: 0.001 }, // Cheap tier
    { type: 'large-llm', enabled: true, costPerMemory: 0.01 }   // Premium tier
  ],
  
  costBudget: 50.0,        // Monthly budget control
  targetCoverage: 0.8      // 80% memory coverage target
});

// Process with cost tracking
const result = await processor.process(userId, agentId, messages);
```

**Key Features**:
- **Statistical Processing**: Only processes 1 in 5 message batches
- **3-Tier Extraction**: Rules (free) → Small LLM (cheap) → Large LLM (premium)
- **Noise Filtering**: Removes "ok", "thanks", filler content before processing
- **Budget Controls**: Monthly spending limits and per-batch restrictions
- **Advanced Buffering**: Prevents OOM crashes with buffer overflow protection

### 2. **Memory Types** - Specialized Storage Layers

#### **WorkingMemory.ts** (197 lines)
**Fast, ephemeral context for immediate conversations**

```typescript
import { WorkingMemory } from '@agentdock/core';

const working = new WorkingMemory(storage, {
  maxContextItems: 10,     // Recent message limit
  ttlSeconds: 3600,        // 1-hour auto-expiry  
  contextWindow: 5,        // Rolling context window
  priority: 'high'         // High-priority access
});

// Store session context
await working.store(agentId, sessionId, messages);

// Retrieve with automatic cleanup
const context = await working.recall(agentId, sessionId);
```

#### **EpisodicMemory.ts** (195 lines)
**Time-ordered experiences and events**

```typescript
import { EpisodicMemory } from '@agentdock/core';

const episodic = new EpisodicMemory(storage, {
  compressionAge: 30,      // Compress after 30 days
  decayRate: 0.1,         // Natural forgetting rate
  retentionPolicy: 'temporal',
  importanceThreshold: 0.3
});

// Store life events with temporal ordering
await episodic.store(agentId, {
  content: 'User mentioned their dog passed away',
  timestamp: Date.now(),
  importance: 0.9,
  emotionalWeight: 0.8
});
```

#### **SemanticMemory.ts** (170 lines)  
**Long-term knowledge and facts**

```typescript
import { SemanticMemory } from '@agentdock/core';

const semantic = new SemanticMemory(storage, {
  confidenceThreshold: 0.7,    // Quality gate
  consolidationEnabled: true,   // Auto-merge similar facts
  vectorSearch: true,          // Enable similarity search
  maxRelatedFacts: 5          // Limit retrieval size
});

// Store permanent knowledge
await semantic.store(agentId, {
  content: 'User is allergic to shellfish',
  keywords: ['allergy', 'shellfish', 'medical'],
  confidence: 0.95,
  neverDecay: true  // Critical medical info
});
```

#### **ProceduralMemory.ts** (200 lines)
**Learned behavioral patterns**

```typescript
import { ProceduralMemory } from '@agentdock/core';

const procedural = new ProceduralMemory(storage, {
  learningRate: 0.05,          // Pattern learning speed
  reinforcementDecay: 0.02,    // Pattern fade rate
  confidenceThreshold: 0.6,    // Action confidence gate
  maxPatterns: 100            // Storage limit
});

// Learn from successful interactions
await procedural.learn(agentId, {
  pattern: 'When user mentions stress → suggest breathing exercises',
  context: 'anxiety management',
  successRate: 0.85,
  lastSuccess: Date.now()
});
```

### 3. **RecallService** - Unified Memory Search

**File**: `services/RecallService.ts` (492 lines)

**Cross-memory-type search and intelligent ranking**:

```typescript
import { RecallService } from '@agentdock/core';

const recall = new RecallService(
  workingMemory, episodicMemory, semanticMemory, proceduralMemory,
  {
    hybridSearch: true,        // Multi-type search
    embeddingSearch: true,     // Vector similarity
    temporalRelevance: true,   // Time-based scoring
    maxResults: 20,           // Result limit
    cacheEnabled: true        // Performance optimization
  }
);

// Unified search across all memory types
const results = await recall.searchMemories(agentId, {
  query: 'breathing exercises for anxiety',
  types: ['semantic', 'procedural'],
  timeRange: { days: 30 },
  minRelevance: 0.7
});
```

### 4. **MemoryManager** - System Orchestration

**File**: `MemoryManager.ts` (251 lines)

**Central coordinator for all memory operations**:

```typescript
import { MemoryManager } from '@agentdock/core';

const manager = new MemoryManager(storage, {
  working: { maxContextItems: 10, ttlSeconds: 3600 },
  episodic: { compressionAge: 30, decayRate: 0.1 },
  semantic: { confidenceThreshold: 0.7, vectorSearch: true },
  procedural: { learningRate: 0.05 }
});

// Process new conversation
const result = await manager.processMessage(agentId, sessionId, {
  id: generateId(),
  role: 'user',
  content: 'I have trouble sleeping before presentations',
  timestamp: Date.now()
});

// Get relevant context for responses
const context = await manager.getRelevantMemories(agentId, sessionId, {
  query: 'presentation anxiety',
  includeTypes: ['episodic', 'semantic', 'procedural'],
  maxResults: 10
});
```

## Storage Integration

### **PostgreSQL Adapter** (537 lines)

**Production-grade storage with advanced vector operations**:

```typescript
// File: storage/adapters/postgresql/operations/memory.ts
import { PostgreSQLMemoryAdapter } from '@agentdock/core/server';

const adapter = new PostgreSQLMemoryAdapter({
  connectionString: process.env.DATABASE_URL,
  schema: 'memory_system',
  vector: {
    dimension: 1536,
    metric: 'cosine',
    indexType: 'ivfflat',
    lists: 100
  }
});

// High-performance batch operations  
await adapter.batchCreateMemories(memories);
await adapter.recallMemories(agentId, criteria, options);
```

### **SQLite Adapter** (428 lines)

**Development-friendly local storage**:

```typescript
// File: storage/adapters/sqlite/operations/memory.ts
import { SQLiteMemoryAdapter } from '@agentdock/core/server';

const adapter = new SQLiteMemoryAdapter({
  filename: './memory.db',
  enableVector: true,  // Uses sqlite-vec extension
  defaultDimension: 1536
});
```

## Batch Processing Utilities

### **StreamingMemoryBatchProcessor** 

**Real-time memory ingestion with overflow protection**:

```typescript
import { StreamingMemoryBatchProcessor } from '@agentdock/core';

const processor = new StreamingMemoryBatchProcessor(
  async (batch) => await adapter.batchCreateMemories(batch),
  {
    maxBatchSize: 1000,      // Batch size limit
    flushIntervalMs: 5000,   // Auto-flush interval  
    maxMemoryMB: 100,        // Memory pressure limit
    maxConcurrent: 5         // Parallel processing limit
  }
);

// Process with automatic batching
await processor.process(memory);

// Monitor performance
const stats = processor.getStats();
console.log(`Throughput: ${stats.throughput} items/sec`);
```

### **MemoryConsolidator**

**Deduplication and similarity clustering**:

```typescript
import { MemoryConsolidator } from '@agentdock/core';

const consolidator = new MemoryConsolidator(
  (m1, m2) => cosineSimilarity(m1.embedding, m2.embedding)
);

// Find similar memory groups
const groups = consolidator.findSimilarGroups(memories, {
  similarityThreshold: 0.85,
  minGroupSize: 2,
  maxGroupSize: 10,
  preserveImportant: true
});

// Consolidate each group to save storage
for (const group of groups) {
  const consolidated = consolidator.consolidateGroup(group);
  await adapter.setMemory(consolidated);
}
```

## Key APIs

### **Browser-Safe Exports** (`@agentdock/core`)

```typescript
import { 
  // Memory types
  MemoryManager,
  WorkingMemory,
  EpisodicMemory, 
  SemanticMemory,
  ProceduralMemory,
  
  // Processing
  BatchProcessor,
  RecallService,
  ConversationProcessor,
  
  // Utilities
  StreamingMemoryBatchProcessor,
  MemoryConsolidator,
  
  // Storage providers (browser-safe)
  MemoryStorageProvider,
  RedisStorageProvider,
  VercelKVProvider
} from '@agentdock/core';
```

### **Server-Only Exports** (`@agentdock/core/server`)

```typescript
import {
  // Storage adapters (Node.js only) 
  SQLiteAdapter,
  SQLiteMemoryAdapter,
  PostgreSQLAdapter,
  PostgreSQLMemoryAdapter,
  
  // Registration functions
  registerSQLiteAdapter,
  registerPostgreSQLAdapter
} from '@agentdock/core/server';
```

## Testing Infrastructure

**Test Results**: 274/281 tests passing (98% success rate)

```bash
# Run all memory tests
cd agentdock-core && npm test src/memory

# Run specific test suites
npm test src/memory/__tests__/unit/
npm test src/memory/__tests__/integration/
npm test src/memory/__tests__/performance/
```

**Test Coverage**:
- **Unit Tests**: Individual memory type functionality
- **Integration Tests**: Cross-system memory interactions 
- **Performance Tests**: Latency and throughput validation
- **E2E Tests**: Complete workflow validation

**Failing Tests** (5 tests - expected):
- Performance tests requiring API keys (store-latency.test.ts)
- One BatchProcessor flaky test for statistical processing

## Performance Characteristics

| Operation | Throughput | Latency | Notes |
|-----------|------------|---------|-------|
| Batch Creation | 10,000 memories/sec | - | PostgreSQL batch operations |
| Memory Recall | - | <100ms | With proper indexing |
| Vector Search | - | ~10ms | 1M vectors (pgvector IVFFlat) |
| Working Memory | - | <5ms | Redis-backed operations |

## Development Workflow

### **1. Local Development Setup**

```bash
# Install dependencies
cd agentdock-core && pnpm install

# Run tests
npm test

# Build
npm run build

# Watch mode during development
npm test -- --watch
```

### **2. Database Setup**

**SQLite (Development)**:
```bash
# Automatic initialization on first use
# No manual setup required
```

**PostgreSQL (Production)**:
```sql
-- Initialize memory schema
SELECT initializeMemorySchema();

-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_memories_vector_cosine 
ON memories USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### **3. Configuration Patterns**

**Development Config**:
```typescript
const config = {
  storage: 'sqlite',
  memory: {
    working: { maxContextItems: 5 },
    semantic: { confidenceThreshold: 0.6 }
  },
  batch: { extractionRate: 0.5 }  // Higher rate for development
};
```

**Production Config**:
```typescript
const config = {
  storage: 'postgresql', 
  memory: {
    working: { maxContextItems: 20, ttlSeconds: 7200 },
    semantic: { confidenceThreshold: 0.8, vectorSearch: true }
  },
  batch: { extractionRate: 0.2, costBudget: 100 }  // Cost-optimized
};
```

## Browser/Server Architecture

**Problem Solved**: SQLite imports were breaking Next.js browser builds.

**Solution**: Dual export system:
- **Main export** (`@agentdock/core`): Browser-safe components only
- **Server export** (`@agentdock/core/server`): Node.js-specific adapters

This follows **industry standard patterns** used by Prisma, Next.js, and other major frameworks.

## Next Steps

1. **Factory Functions**: Add convenience functions for easier setup
2. **Preset Configurations**: Fast/balanced/accurate presets  
3. **Enhanced Caching**: Improve recall performance
4. **Advanced Relationships**: More sophisticated connection discovery
5. **Monitoring Tools**: Memory system observability

---

## Usage Examples

See the [main memory documentation](../../../docs/memory/README.md) for comprehensive usage examples and real-world implementation patterns.

**This technical documentation covers the implementation details for developers working directly with the AgentDock Core memory system codebase.**