/**
 * @fileoverview SQLite-Vec Memory Operations with Hybrid Search
 *
 * Extends SQLite memory operations with vector + FTS5 BM25 hybrid search.
 * Uses native SQLite FTS5 BM25 function (no TypeScript implementation needed).
 *
 * TODO: For vector-only adapters (ChromaDB, Pinecone, Qdrant) that need text search,
 * TypeScript BM25 implementation is available using 'okapibm25' package if required.
 */

import { Database } from 'better-sqlite3';

import { LogCategory, logger } from '../../../../logging';
import {
  MemoryData,
  MemoryRecallOptions,
  VectorMemoryOperations
} from '../../../types';
import { SqliteMemoryOperations } from '../../sqlite/operations/memory';

interface VectorSearchResult {
  id: string;
  vector_similarity: number;
}

interface TextSearchResult {
  id: string;
  text_score: number;
}

interface HybridSearchOptions extends MemoryRecallOptions {
  vectorWeight?: number; // Default 0.7
  textWeight?: number; // Default 0.3
  vectorThreshold?: number; // Default 0.7
}

/**
 * SQLite-Vec memory operations with hybrid vector + FTS5 search
 */
export class SQLiteVecMemoryOperations
  extends SqliteMemoryOperations
  implements VectorMemoryOperations
{
  constructor(db: Database) {
    super(db);
  }

  /**
   * Store memory with embedding support
   */
  async storeMemoryWithEmbedding(
    userId: string,
    agentId: string,
    memory: MemoryData,
    embedding: number[]
  ): Promise<string> {
    const memoryId = await this.store(userId, agentId, memory);

    // Store embedding in vector table (if vector operations are available)
    try {
      await this.storeEmbedding(memoryId, embedding);
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Failed to store embedding, continuing without vector search',
        {
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }

    return memoryId;
  }

  /**
   * Hybrid search: Vector similarity + FTS5 BM25 text search
   */
  async hybridSearch(
    userId: string,
    agentId: string,
    query: string,
    queryEmbedding: number[],
    options: HybridSearchOptions = {}
  ): Promise<MemoryData[]> {
    if (!userId?.trim()) {
      throw new Error('userId is required for memory operations');
    }

    const vectorWeight = options.vectorWeight || 0.7;
    const textWeight = options.textWeight || 0.3;
    const vectorThreshold = options.vectorThreshold || 0.7;
    const limit = options.limit || 20;

    try {
      // Run vector and text searches in parallel
      const [vectorResults, textResults] = await Promise.all([
        this.searchByVector(userId, agentId, queryEmbedding, options),
        this.searchByText(userId, agentId, query, options)
      ]);

      // Hybrid fusion using Reciprocal Rank Fusion (RRF)
      const fusedResults = this.fuseResults(
        vectorResults,
        textResults,
        vectorWeight,
        textWeight,
        limit
      );

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Hybrid search completed',
        {
          userId: userId.substring(0, 8),
          agentId,
          query: query.substring(0, 50),
          vectorResults: vectorResults.length,
          textResults: textResults.length,
          fusedResults: fusedResults.length
        }
      );

      return fusedResults;
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Hybrid search failed',
        {
          userId: userId.substring(0, 8),
          agentId,
          query: query.substring(0, 50),
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Vector similarity search
   */
  async searchByVector(
    userId: string,
    agentId: string,
    queryEmbedding: number[],
    options: HybridSearchOptions = {}
  ): Promise<MemoryData[]> {
    const threshold = options.vectorThreshold || 0.7;
    const limit = options.limit || 20;
    const collectionName = 'memory_embeddings';

    try {
      // Convert query vector to JSON for sqlite-vec
      const queryVectorJson = JSON.stringify(queryEmbedding);

      // Search using sqlite-vec with distance threshold
      const stmt = (this as any).db.prepare(`
        SELECT 
          m.*,
          v.distance as vector_distance,
          (1.0 - v.distance) as vector_similarity
        FROM memories m
        JOIN ${collectionName} v ON m.id = v.rowid
        WHERE v.embedding MATCH ?
          AND m.user_id = ? 
          AND m.agent_id = ?
          AND v.distance <= ?
        ORDER BY v.distance ASC
        LIMIT ?
      `);

      const maxDistance = 1.0 - threshold; // Convert similarity threshold to distance
      const rows = stmt.all(
        queryVectorJson,
        userId,
        agentId,
        maxDistance,
        limit
      ) as any[];

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Vector search completed',
        {
          userId: userId.substring(0, 8),
          agentId,
          queryDimensions: queryEmbedding.length,
          threshold,
          results: rows.length
        }
      );

      return rows.map((row) => (this as any).convertRowToMemoryData(row));
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Vector search failed, falling back to regular search',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      // Fallback to regular text search
      return this.recall(userId, agentId, '', options);
    }
  }

  /**
   * FTS5 BM25 text search using native SQLite function
   */
  async searchByText(
    userId: string,
    agentId: string,
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<MemoryData[]> {
    const limit = options.limit || 20;

    try {
      // Use native SQLite FTS5 BM25 function - COMPLETE IMPLEMENTATION
      const stmt = (this as any).db.prepare(`
        SELECT 
          m.*,
          bm25(memories_fts) as text_score
        FROM memories m
        JOIN memories_fts f ON m.id = f.rowid
        WHERE f.content MATCH ?
          AND m.user_id = ?
          AND m.agent_id = ?
        ORDER BY bm25(memories_fts) DESC
        LIMIT ?
      `);

      const rows = stmt.all(query, userId, agentId, limit) as any[];

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'FTS5 BM25 search completed',
        {
          userId: userId.substring(0, 8),
          agentId,
          query: query.substring(0, 50),
          results: rows.length
        }
      );

      return rows.map((row) => (this as any).convertRowToMemoryData(row));
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'FTS5 search failed, falling back to LIKE search',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      // Fallback to basic LIKE search
      return this.recall(userId, agentId, query, options);
    }
  }

  /**
   * Find similar memories by embedding
   */
  async findSimilarMemories(
    userId: string,
    agentId: string,
    embedding: number[],
    threshold: number = 0.8
  ): Promise<MemoryData[]> {
    return this.searchByVector(userId, agentId, embedding, {
      vectorThreshold: threshold,
      limit: 10
    });
  }

  /**
   * Update memory embedding
   */
  async updateMemoryEmbedding(
    userId: string,
    memoryId: string,
    embedding: number[]
  ): Promise<void> {
    await this.storeEmbedding(memoryId, embedding);
  }

  /**
   * Get memory embedding
   */
  async getMemoryEmbedding(
    userId: string,
    memoryId: string
  ): Promise<number[] | null> {
    const collectionName = 'memory_embeddings';

    try {
      // First verify the memory belongs to the user for security
      const memoryExists = await this.getById(userId, memoryId);
      if (!memoryExists) {
        return null;
      }

      // Get embedding from vector collection
      const stmt = (this as any).db.prepare(
        `SELECT embedding FROM ${collectionName} WHERE rowid = ?`
      );
      const row = stmt.get(memoryId) as { embedding: string } | undefined;

      if (!row) {
        logger.debug(
          LogCategory.STORAGE,
          'SQLiteVecMemoryOps',
          'No embedding found for memory',
          { memoryId }
        );
        return null;
      }

      // Parse the JSON vector
      const embedding = JSON.parse(row.embedding) as number[];

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Retrieved embedding for memory',
        {
          memoryId,
          dimensions: embedding.length
        }
      );

      return embedding;
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Failed to get memory embedding',
        {
          memoryId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return null;
    }
  }

  /**
   * Store embedding in vector table
   */
  private async storeEmbedding(
    memoryId: string,
    embedding: number[]
  ): Promise<void> {
    const collectionName = 'memory_embeddings';

    try {
      // Ensure collection exists before storing
      await this.ensureMemoryVectorCollection(embedding.length);

      // Convert embedding to JSON for sqlite-vec
      const embeddingJson = JSON.stringify(embedding);

      // Store in the vec0 virtual table using memory ID as rowid
      const stmt = (this as any).db.prepare(
        `INSERT OR REPLACE INTO ${collectionName}(rowid, embedding) VALUES (?, ?)`
      );
      stmt.run(memoryId, embeddingJson);

      logger.debug(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Stored embedding for memory',
        {
          memoryId,
          dimensions: embedding.length
        }
      );
    } catch (error) {
      logger.error(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Failed to store embedding',
        {
          memoryId,
          dimensions: embedding.length,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Ensure memory vector collection exists
   */
  private async ensureMemoryVectorCollection(dimension: number): Promise<void> {
    const collectionName = 'memory_embeddings';

    try {
      // Check if collection exists
      const existsStmt = (this as any).db.prepare(
        'SELECT 1 FROM vec_collections WHERE name = ? LIMIT 1'
      );
      const exists = existsStmt.get(collectionName);

      if (!exists) {
        // Create the collection
        const createTableSQL = `CREATE VIRTUAL TABLE IF NOT EXISTS ${collectionName} USING vec0(embedding float[${dimension}])`;
        (this as any).db.prepare(createTableSQL).run();

        // Track in metadata
        const insertMetadata = (this as any).db.prepare(
          `INSERT OR REPLACE INTO vec_collections (name, dimension, metric) VALUES (?, ?, ?)`
        );
        insertMetadata.run(collectionName, dimension, 'cosine');

        logger.info(
          LogCategory.STORAGE,
          'SQLiteVecMemoryOps',
          `Created memory vector collection with ${dimension} dimensions`
        );
      }
    } catch (error) {
      logger.warn(
        LogCategory.STORAGE,
        'SQLiteVecMemoryOps',
        'Failed to ensure memory vector collection exists',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      // Don't throw - allow memory storage to continue without vectors
    }
  }

  /**
   * Reciprocal Rank Fusion for combining vector and text results
   */
  private fuseResults(
    vectorResults: MemoryData[],
    textResults: MemoryData[],
    vectorWeight: number,
    textWeight: number,
    limit: number
  ): MemoryData[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { memory: MemoryData; score: number }>();

    // Add vector results with RRF scoring
    vectorResults.forEach((memory, index) => {
      const rank = index + 1;
      const score = vectorWeight * (1 / (k + rank));
      scoreMap.set(memory.id, { memory, score });
    });

    // Add text results with RRF scoring
    textResults.forEach((memory, index) => {
      const rank = index + 1;
      const textScore = textWeight * (1 / (k + rank));

      const existing = scoreMap.get(memory.id);
      if (existing) {
        existing.score += textScore; // Combine scores
      } else {
        scoreMap.set(memory.id, { memory, score: textScore });
      }
    });

    // Sort by combined score and return top results
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }
}
