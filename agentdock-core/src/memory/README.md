# AgentDock Core Memory System - Technical Implementation

> **Work in Progress** - This technical documentation covers the current implementation of AgentDock's memory system as it exists today. The system is actively under development and APIs may change.

## Overview

The AgentDock Core Memory System provides a production-ready, four-layer memory architecture for AI agents. This is the technical implementation guide for developers integrating the memory system directly or preparing for npm package deployment.

## Architecture Summary

**Four-Layer Memory System**
- **Working Memory**: Session-scoped conversation context with TTL management
- **Episodic Memory**: Time-ordered experiences with configurable decay
- **Semantic Memory**: Long-term knowledge with confidence scoring and consolidation
- **Procedural Memory**: Learned behavioral patterns with reinforcement learning

**Core Systems**
- **PRIME Extraction**: Intelligent memory extraction with tier-based model selection
- **Hybrid Search**: 70/30 vector/text fusion for PostgreSQL, RRF for SQLite
- **Memory Connections**: Progressive relationship discovery with configurable enhancement
- **Cost Tracking**: Production monitoring with budget controls

## Current File Structure

```
agentdock-core/src/memory/
├── index.ts                    # Public API exports
├── MemoryManager.ts           # Core orchestrator
├── create-memory-system.ts    # Factory functions
├── base-types.ts              # Foundational types
│
├── extraction/                # PRIME Extraction System
│   ├── PRIMEExtractor.ts      # Memory extraction engine
│   ├── PRIMEOrchestrator.ts   # Batch processing
│   ├── index.ts               # Extraction exports
│   ├── config/                # Extraction configurations
│   └── __tests__/             # Extraction test suite
│
├── services/                  # Core Services
│   ├── index.ts               # Service exports
│   ├── RecallService.ts       # Memory retrieval
│   ├── EncryptionService.ts   # Security layer
│   ├── RecallServiceUtils.ts  # Utility functions
│   └── RecallServiceTypes.ts  # Service type definitions
│
├── types/                     # Memory Type Implementations
│   ├── index.ts               # Type exports
│   ├── common.ts              # Shared type definitions
│   ├── base/                  # BaseMemoryType foundation
│   ├── working/               # WorkingMemory implementation
│   ├── episodic/              # EpisodicMemory with decay
│   ├── semantic/              # SemanticMemory with consolidation
│   └── procedural/            # ProceduralMemory with learning
│
├── tracking/                  # Cost & Performance Tracking
│   ├── CostTracker.ts         # Production cost monitoring
│   └── index.ts               # Tracking exports
│
├── intelligence/              # AI-Powered Features
│   ├── connections/           # Memory relationship management
│   ├── consolidation/         # Knowledge consolidation
│   ├── embeddings/            # Vector embedding service
│   └── graph/                 # Connection graph implementation
│
├── lifecycle/                 # Memory Management
│   ├── index.ts               # Lifecycle exports
│   ├── types.ts               # Lifecycle type definitions
│   ├── MemoryEvolutionTracker.ts    # Evolution tracking
│   └── examples/              # Lifecycle usage examples
│
├── decay/                     # Lazy Memory Decay System
│   ├── index.ts               # Lazy decay exports
│   ├── types.ts               # Lazy decay type definitions
│   ├── LazyDecayCalculator.ts       # On-demand decay calculation
│   └── LazyDecayBatchProcessor.ts   # Efficient update batching
│
├── procedural/                # Procedural Memory System
│   ├── index.ts               # Procedural exports
│   ├── types.ts               # Procedural type definitions
│   └── ProceduralMemoryManager.ts   # Procedural memory management
│
├── config/                    # Configuration Presets
│   ├── recall-presets.ts      # Preset configurations
│   └── intelligence-layer-config.ts # Intelligence layer settings
│
└── __tests__/                 # Test Suite
    ├── unit/                  # Component tests
    ├── integration/           # Cross-system tests
    └── performance/           # Performance validation
```

## Public API

### Factory Functions

```typescript
import { 
  createMemorySystem, 
  createLocalMemory, 
  createProductionMemory 
} from '@agentdock/core/memory';

// Quick development setup
const memory = await createLocalMemory();

// Production configuration
const memory = await createProductionMemory({
  databaseUrl: process.env.DATABASE_URL,
  recallPreset: 'precision',
  encryption: true
});

// Full configuration
const memory = await createMemorySystem({
  storage: {
    type: 'postgresql',
    connectionString: process.env.DATABASE_URL
  },
  recall: {
    preset: 'research',
    weights: {
      vector: 0.45,
      text: 0.25, 
      temporal: 0.20,
      procedural: 0.10
    }
  },
  extraction: {
    tier: 'balanced',
    budget: 100.0
  }
});
```

### Core Components

```typescript
import { 
  MemoryManager,
  RecallService,
  PRIMEExtractor,
  PRIMEOrchestrator 
} from '@agentdock/core/memory';

// Direct component usage
const memoryManager = new MemoryManager(storage, config);
const recallService = new RecallService(memoryTypes, recallConfig);
const extractor = new PRIMEExtractor(extractionConfig);
```

### Memory Operations

```typescript
// Store memories
await memory.store(userId, "User prefers morning meetings");

// Recall with hybrid search
const memories = await memory.recall(userId, "meeting preferences", {
  limit: 10,
  threshold: 0.7
});

// Process conversations
const result = await memory.processConversation(userId, messages);
```

## PRIME Extraction System

The **Priority Rules Intelligent Memory Extraction (PRIME)** system automatically extracts structured memories from conversations using intelligent model tier selection.

### Tier Selection Logic

```typescript
// Character-based automatic tier routing
const getTier = (messageLength: number) => {
  if (messageLength < 100) return 'fast';        // gpt-4o-mini
  if (messageLength < 500) return 'balanced';    // gpt-4o-mini  
  return 'accurate';                             // gpt-4o
};
```

### Extraction Configuration

```typescript
const extractionConfig = {
  tiers: {
    fast: { 
      model: 'gpt-4o-mini', 
      charThreshold: 100,
      timeout: 5000 
    },
    balanced: { 
      model: 'gpt-4o-mini', 
      charThreshold: 500,
      timeout: 10000 
    },
    accurate: { 
      model: 'gpt-4o', 
      charThreshold: Infinity,
      timeout: 15000 
    }
  },
  extractionRate: 1.0,  // Process all messages in production
  costBudget: 100.0,    // Monthly budget limit
  fallbackToRules: true // Pattern-based fallback
};
```

### Memory Output Structure

```typescript
interface ExtractedMemory {
  working: string[];     // Immediate context
  episodic: string[];    // Experiences and events
  semantic: string[];    // Facts and knowledge
  procedural: string[];  // Learned patterns
}
```

## Memory Recall System

### Recall Presets

The system includes four validated preset configurations:

```typescript
const RECALL_PRESETS = {
  default: {      // General purpose
    vector: 0.30, text: 0.30, temporal: 0.20, procedural: 0.20
  },
  precision: {    // Medical, legal, financial
    vector: 0.25, text: 0.45, temporal: 0.20, procedural: 0.10
  },
  performance: {  // High-volume customer support
    vector: 0.20, text: 0.50, temporal: 0.25, procedural: 0.05
  },
  research: {     // Academic, analysis
    vector: 0.45, text: 0.25, temporal: 0.20, procedural: 0.10
  }
};
```

### Hybrid Search Implementation

**PostgreSQL**: Weighted score fusion
```sql
SELECT *, 
  (0.7 * (1 - (embedding <=> query_embedding)) + 
   0.3 * ts_rank(search_vector, query_text)) as hybrid_score
FROM memories 
ORDER BY hybrid_score DESC;
```

**SQLite**: Reciprocal Rank Fusion (RRF)
```typescript
const rrf = (rank1: number, rank2: number, k = 60) => 
  (1.0 / (k + rank1)) + (1.0 / (k + rank2));
```

## Memory Types Implementation

### Working Memory
```typescript
interface WorkingMemoryConfig {
  ttl: number;           // Default: 3600 seconds (1 hour)
  maxSize: number;       // Default: 100 items
  sessionScoped: boolean; // Default: true
}
```

### Episodic Memory
```typescript
interface EpisodicMemoryConfig {
  decay: {
    rate: number;        // Default: 0.1 per day
    protectionRules: string[];
  };
  temporal: {
    granularity: 'hour' | 'day' | 'week';
    clustering: boolean;
  };
}
```

### Semantic Memory
```typescript
interface SemanticMemoryConfig {
  consolidation: {
    enabled: boolean;
    threshold: number;   // Confidence threshold for consolidation
    interval: number;    // Consolidation check interval
  };
  confidence: {
    initial: number;     // Default: 0.5
    reinforcement: number; // Boost on recall
  };
}
```

### Procedural Memory
```typescript
interface ProceduralMemoryConfig {
  learning: {
    reinforcement: number; // Success reinforcement rate
    decay: number;         // Unused pattern decay
  };
  patterns: {
    maxComplexity: number; // Pattern complexity limit
    minSupport: number;    // Minimum pattern support
  };
}
```

## Memory Connections

### Connection Types
- **Similar**: Semantic similarity via embedding distance
- **Causal**: Cause-effect relationships extracted from text
- **Temporal**: Time-based sequence patterns
- **References**: Explicit mention connections
- **Hierarchical**: Part-of and category relationships

### Progressive Enhancement
```typescript
interface ConnectionConfig {
  embedding: {
    threshold: number;   // Similarity threshold
    maxConnections: number;
  };
  rules: {
    patterns: string[];  // Custom pattern rules
    enabled: boolean;
  };
  llm: {
    enabled: boolean;    // AI-powered analysis
    model: string;       // Model for connection analysis
    budget: number;      // Monthly budget for LLM connections
  };
  temporal: {
    windowSize: number;  // Time window for temporal connections
    enabled: boolean;
  };
}
```

## Storage Adapters

### Development: SQLite + sqlite-vec
```typescript
const storage = new SQLiteAdapter({
  path: './memory.db',
  vectorSearch: true,
  encryption: false
});
```

### Production: PostgreSQL + pgvector
```typescript
const storage = new PostgreSQLAdapter({
  connectionString: process.env.DATABASE_URL,
  vectorDimensions: 1536,
  indexType: 'ivfflat',
  encryption: true
});
```

### Alternative: Vector Databases
```typescript
// Note: ChromaDB and Pinecone adapters exist but are not yet optimized for memory operations
// Use PostgreSQL or SQLite for production deployments
```

## Lazy Memory Decay System

The memory system uses **lazy evaluation** for decay calculation, processing only memories that are actually accessed rather than running scheduled batch jobs.

### Core Components

**LazyDecayCalculator**: Calculates exponential decay on-demand during recall operations
- Custom half-life support (7d working, 30d episodic, 90d semantic, 365d procedural)
- Reinforcement for frequently accessed memories  
- Significance threshold (10%) to avoid unnecessary updates
- neverDecay flag for critical information

**LazyDecayBatchProcessor**: Efficiently batches memory updates
- Collects updates from multiple recall operations
- Writes in optimized batches (100 updates per batch)
- Race condition handling with update merging
- Overflow protection (10K pending update limit)

### Configuration

```typescript
const lazyDecayConfig = {
  defaultHalfLife: 30,           // 30 days default
  reinforcementEnabled: true,    // Strengthen accessed memories
  significanceThreshold: 0.1,    // 10% change required for update
  minUpdateInterval: 60000       // 1 minute minimum between updates
};

const batchProcessorConfig = {
  maxBatchSize: 100,            // 100 updates per batch
  flushIntervalMs: 5000,        // 5 second batching
  maxPendingUpdates: 10000      // 10K update limit
};
```

### Performance Benefits
- **65-100% write avoidance** depending on memory access patterns
- **O(accessed) scaling** - only processes used memories
- **No scheduled jobs** - eliminates batch processing failures
- **Sub-second processing** for typical workloads

## Cost Tracking

### Production Monitoring
```typescript
const costTracker = new CostTracker({
  monthlyBudget: 100.0,
  alerts: {
    thresholds: [50, 75, 90], // Percentage alerts
    webhook: process.env.ALERT_WEBHOOK
  },
  breakdown: {
    extraction: true,
    recall: true,
    connections: true
  }
});
```

### Usage Analytics
```typescript
const usage = await costTracker.getUsageReport({
  period: 'month',
  breakdown: 'by_user'
});

console.log({
  totalCost: usage.total,
  extractionCost: usage.extraction,
  userBreakdown: usage.users
});
```

## Security Considerations

### User Isolation
All memory operations enforce user-level isolation:
```typescript
// Automatic user filtering in all queries
const memories = await memoryManager.recall(userId, query); // Only returns userId memories
```

### Encryption
```typescript
const encryptionService = new EncryptionService({
  key: process.env.ENCRYPTION_KEY,
  algorithm: 'aes-256-gcm',
  fields: ['content', 'metadata'] // Encrypt specific fields
});
```

### Database Security
- User ID constraints on all memory tables
- Prepared statements prevent SQL injection
- Connection pooling with secure credentials
- Optional field-level encryption for sensitive data

## Performance Characteristics

### Recall Performance
- **Sub-100ms** for typical queries (100-10,000 memories per user)
- **Vector search**: Optimized with HNSW/IVFFlat indexing
- **Caching**: Built-in result caching with configurable TTL
- **Batch operations**: Efficient bulk processing for large conversations

### Memory Extraction
- **Tier-based processing**: Automatic cost optimization
- **Graceful degradation**: Pattern-based fallback when AI unavailable
- **Budget controls**: Automatic rate limiting when budget exceeded
- **Async processing**: Non-blocking extraction pipeline

## Validation & Error Handling

The memory system provides comprehensive validation with fail-fast behavior for production reliability.

### Storage Provider Validation

PRIMEOrchestrator automatically validates storage providers support memory operations:

```typescript
// ✅ Valid storage provider
const storage = new PostgreSQLAdapter(config);
const orchestrator = new PRIMEOrchestrator(storage, primeConfig);

// ❌ Invalid storage provider
const basicStorage = new BasicKVStorage(); // No memory interface
const orchestrator = new PRIMEOrchestrator(basicStorage, primeConfig);
// Throws: "Storage provider must support memory operations. 
//          Ensure your storage provider implements the memory interface."
```

### Configuration Validation

PRIMEExtractor validates critical configuration fields at initialization:

```typescript
// ❌ Missing API key
const extractor = new PRIMEExtractor({
  provider: 'openai',
  apiKey: '', // Invalid
  maxTokens: 4000
}, costTracker);
// Throws: ConfigValidationError: "PRIME apiKey is required. 
//          Provide via config.apiKey or PRIME_API_KEY env var"

// ❌ Invalid provider
const extractor = new PRIMEExtractor({
  provider: 'invalid-provider',
  apiKey: 'sk-...'
}, costTracker);
// Throws: ConfigValidationError: "Invalid provider 'invalid-provider'. 
//          Must be one of: openai, anthropic, azure, bedrock"

// ✅ Valid configuration
const extractor = new PRIMEExtractor({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 4000,
  modelTiers: {
    fast: 'gpt-4o-mini',
    balanced: 'gpt-4o-mini', 
    accurate: 'gpt-4o'
  }
}, costTracker);
```

### Environment Variable Support

Configuration supports environment variable overrides for secure deployment:

```typescript
// Environment variables (recommended for production)
PRIME_API_KEY=sk-...
PRIME_PROVIDER=openai
PRIME_DEFAULT_TIER=balanced
PRIME_MAX_TOKENS=4000

// Automatic detection in PRIMEExtractor
const extractor = new PRIMEExtractor({
  // Minimal config - env vars provide the rest
  provider: 'openai', // Can be overridden by PRIME_PROVIDER
  apiKey: 'fallback-key' // PRIME_API_KEY takes precedence
}, costTracker);
```

## Timestamp Handling

The memory system provides precise timestamp handling for temporal accuracy and AI SDK integration.

### Message Timestamp Preservation

Memory extraction preserves original message timestamps from multiple sources:

```typescript
// AI SDK integration with automatic timestamp detection
const messageTime = message.createdAt || message.timestamp || Date.now();

// Stored memories maintain temporal accuracy
const memory = {
  id: 'memory_123',
  content: 'User prefers morning meetings',
  createdAt: messageTime,        // Original message timestamp
  lastAccessedAt: messageTime,   // When first created
  updatedAt: Date.now(),         // When memory was processed
  
  metadata: {
    originalMessageTime: messageTime,    // Backup timestamp reference
    extractionTime: Date.now(),          // When extraction occurred
    originalConversationDate: '2025-01-15T10:30:00Z' // Display context
  }
};
```

### Conversation Context Preservation

PRIMEOrchestrator maintains conversation-level temporal context:

```typescript
// Automatic conversation date extraction for display context
const conversationContext = {
  originalConversationDate: '2025-01-15T10:30:00Z' // From first message
};

// Applied to all memories in the conversation
const memories = await orchestrator.processMessages(userId, agentId, messages);
// Each memory includes originalConversationDate in metadata
```

### Temporal Metadata Structure

```typescript
interface TemporalMetadata {
  originalConversationDate?: string;        // ISO string for conversation context
  originalMessageTime?: number;             // Unix timestamp from source
  extractionTime?: number;                  // When PRIME processed the message
}

// Usage in memory retrieval
const memories = await memoryManager.recall(userId, query);
memories.forEach(memory => {
  console.log('Original message:', new Date(memory.createdAt));
  console.log('Extraction time:', new Date(memory.metadata.extractionTime));
  console.log('Conversation date:', memory.metadata.originalConversationDate);
});
```

## Configuration Examples

### Customer Support Agent
```typescript
const memory = await createMemorySystem({
  recall: { preset: 'performance' },  // Fast exact-match retrieval
  extraction: { tier: 'fast' },       // Cost-optimized extraction
  decay: {
    rules: ['never_decay:contact_info', 'slow_decay:preferences']
  }
});
```

### Research Assistant
```typescript
const memory = await createMemorySystem({
  recall: { preset: 'research' },     // Enhanced semantic connections
  extraction: { tier: 'accurate' },   // High-quality extraction
  connections: {
    llm: { enabled: true },           // AI-powered relationship discovery
    temporal: { enabled: true }       // Time-based patterns
  }
});
```

### Medical Assistant
```typescript
const memory = await createMemorySystem({
  recall: { preset: 'precision' },    // Exact terminology matching
  extraction: { tier: 'accurate' },   // Medical accuracy required
  decay: {
    rules: ['never_decay:allergies', 'never_decay:medications']
  },
  security: {
    encryption: true,                 // HIPAA compliance
    auditLogging: true
  }
});
```

This system is under active development. Key areas for contribution include storage adapter optimization, memory connection algorithms, cost optimization strategies, performance benchmarking, and security enhancements.

Part of the AgentDock project. See main repository for license details. 