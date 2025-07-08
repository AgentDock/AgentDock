# AgentDock Memory Architecture Overview

> See also: [Memory System README](./README.md) | [Memory Connections](./memory-connections.md) | [Graph Architecture](./graph-architecture.md)

## Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Conversation  │    │     PRIME       │    │ Memory System   │
│    Messages     │───▶│   Extraction    │───▶│ Storage & Search│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## PRIME: Intelligent Memory Extraction

**Purpose**: Transform conversations into structured memories

```
Raw Message: "I met Sarah at the coffee shop, she mentioned the project deadline is Friday"

                              ▼ PRIME Extraction

Extracted Memories:
├─ Person: "Sarah" (Semantic)
├─ Location: "coffee shop" (Episodic)  
└─ Deadline: "project due Friday" (Procedural)
```

**Key Features**:
- Smart model selection (standard/advanced 2-tier)
- Rule-based extraction guidance
- Cost optimization with budget tracking
- Real-time message processing

## Memory System: Vector-First Storage & Retrieval

**Purpose**: Store, index, and retrieve memories efficiently

```
Query: "What did Sarah say about deadlines?"

                              ▼ Vector + Text Search

Memory Storage:
┌─────────────┬─────────────┬─────────────┐
│  Embeddings │    FTS5     │   Metadata  │
│   [0.1,0.2] │  "deadline" │   semantic  │
│   [0.3,0.4] │   "friday"  │   episodic  │
└─────────────┴─────────────┴─────────────┘

                              ▼ Hybrid Scoring (70% vector + 30% text)

Results: [Sarah deadline memory, related project memories...]
```

**Key Features**:
- Hybrid vector + text search
- Specialized memory adapters for PostgreSQL and SQLite
- Community-extensible adapters available for ChromaDB, Pinecone, and Qdrant
- Memory type specialization
- Performance: <50ms recall

## Architecture Flow

```mermaid
graph TD
    A[User Message] --> B[PRIME Extraction]
    B --> C[Memory Storage]
    C --> D[Vector Indexing]
    C --> E[Text Indexing]
    
    F[User Query] --> G[Embedding Generation]
    G --> H[Vector Search]
    F --> I[Text Search]
    H --> J[Hybrid Fusion]
    I --> J
    J --> K[Ranked Results]
    
    style B fill:#e1f5fe
    style G fill:#f3e5f5
    style J fill:#e8f5e8
```

## Advanced Features

### PRIME Extraction
- **Rule-based guidance**: Natural language extraction rules
- **Tier optimization**: Auto-select model based on complexity
- **Cost intelligence**: Budget tracking with <$20/month for 100k operations

### Memory Retrieval  
- **Vector-first**: Semantic similarity using text-embedding-3-small
- **Hybrid search**: Combines vector (70%) + text (30%) scoring
- **Multi-adapter**: PostgreSQL ts_rank_cd + SQLite FTS5 BM25
- **Performance**: <50ms recall, >95% accuracy

## Competitive Advantages

| Feature | AgentDock | Competitors |
|---------|-----------|-------------|
| Extraction Intelligence | PRIME with rules | Basic LLM |
| Storage Architecture | Hybrid vector+relational | Vector-only |
| Adapter Support | 5 adapters | 1-2 adapters |
| Managed Service Compatibility | ✅ No extensions | ❌ Requires extensions |
| Cost Optimization | Built-in tracking | External |

## Memory Connections: Graph-like Knowledge

**Purpose**: Automatically discover and maintain relationships between memories

**Key Features**:
- Progressive enhancement: embedding → user rules → LLM analysis
- Hybrid SQL + in-memory graph approach (no dedicated graph database needed)
- Temporal pattern recognition for time-based connections
- Research-based connection types (similar, causal, hierarchical)

See [Memory Connections](./memory-connections.md) for detailed explanation and [Graph Architecture](./graph-architecture.md) for technical implementation.

## Memory Lifecycle & Decay

AgentDock implements a **lazy memory decay** system to simulate human-like forgetting, ensuring that agent memory remains relevant without manual cleanup. This system is efficient, operating on-demand when memories are accessed, which avoids costly batch processing jobs.

**Key Principles:**
- **On-demand calculation**: Decay computed when memories are accessed, not on schedule
- **Access reinforcement**: Frequently used memories stay strong
- **Rule-based protection**: Critical memories can be protected from decay
- **Custom half-lives**: Different decay rates for different memory types

For complete configuration examples and detailed setup instructions, see [Complete Configuration Guide](./complete-configuration-guide.md).

## Summary

**PRIME**: Intelligent extraction from conversations  
**Memory System**: Fast, accurate memory retrieval  
**Memory Connections**: Relationship discovery and knowledge graphs  
**Together**: Complete memory pipeline from raw text to connected knowledge, enabling **Conversational RAG** through agent runtime memory injection

For RAG implementation details, see [Conversational RAG Guide](./retrieval-augmented-generation.md).

AgentDock provides clean architectural separation with no content duplication across memory types while maintaining production-ready performance.