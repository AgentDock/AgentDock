/**
 * @fileoverview SQLite Memory Operations - User Isolation Support
 * Implements storage interface with userId filtering for multi-tenancy.
 */

import { Database } from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { MemoryType } from '../../../../shared/types/memory';
import {
  MemoryConnection,
  MemoryData,
  MemoryOperations,
  MemoryOperationStats,
  MemoryRecallOptions,
  MemoryUpdate
} from '../../../types';
import { nanoid as generateId } from '../../../utils';

interface SqliteRow {
  id: string;
  user_id: string;
  agent_id: string;
  content: string;
  type: string;
  importance: number;
  resonance: number;
  access_count: number;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
  session_id?: string;
  token_count?: number;
  keywords?: string;
  embedding_id?: string;
  metadata?: string;
}

/**
 * SQLite memory operations with user isolation
 */
export class SqliteMemoryOperations implements MemoryOperations {
  constructor(private db: Database) {}

  /**
   * Store memory with user isolation and atomic transaction
   */
  async store(
    userId: string,
    agentId: string,
    memory: MemoryData
  ): Promise<string> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    const id = memory.id || generateId();

    // Use atomic transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO memories (
          id, user_id, agent_id, content, type, importance, resonance, access_count,
          created_at, updated_at, last_accessed_at, keywords, metadata,
          extraction_method, token_count, batch_id, source_message_ids,
          embedding_id, embedding_model, embedding_dimension
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        userId,
        agentId,
        memory.content,
        memory.type,
        memory.importance,
        memory.resonance,
        memory.accessCount,
        memory.createdAt,
        memory.updatedAt,
        memory.lastAccessedAt,
        JSON.stringify(memory.keywords || []),
        JSON.stringify(memory.metadata || {}),
        'manual',
        memory.tokenCount || 0,
        generateId(), // batch_id
        JSON.stringify([]),
        memory.embeddingId || null,
        null, // embedding_model
        null // embedding_dimension
      );

      return id;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteMemoryOps', 'Store failed', {
        userId,
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Recall memories with user filtering
   */
  async recall(
    userId: string,
    agentId: string,
    query: string,
    options?: MemoryRecallOptions
  ): Promise<MemoryData[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM memories 
        WHERE user_id = ? AND agent_id = ? 
        AND (content LIKE ? OR keywords LIKE ?)
        ORDER BY importance DESC, created_at DESC
        LIMIT ?
      `);

      const queryPattern = `%${query}%`;
      const limit = options?.limit || 20;

      const rows = stmt.all(
        userId,
        agentId,
        queryPattern,
        queryPattern,
        limit
      ) as SqliteRow[];

      return rows.map((row) => this.convertRowToMemoryData(row));
    } catch (error) {
      logger.error(LogCategory.STORAGE, 'SQLiteMemoryOps', 'Recall failed', {
        userId,
        agentId,
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update memory with user validation and atomic transaction
   */
  async update(
    userId: string,
    agentId: string,
    memoryId: string,
    updates: Partial<MemoryData>
  ): Promise<void> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    // Use atomic transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE memories 
        SET importance = COALESCE(?, importance), 
            resonance = COALESCE(?, resonance), 
            updated_at = ?
        WHERE user_id = ? AND agent_id = ? AND id = ?
      `);

      stmt.run(
        updates.importance,
        updates.resonance,
        Date.now(),
        userId,
        agentId,
        memoryId
      );
    });

    transaction();
  }

  /**
   * Delete memory with user validation and atomic transaction
   */
  async delete(
    userId: string,
    agentId: string,
    memoryId: string
  ): Promise<void> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    // Use atomic transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        DELETE FROM memories 
        WHERE user_id = ? AND agent_id = ? AND id = ?
      `);

      stmt.run(userId, agentId, memoryId);
    });

    transaction();
  }

  /**
   * Get memory by ID with user validation
   */
  async getById(userId: string, memoryId: string): Promise<MemoryData | null> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE user_id = ? AND id = ?
      `);

    const row = stmt.get(userId, memoryId) as SqliteRow | undefined;
    if (!row) return null;

    return this.convertRowToMemoryData(row);
  }

  /**
   * Get stats with user filtering
   */
  async getStats(
    userId: string,
    agentId?: string
  ): Promise<MemoryOperationStats> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    const whereClause = agentId
      ? 'WHERE user_id = ? AND agent_id = ?'
      : 'WHERE user_id = ?';
    const params = agentId ? [userId, agentId] : [userId];

    const stmt = this.db.prepare(`
      SELECT type, COUNT(*) as count, AVG(importance) as avg_importance
      FROM memories 
      ${whereClause}
      GROUP BY type
    `);

    const rows = stmt.all(...params) as Array<{
      type: string;
      count: number;
      avg_importance: number;
    }>;

    const byType: Record<string, number> = {};
    let totalMemories = 0;
    let totalImportance = 0;

    rows.forEach((row) => {
      byType[row.type] = row.count;
      totalMemories += row.count;
      totalImportance += row.avg_importance * row.count;
    });

    // Calculate approximate size based on content length
    const totalSizeStmt = this.db.prepare(`
      SELECT SUM(LENGTH(content) + LENGTH(COALESCE(keywords, '')) + LENGTH(COALESCE(metadata, ''))) as total_bytes
      FROM memories 
      ${whereClause}
    `);
    const sizeResult = totalSizeStmt.get(...params) as {
      total_bytes: number | null;
    };
    const totalBytes = sizeResult.total_bytes || 0;
    const totalSizeKB = Math.round((totalBytes / 1024) * 100) / 100; // Round to 2 decimal places

    return {
      totalMemories,
      byType,
      avgImportance: totalMemories > 0 ? totalImportance / totalMemories : 0,
      totalSize: `${totalSizeKB}KB`
    };
  }

  /**
   * Optional extended operations with user context
   */
  async applyDecay(
    userId: string,
    agentId: string,
    decayRules: unknown
  ): Promise<unknown> {
    return { processed: 0, decayed: 0, removed: 0 };
  }

  async createConnections(
    userId: string,
    connections: MemoryConnection[]
  ): Promise<void> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    if (connections.length === 0) return;

    // Use atomic transaction for batch insert with user validation
    const transaction = this.db.transaction(() => {
      // First, validate that both source and target memories belong to the user
      const validateStmt = this.db.prepare(`
        SELECT id FROM memories WHERE user_id = ? AND id = ?
      `);

      // Prepare batch insert statement for connections
      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_connections (
          id, source_memory_id, target_memory_id, connection_type, 
          strength, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const connection of connections) {
        // Validate source memory belongs to user
        const sourceValid = validateStmt.get(userId, connection.sourceMemoryId);
        if (!sourceValid) {
          throw new Error(
            `Source memory ${connection.sourceMemoryId} not found for user ${userId}`
          );
        }

        // Validate target memory belongs to user
        const targetValid = validateStmt.get(userId, connection.targetMemoryId);
        if (!targetValid) {
          throw new Error(
            `Target memory ${connection.targetMemoryId} not found for user ${userId}`
          );
        }

        // Insert connection
        insertStmt.run(
          connection.id,
          connection.sourceMemoryId,
          connection.targetMemoryId,
          connection.connectionType,
          connection.strength,
          connection.reason,
          connection.createdAt
        );
      }
    });

    try {
      transaction();

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteMemoryOps',
        'Memory connections created successfully',
        {
          userId: userId.substring(0, 8),
          connectionCount: connections.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteMemoryOps',
        'Failed to create memory connections',
        {
          userId: userId.substring(0, 8),
          connectionCount: connections.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  async findConnectedMemories(
    userId: string,
    memoryId: string,
    depth: number = 2
  ): Promise<{
    memories: MemoryData[];
    connections: MemoryConnection[];
  }> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    try {
      // First validate the starting memory belongs to the user
      const startMemory = await this.getById(userId, memoryId);
      if (!startMemory) {
        return { memories: [], connections: [] };
      }

      // Use recursive CTE to find connected memories with depth limiting
      const connectionsStmt = this.db.prepare(`
        WITH RECURSIVE connected_memories(
          memory_id, 
          connection_id, 
          source_id, 
          target_id, 
          connection_type, 
          strength, 
          reason, 
          created_at,
          depth
        ) AS (
          -- Base case: direct connections from starting memory
          SELECT 
            CASE 
              WHEN mc.source_memory_id = ? THEN mc.target_memory_id
              ELSE mc.source_memory_id
            END as memory_id,
            mc.id as connection_id,
            mc.source_memory_id as source_id,
            mc.target_memory_id as target_id,
            mc.connection_type,
            mc.strength,
            mc.reason,
            mc.created_at,
            1 as depth
          FROM memory_connections mc
          WHERE (mc.source_memory_id = ? OR mc.target_memory_id = ?)
          
          UNION ALL
          
          -- Recursive case: connections from already found memories
          SELECT 
            CASE 
              WHEN mc.source_memory_id = cm.memory_id THEN mc.target_memory_id
              ELSE mc.source_memory_id
            END as memory_id,
            mc.id as connection_id,
            mc.source_memory_id as source_id,
            mc.target_memory_id as target_id,
            mc.connection_type,
            mc.strength,
            mc.reason,
            mc.created_at,
            cm.depth + 1 as depth
          FROM memory_connections mc
          JOIN connected_memories cm ON (
            mc.source_memory_id = cm.memory_id OR mc.target_memory_id = cm.memory_id
          )
          WHERE cm.depth < ? 
            AND (
              CASE 
                WHEN mc.source_memory_id = cm.memory_id THEN mc.target_memory_id
                ELSE mc.source_memory_id
              END
            ) != ?  -- Avoid returning to start memory
        )
        SELECT DISTINCT 
          connection_id,
          source_id,
          target_id,
          connection_type,
          strength,
          reason,
          created_at
        FROM connected_memories
        ORDER BY strength DESC, created_at DESC
      `);

      const connectionRows = connectionsStmt.all(
        memoryId,
        memoryId,
        memoryId,
        depth,
        memoryId
      ) as Array<{
        connection_id: string;
        source_id: string;
        target_id: string;
        connection_type: string;
        strength: number;
        reason: string;
        created_at: number;
      }>;

      // Convert to MemoryConnection objects
      const connections: MemoryConnection[] = connectionRows.map((row) => ({
        id: row.connection_id,
        sourceMemoryId: row.source_id,
        targetMemoryId: row.target_id,
        connectionType: row.connection_type as any,
        strength: row.strength,
        reason: row.reason,
        createdAt: row.created_at,
        metadata: {}
      }));

      // Get unique memory IDs from connections (excluding the starting memory)
      const memoryIds = new Set<string>();
      connections.forEach((conn) => {
        if (conn.sourceMemoryId !== memoryId) {
          memoryIds.add(conn.sourceMemoryId);
        }
        if (conn.targetMemoryId !== memoryId) {
          memoryIds.add(conn.targetMemoryId);
        }
      });

      // Fetch connected memories with user validation
      const memories: MemoryData[] = [];
      if (memoryIds.size > 0) {
        const placeholders = Array.from(memoryIds)
          .map(() => '?')
          .join(',');
        const memoriesStmt = this.db.prepare(`
          SELECT * FROM memories 
          WHERE user_id = ? AND id IN (${placeholders})
          ORDER BY importance DESC, created_at DESC
        `);

        const memoryRows = memoriesStmt.all(
          userId,
          ...Array.from(memoryIds)
        ) as SqliteRow[];

        memories.push(
          ...memoryRows.map((row) => this.convertRowToMemoryData(row))
        );
      }

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteMemoryOps',
        'Found connected memories successfully',
        {
          userId: userId.substring(0, 8),
          memoryId,
          depth,
          memoriesFound: memories.length,
          connectionsFound: connections.length
        }
      );

      return { memories, connections };
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteMemoryOps',
        'Failed to find connected memories',
        {
          userId: userId.substring(0, 8),
          memoryId,
          depth,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Convert database row to MemoryData
   */
  private convertRowToMemoryData(row: SqliteRow): MemoryData {
    // Safe JSON parsing with error handling to prevent memory system crashes
    let keywords: string[] = [];
    if (row.keywords) {
      try {
        keywords = JSON.parse(row.keywords);
      } catch (error) {
        logger.error(
          LogCategory.STORAGE,
          'SQLiteMemoryOps',
          'Failed to parse keywords JSON',
          {
            memoryId: row.id,
            keywords: row.keywords,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        keywords = [];
      }
    }

    let metadata: Record<string, unknown> = {};
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch (error) {
        logger.error(
          LogCategory.STORAGE,
          'SQLiteMemoryOps',
          'Failed to parse metadata JSON',
          {
            memoryId: row.id,
            metadata: row.metadata,
            error: error instanceof Error ? error.message : String(error)
          }
        );
        metadata = {};
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      type: row.type as MemoryType,
      content: row.content,
      importance: row.importance,
      resonance: row.resonance,
      accessCount: row.access_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
      sessionId: row.session_id,
      tokenCount: row.token_count,
      keywords: keywords,
      embeddingId: row.embedding_id,
      metadata: metadata
    };
  }

  /**
   * Batch update memories for decay operations
   */
  async batchUpdateMemories(updates: MemoryUpdate[]): Promise<void> {
    if (updates.length === 0) return;

    const updateBatch = this.db.transaction((updates: MemoryUpdate[]) => {
      const stmt = this.db.prepare(`
        UPDATE memories 
        SET 
          resonance = ?,
          last_accessed_at = ?,
          access_count = ?,
          updated_at = ?
        WHERE id = ?
      `);

      const now = Date.now();
      for (const update of updates) {
        stmt.run(
          update.resonance,
          update.lastAccessedAt,
          update.accessCount,
          now,
          update.id
        );
      }
    });

    try {
      updateBatch(updates);

      logger.debug(
        LogCategory.STORAGE,
        'SqliteMemoryOperations',
        'Batch update completed',
        {
          count: updates.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SqliteMemoryOperations',
        'Batch update failed',
        {
          error: error instanceof Error ? error.message : String(error),
          count: updates.length
        }
      );
      throw new Error(
        `Batch update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
