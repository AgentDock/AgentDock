/**
 * Enhanced Mock Storage Provider for Memory Testing
 *
 * Implements proper user isolation and memory operations for comprehensive testing
 */

import {
  MemoryData,
  MemoryOperations,
  MemoryOperationStats,
  MemoryRecallOptions,
  MemoryUpdate,
  StorageProvider
} from '../../../storage/types';
import { MemoryType } from '../../types';

export class MockStorageProvider implements StorageProvider {
  private data = new Map<string, any>();
  private memories = new Map<string, Map<string, MemoryData[]>>(); // userId -> agentId -> memories[]

  // Basic storage operations
  async get<T>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    for (const key of keys) {
      result[key] = this.data.get(key) || null;
    }
    return result;
  }

  async setMany<T>(items: Record<string, T>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.data.set(key, value);
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
    }
    return count;
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.data.keys()).filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.data.clear();
    this.memories.clear();
  }

  async getList<T>(key: string): Promise<T[] | null> {
    return null;
  }

  async saveList<T>(key: string, values: T[]): Promise<void> {}

  async deleteList(key: string): Promise<boolean> {
    return false;
  }

  // Memory operations with strict user isolation
  memory: MemoryOperations = {
    store: async (
      userId: string,
      agentId: string,
      memory: MemoryData
    ): Promise<string> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');
      if (!agentId?.trim())
        throw new Error('agentId is required for memory operations');

      // Get or create user's memory space
      if (!this.memories.has(userId)) {
        this.memories.set(userId, new Map());
      }
      const userMemories = this.memories.get(userId)!;

      // Get or create agent's memory space for this user
      if (!userMemories.has(agentId)) {
        userMemories.set(agentId, []);
      }
      const agentMemories = userMemories.get(agentId)!;

      // Create memory with ID if not provided
      const storedMemory: MemoryData = {
        ...memory,
        id: memory.id || this.generateId(),
        userId,
        agentId,
        updatedAt: Date.now()
      };

      agentMemories.push(storedMemory);
      return storedMemory.id!;
    },

    recall: async (
      userId: string,
      agentId: string,
      query: string,
      options?: MemoryRecallOptions
    ): Promise<MemoryData[]> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');
      if (!agentId?.trim())
        throw new Error('agentId is required for memory operations');

      const userMemories = this.memories.get(userId);
      if (!userMemories) return [];

      const agentMemories = userMemories.get(agentId);
      if (!agentMemories) return [];

      let filtered = agentMemories;

      // Apply type filter
      if (options?.type) {
        filtered = filtered.filter((m) => m.type === options.type);
      }

      // Apply query filter (search content, keywords, and tags)
      if (query?.trim()) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.content.toLowerCase().includes(lowerQuery) ||
            (m.keywords &&
              m.keywords.some((k) => k.toLowerCase().includes(lowerQuery))) ||
            (m.metadata?.tags &&
              Array.isArray(m.metadata.tags) &&
              m.metadata.tags.some((t) => t.toLowerCase().includes(lowerQuery)))
        );
      }

      // Apply time range filter
      if (options?.timeRange) {
        const start = options.timeRange.start.getTime();
        const end = options.timeRange.end.getTime();
        filtered = filtered.filter(
          (m) => m.createdAt >= start && m.createdAt <= end
        );
      }

      // Apply importance filter
      if (options?.minImportance !== undefined) {
        filtered = filtered.filter(
          (m) => m.importance >= options.minImportance!
        );
      }

      // Sort by relevance (most recent + importance)
      filtered.sort((a, b) => {
        const scoreA = a.importance * 0.5 + (a.createdAt / Date.now()) * 0.5;
        const scoreB = b.importance * 0.5 + (b.createdAt / Date.now()) * 0.5;
        return scoreB - scoreA;
      });

      // Apply limit
      const limit = options?.limit || 20;
      return filtered.slice(0, limit);
    },

    update: async (
      userId: string,
      agentId: string,
      memoryId: string,
      updates: Partial<MemoryData>
    ): Promise<void> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');

      const userMemories = this.memories.get(userId);
      if (!userMemories) return;

      const agentMemories = userMemories.get(agentId);
      if (!agentMemories) return;

      const index = agentMemories.findIndex((m) => m.id === memoryId);
      if (index !== -1) {
        agentMemories[index] = {
          ...agentMemories[index],
          ...updates,
          updatedAt: Date.now()
        };
      }
    },

    delete: async (
      userId: string,
      agentId: string,
      memoryId: string
    ): Promise<void> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');

      const userMemories = this.memories.get(userId);
      if (!userMemories) return;

      const agentMemories = userMemories.get(agentId);
      if (!agentMemories) return;

      const index = agentMemories.findIndex((m) => m.id === memoryId);
      if (index !== -1) {
        agentMemories.splice(index, 1);
      }
    },

    getById: async (
      userId: string,
      memoryId: string
    ): Promise<MemoryData | null> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');

      const userMemories = this.memories.get(userId);
      if (!userMemories) return null;

      // Search through all agent memories for this user
      for (const agentMemories of userMemories.values()) {
        const memory = agentMemories.find((m) => m.id === memoryId);
        if (memory) return memory;
      }

      return null;
    },

    getStats: async (
      userId: string,
      agentId?: string
    ): Promise<MemoryOperationStats> => {
      if (!userId?.trim())
        throw new Error('userId is required for memory operations');

      const userMemories = this.memories.get(userId);
      if (!userMemories) {
        return {
          totalMemories: 0,
          byType: {},
          avgImportance: 0,
          totalSize: '0 KB'
        };
      }

      let allMemories: MemoryData[] = [];

      if (agentId) {
        // Stats for specific agent
        const agentMemories = userMemories.get(agentId);
        if (agentMemories) allMemories = agentMemories;
      } else {
        // Stats for all agents for this user
        for (const agentMemories of userMemories.values()) {
          allMemories.push(...agentMemories);
        }
      }

      const byType: Record<string, number> = {};
      let totalImportance = 0;

      for (const memory of allMemories) {
        byType[memory.type] = (byType[memory.type] || 0) + 1;
        totalImportance += memory.importance;
      }

      const totalSize = JSON.stringify(allMemories).length;

      return {
        totalMemories: allMemories.length,
        byType,
        avgImportance:
          allMemories.length > 0 ? totalImportance / allMemories.length : 0,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`
      };
    },

    batchUpdateMemories: async (updates: MemoryUpdate[]): Promise<void> => {
      // Batch update memories across all users/agents
      for (const update of updates) {
        // Find the memory in all user spaces
        for (const [userId, userMemories] of this.memories.entries()) {
          for (const [agentId, agentMemories] of userMemories.entries()) {
            const memoryIndex = agentMemories.findIndex(m => m.id === update.id);
            if (memoryIndex !== -1) {
              // Update the memory with decay values
              agentMemories[memoryIndex] = {
                ...agentMemories[memoryIndex],
                resonance: update.resonance,
                lastAccessedAt: update.lastAccessedAt,
                accessCount: update.accessCount,
                updatedAt: Date.now()
              };
              break; // Found and updated, move to next update
            }
          }
        }
      }
    }
  };

  // Test helpers
  getUserMemoryCount(userId: string, agentId?: string): number {
    const userMemories = this.memories.get(userId);
    if (!userMemories) return 0;

    if (agentId) {
      const agentMemories = userMemories.get(agentId);
      return agentMemories ? agentMemories.length : 0;
    } else {
      let total = 0;
      for (const agentMemories of userMemories.values()) {
        total += agentMemories.length;
      }
      return total;
    }
  }

  getAllUsersWithMemories(): string[] {
    return Array.from(this.memories.keys());
  }

  clearUserData(userId: string): void {
    this.memories.delete(userId);
  }

  getAllMemoriesForUser(userId: string): MemoryData[] {
    const userMemories = this.memories.get(userId);
    if (!userMemories) return [];

    const allMemories: MemoryData[] = [];
    for (const agentMemories of userMemories.values()) {
      allMemories.push(...agentMemories);
    }
    return allMemories;
  }

  // Alias for integration test compatibility
  getAllUserMemories(userId: string): Promise<MemoryData[]> {
    return Promise.resolve(this.getAllMemoriesForUser(userId));
  }

  private generateId(): string {
    return `mem_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
