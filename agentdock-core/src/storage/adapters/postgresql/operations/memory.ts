/**
 * @fileoverview Memory-specific operations for PostgreSQL storage adapter
 * 
 * Extends the base PostgreSQL adapter with optimized memory operations
 * for the AgentDock Memory System.
 */

import { Pool } from 'pg';
import { LogCategory, logger } from '../../../../logging';
import { nanoid as generateId } from '../../../utils';
import { ConnectionType, MemoryType } from '../schema-memory';

/**
 * Memory data structure
 */
export interface Memory {
  id: string;
  agentId: string;
  userId?: string;
  content: string;
  type: MemoryType;
  importance: number;
  resonance: number;
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  sessionId?: string;
  keywords?: string[];
  metadata?: Record<string, any>;
  extractionMethod: string;
  tokenCount?: number;
  batchId?: string;
  sourceMessageIds?: string[];
  embeddingId?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
}

/**
 * Memory connection for Zettelkasten-style relationships
 */
export interface MemoryConnection {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  connectionType: ConnectionType;
  strength: number;
  reason?: string;
  createdAt: number;
}

/**
 * Scored memory result from recall operations
 */
export interface ScoredMemory extends Memory {
  score: number;
  relevanceScore?: number;
}

/**
 * Memory query options
 */
export interface MemoryQuery {
  types?: MemoryType[];
  minImportance?: number;
  minResonance?: number;
  keywords?: string[];
  timeRange?: {
    start: number;
    end: number;
  };
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Recall options
 */
export interface RecallOptions {
  limit?: number;
  offset?: number;
  includeConnections?: boolean;
  updateAccessStats?: boolean;
}

/**
 * Decay rules for memory resonance
 */
export interface DecayRules {
  decayRate: number; // Rate of exponential decay
  importanceWeight: number; // How much importance affects decay
  accessBoost: number; // Boost per access
}

/**
 * Batch result
 */
export interface BatchResult {
  batchId: string;
  memoriesCreated: number;
  vectorsCreated: number;
  duration: number;
  success: boolean;
  error?: string;
}

import { 
  MemoryData, 
  MemoryOperations as IMemoryOperations, 
  MemoryRecallOptions, 
  MemoryOperationStats 
} from '../../../types';

/**
 * Memory operations for PostgreSQL - implements storage interface directly
 */
export class MemoryOperations implements IMemoryOperations {
  constructor(
    private pool: Pool,
    private schema: string = 'public'
  ) {}

  /**
   * Store a single memory - simple interface
   */
  async store(userId: string, agentId: string, memory: MemoryData): Promise<string> {
    // Convert MemoryData to PostgreSQL Memory format and use batch operation
    const pgMemory = {
      id: memory.id || generateId(),
      agentId: memory.agentId,
      userId: userId,
      content: memory.content,
      type: memory.type,
      importance: memory.importance,
      resonance: memory.resonance,
      accessCount: memory.accessCount,
      createdAt: memory.createdAt || Date.now(),
      updatedAt: memory.updatedAt || Date.now(),
      lastAccessedAt: memory.lastAccessedAt || Date.now(),
      sessionId: memory.sessionId,
      keywords: memory.keywords,
      metadata: memory.metadata,
      extractionMethod: 'manual',
      tokenCount: memory.tokenCount,
      embeddingId: memory.embeddingId
    };

    const result = await this.batchCreateMemories([pgMemory]);
    if (!result.success) {
      throw new Error(`Memory store failed: ${result.error}`);
    }
    return pgMemory.id;
  }

  /**
   * Recall memories - simple interface
   */
  async recall(userId: string, agentId: string, query: string, options?: MemoryRecallOptions): Promise<MemoryData[]> {
    const memoryQuery = {
      types: options?.type ? [options.type] : undefined,
      minImportance: options?.minImportance,
      keywords: query ? [query] : undefined,
      timeRange: options?.timeRange ? {
        start: options.timeRange.start.getTime(),
        end: options.timeRange.end.getTime()
      } : undefined
    };

    const scoredMemories = await this.recallMemories(userId, agentId, memoryQuery, {
      limit: options?.limit || 20,
      updateAccessStats: true
    });

    // Convert to MemoryData format
    return scoredMemories.map(memory => ({
      id: memory.id,
      userId: memory.userId!,
      agentId: memory.agentId,
      type: memory.type,
      content: memory.content,
      importance: memory.importance,
      resonance: memory.resonance,
      accessCount: memory.accessCount,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      lastAccessedAt: memory.lastAccessedAt,
      sessionId: memory.sessionId,
      tokenCount: memory.tokenCount,
      keywords: memory.keywords,
      embeddingId: memory.embeddingId,
      metadata: memory.metadata
    }));
  }

  /**
   * Update memory - simple interface
   */
  async update(userId: string, agentId: string, memoryId: string, updates: Partial<MemoryData>): Promise<void> {
    await this.updateMemory(userId, agentId, memoryId, updates);
  }

  /**
   * Delete memory - simple interface
   */
  async delete(userId: string, agentId: string, memoryId: string): Promise<void> {
    await this.deleteMemory(userId, agentId, memoryId);
  }

  /**
   * Get memory by ID - simple interface
   */
  async getById(userId: string, memoryId: string): Promise<MemoryData | null> {
    const memory = await this.getMemoryById(userId, memoryId);
    if (!memory) return null;

    return {
      id: memory.id,
      userId: memory.userId!,
      agentId: memory.agentId,
      type: memory.type,
      content: memory.content,
      importance: memory.importance,
      resonance: memory.resonance,
      accessCount: memory.accessCount,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      lastAccessedAt: memory.lastAccessedAt,
      sessionId: memory.sessionId,
      tokenCount: memory.tokenCount,
      keywords: memory.keywords,
      embeddingId: memory.embeddingId,
      metadata: memory.metadata
    };
  }

  /**
   * Get memory statistics - simple interface
   */
  async getStats(userId: string, agentId?: string): Promise<MemoryOperationStats> {
    const whereClause = agentId ? 'WHERE m.user_id = $1 AND m.agent_id = $2' : 'WHERE m.user_id = $1';
    const params = agentId ? [userId, agentId] : [userId];

    const memories = await this.recallMemories(userId, agentId || '', {}, { 
      limit: 10000, 
      updateAccessStats: false 
    });

    const byType: Record<string, number> = {};
    let totalImportance = 0;

    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      totalImportance += memory.importance;
    }

    return {
      totalMemories: memories.length,
      byType,
      avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      totalSize: `${(JSON.stringify(memories).length / 1024).toFixed(2)} KB`
    };
  }

  /**
   * Create memories in batch with optimizations
   */
  async batchCreateMemories(
    memories: Memory[],
    vectorData?: Array<{
      memoryId: string;
      vector: number[];
    }>
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const batchId = `batch_${Date.now()}_${generateId()}`;
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Prepare batch insert
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      memories.forEach((memory) => {
        memory.batchId = batchId;
        
        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 
           $${paramIndex++}::${this.schema}.memory_type, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
           to_timestamp($${paramIndex++}), to_timestamp($${paramIndex++}), to_timestamp($${paramIndex++}),
           $${paramIndex++}, $${paramIndex++}::jsonb, $${paramIndex++}::jsonb,
           $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::jsonb,
           $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
        );

        values.push(
          memory.id,
          memory.agentId,
          memory.userId || null,
          memory.content,
          memory.type,
          memory.importance,
          memory.resonance,
          memory.accessCount,
          memory.createdAt / 1000, // Convert to seconds for PostgreSQL timestamp
          memory.updatedAt / 1000,
          memory.lastAccessedAt / 1000,
          memory.sessionId || null,
          JSON.stringify(memory.keywords || []),
          JSON.stringify(memory.metadata || {}),
          memory.extractionMethod,
          memory.tokenCount || null,
          memory.batchId,
          JSON.stringify(memory.sourceMessageIds || []),
          memory.embeddingId || null,
          memory.embeddingModel || null,
          memory.embeddingDimension || null
        );
      });

      // Batch insert memories
      const insertQuery = `
        INSERT INTO ${this.schema}.memories (
          id, agent_id, user_id, content, type, importance, resonance, access_count,
          created_at, updated_at, last_accessed_at, session_id, keywords, metadata,
          extraction_method, token_count, batch_id, source_message_ids,
          embedding_id, embedding_model, embedding_dimension
        ) VALUES ${placeholders.join(', ')}
      `;

      await client.query(insertQuery, values);

      // Update vector references if provided
      if (vectorData && vectorData.length > 0) {
        for (const { memoryId, vector } of vectorData) {
          const vectorStr = `[${vector.join(',')}]`;
          await client.query(
            `
            UPDATE ${this.schema}.memories 
            SET embedding = $1::vector,
                embedding_model = $2,
                embedding_dimension = $3
            WHERE id = $4
          `,
            [vectorStr, 'text-embedding-3-small', vector.length, memoryId]
          );
        }
      }

      await client.query('COMMIT');

      logger.debug(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Batch memory creation successful',
        {
          batchId,
          count: memories.length,
          duration: Date.now() - startTime
        }
      );

      return {
        batchId,
        memoriesCreated: memories.length,
        vectorsCreated: vectorData?.length || 0,
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Batch memory creation failed',
        {
          batchId,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      return {
        batchId,
        memoriesCreated: 0,
        vectorsCreated: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Recall memories with scoring and optimization
   */
  async recallMemories(
    userId: string,
    agentId: string,
    query: MemoryQuery,
    options: RecallOptions = {}
  ): Promise<ScoredMemory[]> {
    const client = await this.pool.connect();
    try {
      const {
        limit = 100,
        offset = 0,
        updateAccessStats = true
      } = options;

      // Build dynamic query
      const conditions: string[] = ['m.user_id = $1', 'm.agent_id = $2'];
      const params: any[] = [userId, agentId];
      let paramIndex = 3;

      if (query.types && query.types.length > 0) {
        conditions.push(`m.type = ANY($${paramIndex}::${this.schema}.memory_type[])`);
        params.push(query.types);
        paramIndex++;
      }

      if (query.minImportance !== undefined) {
        conditions.push(`m.importance >= $${paramIndex}`);
        params.push(query.minImportance);
        paramIndex++;
      }

      if (query.minResonance !== undefined) {
        conditions.push(`m.resonance >= $${paramIndex}`);
        params.push(query.minResonance);
        paramIndex++;
      }

      if (query.keywords && query.keywords.length > 0) {
        conditions.push(`m.keywords @> $${paramIndex}::jsonb`);
        params.push(JSON.stringify(query.keywords));
        paramIndex++;
      }

      if (query.timeRange) {
        conditions.push(`m.created_at >= to_timestamp($${paramIndex})`);
        params.push(query.timeRange.start / 1000);
        paramIndex++;
        
        conditions.push(`m.created_at <= to_timestamp($${paramIndex})`);
        params.push(query.timeRange.end / 1000);
        paramIndex++;
      }

      if (query.sessionId) {
        conditions.push(`m.session_id = $${paramIndex}`);
        params.push(query.sessionId);
        paramIndex++;
      }

      // Calculate relevance score
      const scoreCalculation = `
        (m.importance * 0.3 + 
         m.resonance * 0.2 + 
         (1.0 / (1.0 + extract(epoch from (NOW() - m.last_accessed_at)) / 86400)) * 0.5
        ) AS relevance_score
      `;

      const queryStr = `
        SELECT 
          m.*,
          extract(epoch from m.created_at) * 1000 as created_at_ms,
          extract(epoch from m.updated_at) * 1000 as updated_at_ms,
          extract(epoch from m.last_accessed_at) * 1000 as last_accessed_at_ms,
          ${scoreCalculation}
        FROM ${this.schema}.memories m
        WHERE ${conditions.join(' AND ')}
        ORDER BY relevance_score DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await client.query(queryStr, params);

      // Convert to Memory objects
      const memories: ScoredMemory[] = result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        importance: parseFloat(row.importance),
        resonance: parseFloat(row.resonance),
        accessCount: row.access_count,
        createdAt: parseFloat(row.created_at_ms),
        updatedAt: parseFloat(row.updated_at_ms),
        lastAccessedAt: parseFloat(row.last_accessed_at_ms),
        sessionId: row.session_id,
        keywords: row.keywords,
        metadata: row.metadata,
        extractionMethod: row.extraction_method,
        tokenCount: row.token_count,
        batchId: row.batch_id,
        sourceMessageIds: row.source_message_ids,
        embeddingId: row.embedding_id,
        embeddingModel: row.embedding_model,
        embeddingDimension: row.embedding_dimension,
        score: parseFloat(row.relevance_score),
        relevanceScore: parseFloat(row.relevance_score)
      }));

      // Update access stats in background if requested
      if (updateAccessStats && memories.length > 0) {
        this.updateAccessStats(memories.map(m => m.id)).catch(error => {
          logger.warn(
            LogCategory.STORAGE,
            'MemoryOperations',
            'Failed to update access stats',
            { error: error.message }
          );
        });
      }

      return memories;
    } finally {
      client.release();
    }
  }

  /**
   * Update access statistics for memories
   */
  private async updateAccessStats(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query(
        `
        UPDATE ${this.schema}.memories 
        SET access_count = access_count + 1,
            last_accessed_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1)
      `,
        [memoryIds]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Apply decay rules to memories
   */
  async applyDecay(
    userId: string,
    agentId: string,
    decayRules: DecayRules
  ): Promise<{
    processed: number;
    decayed: number;
    removed: number;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get all memories for user and agent
      const result = await client.query(
        `
        SELECT id, resonance, importance, last_accessed_at, access_count
        FROM ${this.schema}.memories
        WHERE user_id = $1 AND agent_id = $2
      `,
        [userId, agentId]
      );

      let processed = 0;
      let decayed = 0;
      let removed = 0;

      for (const row of result.rows) {
        processed++;
        
        const ageMs = Date.now() - new Date(row.last_accessed_at).getTime();
        const ageDays = ageMs / (24 * 60 * 60 * 1000);
        
        // Apply decay formula
        const decayFactor = Math.exp(-decayRules.decayRate * ageDays);
        const importanceBoost = parseFloat(row.importance) * decayRules.importanceWeight;
        const accessBoost = Math.log(row.access_count + 1) * decayRules.accessBoost;
        
        const newResonance = Math.max(
          0,
          parseFloat(row.resonance) * decayFactor + importanceBoost + accessBoost
        );

        if (newResonance <= 0.01) {
          // Remove memory
          await client.query(
            `DELETE FROM ${this.schema}.memories WHERE id = $1`,
            [row.id]
          );
          removed++;
        } else if (newResonance !== parseFloat(row.resonance)) {
          // Update resonance
          await client.query(
            `
            UPDATE ${this.schema}.memories 
            SET resonance = $1
            WHERE id = $2
          `,
            [newResonance, row.id]
          );
          decayed++;
        }
      }

      await client.query('COMMIT');

      logger.debug(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Decay applied',
        {
          agentId,
          processed,
          decayed,
          removed
        }
      );

      return { processed, decayed, removed };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create memory connections in batch
   */
  async createConnections(userId: string, connections: MemoryConnection[]): Promise<void> {
    if (connections.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      connections.forEach((conn) => {
        placeholders.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 
           $${paramIndex++}::${this.schema}.connection_type, $${paramIndex++}, 
           $${paramIndex++}, to_timestamp($${paramIndex++}))`
        );

        values.push(
          conn.id,
          conn.sourceMemoryId,
          conn.targetMemoryId,
          conn.connectionType,
          conn.strength,
          conn.reason || null,
          conn.createdAt / 1000
        );
      });

      const insertQuery = `
        INSERT INTO ${this.schema}.memory_connections (
          id, source_memory_id, target_memory_id, connection_type, 
          strength, reason, created_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (source_memory_id, target_memory_id) 
        DO UPDATE SET 
          strength = GREATEST(memory_connections.strength, EXCLUDED.strength),
          reason = COALESCE(EXCLUDED.reason, memory_connections.reason)
      `;

      await client.query(insertQuery, values);
      await client.query('COMMIT');

      logger.debug(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Created memory connections',
        { count: connections.length }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find connected memories with traversal
   */
  async findConnectedMemories(
    userId: string,
    memoryId: string,
    depth: number = 2,
    minStrength: number = 0.5
  ): Promise<{
    memories: Memory[];
    connections: MemoryConnection[];
  }> {
    const client = await this.pool.connect();
    try {
      // Recursive CTE for graph traversal
      const result = await client.query(
        `
        WITH RECURSIVE memory_graph AS (
          -- Base case: start memory
          SELECT m.*, 0 as depth, ARRAY[m.id] as path
          FROM ${this.schema}.memories m
          WHERE m.user_id = $1 AND m.id = $2
          
          UNION ALL
          
          -- Recursive case: connected memories
          SELECT m.*, mg.depth + 1, mg.path || m.id
          FROM ${this.schema}.memories m
          JOIN ${this.schema}.memory_connections mc 
            ON (m.id = mc.target_memory_id OR m.id = mc.source_memory_id)
          JOIN memory_graph mg 
            ON (mg.id = mc.source_memory_id OR mg.id = mc.target_memory_id)
          WHERE mg.depth < $3
            AND mc.strength >= $4
            AND NOT m.id = ANY(mg.path)
            AND m.user_id = $1
        )
        SELECT DISTINCT ON (id) *,
          extract(epoch from created_at) * 1000 as created_at_ms,
          extract(epoch from updated_at) * 1000 as updated_at_ms,
          extract(epoch from last_accessed_at) * 1000 as last_accessed_at_ms
        FROM memory_graph
        ORDER BY id, depth
      `,
        [userId, memoryId, depth, minStrength]
      );

      // Get connections
      const memoryIds = result.rows.map(r => r.id);
      const connectionsResult = await client.query(
        `
        SELECT *,
          extract(epoch from created_at) * 1000 as created_at_ms
        FROM ${this.schema}.memory_connections
        WHERE source_memory_id = ANY($1)
          AND target_memory_id = ANY($1)
          AND strength >= $2
      `,
        [memoryIds, minStrength]
      );

      const memories = result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        importance: parseFloat(row.importance),
        resonance: parseFloat(row.resonance),
        accessCount: row.access_count,
        createdAt: parseFloat(row.created_at_ms),
        updatedAt: parseFloat(row.updated_at_ms),
        lastAccessedAt: parseFloat(row.last_accessed_at_ms),
        sessionId: row.session_id,
        keywords: row.keywords,
        metadata: row.metadata,
        extractionMethod: row.extraction_method,
        tokenCount: row.token_count,
        batchId: row.batch_id,
        sourceMessageIds: row.source_message_ids,
        embeddingId: row.embedding_id,
        embeddingModel: row.embedding_model,
        embeddingDimension: row.embedding_dimension
      }));

      const connections = connectionsResult.rows.map(row => ({
        id: row.id,
        sourceMemoryId: row.source_memory_id,
        targetMemoryId: row.target_memory_id,
        connectionType: row.connection_type,
        strength: parseFloat(row.strength),
        reason: row.reason,
        createdAt: parseFloat(row.created_at_ms)
      }));

      return { memories, connections };
    } finally {
      client.release();
    }
  }

  /**
   * Get a single memory by ID
   */
  async getMemoryById(userId: string, memoryId: string): Promise<Memory | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT *,
          extract(epoch from created_at) * 1000 as created_at_ms,
          extract(epoch from updated_at) * 1000 as updated_at_ms,
          extract(epoch from last_accessed_at) * 1000 as last_accessed_at_ms
        FROM ${this.schema}.memories
        WHERE user_id = $1 AND id = $2
      `,
        [userId, memoryId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        importance: parseFloat(row.importance),
        resonance: parseFloat(row.resonance),
        accessCount: row.access_count,
        createdAt: parseFloat(row.created_at_ms),
        updatedAt: parseFloat(row.updated_at_ms),
        lastAccessedAt: parseFloat(row.last_accessed_at_ms),
        sessionId: row.session_id,
        keywords: row.keywords,
        metadata: row.metadata,
        extractionMethod: row.extraction_method,
        tokenCount: row.token_count,
        batchId: row.batch_id,
        sourceMessageIds: row.source_message_ids,
        embeddingId: row.embedding_id,
        embeddingModel: row.embedding_model,
        embeddingDimension: row.embedding_dimension
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update a memory with partial data
   */
  async updateMemory(userId: string, agentId: string, memoryId: string, updates: Partial<Memory>): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Always update the updated_at timestamp
      updates.updatedAt = Date.now();

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && key !== 'id') {
          switch (key) {
            case 'agentId':
              updateFields.push(`agent_id = $${paramIndex++}`);
              values.push(value);
              break;
            case 'userId':
              updateFields.push(`user_id = $${paramIndex++}`);
              values.push(value);
              break;
            case 'sessionId':
              updateFields.push(`session_id = $${paramIndex++}`);
              values.push(value);
              break;
            case 'accessCount':
              updateFields.push(`access_count = $${paramIndex++}`);
              values.push(value);
              break;
            case 'createdAt':
              updateFields.push(`created_at = to_timestamp($${paramIndex++})`);
              values.push(Number(value) / 1000);
              break;
            case 'updatedAt':
              updateFields.push(`updated_at = to_timestamp($${paramIndex++})`);
              values.push(Number(value) / 1000);
              break;
            case 'lastAccessedAt':
              updateFields.push(`last_accessed_at = to_timestamp($${paramIndex++})`);
              values.push(Number(value) / 1000);
              break;
            case 'keywords':
              updateFields.push(`keywords = $${paramIndex++}::jsonb`);
              values.push(JSON.stringify(value));
              break;
            case 'metadata':
              updateFields.push(`metadata = $${paramIndex++}::jsonb`);
              values.push(JSON.stringify(value));
              break;
            case 'sourceMessageIds':
              updateFields.push(`source_message_ids = $${paramIndex++}::jsonb`);
              values.push(JSON.stringify(value));
              break;
            case 'tokenCount':
              updateFields.push(`token_count = $${paramIndex++}`);
              values.push(value);
              break;
            case 'embeddingId':
              updateFields.push(`embedding_id = $${paramIndex++}`);
              values.push(value);
              break;
            case 'embeddingModel':
              updateFields.push(`embedding_model = $${paramIndex++}`);
              values.push(value);
              break;
            case 'embeddingDimension':
              updateFields.push(`embedding_dimension = $${paramIndex++}`);
              values.push(value);
              break;
            case 'extractionMethod':
              updateFields.push(`extraction_method = $${paramIndex++}`);
              values.push(value);
              break;
            case 'batchId':
              updateFields.push(`batch_id = $${paramIndex++}`);
              values.push(value);
              break;
            default:
              // Handle direct column names
              updateFields.push(`${key} = $${paramIndex++}`);
              values.push(value);
              break;
          }
        }
      }

      if (updateFields.length === 0) {
        logger.warn(
          LogCategory.STORAGE,
          'MemoryOperations',
          'No valid fields to update',
          { userId, agentId, memoryId }
        );
        return;
      }

      values.push(userId, agentId, memoryId); // Add userId, agentId, and memoryId as the last parameters

      const updateQuery = `
        UPDATE ${this.schema}.memories 
        SET ${updateFields.join(', ')}
        WHERE user_id = $${paramIndex} AND agent_id = $${paramIndex + 1} AND id = $${paramIndex + 2}
      `;

      const result = await client.query(updateQuery, values);

      if (result.rowCount === 0) {
        throw new Error(`Memory with ID ${memoryId} not found`);
      }

      logger.debug(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Memory updated successfully',
        { userId, agentId, memoryId, updatedFields: updateFields.length }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(userId: string, agentId: string, memoryId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // First delete any connections involving this memory
      await client.query(
        `
        DELETE FROM ${this.schema}.memory_connections 
        WHERE source_memory_id = $1 OR target_memory_id = $1
      `,
        [memoryId]
      );

      // Then delete the memory itself
      const result = await client.query(
        `DELETE FROM ${this.schema}.memories WHERE user_id = $1 AND agent_id = $2 AND id = $3`,
        [userId, agentId, memoryId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Memory with ID ${memoryId} not found`);
      }

      await client.query('COMMIT');

      logger.debug(
        LogCategory.STORAGE,
        'MemoryOperations',
        'Memory deleted successfully',
        { userId, agentId, memoryId }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find similar memories using vector similarity search
   */
  async findSimilar(
    userId: string,
    agentId: string,
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Memory[]> {
    const client = await this.pool.connect();
    try {
      const vectorStr = `[${embedding.join(',')}]`;
      
      const result = await client.query(`
        SELECT m.*, 
               1 - (m.embedding <=> $4::vector) as similarity
        FROM ${this.schema}.memories m
        WHERE m.user_id = $1
          AND m.agent_id = $2
          AND m.embedding IS NOT NULL
          AND 1 - (m.embedding <=> $4::vector) > $5
        ORDER BY m.embedding <=> $4::vector
        LIMIT $3
      `, [userId, agentId, limit, vectorStr, threshold]);
      
      return result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        content: row.content,
        type: row.type,
        importance: parseFloat(row.importance),
        resonance: parseFloat(row.resonance),
        accessCount: row.access_count,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        lastAccessedAt: new Date(row.last_accessed_at).getTime(),
        sessionId: row.session_id,
        keywords: row.keywords,
        metadata: row.metadata,
        extractionMethod: row.extraction_method,
        tokenCount: row.token_count,
        batchId: row.batch_id,
        sourceMessageIds: row.source_message_ids,
        embeddingId: row.embedding_id,
        embeddingModel: row.embedding_model,
        embeddingDimension: row.embedding_dimension
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get connections for a list of memories
   */
  async getConnectionsForMemories(
    userId: string,
    memoryIds: string[]
  ): Promise<MemoryConnection[]> {
    if (memoryIds.length === 0) return [];
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT c.*,
               extract(epoch from c.created_at) * 1000 as created_at_ms
        FROM ${this.schema}.memory_connections c
        JOIN ${this.schema}.memories m1 ON c.source_memory_id = m1.id
        JOIN ${this.schema}.memories m2 ON c.target_memory_id = m2.id
        WHERE (c.source_memory_id = ANY($1) OR c.target_memory_id = ANY($1))
          AND m1.user_id = $2
          AND m2.user_id = $2
      `, [memoryIds, userId]);
      
      return result.rows.map(row => ({
        id: row.id,
        sourceMemoryId: row.source_memory_id,
        targetMemoryId: row.target_memory_id,
        connectionType: row.connection_type,
        strength: parseFloat(row.strength),
        reason: row.reason,
        createdAt: parseFloat(row.created_at_ms)
      }));
    } finally {
      client.release();
    }
  }
}