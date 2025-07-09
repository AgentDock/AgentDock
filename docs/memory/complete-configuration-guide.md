# Complete AgentDock Configuration Guide

## **THE 3-SECOND SETUP**

```bash
# 1. Set your API key
export OPENAI_API_KEY=sk-xxx

# 2. That's it! 
```

```typescript
// 3. Start using AgentDock
import { createMemorySystem } from 'agentdock-core';

const memory = await createMemorySystem();

// METHOD 1: Manual Direct Storage (bypasses PRIME)
await memory.store('user-123', 'User prefers dark mode');

// METHOD 2: Automatic PRIME Extraction (AI-powered)
const extractedMemories = await memory.addMessage('user-123', {
  id: 'msg-123',
  agentId: 'default',
  content: 'I love dark mode and high contrast themes',
  role: 'user',
  timestamp: Date.now()
});

// Recall memories (works with both methods)
const results = await memory.recall('user-123', 'user preferences');
```

---

## **Quick Start Options**

### Option 1: Zero Configuration (Recommended)
```typescript
// Uses smart defaults - perfect for 95% of use cases
const memory = await createMemorySystem();
```

### Option 2: Choose Your Environment  
```typescript
// Local development (SQLite)
const memory = await createMemorySystem({ 
  environment: 'local' 
});

// Production (PostgreSQL) 
const memory = await createMemorySystem({
  environment: 'production',
  databaseUrl: process.env.DATABASE_URL
});
```

### Option 3: Choose Your Use Case
```typescript
// Medical/Legal (High Precision)
const memory = await createMemorySystem({
  environment: 'production',
  recallPreset: 'precision',
  databaseUrl: process.env.DATABASE_URL
});

// Customer Support (High Performance)
const memory = await createMemorySystem({
  environment: 'production', 
  recallPreset: 'performance',
  databaseUrl: process.env.DATABASE_URL
});

// Research/Analysis (Deep Understanding)
const memory = await createMemorySystem({
  environment: 'production',
  recallPreset: 'research', 
  databaseUrl: process.env.DATABASE_URL
});
```

---

## **Memory Creation Methods**

The memory system provides two distinct methods for creating memories:

### **Method 1: Manual Direct Storage**
Use when you know exactly what memory to create. Bypasses AI extraction.

```typescript
// Direct storage with full control
await memoryManager.store(
  'user-123',           // userId
  'agent-456',          // agentId
  'User is allergic to peanuts',  // content
  MemoryType.SEMANTIC,  // type: semantic, episodic, working, procedural
  { 
    timestamp: Date.now(),      // Optional: custom timestamp
    neverDecay: true,          // Optional: prevent decay
    customHalfLife: 365        // Optional: days before 50% decay
  }
);
```

**Best for:**
- Critical information (medical conditions, legal requirements)
- Pre-processed or validated data
- Migration from other systems
- Testing and debugging

### **Method 2: Automatic PRIME Extraction**
AI analyzes messages to extract multiple relevant memories automatically.

```typescript
// Let AI determine what's important
const memories = await memory.addMessage('user-123', {
  id: 'msg-789',
  agentId: 'agent-456',
  content: 'I work night shifts so I prefer afternoon meetings. Also, I\'m lactose intolerant.',
  role: 'user',
  timestamp: Date.now()
});
// Returns: Array of extracted memories with AI-determined types and importance
```

**Best for:**
- Natural conversations
- Complex messages with multiple facts
- When you want AI to determine importance
- Real-time chat applications

### **Comparison**

| Feature | Manual Storage | PRIME Extraction |
|---------|---------------|------------------|
| AI Processing | None | Full analysis |
| Control | Complete | AI-guided |
| Speed | Fastest | Slower (AI processing) |
| Cost | Storage only | Storage + AI tokens |
| Memory Count | 1 per call | 0-N per message |
| Use Case | Known facts | Conversations |

---

## **Environment Variables That Actually Work**

### **Minimal Setup (Just Works™)**
```bash
# Only one required:
OPENAI_API_KEY=sk-xxx
```

### **Force Quality Models**
```bash
# Always use premium models (costs more, better quality)
OPENAI_API_KEY=sk-xxx
PRIME_DEFAULT_TIER=advanced           # ✅ VERIFIED WORKING
CONNECTION_ALWAYS_ADVANCED=true       # ✅ VERIFIED WORKING
```

### **Force Single Model Everywhere**
```bash
# Use same model for everything (simple & predictable)
OPENAI_API_KEY=sk-xxx
PRIME_MODEL=gpt-4.1                   # ✅ VERIFIED WORKING
CONNECTION_MODEL=gpt-4.1              # ✅ VERIFIED WORKING
```

### **Cost Optimization**
```bash
# Use cheapest models (save money)
OPENAI_API_KEY=sk-xxx
PRIME_MODEL=gpt-4.1-mini             # ✅ VERIFIED WORKING
CONNECTION_MODEL=gpt-4.1-mini        # ✅ VERIFIED WORKING
```

### **Smart Balance (Default)**
```bash
# Auto-optimize cost vs quality (recommended)
OPENAI_API_KEY=sk-xxx
# No other variables needed - system chooses best model per task
```

---

## **Available Presets**

| Environment | Description | Database | Use Case |
|-------------|-------------|----------|----------|
| `local` | **Default** | SQLite | Development, testing |
| `production` | Optimized | PostgreSQL | Live applications |

| Recall Preset | Description | Best For |
|---------------|-------------|----------|
| `default` | **Recommended** | General purpose |
| `precision` | High accuracy | Medical, legal, finance |
| `performance` | Fast response | Customer support |
| `research` | Deep analysis | Academic, content discovery |

---

## **Real-World Examples**

### Example 1: Startup (Simple & Cheap)
```typescript
// Perfect for MVP, prototypes, small teams
const memory = await createMemorySystem();
```
**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
PRIME_MODEL=gpt-4.1-mini    # Saves ~80% on costs
CONNECTION_MODEL=gpt-4.1-mini
```

### Example 2: Medical App (Safety First)
```typescript
// High precision for safety-critical applications
const memory = await createMemorySystem({
  environment: 'production',
  recallPreset: 'precision',
  databaseUrl: process.env.DATABASE_URL
});
```
**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
PRIME_DEFAULT_TIER=advanced      # Always use best models
CONNECTION_ALWAYS_ADVANCED=true  # Safety first
PRIME_PROVIDER=openai            # Industry standard provider
```

### Example 3: Customer Support (High Volume)
```typescript
// Optimized for speed and throughput
const memory = await createMemorySystem({
  environment: 'production', 
  recallPreset: 'performance',
  databaseUrl: process.env.DATABASE_URL
});
```
**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
PRIME_ADVANCED_MIN_CHARS=1000    # Rarely use expensive models
CONNECTION_AUTO_SIMILAR=0.7       # More auto-classification (cheaper)
```

### Example 4: Research Platform (Deep AI)
```typescript
// Maximum intelligence and connection discovery
const memory = await createMemorySystem({
  environment: 'production',
  recallPreset: 'research',
  databaseUrl: process.env.DATABASE_URL
});
```
**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
PRIME_ADVANCED_MIN_CHARS=200     # Use advanced models more often
CONNECTION_PREFER_QUALITY=true   # Bias toward quality
```

### Example 5: Enterprise (Balanced Production)
```typescript
// Production-ready with smart cost optimization
const memory = await createMemorySystem({
  environment: 'production',
  databaseUrl: process.env.DATABASE_URL
});
```
**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
NODE_ENV=production
# Uses smart defaults - auto-optimizes cost vs quality
```

---

## **Advanced Customization**

Only use this if the presets don't meet your needs:

```typescript
const memory = await createMemorySystem({
  environment: 'production',
  databaseUrl: process.env.DATABASE_URL,
  overrides: {
    // Custom PRIME configuration
    prime: {
      primeConfig: {
        provider: 'openai',
        standardModel: 'gpt-4.1-mini',
        advancedModel: 'gpt-4.1',
        autoTierSelection: true,
        tierThresholds: {
          advancedMinChars: 300,  // Custom threshold
          advancedMinRules: 3     // Custom threshold  
        }
      }
    },
    
    // Custom memory configuration
    memory: {
      working: {
        maxTokens: 8000,         // Larger context
        ttlSeconds: 7200         // 2-hour TTL
      }
    },
    
    // Custom recall configuration
    recall: {
      defaultLimit: 20,          // More results
      cacheResults: true,
      cacheTTL: 600,             // 10-minute cache
      defaultConnectionHops: 2   // Graph traversal depth: 1=direct, 2=friends-of-friends, 3=research-depth
    },

    // Intelligence layer configuration
    intelligence: {
      temporal: { enabled: true },           // Enable temporal pattern analysis
      connectionDetection: {
        enabled: true,                       // Enable memory connections
        method: 'embedding-only'             // Cost-optimized connection discovery
      }
    },
    
    // Custom storage configuration for pgvector
    storage: {
      type: 'postgresql-vector',
      config: {
        connectionString: process.env.DATABASE_URL,
        enableVector: true,
        defaultDimension: 1536,    // OpenAI embeddings
        defaultMetric: 'cosine',   // Best for semantic similarity
        
        // Production pgvector tuning
        ivfflat: {
          lists: 100,              // Number of clusters (sqrt(rows) is good start)
          probes: 10               // Clusters to search (10 = 94% recall)
        }
      }
    }
  }
});
```

---

## **Intelligence Layer Configuration**

The intelligence layer adds advanced memory features like temporal patterns and connection discovery:

### **Temporal Pattern Analysis**
```typescript
intelligence: {
  temporal: { enabled: true }  // Analyzes memory access patterns over time
}
```
- **What it does**: Detects daily, weekly, and burst patterns in memory creation
- **Benefits**: Provides relevance boost during peak activity hours
- **Storage**: Patterns stored as `temporalInsights` in memory metadata
- **Performance**: Statistical analysis with optional LLM enhancement

### **Connection Discovery**
```typescript
intelligence: {
  connectionDetection: {
    enabled: true,
    method: 'embedding-only'  // Cost-optimized approach
  }
}
```
- **What it does**: Automatically discovers relationships between memories
- **Methods**: `embedding-only` (fast, cheap) or `enhanced` (includes LLM analysis)
- **Connection types**: similar, related, causes, part_of, opposite
- **Performance**: 65% cost reduction through smart triage

### **Connection Hops Configuration**
```typescript
recall: {
  defaultConnectionHops: 2  // How deep to traverse memory connections
}
```
- **1 hop**: Direct connections only (fastest)
- **2 hops**: Friends-of-friends (balanced)  
- **3 hops**: Research depth (most comprehensive)
- **Presets**: Default/Performance/Precision use 1, Research uses 3

### **Evolution Tracking**
Evolution tracking is automatically enabled when storage supports it:
```typescript
// Events tracked: created, accessed, updated, connected
// Storage: via storage.evolution.trackEvent() interface
// Performance: Batched processing for efficiency
```

---

## **Environment Variables Reference**

### **Core System Variables**
```bash
# Embedding Configuration
EMBEDDING_PROVIDER=openai             # Provider: openai
EMBEDDING_MODEL=text-embedding-3-small # Model for embeddings

# Recall Cache Configuration (Performance Optimization)
RECALL_CACHE_HIGH_WATER=1000          # Cache cleanup trigger (when cache hits this size)
RECALL_CACHE_LOW_WATER=900            # Target cache size after cleanup
# Example: When cache reaches 1000 items, it cleans down to 900 items
```

### **PRIME System (Memory Extraction)**
```bash
# Provider & API Keys
PRIME_PROVIDER=openai                 # LLM provider
PRIME_API_KEY=sk-xxx                  # Dedicated API key
OPENAI_API_KEY=sk-xxx                 # Fallback API key

# 2-Tier Model Control ✅ VERIFIED
PRIME_MODEL=gpt-4.1                   # Override both tiers
PRIME_STANDARD_MODEL=gpt-4.1-mini     # Standard tier only
PRIME_ADVANCED_MODEL=gpt-4.1          # Advanced tier only  
PRIME_DEFAULT_TIER=standard           # Force tier (standard|advanced)

# Smart Thresholds
PRIME_ADVANCED_MIN_CHARS=500          # Use advanced for content >N chars
PRIME_ADVANCED_MIN_RULES=5            # Use advanced for >N active rules
PRIME_MAX_TOKENS=4000                 # Maximum tokens per request

# Cost Control
PRIME_ENABLE_COST_TRACKING=true       # Track costs
PRIME_COST_THRESHOLD=10.00            # Daily limit ($USD)
```

### **CONNECTION System (Memory Connections)**
```bash
# Provider & API Keys (inherits from PRIME by default)
CONNECTION_PROVIDER=openai            # Override provider
CONNECTION_API_KEY=sk-xxx             # Override API key

# 2-Tier Model Control ✅ VERIFIED  
CONNECTION_MODEL=gpt-4.1              # Override both tiers
CONNECTION_STANDARD_MODEL=gpt-4.1-mini # Standard tier only
CONNECTION_ENHANCED_MODEL=gpt-4.1     # Advanced tier only
CONNECTION_ALWAYS_ADVANCED=false      # Force advanced (true|false)
CONNECTION_PREFER_QUALITY=false       # Bias toward quality in production

# Smart Triage (Cost Optimization)
CONNECTION_AUTO_SIMILAR=0.8           # Auto "similar" threshold (40% FREE)
CONNECTION_AUTO_RELATED=0.6           # Auto "related" threshold (25% FREE)  
CONNECTION_LLM_REQUIRED=0.3           # LLM analysis threshold (35% PAID)
```

### **Database Configuration**
```bash
# PostgreSQL (Production)
DATABASE_URL=postgresql://...         # Full connection string
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=agentdock
POSTGRES_USER=postgres
POSTGRES_PASSWORD=xxx

# SQLite (Development)
SQLITE_PATH=./agentdock.db           # Database file path
ENABLE_SQLITE_VEC=true               # Vector support
```

### **Database Configuration**
```bash
# PostgreSQL with pgvector (PRODUCTION-READY)
DATABASE_URL=postgresql://...         # Full connection string
ENABLE_PGVECTOR=true                  # Enable vector search

# pgvector Performance Tuning (PRODUCTION-READY)
PGVECTOR_IVFFLAT_LISTS=100           # Index clusters (default: sqrt(n) rows)
PGVECTOR_IVFFLAT_PROBES=10           # Search probes (accuracy vs speed)

# Production Guidelines:
# - Lists: Start with sqrt(expected_rows). 100 = good for ~10k vectors
# - Probes: 10 = 94% recall, 20 = 97% recall, 50 = 99% recall
# - For 100k+ vectors: lists=316, probes=15-20
# - Rebuild index when doubling vector count

# pgvector Index Creation (run manually in production):
# CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### **System Configuration**
```bash
# Environment
NODE_ENV=production                   # Environment mode
LOG_LEVEL=info                       # Logging level
DEBUG_MEMORY=false                   # Enable memory debug logs
DEBUG_STORAGE=false                  # Enable storage debug logs

# Memory System
MEMORY_MAX_TOKENS=10000              # Max context tokens
MEMORY_TTL=86400                     # Memory TTL (seconds)
MEMORY_ENCRYPTION_KEY=xxx            # Encryption key for PII
```

---

## **Advanced Recall Features**

### **Connection Graph Configuration**
```typescript
// Use memory connections to find related memories
const results = await memory.recall('user-123', 'JavaScript', {
  // Connection Graph Features (Brief Explanation)
  useConnections: true,        // Find connected memories (default: true)
  connectionHops: 2,          // How deep to traverse (1 = direct, 2 = friends of friends)
  connectionTypes: ['similar', 'causes'], // Filter connection types
  boostCentralMemories: true  // Prioritize highly-connected memories
});
```

## **Storage Adapter Priority**

| Adapter | Status | Use Case | Performance |
|---------|--------|----------|-------------|
| **pgvector** | **PRODUCTION-READY** | **Primary choice** - PostgreSQL with vectors | 10k+ QPS with proper indexing |
| **postgresql** | Production-Ready | PostgreSQL without vectors | High performance |
| **sqlite-vec** | Supported | Local development with vectors | Good for <50k vectors |
| **sqlite** | Supported | Local development | Fast for small datasets |
| **memory** | Testing Only | No persistence | In-memory only |
| ChromaDB/Pinecone/Qdrant | Community Extensible | Base classes for extension | Varies |

## **Troubleshooting**

### "No API key found"
```bash
# Fix: Set a provider API key
export OPENAI_API_KEY=sk-xxx
```

### "High API costs"
```bash
# Fix: Use cheaper models
export PRIME_MODEL=gpt-4.1-mini
export CONNECTION_MODEL=gpt-4.1-mini
```

### "Storage connection failed"
```bash
# Fix: Check database URL and credentials
export DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### "Poor memory quality"
```bash
# Fix: Use higher quality models
export PRIME_DEFAULT_TIER=advanced
export CONNECTION_ALWAYS_ADVANCED=true
```

### "pgvector performance issues"
```bash
# Fix: Tune index parameters based on dataset
export PGVECTOR_IVFFLAT_LISTS=200   # Increase for larger datasets
export PGVECTOR_IVFFLAT_PROBES=20   # Increase for better accuracy
```

### "Memory decay configuration"
```bash
# Fix: Configure memory lifecycle for your use case
# See Memory Lifecycle Examples section below
```

---

## **Memory Lifecycle Configuration Examples**

### **Therapy Agent: Never Forget Critical Information**
```typescript
// Critical patient information protected from decay
const memory = await createMemorySystem({
  environment: 'production',
  overrides: {
    lifecycle: {
      decayConfig: {
        defaultDecayRate: 0.02,        // Slow decay (60 day half-life)
        deleteThreshold: 0.05,         // Keep memories longer
        rules: [{
          id: 'critical-info',
          condition: 'importance > 0.8',
          neverDecay: true,             // Protect critical memories
          enabled: true
        }]
      }
    }
  }
});

// Store protected memory
await memory.store('user-123', 'Patient has severe allergy to penicillin', {
  importance: 1.0,
  neverDecay: true  // This memory will never decay
});
```

### **Business Agent: Fresh Data Priority**
```typescript
// Recent market data prioritized, old data expires quickly
const memory = await createMemorySystem({
  environment: 'production',
  overrides: {
    lifecycle: {
      decayConfig: {
        defaultDecayRate: 0.1,         // Fast decay (14 day half-life)
        deleteThreshold: 0.2,          // Remove old data quickly
        rules: [{
          id: 'recent-data',
          condition: 'accessCount > 5',
          decayRate: 0.05,              // Slower decay for accessed data
          enabled: true
        }]
      }
    }
  }
});
```

### **Assistant: Balanced Memory**
```typescript
// Standard balanced configuration
const memory = await createMemorySystem({
  environment: 'production',
  overrides: {
    lifecycle: {
      decayConfig: {
        defaultDecayRate: 0.05,        // 30 day half-life
        deleteThreshold: 0.1,
        rules: [{
          id: 'user-preferences',
          condition: 'type = "semantic" AND importance > 0.7',
          customHalfLife: 90,           // User preferences last 90 days
          enabled: true
        }]
      }
    }
  }
});
```

---

## **Best Practices**

1. **Start Simple**: Use `createMemorySystem()` with no options first
2. **Environment Variables First**: Set API keys in environment, not code
3. **Pick Your Use Case**: Choose the right `recallPreset` for your domain
4. **Monitor Costs**: Start with defaults, then optimize based on usage
5. **Test Locally**: Use `environment: 'local'` for development

---

## **Related Documentation**

- [Architecture Overview](./architecture-overview.md)
- [Memory Connections](./memory-connections.md)

---

**That's it! You now have everything you need to configure AgentDock. Start with the 3-second setup and expand as needed.**