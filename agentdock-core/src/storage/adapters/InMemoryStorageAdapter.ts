/**
 * In-memory storage adapter for testing purposes
 *
 * This adapter stores all data in memory and is primarily used for unit tests
 * and development. Data is not persisted between restarts.
 */

import { MemoryData } from '../../memory/base-types';
import { Memory, MemoryType } from '../../memory/types';
import {
  MemoryConnection,
  MemoryOperations,
  StorageOptions,
  StorageProvider,
  VectorMemoryOperations
} from '../types';

export class InMemoryStorageAdapter implements StorageProvider {
  private data = new Map<string, any>();
  private memories = new Map<string, MemoryData>();
  private connections = new Map<string, MemoryConnection>();

  constructor() {
    // Initialize memory operations
    this.memory = new InMemoryMemoryOperations(this.memories, this.connections);
  }

  memory: MemoryOperations & Partial<VectorMemoryOperations>;

  async get(key: string): Promise<any> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string, options?: StorageOptions): Promise<boolean> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed;
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.data.keys());
    if (!pattern) return allKeys;

    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter((key) => regex.test(key));
  }

  async clear(): Promise<void> {
    this.data.clear();
    this.memories.clear();
    this.connections.clear();
  }

  async destroy(): Promise<void> {
    await this.clear();
  }

  async exists(key: string, options?: StorageOptions): Promise<boolean> {
    return this.data.has(key);
  }

  async getMany<T>(
    keys: string[],
    options?: StorageOptions
  ): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    for (const key of keys) {
      result[key] = this.data.get(key) || null;
    }
    return result;
  }

  async setMany<T>(
    items: Record<string, T>,
    options?: StorageOptions
  ): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.data.set(key, value);
    }
  }

  async deleteMany(keys: string[], options?: StorageOptions): Promise<number> {
    let deletedCount = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async list(prefix: string, options?: any): Promise<string[]> {
    return Array.from(this.data.keys()).filter((key) => key.startsWith(prefix));
  }

  async getList<T>(
    key: string,
    start?: number,
    end?: number,
    options?: StorageOptions
  ): Promise<T[] | null> {
    const value = this.data.get(key);
    if (!Array.isArray(value)) return null;

    const startIndex = start || 0;
    const endIndex = end === -1 ? value.length : end || value.length;
    return value.slice(startIndex, endIndex + 1);
  }

  async saveList<T>(
    key: string,
    values: T[],
    options?: StorageOptions
  ): Promise<void> {
    this.data.set(key, values);
  }

  async deleteList(key: string, options?: StorageOptions): Promise<boolean> {
    return this.delete(key, options);
  }
}

class InMemoryMemoryOperations
  implements MemoryOperations, VectorMemoryOperations
{
  constructor(
    private memories: Map<string, MemoryData>,
    private connections: Map<string, MemoryConnection>
  ) {}

  async store(
    userId: string,
    agentId: string,
    memory: Memory
  ): Promise<string> {
    const id =
      memory.id ||
      `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const memoryData: MemoryData = {
      ...memory,
      id,
      userId,
      agentId,
      createdAt: memory.createdAt || Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      resonance: memory.resonance || 0.5,
      importance: memory.importance || 0.5
    };

    this.memories.set(id, memoryData);
    return id;
  }

  async recall(
    userId: string,
    agentId: string,
    query: string,
    options?: { type?: MemoryType; limit?: number }
  ): Promise<MemoryData[]> {
    const limit = options?.limit || 20;
    const type = options?.type;

    const results = Array.from(this.memories.values())
      .filter(
        (memory) =>
          memory.userId === userId &&
          memory.agentId === agentId &&
          (!type || memory.type === type) &&
          (!query || memory.content.toLowerCase().includes(query.toLowerCase()))
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Update access counts
    results.forEach((memory) => {
      memory.accessCount = (memory.accessCount || 0) + 1;
      memory.lastAccessedAt = Date.now();
    });

    return results;
  }

  async update(
    userId: string,
    agentId: string,
    memoryId: string,
    updates: Partial<MemoryData>
  ): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory && memory.userId === userId && memory.agentId === agentId) {
      Object.assign(memory, updates, { updatedAt: Date.now() });
    }
  }

  async delete(
    userId: string,
    agentId: string,
    memoryId: string
  ): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory && memory.userId === userId && memory.agentId === agentId) {
      this.memories.delete(memoryId);
    }
  }

  async getById(userId: string, memoryId: string): Promise<MemoryData | null> {
    const memory = this.memories.get(memoryId);
    return memory && memory.userId === userId ? memory : null;
  }

  async getStats(userId: string, agentId?: string): Promise<any> {
    const userMemories = Array.from(this.memories.values()).filter(
      (memory) =>
        memory.userId === userId && (!agentId || memory.agentId === agentId)
    );

    return {
      totalMemories: userMemories.length,
      memoryTypes: userMemories.reduce(
        (acc, memory) => {
          acc[memory.type] = (acc[memory.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      totalConnections: Array.from(this.connections.values()).length,
      lastUpdated: Date.now()
    };
  }

  async createConnection(
    userId: string,
    connection: MemoryConnection
  ): Promise<void> {
    this.connections.set(connection.id, { ...connection, userId } as any);
  }

  async createConnections(
    userId: string,
    connections: MemoryConnection[]
  ): Promise<void> {
    for (const connection of connections) {
      await this.createConnection(userId, connection);
    }
  }

  async getConnections(
    userId: string,
    memoryId: string
  ): Promise<MemoryConnection[]> {
    return Array.from(this.connections.values()).filter(
      (conn: any) =>
        conn.userId === userId &&
        (conn.sourceMemoryId === memoryId || conn.targetMemoryId === memoryId)
    );
  }

  async findConnectedMemories(
    userId: string,
    memoryId: string,
    depth: number = 1
  ): Promise<{ memories: MemoryData[]; connections: MemoryConnection[] }> {
    const visited = new Set<string>();
    const resultMemories: MemoryData[] = [];
    const resultConnections: MemoryConnection[] = [];

    const traverse = async (currentId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      const connections = await this.getConnections(userId, currentId);
      for (const conn of connections) {
        resultConnections.push(conn);
        if (currentDepth < depth) {
          // Get the target memory (the one we're connecting TO)
          const targetId =
            conn.sourceMemoryId === currentId
              ? conn.targetMemoryId
              : conn.sourceMemoryId;
          const memory = await this.getById(userId, targetId);
          if (memory) {
            resultMemories.push(memory);
            await traverse(targetId, currentDepth + 1);
          }
        }
      }
    };

    await traverse(memoryId, 0);
    return { memories: resultMemories, connections: resultConnections };
  }

  async batchUpdateMemories(
    updates: Array<{
      id: string;
      resonance: number;
      lastAccessedAt: number;
      accessCount: number;
    }>
  ): Promise<void> {
    for (const update of updates) {
      const memory = this.memories.get(update.id);
      if (memory) {
        memory.resonance = update.resonance;
        memory.lastAccessedAt = update.lastAccessedAt;
        memory.accessCount = update.accessCount;
        memory.updatedAt = Date.now();
      }
    }
  }

  // Vector operations
  async storeMemoryWithEmbedding(
    userId: string,
    agentId: string,
    memory: any,
    embedding: number[]
  ): Promise<string> {
    const memoryWithEmbedding = {
      ...memory,
      embeddingId: `emb_${Date.now()}`, // Use embeddingId instead of embedding
      userId,
      agentId
    };
    return this.store(userId, agentId, memoryWithEmbedding);
  }

  async searchByVector(
    userId: string,
    agentId: string,
    queryVector: number[],
    options?: { threshold?: number; limit?: number }
  ): Promise<MemoryData[]> {
    // For testing purposes, just return recent memories
    return this.recall(userId, agentId, '', { limit: options?.limit || 20 });
  }

  async findSimilarMemories(
    userId: string,
    agentId: string,
    embedding: number[],
    threshold?: number
  ): Promise<MemoryData[]> {
    return this.searchByVector(userId, agentId, embedding, {
      threshold,
      limit: 20
    });
  }

  async hybridSearch(
    userId: string,
    agentId: string,
    query: string,
    queryVector: number[],
    options?: { threshold?: number; limit?: number }
  ): Promise<MemoryData[]> {
    const textResults = await this.recall(userId, agentId, query, options);
    return textResults.slice(0, options?.limit || 20);
  }

  async updateMemoryEmbedding(
    userId: string,
    memoryId: string,
    embedding: number[]
  ): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (memory && memory.userId === userId) {
      memory.embeddingId = `emb_${Date.now()}`;
      memory.updatedAt = Date.now();
    }
  }

  async getMemoryEmbedding(
    userId: string,
    memoryId: string
  ): Promise<number[] | null> {
    const memory = this.memories.get(memoryId);
    // Return null since we don't store actual embeddings in this test adapter
    return null;
  }

  async vectorSearch(
    userId: string,
    agentId: string,
    queryVector: number[],
    options?: { threshold?: number; limit?: number }
  ): Promise<MemoryData[]> {
    return this.searchByVector(userId, agentId, queryVector, options);
  }
}
