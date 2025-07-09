/**
 * @fileoverview PostgreSQL memory-specific schema for AgentDock Memory System
 *
 * This extends the base PostgreSQL adapter with memory-specific tables
 * optimized for sub-100ms recalls and production scale.
 */

import { Pool } from 'pg';

import { LogCategory, logger } from '../../../logging';
import { SQLIdentifierValidator } from '../shared/sql-identifier-validator';

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
  schema: string = 'public'
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'MemorySchema',
    'Initializing memory schema',
    { schema }
  );

  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    // Create schema if needed
    if (schema !== 'public') {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${secureSchema}`);
    }

    // Enable pgvector extension for vector similarity search
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create enum types with validated schema
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ${secureSchema}.memory_type AS ENUM ('working', 'episodic', 'semantic', 'procedural');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ${secureSchema}.connection_type AS ENUM ('related', 'causes', 'part_of', 'similar', 'opposite');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create memories table with partitioning support
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        user_id UUID NOT NULL,
        
        -- Memory content and type
        content TEXT NOT NULL,
        type ${secureSchema}.memory_type NOT NULL,
        
        -- Importance and decay
        importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        resonance REAL NOT NULL DEFAULT 1.0 CHECK (resonance >= 0),
        access_count INTEGER NOT NULL DEFAULT 0,
        
        -- LAZY DECAY SYSTEM FIELDS
        never_decay BOOLEAN NOT NULL DEFAULT FALSE,
        custom_half_life INTEGER CHECK (custom_half_life > 0),
        reinforceable BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        
        -- Timestamps with timezone
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        -- Context and metadata
        session_id UUID,
        keywords JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        
        -- Extraction tracking
        extraction_method TEXT NOT NULL DEFAULT 'rules',
        token_count INTEGER DEFAULT 0,
        batch_id TEXT,
        source_message_ids JSONB DEFAULT '[]'::jsonb,
        
        -- Vector embedding reference
        embedding_id UUID,
        embedding_model TEXT,
        embedding_dimension INTEGER,
        
        -- Vector embedding (pgvector)
        embedding vector(1536)
      ) PARTITION BY RANGE (created_at);
    `);

    // Create initial partitions (quarterly)
    const currentYear = new Date().getFullYear();
    const quarters = [
      { start: '01-01', end: '04-01' },
      { start: '04-01', end: '07-01' },
      { start: '07-01', end: '10-01' },
      { start: '10-01', end: '01-01' }
    ];

    for (let i = 0; i < quarters.length; i++) {
      const quarter = quarters[i];
      const endYear = i === 3 ? currentYear + 1 : currentYear;

      await client
        .query(
          `
        CREATE TABLE IF NOT EXISTS ${secureSchema}.memories_${currentYear}_q${i + 1} 
        PARTITION OF ${secureSchema}.memories
        FOR VALUES FROM ('${currentYear}-${quarter.start}') 
        TO ('${endYear}-${quarter.end}');
      `
        )
        .catch(() => {
          // Partition might already exist
        });
    }

    // High-performance indexes - Updated for user isolation
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_agent_type 
        ON ${secureSchema}.memories(user_id, agent_id, type, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_agent_importance 
        ON ${secureSchema}.memories(user_id, agent_id, importance DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_recall 
        ON ${secureSchema}.memories(user_id, agent_id, importance DESC, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_agent_type_importance 
        ON ${secureSchema}.memories(agent_id, type, importance DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_agent_resonance 
        ON ${secureSchema}.memories(agent_id, resonance DESC) 
        WHERE resonance > 0.5;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_keywords_gin 
        ON ${secureSchema}.memories USING GIN (keywords);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_metadata_gin 
        ON ${secureSchema}.memories USING GIN (metadata);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_active 
        ON ${secureSchema}.memories(agent_id, importance DESC) 
        WHERE importance > 0.3 AND resonance > 0.1;
    `);

    // Vector similarity search index (pgvector HNSW)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw 
        ON ${secureSchema}.memories USING hnsw (embedding vector_cosine_ops)
        WHERE embedding IS NOT NULL;
    `);

    // Memory connections table (Zettelkasten)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.memory_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_memory_id UUID NOT NULL,
        target_memory_id UUID NOT NULL,
        connection_type ${secureSchema}.connection_type NOT NULL,
        strength REAL NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(source_memory_id, target_memory_id),
        FOREIGN KEY (source_memory_id) REFERENCES ${secureSchema}.memories(id) ON DELETE CASCADE,
        FOREIGN KEY (target_memory_id) REFERENCES ${secureSchema}.memories(id) ON DELETE CASCADE
      );
    `);

    // Bidirectional search indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_connections_source 
        ON ${secureSchema}.memory_connections(source_memory_id, strength DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_connections_target 
        ON ${secureSchema}.memory_connections(target_memory_id, strength DESC);
    `);

    // Procedural patterns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.procedural_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL,
        pattern_name TEXT NOT NULL,
        tool_sequence JSONB NOT NULL,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        avg_execution_time INTERVAL,
        context_pattern JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(agent_id, pattern_name)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patterns_agent_success 
        ON ${secureSchema}.procedural_patterns(agent_id, success_count DESC);
    `);

    // Update trigger for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION ${secureSchema}.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TRIGGER update_memories_updated_at BEFORE UPDATE
          ON ${secureSchema}.memories FOR EACH ROW
          EXECUTE FUNCTION ${secureSchema}.update_updated_at_column();
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE
          ON ${secureSchema}.procedural_patterns FOR EACH ROW
          EXECUTE FUNCTION ${secureSchema}.update_updated_at_column();
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    logger.debug(
      LogCategory.STORAGE,
      'MemorySchema',
      'Memory schema initialization complete'
    );
  } finally {
    client.release();
  }
}

/**
 * Create a new monthly partition for memories table
 */
export async function createMemoryPartition(
  pool: Pool,
  schema: string,
  year: number,
  month: number
): Promise<void> {
  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const partitionName = `memories_${year}_${month.toString().padStart(2, '0')}`;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${secureSchema}.${partitionName}
      PARTITION OF ${secureSchema}.memories
      FOR VALUES FROM ('${startDate.toISOString().split('T')[0]}') 
      TO ('${endDate.toISOString().split('T')[0]}')
    `);

    logger.debug(
      LogCategory.STORAGE,
      'MemorySchema',
      'Created memory partition',
      { partition: partitionName }
    );
  } catch (error) {
    // Partition might already exist
    logger.debug(
      LogCategory.STORAGE,
      'MemorySchema',
      'Partition already exists',
      { partition: partitionName }
    );
  } finally {
    client.release();
  }
}

/**
 * Clean up old memories based on decay rules
 */
export async function cleanupDecayedMemories(
  pool: Pool,
  schema: string,
  thresholds: {
    resonanceThreshold: number;
    daysOld: number;
  }
): Promise<number> {
  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      DELETE FROM ${secureSchema}.memories 
      WHERE resonance < $1
        AND last_accessed_at < CURRENT_TIMESTAMP - INTERVAL '${thresholds.daysOld} days'
        AND type != 'semantic'
    `,
      [thresholds.resonanceThreshold]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'MemorySchema',
        'Cleaned up decayed memories',
        {
          count: result.rowCount,
          thresholds
        }
      );
    }

    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Get memory table statistics
 */
export async function getMemoryStats(
  pool: Pool,
  schema: string,
  agentId?: string
): Promise<{
  totalMemories: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  avgResonance: number;
  totalConnections: number;
}> {
  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    const whereClause = agentId ? `WHERE agent_id = $1` : '';
    const params = agentId ? [agentId] : [];

    const statsResult = await client.query(
      `
      SELECT 
        COUNT(*) as total,
        type,
        AVG(importance) as avg_importance,
        AVG(resonance) as avg_resonance
      FROM ${secureSchema}.memories
      ${whereClause}
      GROUP BY type
    `,
      params
    );

    const connectionsResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM ${secureSchema}.memory_connections mc
      ${
        agentId
          ? `WHERE EXISTS (
        SELECT 1 FROM ${secureSchema}.memories m 
        WHERE m.id = mc.source_memory_id 
        AND m.agent_id = $1
      )`
          : ''
      }
    `,
      params
    );

    const byType: Record<string, number> = {};
    let totalMemories = 0;
    let totalImportance = 0;
    let totalResonance = 0;

    statsResult.rows.forEach((row) => {
      byType[row.type] = parseInt(row.total);
      totalMemories += parseInt(row.total);
      totalImportance += parseFloat(row.avg_importance) * parseInt(row.total);
      totalResonance += parseFloat(row.avg_resonance) * parseInt(row.total);
    });

    return {
      totalMemories,
      byType: byType as Record<MemoryType, number>,
      avgImportance: totalMemories > 0 ? totalImportance / totalMemories : 0,
      avgResonance: totalMemories > 0 ? totalResonance / totalMemories : 0,
      totalConnections: parseInt(connectionsResult.rows[0]?.total || '0')
    };
  } finally {
    client.release();
  }
}

/**
 * LAZY DECAY MIGRATION - Add lazy decay fields to existing memories table
 */
export async function migrateToLazyDecay(
  pool: Pool,
  schema: string = 'public'
): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'MemorySchema',
    'Starting lazy decay migration',
    { schema }
  );

  // Validate and escape schema name to prevent SQL injection
  const secureSchema = SQLIdentifierValidator.securePostgreSQLSchema(schema);

  const client = await pool.connect();
  try {
    // Check if migration is needed by checking for never_decay column
    const columnCheck = await client.query(
      `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = 'memories' AND column_name = 'never_decay'
    `,
      [schema]
    );

    if (columnCheck.rows.length > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'MemorySchema',
        'Lazy decay migration already applied'
      );
      return;
    }

    // Add lazy decay columns
    await client.query(`
      ALTER TABLE ${secureSchema}.memories 
      ADD COLUMN never_decay BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN custom_half_life INTEGER CHECK (custom_half_life > 0),
      ADD COLUMN reinforceable BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
    `);

    // Add index for lazy decay queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_memories_lazy_decay 
        ON ${secureSchema}.memories(agent_id, status, never_decay, custom_half_life)
        WHERE status = 'active'
    `);

    logger.debug(
      LogCategory.STORAGE,
      'MemorySchema',
      'Lazy decay migration completed successfully'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'MemorySchema',
      'Lazy decay migration failed',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  } finally {
    client.release();
  }
}
