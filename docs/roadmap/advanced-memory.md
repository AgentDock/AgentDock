# Advanced Memory Systems for AI Agents

**Status**: 🔄 In Progress  
**Priority**: High  
**Complexity**: High

**Reference**: [Memory System PRD](../prd/agentdock-memory.md) | [Visual Examples](memory-system-visual-examples.md)

## Table of Contents

1. [Why This Matters](#why-this-matters)
2. [Memory Types](#memory-types)
3. [Memory Operations](#memory-operations)
4. [Memory Processing Pipeline](#memory-processing-pipeline)
5. [Memory Decay System](#memory-decay-system)
6. [Memory Evolution and Connections](#memory-evolution-and-connections)
7. [Batch Processing Architecture](#batch-processing-architecture)
8. [Three-Tier Memory Extraction](#three-tier-memory-extraction)
9. [Memory Creation Rate Analysis](#memory-creation-rate-analysis)
10. [Procedural Memory: Learning Tool Patterns](#procedural-memory-learning-tool-patterns)
11. [Database Design](#database-design)
12. [Real-World Examples](#real-world-examples)
13. [Storage Configuration](#storage-configuration)
14. [Performance Optimization](#performance-optimization)
15. [Implementation Checklist](#implementation-checklist)

## Why This Matters

Without memory, AI agents are like talking to someone with amnesia - every conversation starts from zero. AgentDock's Advanced Memory System changes this by giving agents:

- **Persistent Knowledge**: Remember user preferences, facts, and context across sessions
- **Learning from Experience**: Improve responses based on what worked before
- **Personalization at Scale**: Each agent develops unique knowledge about their users
- **Reduced Repetition**: Stop asking the same questions over and over
- **Contextual Intelligence**: Understand the full history, not just the last message

This isn't just about storage - it's about creating AI agents that truly understand and grow with their users.

## Overview

AgentDock's memory system gives AI agents the ability to remember, learn, and improve over time. We implement four types of human-like memory with intelligent decay, evolution, and connection building. The system processes messages in batches of 5-20 for efficiency while maintaining high-quality memory extraction.

## Memory Types

The system implements four core memory types based on human cognitive architecture:

### Working Memory
- **What it is**: Current conversation context (the active context window)
- **Purpose**: Maintains conversation flow and immediate context
- **Example**: "As we discussed earlier in this conversation..."
- **Decay**: Never - it's just the current context

### Episodic Memory  
- **What it is**: Time-stamped experiences and interactions
- **Purpose**: Remembers specific events and conversations
- **Example**: "Last Tuesday you mentioned preferring morning meetings"
- **Decay**: Converts to semantic memory after 30 days by default

### Semantic Memory
- **What it is**: Extracted facts, preferences, and knowledge
- **Purpose**: Long-term storage of important information
- **Example**: "User prefers dark mode and uses VSCode"
- **Decay**: Based on importance and access frequency

### Procedural Memory
- **What it is**: Patterns of successful tool usage
- **Purpose**: Learns optimal ways to accomplish tasks
- **Example**: "For research tasks, search first then use deep_research"
- **Decay**: Slower decay for frequently successful patterns

## Memory Type Terminology Mapping

The memory system uses different terminology in different contexts to be more accessible:

| Technical Term (Core) | User-Friendly Term (UI) | Description |
|----------------------|------------------------|-------------|
| Semantic Memory | Fact | Long-term knowledge and information |
| Episodic Memory | Conversation | Time-stamped interactions and events |
| Semantic Memory (preferences) | Preference | User/agent preferences and settings |
| Working Memory | Context | Current conversation state |
| Procedural Memory | (Not exposed in UI) | Tool usage patterns |

This mapping allows the commercial UI to use simpler terms while the core system maintains technical accuracy.

## Memory Operations

```typescript
// agentdock-core/src/memory/types.ts
export interface MemoryProvider {
  // Core memory operations
  remember(agentId: string, content: string, context?: MemoryContext): Promise<Memory>;
  recall(agentId: string, query: string, options?: RecallOptions): Promise<Memory[]>;
  forget(agentId: string, memoryId: string): Promise<void>;
  export(agentId: string): Promise<MemoryExport>;
  
  // Memory lifecycle management
  consolidate(agentId: string): Promise<ConsolidationResult>;
  decay(agentId: string): Promise<DecayResult>;
  
  // Compact summaries for efficiency
  getCompactSummary(agentId: string): Promise<string>;
  updateCompactSummary(agentId: string): Promise<void>;
}

export interface Memory {
  id: string;
  agentId: string;
  content: string;
  embedding: number[]; // For semantic search
  
  // Memory type
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  
  // Temporal data
  timestamp: Date;
  sessionId?: string;
  
  // Importance and decay
  importance: number;      // 0-1, how important is this memory
  resonance: number;       // Current relevance after decay
  accessCount: number;
  lastAccessed: Date;
  
  // Connections to other memories
  connections: MemoryConnection[];
  
  // Evolution tracking
  evolutionHistory: MemoryEvolution[];
  
  // Metadata
  keywords?: string[];
  tokenCount: number;
  metadata?: Record<string, any>;
}

export interface MemoryConnection {
  targetMemoryId: string;
  connectionType: 'related' | 'contradicts' | 'updates' | 'supports';
  strength: number; // 0-1
  reason: string;
}
```

## Memory Processing Pipeline

```mermaid
graph LR
    subgraph "Memory Processing Engine"
        A[New Message] --> B[Analyze Context]
        B --> C{Is Important?}
        C -->|No| D[Skip]
        C -->|Yes| E[Find Similar]
        E --> F{Match Type}
        F -->|New| G[Add Memory]
        F -->|Similar| H[Merge Facts]
        F -->|Contradicts| I[Replace Old]
        F -->|Duplicate| J[Skip]
    end
```

## Memory Decay System

Memories decay over time unless they're important or frequently accessed. This keeps the system efficient and relevant.

```typescript
// agentdock-core/src/memory/decay/decay-engine.ts
export class MemoryDecayEngine {
  async applyDecay(memories: Memory[], config: DecayConfig): Promise<Memory[]> {
    return memories.map(memory => {
      // Time-based decay - older memories fade
      const daysSinceAccess = (Date.now() - memory.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
      const timeFactor = Math.exp(-config.decayRate * daysSinceAccess);
      
      // Access boost - frequently used memories persist
      const accessFactor = Math.min(1, memory.accessCount / 10);
      
      // Importance preservation - critical info stays
      const importanceFactor = memory.importance;
      
      // Calculate final decay
      memory.resonance = timeFactor * (0.3 + 0.4 * accessFactor + 0.3 * importanceFactor);
      
      return memory;
    });
  }
  
  async cleanupDecayed(agentId: string, config: DecayConfig): Promise<number> {
    // Remove memories that have decayed below threshold
    const memories = await this.storage.getMemories(agentId);
    const toDelete = memories.filter(m => 
      m.resonance < config.minThreshold && 
      m.importance < 0.5 &&
      !config.neverDecay.includes(m.content)
    );
    
    for (const memory of toDelete) {
      await this.storage.delete(memory.id);
    }
    
    return toDelete.length;
  }
}

// Configurable decay for different use cases
export interface DecayConfig {
  decayRate: number;              // How fast memories fade (0.01-0.1)
  minThreshold: number;           // Minimum resonance to keep (0.1-0.3)
  neverDecay: string[];          // Keywords that prevent decay
  
  // Type-specific decay rates
  episodicDecayDays: number;     // When to convert episodic → semantic
  semanticDecayRate: number;     // Slower decay for facts
  proceduralDecayRate: number;   // Even slower for learned patterns
}

// Example: Therapy bot configuration
const therapyDecayConfig: DecayConfig = {
  decayRate: 0.02,               // Very slow decay
  minThreshold: 0.1,             // Keep more memories
  neverDecay: [
    "trauma", "trigger", "medication", "allergy",
    "emergency contact", "crisis", "suicide"
  ],
  episodicDecayDays: 7,          // Quick pattern recognition
  semanticDecayRate: 0.01,       // Keep facts longer
  proceduralDecayRate: 0.005     // Keep coping strategies
};

// Example: Customer support configuration  
const supportDecayConfig: DecayConfig = {
  decayRate: 0.08,               // Faster decay
  minThreshold: 0.2,             // More aggressive cleanup
  neverDecay: [
    "account", "subscription", "payment", "bug"
  ],
  episodicDecayDays: 30,         // Monthly pattern analysis
  semanticDecayRate: 0.05,       // Moderate fact retention
  proceduralDecayRate: 0.02      // Keep solution patterns
};
```

## Memory Evolution and Connections

Memories aren't static - they evolve and connect as new information arrives. This is inspired by the **Zettelkasten method** - a knowledge management system where ideas are interconnected through meaningful links, creating a web of knowledge that grows more valuable over time.

### The Zettelkasten Principle

The Zettelkasten (German for "slip box") method, famously used by sociologist Niklas Luhmann to write over 70 books, treats each piece of information as a node in a network. In our memory system:

- Each memory can link to multiple other memories
- Connections are typed (related, contradicts, updates, supports)
- The value of memories increases with more connections
- New insights emerge from unexpected connections

```typescript
// agentdock-core/src/memory/evolution/evolution-engine.ts
export class MemoryEvolutionEngine {
  async evolveMemory(memory: Memory, relatedMemories: Memory[]): Promise<void> {
    // Find connections to existing memories
    for (const related of relatedMemories) {
      const similarity = this.calculateSimilarity(memory, related);
      
      if (similarity > 0.7) {
        // These memories are related
        memory.connections.push({
          targetMemoryId: related.id,
          connectionType: this.determineConnectionType(memory, related),
          strength: similarity,
          reason: `Similar content (${Math.round(similarity * 100)}% match)`
        });
      }
    }
    
    // Update keywords based on connections
    const allKeywords = new Set(memory.keywords || []);
    for (const related of relatedMemories) {
      if (related.keywords) {
        related.keywords.forEach(k => allKeywords.add(k));
      }
    }
    memory.keywords = Array.from(allKeywords);
    
    // Track evolution
    memory.evolutionHistory.push({
      timestamp: new Date(),
      action: 'connected',
      details: `Linked to ${memory.connections.length} related memories`
    });
  }
  
  private determineConnectionType(memory1: Memory, memory2: Memory): string {
    // Check if memories contradict
    if (this.detectContradiction(memory1.content, memory2.content)) {
      return 'contradicts';
    }
    
    // Check if one updates the other
    if (memory1.timestamp > memory2.timestamp && 
        this.detectUpdate(memory1.content, memory2.content)) {
      return 'updates';
    }
    
    // Check if they support each other
    if (this.detectSupport(memory1.content, memory2.content)) {
      return 'supports';
    }
    
    return 'related';
  }
}
```

## Batch Processing Architecture

The system processes messages in batches for efficiency. Instead of analyzing every message individually, we collect 5-20 messages and process them together.

### Why Batch Processing?

| Approach | Messages Processed | Memories Created | Quality | Cost |
|----------|-------------------|------------------|---------|------|
| Individual | 100 messages | 80 memories | Low (lots of noise) | High |
| Batch (20) | 100 messages | 20 memories | High (contextual) | Low |

### Batch Processing Implementation

```typescript
// agentdock-core/src/memory/batch/batch-processor.ts
export class BatchMemoryProcessor {
  private messageBuffer: Map<string, Message[]> = new Map();
  private batchConfig: BatchConfig;
  
  constructor(config: BatchConfig = {
    maxBatchSize: 20,           // Process after 20 messages
    timeoutMinutes: 30,         // Or after 30 minutes
    minBatchSize: 5            // Need at least 5 messages
  }) {
    this.batchConfig = config;
  }
  
  async addMessage(agentId: string, message: Message): Promise<Memory[]> {
    // Add to buffer
    const buffer = this.messageBuffer.get(agentId) || [];
    buffer.push(message);
    this.messageBuffer.set(agentId, buffer);
    
    // Check if we should process
    if (this.shouldProcessBatch(buffer)) {
      const memories = await this.processBatch(agentId, buffer);
      this.messageBuffer.delete(agentId); // Clear buffer
      return memories;
    }
    
    return [];
  }
  
  private shouldProcessBatch(buffer: Message[]): boolean {
    // Process when batch is full
    if (buffer.length >= this.batchConfig.maxBatchSize) return true;
    
    // Process on timeout
    const lastMessage = buffer[buffer.length - 1];
    const timeSinceLastMessage = Date.now() - lastMessage.timestamp.getTime();
    if (timeSinceLastMessage > this.batchConfig.timeoutMinutes * 60 * 1000) {
      return buffer.length >= this.batchConfig.minBatchSize;
    }
    
    return false;
  }
  
  async processBatch(agentId: string, messages: Message[]): Promise<Memory[]> {
    // Filter out noise
    const meaningful = messages.filter(msg => {
      // Skip very short messages
      if (msg.content.length < 10) return false;
      
      // Skip if entire message is just greeting
      if (/^(hi|hello|thanks|ok|yes|no)\.?$/i.test(msg.content.trim())) {
        return false;
      }
      
      // Keep everything else
      return true;
    });
    
    // Extract memories using three-tier approach
    const memories: Memory[] = [];
    
    // Tier 1: Rules (always runs)
    memories.push(...await this.extractWithRules(meaningful));
    
    // Tier 2: Small AI model (optional)
    if (this.config.enableSmallModel) {
      memories.push(...await this.extractWithSmallModel(meaningful, memories));
    }
    
    // Tier 3: Premium AI model (optional)
    if (this.config.enablePremiumModel) {
      memories.push(...await this.extractWithPremiumModel(meaningful, memories));
    }
    
    return memories;
  }
}
```

## Three-Tier Memory Extraction

### Tier 1: Rule-Based Extraction (Always Active)

Fast, deterministic extraction using patterns. No AI needed.

```typescript
// agentdock-core/src/memory/extractors/rules-extractor.ts
export class RulesMemoryExtractor {
  private rules: ExtractionRule[] = [
    {
      name: 'preferences',
      pattern: /I (prefer|like|want|need|hate|dislike) (.+)/gi,
      type: 'semantic',
      importance: 0.8
    },
    {
      name: 'personal_info',
      pattern: /I am (.+)|My name is (.+)|I work as (.+)/gi,
      type: 'semantic',
      importance: 0.9
    },
    {
      name: 'goals',
      pattern: /My goal is to (.+)|I want to achieve (.+)|I'm trying to (.+)/gi,
      type: 'semantic',
      importance: 0.9
    },
    {
      name: 'problems',
      pattern: /I'm struggling with (.+)|I have trouble with (.+)|(.+) doesn't work/gi,
      type: 'episodic',
      importance: 0.85
    },
    {
      name: 'explicit_memory',
      pattern: /(Remember|Don't forget|Note) that (.+)/gi,
      type: 'semantic',
      importance: 1.0
    }
  ];
  
  async extractFromBatch(messages: Message[]): Promise<Memory[]> {
    const memories: Memory[] = [];
    const batchText = messages.map(m => m.content).join(' ');
    
    for (const rule of this.rules) {
      const matches = batchText.match(rule.pattern);
      if (matches) {
        for (const match of matches) {
          memories.push({
            id: generateId(),
            type: rule.type,
            content: this.cleanMatch(match),
            importance: rule.importance,
            timestamp: new Date(),
            extractionMethod: 'rules'
          });
        }
      }
    }
    
    return this.deduplicateMemories(memories);
  }
}
```

### Tier 2: Small Model Enhancement (Budget Option)

Uses affordable AI models to find patterns rules might miss.

```typescript
// agentdock-core/src/memory/extractors/small-model-extractor.ts
export class SmallModelExtractor {
  // Budget models (June 2025 pricing)
  // - Mistral Small: $0.10/$0.30 per 1M tokens
  // - Gemini Flash: $0.10/$0.40 per 1M tokens  
  // - GPT-4 Mini: $0.10/$0.40 per 1M tokens
  
  async enhance(messages: Message[], existingMemories: Memory[]): Promise<Memory[]> {
    const prompt = `Extract key insights from this conversation that simple rules might miss:

Messages:
${messages.map(m => m.content).join('\n')}

Already found:
${existingMemories.map(m => m.content).join('\n')}

Focus on:
- Emotional patterns
- Implicit preferences
- Context between messages
- Problem-solving approaches

Return 1-3 new insights as JSON.`;

    const response = await this.callSmallModel(prompt);
    return this.parseResponse(response);
  }
}
```

### Tier 3: Premium Model Insights (Advanced Option)

Deep analysis using top-tier models for complex understanding.

```typescript
// agentdock-core/src/memory/extractors/premium-extractor.ts
export class PremiumModelExtractor {
  // Premium models (June 2025 pricing)
  // - GPT-4: $10/$30 per 1M tokens
  // - Claude 3.5: $3/$15 per 1M tokens
  // - Gemini Ultra: $7/$21 per 1M tokens
  
  async extractDeepInsights(messages: Message[], memories: Memory[]): Promise<Memory[]> {
    const prompt = `Analyze this conversation for deep psychological and behavioral insights:

${messages.map(m => m.content).join('\n')}

Provide insights about:
1. Underlying motivations and values
2. Communication patterns
3. Emotional intelligence markers
4. Long-term behavioral patterns
5. Areas of growth or concern

Be specific and actionable.`;

    const response = await this.callPremiumModel(prompt);
    return this.parseAdvancedInsights(response);
  }
}
```

## Memory Creation Rate Analysis

Different configurations create different amounts of memories:

### Configuration Scenarios

| Rate | Memories per 1000 Messages | Tokens per Memory | Use Case |
|------|---------------------------|-------------------|----------|
| 20% (Conservative) | 200 memories | ~25 tokens | Production default |
| 40% (Balanced) | 400 memories | ~100 tokens | Active learning |
| 60% (Comprehensive) | 600 memories | ~160 tokens | Research/therapy |
| 80% (Maximum) | 800 memories | ~200 tokens | Complete capture |

### Memory Creation Examples

```typescript
// 20% Rate - Conservative (Recommended)
const conservativeConfig = {
  batchSize: 20,
  memoryCreationRate: 0.2,
  filters: {
    minMessageLength: 50,
    skipGreetings: true,
    skipConfirmations: true
  },
  expectedOutput: {
    memoriesPerBatch: 4,
    avgTokensPerMemory: 25,
    focusOn: ['facts', 'preferences', 'goals']
  }
};

// 40% Rate - Balanced
const balancedConfig = {
  batchSize: 20,
  memoryCreationRate: 0.4,
  filters: {
    minMessageLength: 30,
    includeEmotions: true
  },
  expectedOutput: {
    memoriesPerBatch: 8,
    avgTokensPerMemory: 100,
    focusOn: ['facts', 'emotions', 'patterns', 'context']
  }
};

// 60% Rate - Comprehensive  
const comprehensiveConfig = {
  batchSize: 20,
  memoryCreationRate: 0.6,
  filters: {
    minMessageLength: 20,
    captureEverything: true
  },
  expectedOutput: {
    memoriesPerBatch: 12,
    avgTokensPerMemory: 160,
    focusOn: ['everything', 'relationships', 'nuance']
  }
};

// 80% Rate - Maximum
const maximumConfig = {
  batchSize: 20,
  memoryCreationRate: 0.8,
  filters: {
    minMessageLength: 10,
    noFiltering: true
  },
  expectedOutput: {
    memoriesPerBatch: 16,
    avgTokensPerMemory: 200,
    focusOn: ['complete_record', 'verbatim', 'forensic']
  }
};
```

## Procedural Memory: Learning Tool Patterns

The system learns from successful tool usage to optimize future actions.

```typescript
// agentdock-core/src/memory/procedural/procedural-manager.ts
export interface ProceduralMemory extends Memory {
  type: 'procedural';
  pattern: ToolPattern;
  successRate: number;
  useCount: number;
}

export interface ToolPattern {
  name: string;
  sequence: ToolCall[];
  context: string;
  avgExecutionTime: number;
}

export class ProceduralMemoryManager {
  async learnFromExecution(
    agentId: string,
    toolCalls: ToolCall[],
    outcome: 'success' | 'failure'
  ): Promise<void> {
    if (outcome === 'success' && toolCalls.length >= 2) {
      // This sequence worked - remember it
      const pattern: ToolPattern = {
        name: this.generatePatternName(toolCalls),
        sequence: toolCalls,
        context: this.extractContext(toolCalls),
        avgExecutionTime: this.calculateAvgTime(toolCalls)
      };
      
      // Check if we've seen this pattern before
      const existing = await this.findSimilarPattern(agentId, pattern);
      
      if (existing) {
        // Update success rate
        existing.successRate = 
          (existing.successRate * existing.useCount + 1) / 
          (existing.useCount + 1);
        existing.useCount++;
        await this.storage.update(existing);
      } else {
        // New successful pattern
        await this.storage.save({
          type: 'procedural',
          agentId,
          pattern,
          successRate: 1.0,
          useCount: 1,
          importance: 0.8
        });
      }
    }
  }
  
  async suggestTools(agentId: string, task: string): Promise<ToolCall[]> {
    // Find patterns that worked for similar tasks
    const patterns = await this.storage.searchProcedural(agentId, task);
    
    // Return the most successful pattern
    const best = patterns
      .filter(p => p.successRate > 0.7)
      .sort((a, b) => b.successRate - a.successRate)[0];
      
    return best?.pattern.sequence || [];
  }
}

// Example: Learning that search → deep_research works
const learnedPattern: ProceduralMemory = {
  type: 'procedural',
  pattern: {
    name: 'research_workflow',
    sequence: [
      { tool: 'search', params: { query: '...' }, duration: 200 },
      { tool: 'deep_research', params: { topic: '...' }, duration: 3000 }
    ],
    context: 'User asking for detailed information',
    avgExecutionTime: 3200
  },
  successRate: 0.85,
  useCount: 20,
  importance: 0.9
};
```

## Database Design

The memory system supports both SQLite (with sqlite-vec) for local development and PostgreSQL (with pgvector) for production. Here's how they map:

### SQLite Schema (Local Development)

SQLite with sqlite-vec extension provides vector search capabilities for local development:

```sql
-- Enable sqlite-vec extension (must be loaded at runtime)
-- See: https://github.com/asg017/sqlite-vec

-- Main memories table
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB, -- sqlite-vec stores vectors as BLOB
    
    -- Memory type
    type TEXT NOT NULL CHECK (type IN ('working', 'episodic', 'semantic', 'procedural')),
    
    -- Importance and decay
    importance REAL NOT NULL CHECK (importance >= 0 AND importance <= 1),
    resonance REAL NOT NULL DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT, -- ISO 8601 datetime string
    
    -- Temporal data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    session_id TEXT,
    
    -- Metadata (stored as JSON string)
    keywords TEXT, -- JSON array
    token_count INTEGER,
    extraction_method TEXT,
    
    -- Batch processing
    batch_id TEXT,
    source_message_ids TEXT, -- JSON array
    
    -- JSON for flexibility
    metadata TEXT DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_memories_agent_id ON memories(agent_id);
CREATE INDEX idx_memories_type ON memories(type, agent_id);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_created_at ON memories(created_at DESC);

-- Virtual table for vector search (sqlite-vec)
CREATE VIRTUAL TABLE memories_vec USING vec0(
    memory_id TEXT PRIMARY KEY,
    embedding FLOAT[1536]
);

-- Memory connections table
CREATE TABLE memory_connections (
    id TEXT PRIMARY KEY,
    source_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL,
    strength REAL NOT NULL CHECK (strength >= 0 AND strength <= 1),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    UNIQUE(source_memory_id, target_memory_id)
);

CREATE INDEX idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX idx_connections_target ON memory_connections(target_memory_id);
```

### PostgreSQL Schema (Production)

PostgreSQL with pgvector provides advanced vector operations and better performance:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search optimization

-- Main memories table
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- pgvector native type
    
    -- Memory type
    type VARCHAR(50) NOT NULL CHECK (type IN ('working', 'episodic', 'semantic', 'procedural')),
    
    -- Importance and decay
    importance DECIMAL(3,2) NOT NULL CHECK (importance >= 0 AND importance <= 1),
    resonance DECIMAL(3,2) NOT NULL DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    
    -- Temporal data
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_id VARCHAR(255),
    
    -- Metadata
    keywords TEXT[], -- PostgreSQL native array
    token_count INTEGER,
    extraction_method VARCHAR(50),
    
    -- Batch processing
    batch_id UUID,
    source_message_ids TEXT[],
    
    -- JSON for flexibility
    metadata JSONB DEFAULT '{}' -- JSONB for better performance
);

-- PostgreSQL-specific optimized indexes
CREATE INDEX CONCURRENTLY idx_memories_agent_id ON memories(agent_id);
CREATE INDEX CONCURRENTLY idx_memories_type ON memories(type, agent_id);
CREATE INDEX CONCURRENTLY idx_memories_importance ON memories(importance DESC);
CREATE INDEX CONCURRENTLY idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX CONCURRENTLY idx_memories_resonance ON memories(resonance DESC);

-- Vector similarity search optimization (PostgreSQL specific)
CREATE INDEX CONCURRENTLY idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);

-- Text search optimization (PostgreSQL specific)
CREATE INDEX CONCURRENTLY idx_memories_content_gin ON memories 
USING gin (content gin_trgm_ops);

-- Keyword search optimization (PostgreSQL specific)
CREATE INDEX CONCURRENTLY idx_memories_keywords ON memories 
USING gin (keywords);

-- Memory connections table
CREATE TABLE memory_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL,
    strength DECIMAL(3,2) NOT NULL CHECK (strength >= 0 AND strength <= 1),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(source_memory_id, target_memory_id)
);

CREATE INDEX CONCURRENTLY idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX CONCURRENTLY idx_connections_target ON memory_connections(target_memory_id);
CREATE INDEX CONCURRENTLY idx_connections_type ON memory_connections(connection_type);
```

### Key Differences

| Feature | SQLite | PostgreSQL |
|---------|---------|------------|
| Vector Storage | BLOB with sqlite-vec | Native vector type |
| Vector Search | Virtual table | Native indexes with ivfflat |
| Arrays | JSON strings | Native arrays |
| UUIDs | Text | Native UUID type |
| Timestamps | ISO 8601 strings | Native timestamp with timezone |
| JSON | TEXT | JSONB with indexing |
| Concurrent Index Creation | Not supported | Supported with CONCURRENTLY |
| Text Search | Basic LIKE | Advanced with pg_trgm |

### Optimized Queries

```typescript
// agentdock-core/src/memory/storage/queries.ts
export class MemoryQueries {
  // Batch insert for efficiency
  async insertBatch(memories: Memory[]): Promise<void> {
    const query = `
      INSERT INTO memories (
        agent_id, content, embedding, type, importance,
        keywords, token_count, extraction_method, batch_id
      ) VALUES ${memories.map((_, i) => 
        `($${i*9+1}, $${i*9+2}, $${i*9+3}, $${i*9+4}, $${i*9+5}, $${i*9+6}, $${i*9+7}, $${i*9+8}, $${i*9+9})`
      ).join(', ')}
    `;
    
    const values = memories.flatMap(m => [
      m.agentId, m.content, m.embedding, m.type, m.importance,
      m.keywords, m.tokenCount, m.extractionMethod, m.batchId
    ]);
    
    await this.db.query(query, values);
  }
  
  // Semantic search with filters
  async semanticSearch(
    agentId: string,
    embedding: number[],
    options: SearchOptions = {}
  ): Promise<Memory[]> {
    const query = `
      SELECT *, 
        (embedding <=> $2::vector) as distance,
        (importance * 0.4 + resonance * 0.3 + (1 - (embedding <=> $2::vector)) * 0.3) as score
      FROM memories
      WHERE agent_id = $1
        AND ($3::varchar[] IS NULL OR type = ANY($3))
        AND ($4::decimal IS NULL OR importance >= $4)
        AND (embedding <=> $2::vector) < $5
      ORDER BY score DESC
      LIMIT $6
    `;
    
    const result = await this.db.query(query, [
      agentId,
      JSON.stringify(embedding),
      options.types || null,
      options.minImportance || null,
      options.maxDistance || 0.8,
      options.limit || 10
    ]);
    
    return result.rows;
  }
  
  // Efficient decay processing
  async processDecay(agentId: string, config: DecayConfig): Promise<void> {
    const query = `
      WITH updated AS (
        UPDATE memories 
        SET resonance = GREATEST(
          resonance * $2, -- decay rate
          $3 -- minimum threshold
        )
        WHERE agent_id = $1
          AND created_at < NOW() - INTERVAL '1 day'
          AND type != 'working'
        RETURNING id
      ),
      deleted AS (
        DELETE FROM memories 
        WHERE agent_id = $1 
          AND resonance < $3 
          AND importance < 0.5
          AND NOT (keywords && $4::text[])
        RETURNING id
      )
      SELECT 
        (SELECT COUNT(*) FROM updated) as updated_count,
        (SELECT COUNT(*) FROM deleted) as deleted_count
    `;
    
    await this.db.query(query, [
      agentId,
      1 - config.decayRate,
      config.minThreshold,
      config.neverDecay
    ]);
  }
}
```

## Real-World Examples

### Therapy Session Memory

```typescript
// Configuration for mental health support
const therapyConfig = {
  memory: {
    batchSize: 10,              // Smaller batches for nuance
    extractionRate: 0.6,        // Capture more details
    enableSmallModel: true,     // Use AI for emotion detection
    enablePremiumModel: false   // Budget conscious
  },
  decay: {
    episodicToSemanticDays: 7,  // Quick pattern recognition
    decayRate: 0.02,            // Very slow decay
    minThreshold: 0.1,          // Keep more memories
    neverDecay: [
      "trauma", "trigger", "medication", "allergy",
      "emergency", "crisis", "suicide", "self-harm"
    ]
  },
  procedural: {
    trackCopingStrategies: true,
    learnFromProgress: true
  }
};

// Example therapy session
await memory.remember('therapist-ai', `
  Patient mentioned feeling overwhelmed at work. This is the 
  third session where work stress comes up. They respond well 
  to breathing exercises but struggle with boundary setting.
`);

// System extracts:
// - Semantic: "Patient experiences work-related stress"
// - Episodic: "Third mention of work stress in sessions"
// - Procedural: "Breathing exercises effective for this patient"
// - Connection: Links to previous work stress discussions
```

### Customer Support Memory

```typescript
// Configuration for support agents
const supportConfig = {
  memory: {
    batchSize: 20,              // Standard batch size
    extractionRate: 0.4,        // Balanced extraction
    enableSmallModel: true,     // Quick pattern detection
    enablePremiumModel: false
  },
  decay: {
    episodicToSemanticDays: 30, // Monthly consolidation
    decayRate: 0.08,            // Faster decay
    minThreshold: 0.2,          // More aggressive cleanup
    neverDecay: [
      "account", "subscription", "payment", "refund",
      "bug", "feature request", "escalation"
    ]
  },
  procedural: {
    trackSolutionPatterns: true,
    learnFromResolutions: true
  }
};

// Example support interaction
await memory.remember('support-bot', `
  Customer John (Premium subscriber) reporting sync issues 
  between mobile and desktop. This is his second sync ticket 
  this month. Previous issue was resolved by clearing cache.
`);

// System extracts:
// - Semantic: "John is Premium subscriber with sync issues"
// - Episodic: "Second sync ticket this month"
// - Procedural: "Cache clearing resolved previous sync issue"
// - Connection: Links to previous support ticket
```

### Educational Tutor Memory

```typescript
// Configuration for tutoring
const tutorConfig = {
  memory: {
    batchSize: 15,              // Medium batches
    extractionRate: 0.5,        // Capture learning patterns
    enableSmallModel: true,     // Understand confusion points
    enablePremiumModel: false
  },
  decay: {
    episodicToSemanticDays: 14, // Two-week consolidation
    decayRate: 0.04,            // Slow decay for continuity
    minThreshold: 0.15,
    neverDecay: [
      "learning disability", "accommodation", "IEP",
      "struggles with", "excels at", "preferred style"
    ]
  },
  procedural: {
    trackTeachingMethods: true,
    adaptToLearningStyle: true
  }
};

// Example tutoring session
await memory.remember('math-tutor', `
  Student Jamie struggles with fractions when denominators 
  differ but understands with visual aids like pie charts. 
  Responds well to real-world examples like recipes.
`);

// System extracts:
// - Semantic: "Jamie learns fractions better with visual aids"
// - Episodic: "Struggled with different denominators today"
// - Procedural: "Use pie charts and recipes for fractions"
// - Connection: Updates previous math struggle memories
```

## Storage Configuration

### Development Setup (SQLite)

```bash
# .env.local
ENABLE_SQLITE=true
ENABLE_SQLITE_VEC=true
KV_STORE_PROVIDER=sqlite

# Automatic - no configuration needed
# Creates ./agentdock.db with vector support
```

### Production Setup (PostgreSQL)

```bash
# .env.local
DATABASE_URL=postgresql://user:pass@host:5432/agentdock
ENABLE_PGVECTOR=true
KV_STORE_PROVIDER=postgresql

# Run migrations
pnpm db:migrate
```

### Supabase Setup

```sql
-- Enable in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Then use connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

## Performance Optimization

### Batch Processing Benefits

```typescript
// Individual processing (inefficient)
const individual = {
  messagesProcessed: 100,
  llmCalls: 100,           // One per message
  memoriesCreated: 80,     // 80% noise
  totalTokens: 5000,       // High overhead
  totalCost: $0.50
};

// Batch processing (efficient)
const batched = {
  messagesProcessed: 100,
  llmCalls: 5,            // 20 messages per batch
  memoriesCreated: 20,     // High quality only
  totalTokens: 1000,       // 80% reduction
  totalCost: $0.10        // 80% cost reduction
};
```

### Memory Access Patterns

```typescript
// Optimize for common queries
export class MemoryAccessOptimizer {
  // Cache frequently accessed memories
  private cache = new LRUCache<string, Memory[]>({ max: 1000 });
  
  async getRecentMemories(agentId: string): Promise<Memory[]> {
    const cacheKey = `recent:${agentId}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const memories = await this.db.query(`
      SELECT * FROM memories
      WHERE agent_id = $1
        AND last_accessed > NOW() - INTERVAL '7 days'
      ORDER BY last_accessed DESC
      LIMIT 20
    `, [agentId]);
    
    this.cache.set(cacheKey, memories);
    return memories;
  }
  
  // Precompute embeddings for common queries
  async precomputeEmbeddings(commonQueries: string[]): Promise<void> {
    for (const query of commonQueries) {
      const embedding = await this.embedder.embed(query);
      await this.cache.set(`embed:${query}`, embedding);
    }
  }
}
```

## Implementation Checklist

### Phase 1: Core Memory System
- [ ] Memory types (working, episodic, semantic, procedural)
- [ ] Basic CRUD operations
- [ ] Rule-based extraction
- [ ] PostgreSQL schema
- [ ] Simple decay system

### Phase 2: Batch Processing
- [ ] Message buffering
- [ ] Batch triggers (size/timeout)
- [ ] Noise filtering
- [ ] Batch storage optimization

### Phase 3: Advanced Features
- [ ] Memory connections
- [ ] Evolution tracking
- [ ] Small model integration
- [ ] Semantic search
- [ ] Configurable decay

### Phase 4: Production Ready
- [ ] Performance optimization
- [ ] Monitoring and metrics
- [ ] Export/import functionality
- [ ] Privacy controls
- [ ] Documentation

## Summary

AgentDock's memory system enables AI agents to truly remember and learn. By implementing human-like memory types with intelligent processing, decay, and evolution, agents become more helpful over time. The batch processing approach provides 5x efficiency gains while improving memory quality through contextual understanding.

### Core Features (Open Source)
- **Four memory types**: Working, episodic, semantic, procedural
- **Memory connections**: Zettelkasten-inspired linking system
- **Batch processing**: 5-20 message batches for efficiency
- **Three-tier extraction**: Rules, small model, premium model
- **Decay and evolution**: Intelligent memory management
- **Dual database support**: SQLite-vec for local, PostgreSQL+pgvector for production

### Commercial Extensions
You can build commercial products with these AgentDock memory system extensions:
- **Agent types**: Personal vs Client-Serving agents with different memory behaviors
- **Multi-tenancy**: Organization-level memory isolation
- **Professional features**: Client data isolation, professional-only notes
- **Credit tracking**: Usage-based billing for memory operations

Key benefits:
- **Persistent knowledge** across conversations
- **Learned patterns** from successful interactions  
- **Efficient processing** through batching
- **Flexible configuration** for different use cases
- **Production ready** with both SQLite and PostgreSQL support