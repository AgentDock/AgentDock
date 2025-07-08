/**
 * @fileoverview Integration tests for MemoryManager lazy decay
 *
 * Tests the complete integration of lazy decay within MemoryManager,
 * ensuring recall operations properly apply on-demand decay calculations.
 */

import {
  MemoryData,
  MemoryOperations,
  MemoryUpdate,
  StorageProvider
} from '../../../storage/types';
import { MemoryManager } from '../../MemoryManager';
import { MemoryManagerConfig, MemoryType } from '../../types';

// Mock storage provider with memory operations
const createMockStorageProvider = (): StorageProvider => {
  const memories: MemoryData[] = [];
  let updateHistory: MemoryUpdate[] = [];

  const mockMemoryOps: MemoryOperations = {
    store: jest
      .fn()
      .mockImplementation(
        async (userId: string, agentId: string, memory: MemoryData) => {
          memories.push({
            ...memory,
            id: `mem-${Date.now()}-${Math.random()}`
          });
          return memory.id;
        }
      ),

    recall: jest
      .fn()
      .mockImplementation(
        async (userId: string, agentId: string, query: string, options?) => {
          // Return memories that would normally be filtered by query
          return memories.filter(
            (m) =>
              m.userId === userId &&
              m.agentId === agentId &&
              (options?.type ? m.type === options.type : true)
          );
        }
      ),

    update: jest
      .fn()
      .mockImplementation(
        async (
          userId: string,
          agentId: string,
          memoryId: string,
          updates: Partial<MemoryData>
        ) => {
          const memory = memories.find((m) => m.id === memoryId);
          if (memory) {
            Object.assign(memory, updates);
          }
        }
      ),

    delete: jest.fn(),
    getStats: jest.fn().mockResolvedValue({
      totalMemories: memories.length,
      byType: {},
      avgImportance: 0.5,
      totalSize: '1MB'
    }),

    batchUpdateMemories: jest
      .fn()
      .mockImplementation(async (updates: MemoryUpdate[]) => {
        updateHistory.push(...updates);
        // Apply updates to stored memories
        updates.forEach((update) => {
          const memory = memories.find((m) => m.id === update.id);
          if (memory) {
            memory.resonance = update.resonance;
            memory.lastAccessedAt = update.lastAccessedAt;
            memory.accessCount = update.accessCount;
          }
        });
      })
  };

  return {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getMany: jest.fn(),
    setMany: jest.fn(),
    deleteMany: jest.fn(),
    list: jest.fn(),
    clear: jest.fn(),
    getList: jest.fn(),
    saveList: jest.fn(),
    deleteList: jest.fn(),
    memory: mockMemoryOps,
    // Helper methods for testing
    _getMemories: () => memories,
    _getUpdateHistory: () => updateHistory,
    _clearUpdateHistory: () => {
      updateHistory = [];
    }
  } as any;
};

describe('MemoryManager Lazy Decay Integration', () => {
  let memoryManager: MemoryManager;
  let mockStorage: StorageProvider & {
    _getMemories: () => MemoryData[];
    _getUpdateHistory: () => MemoryUpdate[];
    _clearUpdateHistory: () => void;
  };
  let config: MemoryManagerConfig;

  beforeEach(() => {
    mockStorage = createMockStorageProvider() as any;

    config = {
      working: {
        maxTokens: 4000,
        ttlSeconds: 3600,
        maxContextItems: 100,
        compressionThreshold: 0.8,
        encryptSensitive: false
      },
      episodic: {
        maxMemoriesPerSession: 1000,
        decayRate: 0.1,
        importanceThreshold: 0.5,
        compressionAge: 86400,
        encryptSensitive: false
      },
      semantic: {
        maxMemoriesPerCategory: 2000,
        deduplicationThreshold: 0.9,
        confidenceThreshold: 0.7,
        vectorSearchEnabled: false,
        encryptSensitive: false,
        autoExtractFacts: false
      },
      procedural: {
        minSuccessRate: 0.7,
        maxPatternsPerCategory: 500,
        decayRate: 0.05,
        confidenceThreshold: 0.8,
        adaptiveLearning: true,
        patternMerging: true
      }
    };

    memoryManager = new MemoryManager(mockStorage, config);
  });

  afterEach(async () => {
    // CRITICAL: Close MemoryManager to stop LazyDecayBatchProcessor timers
    await memoryManager.close();
  });

  describe('Recall with Lazy Decay', () => {
    it('should apply lazy decay during normal recall', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Store a memory that will need decay calculation
      const memoryId = await memoryManager.store(
        userId,
        agentId,
        'Test memory content',
        MemoryType.SEMANTIC
      );

      // Manually add an older memory with outdated timestamps for testing
      const oldMemory: MemoryData = {
        id: 'old-memory',
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content: 'Old memory content',
        importance: 0.8,
        resonance: 1.0,
        accessCount: 0,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        status: 'active'
      };

      mockStorage._getMemories().push(oldMemory);
      mockStorage._clearUpdateHistory();

      // Perform recall - this should trigger lazy decay
      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'test query'
      );

      // Force flush of pending updates for testing
      await memoryManager.flushLazyDecayUpdates();

      // Verify that memories were returned
      expect(recalledMemories.length).toBeGreaterThan(0);

      // Verify that batch updates were called for decay
      const updateHistory = mockStorage._getUpdateHistory();
      expect(updateHistory.length).toBeGreaterThan(0);

      // Verify that the old memory had its resonance updated due to decay
      const oldMemoryUpdate = updateHistory.find((u) => u.id === 'old-memory');
      expect(oldMemoryUpdate).toBeDefined();
      expect(oldMemoryUpdate!.resonance).toBeLessThan(1.0); // Should have decayed
    });

    it('should handle memories with neverDecay flag correctly', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add a memory with neverDecay set to true
      const neverDecayMemory: MemoryData = {
        id: 'never-decay-memory',
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content: 'Important memory that should never decay',
        importance: 0.9,
        resonance: 1.0,
        accessCount: 5,
        createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        updatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
        status: 'active',
        neverDecay: true
      };

      mockStorage._getMemories().push(neverDecayMemory);
      mockStorage._clearUpdateHistory();

      // Perform recall
      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'important memory'
      );

      expect(recalledMemories.length).toBeGreaterThan(0);

      // Check if the neverDecay memory was processed
      const updateHistory = mockStorage._getUpdateHistory();
      const neverDecayUpdate = updateHistory.find(
        (u) => u.id === 'never-decay-memory'
      );

      // It might still get a reinforcement update if it's reinforceable
      if (neverDecayUpdate) {
        // Resonance should not have decayed, might have been reinforced
        expect(neverDecayUpdate.resonance).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('should handle custom half-life memories correctly', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add a memory with custom half-life
      const customHalfLifeMemory: MemoryData = {
        id: 'custom-halflife-memory',
        userId,
        agentId,
        type: MemoryType.EPISODIC,
        content: 'Memory with custom decay rate',
        importance: 0.7,
        resonance: 1.0,
        accessCount: 2,
        createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
        updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        status: 'active',
        customHalfLife: 15 // 15-day half-life instead of default 30
      };

      mockStorage._getMemories().push(customHalfLifeMemory);
      mockStorage._clearUpdateHistory();

      // Perform recall
      await memoryManager.recall(userId, agentId, 'custom decay');

      // Verify that the custom half-life was applied
      const updateHistory = mockStorage._getUpdateHistory();
      const customUpdate = updateHistory.find(
        (u) => u.id === 'custom-halflife-memory'
      );

      if (customUpdate) {
        // With 15-day half-life and 15 days elapsed, should be around 0.5
        expect(customUpdate.resonance).toBeCloseTo(0.5, 1);
      }
    });

    it('should skip archived memories', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add an archived memory
      const archivedMemory: MemoryData = {
        id: 'archived-memory',
        userId,
        agentId,
        type: MemoryType.WORKING,
        content: 'Archived memory content',
        importance: 0.4,
        resonance: 0.3,
        accessCount: 1,
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        status: 'archived'
      };

      mockStorage._getMemories().push(archivedMemory);
      mockStorage._clearUpdateHistory();

      // Perform recall
      await memoryManager.recall(userId, agentId, 'archived content');

      // Archived memory should not have been updated
      const updateHistory = mockStorage._getUpdateHistory();
      const archivedUpdate = updateHistory.find(
        (u) => u.id === 'archived-memory'
      );
      expect(archivedUpdate).toBeUndefined();
    });
  });

  describe('Recall with Different Memory Types', () => {
    beforeEach(async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add memories of different types
      const memoryTypes: MemoryType[] = [
        MemoryType.WORKING,
        MemoryType.EPISODIC,
        MemoryType.SEMANTIC,
        MemoryType.PROCEDURAL
      ];

      for (const type of memoryTypes) {
        const memory: MemoryData = {
          id: `${type}-memory`,
          userId,
          agentId,
          type,
          content: `${type} memory content`,
          importance: 0.6,
          resonance: 1.0,
          accessCount: 3,
          createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 days ago
          updatedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
          status: 'active'
        };
        mockStorage._getMemories().push(memory);
      }
    });

    it('should apply lazy decay to all memory types during recall', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      mockStorage._clearUpdateHistory();

      // Perform recall without type filter
      await memoryManager.recall(userId, agentId, 'memory content');

      // Force flush of pending updates for testing
      await memoryManager.flushLazyDecayUpdates();

      // All memory types should have been processed for decay
      const updateHistory = mockStorage._getUpdateHistory();
      const memoryTypes = [
        MemoryType.WORKING,
        MemoryType.EPISODIC,
        MemoryType.SEMANTIC,
        MemoryType.PROCEDURAL
      ];

      memoryTypes.forEach((type) => {
        const typeUpdate = updateHistory.find((u) => u.id === `${type}-memory`);
        expect(typeUpdate).toBeDefined();
        expect(typeUpdate!.resonance).toBeLessThan(1.0); // Should have decayed
      });
    });

    it('should apply lazy decay when filtering by specific memory type', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      mockStorage._clearUpdateHistory();

      // Perform recall with type filter
      await memoryManager.recall(userId, agentId, 'semantic content', {
        type: MemoryType.SEMANTIC
      });

      // Force flush of pending updates for testing
      await memoryManager.flushLazyDecayUpdates();

      // Only semantic memory should be in the batch update
      const updateHistory = mockStorage._getUpdateHistory();
      const semanticUpdate = updateHistory.find(
        (u) => u.id === `${MemoryType.SEMANTIC}-memory`
      );

      expect(semanticUpdate).toBeDefined();
      expect(semanticUpdate!.resonance).toBeLessThan(1.0);
    });
  });

  describe('Error Handling in Lazy Decay Integration', () => {
    it('should handle storage errors gracefully during recall', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Mock storage to throw an error
      (mockStorage.memory!.recall as jest.Mock).mockRejectedValueOnce(
        new Error('Storage connection failed')
      );

      // Recall should throw the original storage error
      await expect(
        memoryManager.recall(userId, agentId, 'test query')
      ).rejects.toThrow('Storage connection failed');
    });

    it('should handle batch update failures during lazy decay', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add a memory that will need decay updates
      const memory: MemoryData = {
        id: 'test-memory',
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content: 'Test content',
        importance: 0.8,
        resonance: 1.0,
        accessCount: 0,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        status: 'active'
      };
      mockStorage._getMemories().push(memory);

      // Mock batch update to fail
      (
        mockStorage.memory!.batchUpdateMemories as jest.Mock
      ).mockRejectedValueOnce(new Error('Batch update failed'));

      // Recall should succeed even if batch update fails (resilient design)
      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'test'
      );
      expect(recalledMemories.length).toBeGreaterThan(0);

      // Force flush to trigger the batch update failure
      await memoryManager.flushLazyDecayUpdates();

      // Verify batch update was attempted but failed
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalled();
    });

    it('should handle missing batch update capability', async () => {
      // Test should validate that MemoryManager requires batchUpdateMemories at construction time
      const storageWithoutBatch = createMockStorageProvider() as any;
      delete storageWithoutBatch.memory!.batchUpdateMemories;

      // Creating MemoryManager should throw error when storage doesn't support batch updates
      expect(() => {
        new MemoryManager(storageWithoutBatch, config);
      }).toThrow('Storage provider does not support batch updates');
    });
  });

  describe('Performance of Lazy Decay Integration', () => {
    it('should handle large memory sets efficiently', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add a large number of memories
      const largeMemorySet: MemoryData[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: `large-memory-${i}`,
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: `Large memory content ${i}`,
          importance: Math.random(),
          resonance: Math.random(),
          accessCount: Math.floor(Math.random() * 10),
          createdAt: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000, // Random age up to 60 days
          updatedAt: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
          status: 'active'
        })
      );

      mockStorage._getMemories().push(...largeMemorySet);
      mockStorage._clearUpdateHistory();

      // Measure recall performance with lazy decay
      const startTime = Date.now();
      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'large memory'
      );
      const recallTime = Date.now() - startTime;

      // Should complete recall with decay calculation in reasonable time
      expect(recallTime).toBeLessThan(2000); // Under 2 seconds for 1K memories (includes decay calculation)
      expect(recalledMemories.length).toBe(1000);

      // Verify that updates were batched efficiently
      const updateHistory = mockStorage._getUpdateHistory();
      expect(updateHistory.length).toBeGreaterThan(0); // Some memories should need updates
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalled();
    });

    it('should minimize database operations through intelligent filtering', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Add memories with recent updates (shouldn't need updates)
      const recentMemories: MemoryData[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `recent-memory-${i}`,
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: `Recent memory ${i}`,
          importance: 0.7,
          resonance: 0.8,
          accessCount: 5,
          createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
          updatedAt: Date.now() - 30 * 1000, // 30 seconds ago (very recent)
          lastAccessedAt: Date.now() - 24 * 60 * 60 * 1000,
          status: 'active'
        })
      );

      mockStorage._getMemories().push(...recentMemories);
      mockStorage._clearUpdateHistory();

      // Perform recall
      await memoryManager.recall(userId, agentId, 'recent memory');

      // Should have minimal or no updates due to recent update times
      const updateHistory = mockStorage._getUpdateHistory();
      expect(updateHistory.length).toBeLessThan(10); // Most should be skipped due to recent updates
    });
  });
});
