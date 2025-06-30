/**
 * @fileoverview SQLite Memory Operations - User Isolation Support
 * Implements storage interface with userId filtering for multi-tenancy.
 */

import { Database } from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { MemoryType } from '../../../../shared/types/memory';
import {
  MemoryData,
  MemoryOperations,
  MemoryOperationStats,
  MemoryRecallOptions
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
    connections: unknown[]
  ): Promise<void> {
    // Minimal implementation for interface compliance
  }

  async findConnectedMemories(
    userId: string,
    memoryId: string,
    depth?: number
  ): Promise<unknown> {
    return { memories: [], connections: [] };
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
}
