# Phase 1: Core Foundation Implementation

**Goal**: Build basic memory system with rule-based extraction extending existing AgentDock infrastructure.

**Cross-Reference**: [Advanced Memory](../../roadmap/advanced-memory.md) sections 2-4, 6, 11

## Overview

This phase implements the four memory types with rule-based extraction (no AI costs) and basic decay. Everything extends existing AgentDock storage abstraction and message persistence.

## Database Schema

### SQLite Schema (Development)

```sql
-- agentdock-core/src/memory/schemas/sqlite-schema.sql

-- Enable sqlite-vec extension
-- CREATE VIRTUAL TABLE temp.vec_examples USING vec0(embedding float[768]);

-- Core memories table
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    user_id TEXT,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('working', 'episodic', 'semantic', 'procedural')),
    
    -- Importance and decay
    importance REAL NOT NULL DEFAULT 0.5,
    resonance REAL NOT NULL DEFAULT 1.0,
    access_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    
    -- Context
    session_id TEXT,
    keywords TEXT, -- JSON array
    metadata TEXT, -- JSON object
    
    -- Extraction
    extraction_method TEXT NOT NULL DEFAULT 'rules',
    token_count INTEGER DEFAULT 0,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes for performance (matching Advanced Memory section 11)
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_keywords ON memories(keywords);

-- Full-text search for content
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content,
    content_rowid UNINDEXED
);

-- Vector table for embeddings (when sqlite-vec is available)
CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec USING vec0(
    embedding float[768]
);

-- Memory connections (Zettelkasten-style)
CREATE TABLE IF NOT EXISTS memory_connections (
    id TEXT PRIMARY KEY,
    source_memory_id TEXT NOT NULL,
    target_memory_id TEXT NOT NULL,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('related', 'contradicts', 'updates', 'supports')),
    strength REAL NOT NULL DEFAULT 0.5,
    reason TEXT,
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY (target_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    UNIQUE(source_memory_id, target_memory_id)
);

-- Indexes for memory connections
CREATE INDEX IF NOT EXISTS idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON memory_connections(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON memory_connections(connection_type);

-- Procedural memory patterns
CREATE TABLE IF NOT EXISTS procedural_patterns (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    pattern_name TEXT NOT NULL,
    tool_sequence TEXT NOT NULL, -- JSON array of tool calls
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    avg_execution_time REAL,
    context_pattern TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
```

### PostgreSQL Schema (Production)

```sql
-- agentdock-core/src/memory/schemas/postgres-schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Core memories table
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID,
    content TEXT NOT NULL,
    embedding vector(768), -- pgvector for semantic search
    type memory_type NOT NULL,
    
    -- Importance and decay
    importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    resonance REAL NOT NULL DEFAULT 1.0 CHECK (resonance >= 0 AND resonance <= 1),
    access_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Context
    session_id UUID,
    keywords TEXT[], -- Array of keywords
    metadata JSONB DEFAULT '{}',
    
    -- Extraction
    extraction_method TEXT NOT NULL DEFAULT 'rules',
    token_count INTEGER DEFAULT 0
);

-- Memory types enum
CREATE TYPE memory_type AS ENUM ('working', 'episodic', 'semantic', 'procedural');

-- Connection types enum
CREATE TYPE connection_type AS ENUM ('related', 'contradicts', 'updates', 'supports');

-- Performance indexes (from Advanced Memory section 14)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_resonance ON memories(resonance DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- GIN indexes for text search and keywords (from Advanced Memory)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_content_gin ON memories USING gin (content gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_keywords ON memories USING gin (keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_metadata ON memories USING gin (metadata);

-- Vector similarity search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Memory connections table
CREATE TABLE IF NOT EXISTS memory_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    connection_type connection_type NOT NULL,
    strength REAL NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(source_memory_id, target_memory_id)
);

-- Indexes for memory connections
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_target ON memory_connections(target_memory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_type ON memory_connections(connection_type);

-- Procedural patterns table
CREATE TABLE IF NOT EXISTS procedural_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    pattern_name TEXT NOT NULL,
    tool_sequence JSONB NOT NULL, -- Array of tool calls
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    avg_execution_time REAL,
    context_pattern TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

## Memory Terminology Mapping

The memory system uses different terminology in different contexts to be more accessible:

| Technical Term (Core) | User-Friendly Term (UI) | Description |
|----------------------|------------------------|-------------|
| Semantic Memory | Fact | Long-term knowledge and information |
| Episodic Memory | Conversation | Time-stamped interactions and events |
| Semantic Memory (preferences) | Preference | User/agent preferences and settings |
| Working Memory | Context | Current conversation state |
| Procedural Memory | (Not exposed in UI) | Tool usage patterns |

This mapping allows the commercial UI to use simpler terms while the core system maintains technical accuracy.

## Compact Summary System

```typescript
// agentdock-core/src/memory/compact/compact-summary.ts

interface CompactSummary {
  agentId: string;
  summary: string;           // Max 500 tokens
  lastUpdated: Date;
  memoryCount: number;
  topKeywords: string[];
  summaryVersion: number;
}

export class CompactSummaryManager {
  private cache = new LRUCache<string, CompactSummary>({ max: 1000 });
  private readonly MAX_SUMMARY_TOKENS = 500;
  
  async getCompactSummary(agentId: string): Promise<string> {
    const cacheKey = `summary:${agentId}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return cached.summary;
    }
    
    // Load from storage
    const stored = await this.storage.get(`summary:${agentId}`) as CompactSummary;
    if (stored) {
      this.cache.set(cacheKey, stored);
      return stored.summary;
    }
    
    // Generate new summary
    await this.updateCompactSummary(agentId);
    return await this.getCompactSummary(agentId);
  }
  
  async updateCompactSummary(agentId: string): Promise<void> {
    const memories = await this.getAllMemories(agentId);
    
    if (memories.length === 0) {
      const emptySummary: CompactSummary = {
        agentId,
        summary: "No memories yet.",
        lastUpdated: new Date(),
        memoryCount: 0,
        topKeywords: [],
        summaryVersion: 1
      };
      await this.saveSummary(emptySummary);
      return;
    }
    
    // Group by importance and recency
    const highImportance = memories.filter(m => m.importance > 0.7);
    const recentMemories = memories
      .filter(m => m.lastAccessedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .slice(0, 20);
    
    // Extract top keywords
    const allKeywords = new Set<string>();
    memories.forEach(m => {
      if (m.keywords) {
        m.keywords.forEach(k => allKeywords.add(k));
      }
    });
    
    const topKeywords = Array.from(allKeywords)
      .sort((a, b) => {
        const aCount = memories.filter(m => m.keywords?.includes(a)).length;
        const bCount = memories.filter(m => m.keywords?.includes(b)).length;
        return bCount - aCount;
      })
      .slice(0, 10);
    
    // Generate summary text
    const summaryParts = [
      `Agent has ${memories.length} memories.`,
      highImportance.length > 0 ? `${highImportance.length} high-importance items.` : null,
      recentMemories.length > 0 ? `${recentMemories.length} recently accessed.` : null,
      topKeywords.length > 0 ? `Key topics: ${topKeywords.slice(0, 5).join(', ')}.` : null
    ].filter(Boolean);
    
    const summary: CompactSummary = {
      agentId,
      summary: summaryParts.join(' ').substring(0, this.MAX_SUMMARY_TOKENS),
      lastUpdated: new Date(),
      memoryCount: memories.length,
      topKeywords,
      summaryVersion: 1
    };
    
    await this.saveSummary(summary);
  }
  
  private async saveSummary(summary: CompactSummary): Promise<void> {
    const cacheKey = `summary:${summary.agentId}`;
    this.cache.set(cacheKey, summary);
    await this.storage.set(`summary:${summary.agentId}`, summary);
  }
  
  private async getAllMemories(agentId: string): Promise<Memory[]> {
    const memoryIds = await this.getMemoryIndex(agentId);
    const memories: Memory[] = [];
    
    for (const memoryId of memoryIds) {
      const memory = await this.storage.get(`memory:${memoryId}`) as Memory;
      if (memory) {
        memories.push(memory);
      }
    }
    
    return memories;
  }
}
```

## Core Memory Types Implementation

### Memory Interface

```typescript
// agentdock-core/src/memory/types.ts

export interface Memory {
  id: string;
  agentId: string;
  userId?: string;
  content: string;
  embedding?: number[];
  
  // Memory type
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  
  // Importance and decay
  importance: number;      // 0-1, how important is this memory
  resonance: number;       // Current relevance after decay
  accessCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  
  // Context
  sessionId?: string;
  keywords?: string[];
  metadata?: Record<string, any>;
  
  // Extraction
  extractionMethod: 'rules' | 'small_model' | 'premium_model';
  tokenCount?: number;
  
  // Connections (Zettelkasten style)
  connections?: MemoryConnection[];
}

export interface MemoryConnection {
  targetMemoryId: string;
  connectionType: 'related' | 'contradicts' | 'updates' | 'supports';
  strength: number; // 0-1
  reason: string;
}

export interface MemoryProvider {
  // Core operations
  remember(agentId: string, content: string, context?: MemoryContext): Promise<Memory>;
  recall(agentId: string, query: string, options?: RecallOptions): Promise<Memory[]>;
  forget(agentId: string, memoryId: string): Promise<void>;
  
  // Lifecycle
  decay(agentId: string): Promise<DecayResult>;
  
  // Compact summaries for efficiency
  getCompactSummary(agentId: string): Promise<string>;
  updateCompactSummary(agentId: string): Promise<void>;
  
  // Export for GDPR compliance
  export(agentId: string): Promise<MemoryExport>;
}
```

### Working Memory Implementation

```typescript
// agentdock-core/src/memory/working-memory.ts

import { useChatStorage } from '../../../src/hooks/use-chat-storage';
import { applyHistoryPolicy } from '../utils/message-history';

/**
 * Working Memory extends existing message persistence
 * No new storage needed - uses current useChatStorage system
 */
export class WorkingMemoryManager {
  /**
   * Get working memory (current session context)
   * Uses existing message storage per agent per user
   */
  async getWorkingMemory(agentId: string, sessionId?: string): Promise<Message[]> {
    // Use existing chat storage hook functionality
    const messages = this.loadStoredMessages(agentId);
    
    // Apply existing history policies
    return applyHistoryPolicy(messages, {
      historyPolicy: 'lastN',
      historyLength: 20,
      preserveSystemMessages: true
    });
  }
  
  /**
   * Update working memory (save messages)
   * Uses existing useChatStorage save functionality
   */
  async updateWorkingMemory(agentId: string, messages: Message[]): Promise<void> {
    // Use existing storage through useChatStorage pattern
    if (typeof window !== 'undefined') {
      const storageKey = `chat-${agentId}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
    
    // TODO: Server-side storage when migration happens
    // await this.serverStorage.set(storageKey, messages);
  }
  
  /**
   * Extract facts from working memory for long-term storage
   */
  async extractFromWorkingMemory(agentId: string): Promise<Memory[]> {
    const messages = await this.getWorkingMemory(agentId);
    const rulesExtractor = new RulesMemoryExtractor();
    
    return rulesExtractor.extractFromMessages(messages, agentId);
  }
  
  private loadStoredMessages(agentId: string): Message[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const storageKey = `chat-${agentId}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load stored messages:', error);
      return [];
    }
  }
}

## Configurable Decay System

```typescript
// agentdock-core/src/memory/decay/decay-engine.ts

export interface DecayConfig {
  decayRate: number;              // How fast memories fade (0.01-0.1)
  minThreshold: number;           // Minimum resonance to keep (0.1-0.3)
  neverDecay: string[];          // Keywords that prevent decay
  
  // Type-specific decay rates
  episodicDecayDays: number;     // When to convert episodic → semantic
  semanticDecayRate: number;     // Slower decay for facts
  proceduralDecayRate: number;   // Even slower for learned patterns
}

export class MemoryDecayEngine {
  async applyDecay(memories: Memory[], config: DecayConfig): Promise<Memory[]> {
    return memories.map(memory => {
      // Time-based decay - older memories fade
      const daysSinceAccess = (Date.now() - memory.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
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
      !config.neverDecay.some(keyword => m.content.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    for (const memory of toDelete) {
      await this.storage.delete(memory.id);
    }
    
    return toDelete.length;
  }
}

// WARNING: Configure never-decay keywords for your specific use case.
// Examples (configure based on your needs):
// - Healthcare: ['allergy', 'medication'] 
// - Finance: ['account_number', 'tax_id']
// You are responsible for appropriate configuration.

const therapyDecayConfig: DecayConfig = {
  decayRate: 0.02,               // Very slow decay
  minThreshold: 0.1,             // Keep more memories
  neverDecay: [],                // EMPTY by default - user configures
  episodicDecayDays: 7,          // Quick pattern recognition
  semanticDecayRate: 0.01,       // Keep facts longer
  proceduralDecayRate: 0.005     // Keep coping strategies
};

const supportDecayConfig: DecayConfig = {
  decayRate: 0.08,               // Faster decay
  minThreshold: 0.2,             // More aggressive cleanup
  neverDecay: [],                // EMPTY by default - user configures
  episodicDecayDays: 30,         // Monthly pattern analysis
  semanticDecayRate: 0.05,       // Moderate fact retention
  proceduralDecayRate: 0.02      // Keep solution patterns
};
```
```

### Long-term Memory Implementation

```typescript
// agentdock-core/src/memory/long-term-memory.ts

import { createStorageProvider } from '../storage/factory';
import { StorageProvider } from '../storage/types';
import { logger, LogCategory } from '../logging';

export class LongTermMemoryManager implements MemoryProvider {
  private storage: StorageProvider;
  private namespace: string;
  
  constructor(agentId: string) {
    // Use existing storage abstraction
    this.storage = createStorageProvider({
      type: process.env.KV_STORE_PROVIDER || 'memory',
      namespace: `memory:${agentId}`,
      config: {
        isPersistent: true // Use global storage for serverless
      }
    });
    this.namespace = `memory:${agentId}`;
  }
  
  async remember(agentId: string, content: string, context?: MemoryContext): Promise<Memory> {
    const memory: Memory = {
      id: this.generateId(),
      agentId,
      userId: context?.userId,
      content,
      type: context?.type || 'semantic',
      importance: context?.importance || 0.5,
      resonance: 1.0,
      accessCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      sessionId: context?.sessionId,
      keywords: context?.keywords,
      metadata: context?.metadata,
      extractionMethod: 'rules'
    };
    
    // Store in existing storage abstraction
    const key = `memory:${memory.id}`;
    await this.storage.set(key, memory);
    
    // Add to agent's memory index
    await this.addToIndex(agentId, memory.id);
    
    logger.debug(LogCategory.STORAGE, 'Memory', 'Created memory', {
      memoryId: memory.id,
      agentId,
      type: memory.type,
      importance: memory.importance
    });
    
    return memory;
  }
  
  async recall(agentId: string, query: string, options: RecallOptions = {}): Promise<Memory[]> {
    const memoryIds = await this.getMemoryIndex(agentId);
    const memories: Memory[] = [];
    
    // Load all memories (TODO: optimize with pagination)
    for (const memoryId of memoryIds) {
      const key = `memory:${memoryId}`;
      const memory = await this.storage.get(key) as Memory;
      if (memory) {
        memories.push(memory);
      }
    }
    
    // Filter by type if specified
    let filtered = memories;
    if (options.types) {
      filtered = memories.filter(m => options.types!.includes(m.type));
    }
    
    // Simple text search (TODO: vector search in Phase 3)
    if (query) {
      const queryLower = query.toLowerCase();
      filtered = filtered.filter(memory => 
        memory.content.toLowerCase().includes(queryLower) ||
        (memory.keywords && memory.keywords.some(k => k.toLowerCase().includes(queryLower)))
      );
    }
    
    // Sort by relevance (resonance * importance)
    filtered.sort((a, b) => (b.resonance * b.importance) - (a.resonance * a.importance));
    
    // Update access count
    for (const memory of filtered.slice(0, options.limit || 10)) {
      memory.accessCount++;
      memory.lastAccessedAt = new Date();
      await this.storage.set(`memory:${memory.id}`, memory);
    }
    
    return filtered.slice(0, options.limit || 10);
  }
  
  async forget(agentId: string, memoryId: string): Promise<void> {
    const key = `memory:${memoryId}`;
    await this.storage.delete(key);
    await this.removeFromIndex(agentId, memoryId);
    
    logger.debug(LogCategory.STORAGE, 'Memory', 'Deleted memory', {
      memoryId,
      agentId
    });
  }
  
  async decay(agentId: string): Promise<DecayResult> {
    const memoryIds = await this.getMemoryIndex(agentId);
    let processed = 0;
    let deleted = 0;
    
    for (const memoryId of memoryIds) {
      const key = `memory:${memoryId}`;
      const memory = await this.storage.get(key) as Memory;
      if (!memory) continue;
      
      // Apply decay (from Advanced Memory section 5)
      const daysSinceAccess = (Date.now() - memory.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
      const timeFactor = Math.exp(-0.05 * daysSinceAccess); // 5% decay per day
      const accessFactor = Math.min(1, memory.accessCount / 10);
      const importanceFactor = memory.importance;
      
      memory.resonance = timeFactor * (0.3 + 0.4 * accessFactor + 0.3 * importanceFactor);
      
      // Delete if resonance too low
      if (memory.resonance < 0.1 && memory.importance < 0.5) {
        await this.forget(agentId, memoryId);
        deleted++;
      } else {
        await this.storage.set(key, memory);
      }
      processed++;
    }
    
    return { processed, deleted };
  }
  
  async export(agentId: string): Promise<MemoryExport> {
    const memoryIds = await this.getMemoryIndex(agentId);
    const memories: Memory[] = [];
    
    for (const memoryId of memoryIds) {
      const key = `memory:${memoryId}`;
      const memory = await this.storage.get(key) as Memory;
      if (memory) {
        memories.push(memory);
      }
    }
    
    return {
      agentId,
      totalMemories: memories.length,
      exportedAt: new Date(),
      memories
    };
  }
  
  private async getMemoryIndex(agentId: string): Promise<string[]> {
    const indexKey = `index:${agentId}`;
    const index = await this.storage.get(indexKey) as string[];
    return index || [];
  }
  
  private async addToIndex(agentId: string, memoryId: string): Promise<void> {
    const index = await this.getMemoryIndex(agentId);
    index.push(memoryId);
    const indexKey = `index:${agentId}`;
    await this.storage.set(indexKey, index);
  }
  
  private async removeFromIndex(agentId: string, memoryId: string): Promise<void> {
    const index = await this.getMemoryIndex(agentId);
    const filtered = index.filter(id => id !== memoryId);
    const indexKey = `index:${agentId}`;
    await this.storage.set(indexKey, filtered);
  }
  
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Rule-Based Memory Extraction

**Note**: Users create their own rules via interface. The examples below are for demonstration only.

```typescript
// agentdock-core/src/memory/extractors/rules-extractor.ts

/**
 * User-defined rule-based extraction with ZERO AI costs
 * Users create rules via interface - no hardcoded patterns
 * Cross-reference: Advanced Memory section 8.1
 */
export class RulesMemoryExtractor {
  
  async extractFromMessages(messages: Message[], agentId: string): Promise<Memory[]> {
    // Load user-defined rules from database
    const userRules = await this.getUserDefinedRules(agentId);
    const memories: Memory[] = [];
    const messageText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');
    
    // Apply user-defined rules
    for (const rule of userRules.filter(r => r.isActive)) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const matches = messageText.match(regex);
        
        if (matches) {
          for (const match of matches) {
            const cleanedContent = this.cleanMatch(match);
            if (cleanedContent.length > 5) {
              memories.push({
                id: this.generateId(),
                agentId,
                content: cleanedContent,
                type: rule.type,
                importance: rule.importance,
                keywords: rule.keywords,
                extractionMethod: 'rules',
                metadata: { ruleId: rule.id, ruleName: rule.name }
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Invalid regex in rule ${rule.name}:`, error);
      }
    }
    
    return this.deduplicateMemories(memories);
  }
  
  private async getUserDefinedRules(agentId: string): Promise<UserDefinedRule[]> {
    // Load from database - users create via interface
    return this.storage.get(`rules:${agentId}`) || [];
  }
}

// Example user-defined rules (created via interface)
interface UserDefinedRule {
  id: string;
  name: string;
  pattern: string;        // User enters regex
  type: 'semantic' | 'episodic' | 'procedural';
  importance: number;
  keywords: string[];
  isActive: boolean;
  createdBy: string;     // user ID
  language?: string;     // en, es, fr, etc.
}

// Example rules a user might create:
const exampleUserRules: UserDefinedRule[] = [
  {
    id: 'user_pref_001',
    name: 'User Preferences',
    pattern: '(prefer|like|want|need) (.+)',
    type: 'semantic',
    importance: 0.8,
    keywords: ['preference'],
    isActive: true,
    createdBy: 'user_123',
    language: 'en'
  },
  {
    id: 'explicit_memory',
    name: 'Explicit Memory Requests',
    pattern: '(remember|don\\'t forget|note|keep in mind) (.+)',
    type: 'semantic',
    importance: 1.0,
    keywords: ['important', 'remember'],
    isActive: true,
    createdBy: 'user_123',
    language: 'en'
  }
];

// Interface for users to create rules
export class UserRuleInterface {
  async createRule(agentId: string, rule: Omit<UserDefinedRule, 'id'>): Promise<UserDefinedRule> {
    const newRule: UserDefinedRule = {
      id: this.generateId(),
      ...rule
    };
    
    // Validate regex pattern
    try {
      new RegExp(rule.pattern);
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error.message}`);
    }
    
    // Save to database
    const existingRules = await this.getUserDefinedRules(agentId);
    existingRules.push(newRule);
    await this.storage.set(`rules:${agentId}`, existingRules);
    
    return newRule;
  }
  
  async updateRule(agentId: string, ruleId: string, updates: Partial<UserDefinedRule>): Promise<void> {
    const rules = await this.getUserDefinedRules(agentId);
    const ruleIndex = rules.findIndex(r => r.id === ruleId);
    
    if (ruleIndex === -1) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    
    rules[ruleIndex] = { ...rules[ruleIndex], ...updates };
    await this.storage.set(`rules:${agentId}`, rules);
  }
  
  async deleteRule(agentId: string, ruleId: string): Promise<void> {
    const rules = await this.getUserDefinedRules(agentId);
    const filtered = rules.filter(r => r.id !== ruleId);
    await this.storage.set(`rules:${agentId}`, filtered);
  }
  }
}
```

## Integration with AgentDock Core

```typescript
// agentdock-core/src/memory/memory-manager.ts

import { WorkingMemoryManager } from './working-memory';
import { LongTermMemoryManager } from './long-term-memory';
import { RulesMemoryExtractor } from './extractors/rules-extractor';

/**
 * Main memory manager coordinating all memory types
 */
export class AgentMemoryManager {
  private workingMemory: WorkingMemoryManager;
  private longTermMemory: LongTermMemoryManager;
  private rulesExtractor: RulesMemoryExtractor;
  
  constructor(private agentId: string) {
    this.workingMemory = new WorkingMemoryManager();
    this.longTermMemory = new LongTermMemoryManager(agentId);
    this.rulesExtractor = new RulesMemoryExtractor();
  }
  
  /**
   * Process new message and extract memories
   */
  async processMessage(message: Message, sessionId?: string): Promise<Memory[]> {
    // Update working memory (existing message storage)
    const workingMessages = await this.workingMemory.getWorkingMemory(this.agentId, sessionId);
    workingMessages.push(message);
    await this.workingMemory.updateWorkingMemory(this.agentId, workingMessages);
    
    // Extract memories from recent messages using rules
    const recentMessages = workingMessages.slice(-5); // Process last 5 messages
    const newMemories = await this.rulesExtractor.extractFromMessages(recentMessages, this.agentId);
    
    // Store new memories in long-term storage
    const storedMemories: Memory[] = [];
    for (const memory of newMemories) {
      memory.sessionId = sessionId;
      const stored = await this.longTermMemory.remember(this.agentId, memory.content, {
        type: memory.type,
        importance: memory.importance,
        keywords: memory.keywords,
        sessionId,
        metadata: memory.metadata
      });
      storedMemories.push(stored);
    }
    
    return storedMemories;
  }
  
  /**
   * Recall relevant memories for context
   */
  async recallMemories(query: string, options: RecallOptions = {}): Promise<Memory[]> {
    return this.longTermMemory.recall(this.agentId, query, options);
  }
  
  /**
   * Get current working memory context
   */
  async getWorkingContext(sessionId?: string): Promise<Message[]> {
    return this.workingMemory.getWorkingMemory(this.agentId, sessionId);
  }
  
  /**
   * Run decay process to clean up old memories
   */
  async runDecay(): Promise<DecayResult> {
    return this.longTermMemory.decay(this.agentId);
  }
  
  /**
   * Export all memories (GDPR compliance)
   */
  async exportMemories(): Promise<MemoryExport> {
    return this.longTermMemory.export(this.agentId);
  }
}
```

## Usage Examples

### Basic Memory Creation

```typescript
// Example: Customer support agent
const memoryManager = new AgentMemoryManager('agent_support_123');

// Process user message
const userMessage = {
  role: 'user',
  content: "Hi, I'm John and I prefer email notifications over SMS. My account number is ACC-12345.",
  timestamp: new Date()
};

const memories = await memoryManager.processMessage(userMessage);
// Creates memories:
// - "prefer email notifications over SMS" (semantic, importance: 0.8)
// - "name is John" (semantic, importance: 0.9)
// - "account number is ACC-12345" (semantic, importance: 0.9)
```

### Memory Recall

```typescript
// Later conversation - recall user preferences
const relevantMemories = await memoryManager.recallMemories('notification preferences', {
  types: ['semantic'],
  limit: 5
});

// Returns: [{ content: "prefer email notifications over SMS", ... }]
```

### Working Memory Context

```typescript
// Get current conversation context
const context = await memoryManager.getWorkingContext(sessionId);
// Returns current session messages (uses existing useChatStorage)
```

## Performance Considerations

**Memory Storage**: Uses existing AgentDock storage abstraction - scales with your chosen provider  
**Rule Extraction**: O(n) pattern matching - very fast, no AI costs  
**Memory Recall**: Simple text search in Phase 1 - adequate for <1000 memories per agent  
**Working Memory**: Leverages existing message storage - no performance impact

## Testing Strategy

```typescript
// agentdock-core/src/memory/__tests__/memory-manager.test.ts

describe('AgentMemoryManager', () => {
  test('should extract preferences from user messages', async () => {
    const manager = new AgentMemoryManager('test_agent');
    
    const message = {
      role: 'user' as const,
      content: "I prefer dark mode and I work as a software engineer",
      timestamp: new Date()
    };
    
    const memories = await manager.processMessage(message);
    
    expect(memories).toHaveLength(2);
    expect(memories[0].content).toContain('prefer dark mode');
    expect(memories[1].content).toContain('work as software engineer');
    expect(memories[0].type).toBe('semantic');
    expect(memories[0].importance).toBe(0.8);
  });
  
  test('should recall relevant memories', async () => {
    const manager = new AgentMemoryManager('test_agent');
    
    // First, create some memories
    await manager.processMessage({
      role: 'user',
      content: "I like pizza and I hate vegetables",
      timestamp: new Date()
    });
    
    // Then recall
    const memories = await manager.recallMemories('food preferences');
    
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].content.toLowerCase()).toMatch(/(pizza|vegetables)/);
  });
});
```

## Implementation Checklist

### Core Components
- [ ] Database schemas (SQLite + PostgreSQL)
- [ ] `Memory` interface and type definitions
- [ ] `WorkingMemoryManager` extending existing message storage
- [ ] `LongTermMemoryManager` using storage abstraction
- [ ] `RulesMemoryExtractor` with pattern matching
- [ ] `AgentMemoryManager` coordination layer

### Database Setup
- [ ] SQLite schema with vector tables
- [ ] PostgreSQL schema with pgvector
- [ ] GIN indexes for text search
- [ ] Vector similarity indexes
- [ ] Migration scripts from current system

### Integration
- [ ] Extend existing `useChatStorage` for working memory
- [ ] Connect to storage abstraction layer
- [ ] Integrate with existing vector adapters
- [ ] Update agent initialization code
- [ ] Add memory operations to agent API

### Testing
- [ ] Unit tests for memory extraction
- [ ] Integration tests with storage providers
- [ ] Performance tests with large memory sets
- [ ] Memory recall accuracy tests

This foundation provides persistent memory across sessions using existing AgentDock infrastructure with zero AI costs for basic pattern recognition. 