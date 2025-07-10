/**
 * @fileoverview PostgreSQL memory-specific schema for AgentDock Memory System
 *
 * This extends the base PostgreSQL adapter with memory-specific tables
 * optimized for sub-100ms recalls and production scale.
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { parseSqlIdentifier, quotePgIdentifier } from '../../utils/sql-utils';

/**
 * Memory types supported by the system
 */
export enum MemoryType {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural'
}

/**
 * Connection types for memory relationships
 */
export enum ConnectionType {
  RELATED = 'related',
  CAUSES = 'causes',
  PART_OF = 'part_of',
  SIMILAR = 'similar',
  OPPOSITE = 'opposite'
}

/**
 * Initialize memory-specific tables and indexes
 */
export async function initializeMemorySchema(
  pool: Pool,
  schema: string
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'PostgreSQLMemorySchema',
    'Initializing memory schema',
    { schema }
  );

  // Validate and quote schema name safely
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const quotedSchema = quotePgIdentifier(validatedSchema);

  const client = await pool.connect();
  try {
    // Create schema if it doesn't exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`);

    // Create enhanced memories table with vector support
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('working', 'episodic', 'semantic', 'procedural')),
        content TEXT NOT NULL,
        importance DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        metadata JSONB DEFAULT '{}',
        embedding vector(1536), -- OpenAI text-embedding-3-small dimension
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        access_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT[],
        source TEXT,
        confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1)
      )
    `);

    // Create memory connections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.memory_connections (
        id SERIAL PRIMARY KEY,
        from_memory_id TEXT NOT NULL,
        to_memory_id TEXT NOT NULL,
        connection_type TEXT NOT NULL CHECK (connection_type IN ('related', 'causes', 'part_of', 'similar', 'opposite')),
        strength DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (from_memory_id) REFERENCES ${quotedSchema}.memories(id) ON DELETE CASCADE,
        FOREIGN KEY (to_memory_id) REFERENCES ${quotedSchema}.memories(id) ON DELETE CASCADE,
        UNIQUE(from_memory_id, to_memory_id, connection_type)
      )
    `);

    // Create memory consolidation tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${quotedSchema}.memory_consolidations (
        id SERIAL PRIMARY KEY,
        original_memory_ids TEXT[] NOT NULL,
        consolidated_memory_id TEXT NOT NULL,
        strategy TEXT NOT NULL CHECK (strategy IN ('merge', 'synthesize', 'abstract', 'hierarchy')),
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (consolidated_memory_id) REFERENCES ${quotedSchema}.memories(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for efficient queries
    await createMemoryIndexes(client, quotedSchema);

    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'Memory schema initialized successfully',
      { schema: validatedSchema }
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'Failed to initialize memory schema',
      { schema: validatedSchema, error }
    );
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create optimized indexes for memory operations
 */
async function createMemoryIndexes(
  client: any,
  quotedSchema: string
): Promise<void> {
  // Primary query indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_user_agent_type 
    ON ${quotedSchema}.memories(user_id, agent_id, type)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_importance 
    ON ${quotedSchema}.memories(importance DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_created_at 
    ON ${quotedSchema}.memories(created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_accessed_at 
    ON ${quotedSchema}.memories(accessed_at DESC)
  `);

  // Vector similarity index (if pgvector is available)
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_embedding_cosine 
      ON ${quotedSchema}.memories USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100)
    `);
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'Failed to create vector index - pgvector extension may not be available',
      { error }
    );
  }

  // Text search index
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_content_gin 
    ON ${quotedSchema}.memories USING gin(to_tsvector('english', content))
  `);

  // Tags index
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memories_tags_gin 
    ON ${quotedSchema}.memories USING gin(tags)
  `);

  // Memory connections indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memory_connections_from 
    ON ${quotedSchema}.memory_connections(from_memory_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memory_connections_to 
    ON ${quotedSchema}.memory_connections(to_memory_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memory_connections_type 
    ON ${quotedSchema}.memory_connections(connection_type)
  `);

  // Consolidation tracking indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memory_consolidations_original 
    ON ${quotedSchema}.memory_consolidations USING gin(original_memory_ids)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_memory_consolidations_consolidated 
    ON ${quotedSchema}.memory_connections(consolidated_memory_id)
  `);
}

/**
 * Enable pgvector extension for vector operations
 */
export async function enableVectorExtension(pool: Pool): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    logger.info(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'pgvector extension enabled successfully'
    );
    return true;
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'Failed to enable pgvector extension',
      { error }
    );
    return false;
  } finally {
    client.release();
  }
}

/**
 * Clean up old memories based on type-specific retention policies
 */
export async function cleanupOldMemories(
  pool: Pool,
  schema: string,
  retentionDays: Record<MemoryType, number>
): Promise<number> {
  // Validate and quote schema name safely
  const validatedSchema = parseSqlIdentifier(schema, 'schema name');
  const quotedSchema = quotePgIdentifier(validatedSchema);

  const client = await pool.connect();
  let totalDeleted = 0;

  try {
    for (const [type, days] of Object.entries(retentionDays)) {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await client.query(
        `DELETE FROM ${quotedSchema}.memories 
         WHERE type = $1 AND created_at < $2`,
        [type, cutoffDate]
      );

      totalDeleted += result.rowCount || 0;
    }

    if (totalDeleted > 0) {
      logger.info(
        LogCategory.STORAGE,
        'PostgreSQLMemorySchema',
        'Cleaned up old memories',
        { totalDeleted, schema: validatedSchema }
      );
    }

    return totalDeleted;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'PostgreSQLMemorySchema',
      'Failed to cleanup old memories',
      { schema: validatedSchema, error }
    );
    return 0;
  } finally {
    client.release();
  }
}
