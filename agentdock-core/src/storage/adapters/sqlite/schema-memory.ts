/**
 * @fileoverview SQLite memory-specific schema for development
 *
 * Simplified memory tables for local development with SQLite.
 * Uses the same structure as PostgreSQL but adapted for SQLite syntax.
 */

import { Database } from 'better-sqlite3';

import { LogCategory, logger } from '../../../logging';

/**
 * Initialize memory-specific tables for SQLite
 */
export async function initializeMemorySchema(db: Database): Promise<void> {
  logger.debug(
    LogCategory.STORAGE,
    'SQLiteMemorySchema',
    'Initializing memory schema'
  );

  try {
    // Core memories table with SQLite optimizations
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('working', 'episodic', 'semantic', 'procedural')),
        
        -- Numeric fields for efficient queries
        importance REAL NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
        resonance REAL NOT NULL DEFAULT 1.0 CHECK (resonance >= 0),
        access_count INTEGER NOT NULL DEFAULT 0,
        
        -- LAZY DECAY SYSTEM FIELDS
        never_decay INTEGER NOT NULL DEFAULT 0 CHECK (never_decay IN (0, 1)),
        custom_half_life INTEGER CHECK (custom_half_life > 0),
        reinforceable INTEGER NOT NULL DEFAULT 1 CHECK (reinforceable IN (0, 1)),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        
        -- Integer timestamps for performance
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        
        -- JSON storage
        keywords TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        
        -- Tracking
        extraction_method TEXT NOT NULL DEFAULT 'rules',
        token_count INTEGER DEFAULT 0,
        batch_id TEXT,
        source_message_ids TEXT DEFAULT '[]',
        
        -- Vector reference
        embedding_id TEXT,
        embedding_model TEXT,
        embedding_dimension INTEGER
      );
    `);

    // Covering indexes for common queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_recall ON memories(
        agent_id, type, importance DESC, resonance DESC
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_decay ON memories(
        agent_id, last_accessed_at, resonance
      ) WHERE importance < 0.7;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(
        agent_id, session_id, created_at DESC
      ) WHERE session_id IS NOT NULL;
    `);

    // Memory connections table
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_connections (
        id TEXT PRIMARY KEY,
        source_memory_id TEXT NOT NULL,
        target_memory_id TEXT NOT NULL,
        connection_type TEXT NOT NULL CHECK (
          connection_type IN ('related', 'causes', 'part_of', 'similar', 'opposite')
        ),
        strength REAL NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
        reason TEXT,
        created_at INTEGER NOT NULL,
        
        UNIQUE(source_memory_id, target_memory_id),
        FOREIGN KEY (source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (target_memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );
    `);

    // Connection indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_source 
      ON memory_connections(source_memory_id, strength DESC);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_target 
      ON memory_connections(target_memory_id, strength DESC);
    `);

    // Procedural patterns table
    db.exec(`
      CREATE TABLE IF NOT EXISTS procedural_patterns (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        pattern_name TEXT NOT NULL,
        tool_sequence TEXT NOT NULL, -- JSON
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        avg_execution_time_ms INTEGER, -- Store as milliseconds
        context_pattern TEXT, -- JSON
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        
        UNIQUE(agent_id, pattern_name)
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patterns_agent_success 
      ON procedural_patterns(agent_id, success_count DESC);
    `);

    // Create triggers for updated_at
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_memories_timestamp 
      AFTER UPDATE ON memories
      BEGIN
        UPDATE memories SET updated_at = CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)
        WHERE id = NEW.id;
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_patterns_timestamp 
      AFTER UPDATE ON procedural_patterns
      BEGIN
        UPDATE procedural_patterns SET updated_at = CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)
        WHERE id = NEW.id;
      END;
    `);

    // High-performance indexes - Updated for user isolation
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_agent_type 
        ON memories(user_id, agent_id, type, created_at DESC);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_agent_importance 
        ON memories(user_id, agent_id, importance DESC);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_user_recall 
        ON memories(user_id, agent_id, importance DESC, created_at DESC);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_agent_type_importance 
        ON memories(agent_id, type, importance DESC);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_agent_resonance 
        ON memories(agent_id, resonance DESC) 
        WHERE resonance > 0.5;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_keywords 
        ON memories(keywords);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_active 
        ON memories(agent_id, importance DESC) 
        WHERE importance > 0.3 AND resonance > 0.1;
    `);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Memory schema initialization complete'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Failed to initialize memory schema',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
    throw error;
  }
}

/**
 * Clean up old memories based on decay rules
 */
export function cleanupDecayedMemories(
  db: Database,
  thresholds: {
    resonanceThreshold: number;
    daysOld: number;
  }
): number {
  try {
    const cutoffTime = Date.now() - thresholds.daysOld * 24 * 60 * 60 * 1000;

    const result = db
      .prepare(
        `
      DELETE FROM memories 
      WHERE resonance < ?
        AND last_accessed_at < ?
        AND type != 'semantic'
    `
      )
      .run(thresholds.resonanceThreshold, cutoffTime);

    if (result.changes > 0) {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteMemorySchema',
        'Cleaned up decayed memories',
        {
          count: result.changes,
          thresholds
        }
      );
    }

    return result.changes;
  } catch (error) {
    logger.warn(LogCategory.STORAGE, 'SQLiteMemorySchema', 'Cleanup failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return 0;
  }
}

/**
 * Get memory table statistics
 */
export function getMemoryStats(
  db: Database,
  agentId?: string
): {
  totalMemories: number;
  byType: Record<string, number>;
  avgImportance: number;
  avgResonance: number;
  totalConnections: number;
} {
  try {
    const whereClause = agentId ? 'WHERE agent_id = ?' : '';
    const params = agentId ? [agentId] : [];

    // Get stats by type
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        type,
        AVG(importance) as avg_importance,
        AVG(resonance) as avg_resonance
      FROM memories
      ${whereClause}
      GROUP BY type
    `);

    const statsRows = agentId ? statsStmt.all(agentId) : statsStmt.all();

    // Get connection count
    const connectionStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM memory_connections mc
      ${
        agentId
          ? `WHERE EXISTS (
        SELECT 1 FROM memories m 
        WHERE m.id = mc.source_memory_id 
        AND m.agent_id = ?
      )`
          : ''
      }
    `);

    const connectionResult = agentId
      ? (connectionStmt.get(agentId) as { total: number })
      : (connectionStmt.get() as { total: number });

    const byType: Record<string, number> = {};
    let totalMemories = 0;
    let totalImportance = 0;
    let totalResonance = 0;

    statsRows.forEach((row: any) => {
      byType[row.type] = row.total;
      totalMemories += row.total;
      totalImportance += row.avg_importance * row.total;
      totalResonance += row.avg_resonance * row.total;
    });

    return {
      totalMemories,
      byType,
      avgImportance: totalMemories > 0 ? totalImportance / totalMemories : 0,
      avgResonance: totalMemories > 0 ? totalResonance / totalMemories : 0,
      totalConnections: connectionResult?.total || 0
    };
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Failed to get memory stats',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );

    return {
      totalMemories: 0,
      byType: {},
      avgImportance: 0,
      avgResonance: 0,
      totalConnections: 0
    };
  }
}

/**
 * Optimize database for memory operations
 */
export function optimizeMemoryDatabase(db: Database): void {
  try {
    // Analyze tables for query optimization
    db.exec('ANALYZE memories;');
    db.exec('ANALYZE memory_connections;');
    db.exec('ANALYZE procedural_patterns;');

    // Vacuum to reclaim space
    db.exec('VACUUM;');

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Database optimized'
    );
  } catch (error) {
    logger.warn(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Optimization failed',
      {
        error: error instanceof Error ? error.message : String(error)
      }
    );
  }
}

/**
 * LAZY DECAY MIGRATION - Add lazy decay fields to existing memories table
 */
export function migrateToLazyDecay(db: Database): void {
  logger.debug(
    LogCategory.STORAGE,
    'SQLiteMemorySchema',
    'Starting lazy decay migration'
  );

  try {
    // Check if migration is needed by checking for never_decay column
    const columnCheck = db
      .prepare(
        `
      SELECT name FROM pragma_table_info('memories') WHERE name = 'never_decay'
    `
      )
      .get();

    if (columnCheck) {
      logger.debug(
        LogCategory.STORAGE,
        'SQLiteMemorySchema',
        'Lazy decay migration already applied'
      );
      return;
    }

    // Add lazy decay columns
    db.exec(`
      ALTER TABLE memories 
      ADD COLUMN never_decay INTEGER NOT NULL DEFAULT 0 CHECK (never_decay IN (0, 1))
    `);

    db.exec(`
      ALTER TABLE memories 
      ADD COLUMN custom_half_life INTEGER CHECK (custom_half_life > 0)
    `);

    db.exec(`
      ALTER TABLE memories 
      ADD COLUMN reinforceable INTEGER NOT NULL DEFAULT 1 CHECK (reinforceable IN (0, 1))
    `);

    db.exec(`
      ALTER TABLE memories 
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
    `);

    // Add index for lazy decay queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_lazy_decay 
        ON memories(agent_id, status, never_decay, custom_half_life)
        WHERE status = 'active'
    `);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Lazy decay migration completed successfully'
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteMemorySchema',
      'Lazy decay migration failed',
      { error: error instanceof Error ? error.message : String(error) }
    );
    throw error;
  }
}
