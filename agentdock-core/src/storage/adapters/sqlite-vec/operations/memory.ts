/**
 * @fileoverview SQLite-Vec Memory Operations with Hybrid Search
 *
 * Extends SQLite memory operations with vector + FTS5 BM25 hybrid search.
 * Uses native SQLite FTS5 BM25 function (no TypeScript implementation needed).
 *
 * TODO: For vector-only adapters (ChromaDB, Pinecone, Qdrant) that need text search,
 * TypeScript BM25 implementation is available using 'okapibm25' package if required.
 */

import Database from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import { BaseMemoryItem, MemoryType } from '../../../../shared/types/memory';
import {
  DatabaseMemoryQuery,
  DatabaseRecallOptions,
  VectorSearchResult
} from '../../../base-types';
import { TABLE_NAMES } from '../../../utils/sql-utils';

/**
 * Full memory item interface that extends BaseMemoryItem with storage-specific properties
 */
export interface FullMemoryItem extends BaseMemoryItem {
  userId: string;
  agentId: string;
  metadata?: Record<string, unknown>;
  accessedAt: number;
  accessCount: number;
}

export interface MemorySearchResult extends FullMemoryItem {
  score: number;
  distance?: number;
}

/**
 * Store a memory item with vector embedding
 */
export async function storeMemory(
  db: Database.Database,
  memory: FullMemoryItem,
  embedding?: number[]
): Promise<void> {
  const transaction = db.transaction(() => {
    try {
      // Insert into memories table
      const insertMemory = db.prepare(`
        INSERT OR REPLACE INTO memories (
          id, user_id, agent_id, type, content, importance, 
          metadata, created_at, accessed_at, access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertMemory.run(
        memory.id,
        memory.userId,
        memory.agentId,
        memory.type,
        memory.content,
        memory.importance,
        JSON.stringify(memory.metadata || {}),
        new Date(memory.createdAt).toISOString(),
        new Date(memory.accessedAt).toISOString(),
        memory.accessCount || 0
      );

      // Store embedding if provided
      if (embedding) {
        const vectorData = new Float32Array(embedding);
        const insertEmbedding = db.prepare(`
          INSERT OR REPLACE INTO ${TABLE_NAMES.MEMORY_EMBEDDINGS}(rowid, embedding) 
          VALUES (?, ?)
        `);
        insertEmbedding.run(memory.id, vectorData);
      }

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Stored memory: ${memory.id} for user: ${memory.userId}`
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Failed to store memory: ${memory.id}`,
        { error }
      );
      throw error;
    }
  });

  transaction();
}

/**
 * Search memories using vector similarity and text matching
 */
export async function searchMemories(
  db: Database.Database,
  options: DatabaseRecallOptions
): Promise<MemorySearchResult[]> {
  try {
    const { query, userId, agentId, limit = 10, threshold } = options;

    // For text-based search without embeddings
    const sql = `
      SELECT 
        id, user_id, agent_id, type, content, importance,
        metadata, created_at, accessed_at, access_count,
        (CASE 
          WHEN content LIKE ? THEN 0.9
          WHEN content LIKE ? THEN 0.7
          ELSE 0.5
        END) as score
      FROM memories 
      WHERE user_id = ? AND agent_id = ?
        AND (content LIKE ? OR content LIKE ?)
      ORDER BY score DESC, importance DESC, accessed_at DESC
      LIMIT ?
    `;

    const searchTerm = `%${query}%`;
    const exactTerm = `%${query}%`;

    const stmt = db.prepare(sql);
    const rows = stmt.all(
      exactTerm,
      searchTerm,
      userId,
      agentId,
      searchTerm,
      exactTerm,
      limit
    ) as Array<{
      id: string;
      user_id: string;
      agent_id: string;
      type: string;
      content: string;
      importance: number;
      metadata: string;
      created_at: string;
      accessed_at: string;
      access_count: number;
      score: number;
    }>;

    const results: MemorySearchResult[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      type: row.type as MemoryType,
      content: row.content,
      importance: row.importance,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at).getTime(),
      accessedAt: new Date(row.accessed_at).getTime(),
      accessCount: row.access_count,
      score: row.score
    }));

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Found ${results.length} memories for query: "${query}"`
    );

    return results;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Failed to search memories',
      { error }
    );
    throw error;
  }
}

/**
 * Vector-based memory search using embeddings
 */
export async function vectorSearchMemories(
  db: Database.Database,
  queryEmbedding: number[],
  options: DatabaseRecallOptions
): Promise<MemorySearchResult[]> {
  try {
    const { userId, agentId, limit = 10, threshold } = options;

    // Convert query vector to binary format
    const queryData = new Float32Array(queryEmbedding);

    // Search using vector similarity with memory filtering
    let sql = `
      SELECT 
        m.id, m.user_id, m.agent_id, m.type, m.content, m.importance,
        m.metadata, m.created_at, m.accessed_at, m.access_count,
        v.distance,
        (1 - v.distance) as score
      FROM memories m
      JOIN ${TABLE_NAMES.MEMORY_EMBEDDINGS} v ON m.id = v.rowid
      WHERE m.user_id = ? AND m.agent_id = ? 
        AND v.embedding MATCH ?
    `;

    const params: any[] = [userId, agentId, queryData];

    // Add threshold filter if provided
    if (threshold !== undefined) {
      sql += ' AND v.distance <= ?';
      params.push(1 - threshold); // Convert similarity to distance
    }

    sql += ' ORDER BY v.distance ASC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      user_id: string;
      agent_id: string;
      type: string;
      content: string;
      importance: number;
      metadata: string;
      created_at: string;
      accessed_at: string;
      access_count: number;
      distance: number;
      score: number;
    }>;

    const results: MemorySearchResult[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      type: row.type as MemoryType,
      content: row.content,
      importance: row.importance,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at).getTime(),
      accessedAt: new Date(row.accessed_at).getTime(),
      accessCount: row.access_count,
      score: row.score,
      distance: row.distance
    }));

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Vector search found ${results.length} memories`
    );

    return results;
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      'Failed to perform vector search on memories',
      { error }
    );
    throw error;
  }
}

/**
 * Get memories by query parameters
 */
export async function getMemories(
  db: Database.Database,
  query: DatabaseMemoryQuery
): Promise<FullMemoryItem[]> {
  try {
    const {
      userId,
      agentId,
      type,
      minImportance,
      maxAge,
      limit = 50,
      offset = 0
    } = query;

    let sql = `
      SELECT 
        id, user_id, agent_id, type, content, importance,
        metadata, created_at, accessed_at, access_count
      FROM memories 
      WHERE user_id = ? AND agent_id = ?
    `;

    const params: any[] = [userId, agentId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (minImportance !== undefined) {
      sql += ' AND importance >= ?';
      params.push(minImportance);
    }

    if (maxAge !== undefined) {
      const cutoffDate = new Date(Date.now() - maxAge);
      sql += ' AND created_at >= ?';
      params.push(cutoffDate.toISOString());
    }

    sql += ' ORDER BY importance DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      user_id: string;
      agent_id: string;
      type: string;
      content: string;
      importance: number;
      metadata: string;
      created_at: string;
      accessed_at: string;
      access_count: number;
    }>;

    const results: FullMemoryItem[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      type: row.type as MemoryType,
      content: row.content,
      importance: row.importance,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at).getTime(),
      accessedAt: new Date(row.accessed_at).getTime(),
      accessCount: row.access_count
    }));

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Retrieved ${results.length} memories for user: ${userId}`
    );

    return results;
  } catch (error) {
    logger.error(LogCategory.STORAGE, 'SQLiteVec', 'Failed to get memories', {
      error
    });
    throw error;
  }
}

/**
 * Update memory access information
 */
export async function updateMemoryAccess(
  db: Database.Database,
  memoryId: string
): Promise<void> {
  try {
    const stmt = db.prepare(`
      UPDATE memories 
      SET accessed_at = ?, access_count = access_count + 1
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), memoryId);

    logger.debug(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Updated access for memory: ${memoryId}`
    );
  } catch (error) {
    logger.error(
      LogCategory.STORAGE,
      'SQLiteVec',
      `Failed to update memory access: ${memoryId}`,
      { error }
    );
    throw error;
  }
}

/**
 * Delete a memory and its associated embedding
 */
export async function deleteMemory(
  db: Database.Database,
  memoryId: string
): Promise<void> {
  const transaction = db.transaction(() => {
    try {
      // Delete from memories table
      const deleteMemory = db.prepare('DELETE FROM memories WHERE id = ?');
      deleteMemory.run(memoryId);

      // Delete associated embedding
      const deleteEmbedding = db.prepare(`
        DELETE FROM ${TABLE_NAMES.MEMORY_EMBEDDINGS} WHERE rowid = ?
      `);
      deleteEmbedding.run(memoryId);

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Deleted memory: ${memoryId}`
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteVec',
        `Failed to delete memory: ${memoryId}`,
        { error }
      );
      throw error;
    }
  });

  transaction();
}
