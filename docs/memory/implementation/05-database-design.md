# Database Design for Memory System

**Status**: 🗄️ Implementation Ready  
**Purpose**: Database schemas and storage design for AgentDock Memory System  
**Phase**: 5 - Storage Foundation

**Cross-Reference**: [Advanced Memory](../../roadmap/advanced-memory.md) sections 11-12

## Overview

The memory system uses dual database support for development and production environments:
- **SQLite + sqlite-vec**: Local development with vector search
- **PostgreSQL + pgvector**: Production with advanced indexing

## SQLite Schema (Development)

```sql
-- Enable sqlite-vec extension for vector search
-- Must be loaded at runtime: .load sqlite-vec

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
    batch_id TEXT,
    source_message_ids TEXT -- JSON array
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_resonance ON memories(resonance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- Vector search table (sqlite-vec)
CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec USING vec0(
    memory_id TEXT PRIMARY KEY,
    embedding FLOAT[768]
);

-- Memory connections
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

-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON memory_connections(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_connections_type ON memory_connections(connection_type);
```

## PostgreSQL Schema (Production)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Memory types enum
CREATE TYPE memory_type AS ENUM ('working', 'episodic', 'semantic', 'procedural');
CREATE TYPE connection_type AS ENUM ('related', 'contradicts', 'updates', 'supports');

-- Core memories table
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID,
    content TEXT NOT NULL,
    embedding vector(768), -- pgvector native type
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
    keywords TEXT[], -- Native PostgreSQL array
    metadata JSONB DEFAULT '{}', -- JSONB for better performance
    
    -- Extraction
    extraction_method TEXT NOT NULL DEFAULT 'rules',
    token_count INTEGER DEFAULT 0,
    batch_id UUID,
    source_message_ids TEXT[]
);

-- Optimized indexes for PostgreSQL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_resonance ON memories(resonance DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- Advanced PostgreSQL indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_content_gin ON memories USING gin (content gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_keywords ON memories USING gin (keywords);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_metadata ON memories USING gin (metadata);

-- Vector similarity search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memories_embedding ON memories 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);

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

-- Connection indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_source ON memory_connections(source_memory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_target ON memory_connections(target_memory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connections_type ON memory_connections(connection_type);
```

## AgentDock Storage Integration

```typescript
// agentdock-core/src/memory/storage/memory-storage-adapter.ts

import { StorageAdapter } from '../storage/adapter';

export class MemoryStorageAdapter extends StorageAdapter {
  constructor(
    private memoryConfig: MemoryDatabaseConfig,
    private parentAdapter: StorageAdapter
  ) {
    super();
  }
  
  async initializeMemoryTables(): Promise<void> {
    if (this.memoryConfig.type === 'sqlite') {
      await this.executeSQLiteSchema();
    } else {
      await this.executePostgreSQLSchema();
    }
  }
  
  // Use existing AgentDock storage patterns
  async storeMemory(memory: Memory): Promise<void> {
    return this.parentAdapter.set(`memory:${memory.id}`, memory);
  }
  
  async getMemoriesByAgent(agentId: string): Promise<Memory[]> {
    return this.parentAdapter.getByPrefix(`memory:agent:${agentId}`);
  }
}
```

## Migration Strategy

```typescript
// agentdock-core/src/memory/migrations/001_initial_schema.ts
export async function up(db: Database): Promise<void> {
  // Create memory tables
  await db.exec(MEMORY_SCHEMA_SQL);
  
  // Create indexes
  await db.exec(MEMORY_INDEXES_SQL);
  
  // Setup vector search
  if (db.type === 'postgresql') {
    await db.exec('CREATE EXTENSION IF NOT EXISTS vector;');
  }
}

export async function down(db: Database): Promise<void> {
  await db.exec('DROP TABLE IF EXISTS memory_connections;');
  await db.exec('DROP TABLE IF EXISTS memories;');
}
```

Key design principles:
- **Dual database support** for development and production
- **Vector search optimization** for semantic queries  
- **Connection indexing** for Zettelkasten traversal
- **Integration with existing AgentDock storage patterns**
- **Performance-first indexing** for production scale 