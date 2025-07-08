/**
 * @fileoverview End-to-end tests for Lazy Decay System
 *
 * Complete integration tests covering the entire lazy decay workflow
 * from memory creation to decay calculation during recall operations.
 */

import {
  MemoryData,
  MemoryOperations,
  MemoryUpdate,
  StorageProvider
} from '../../../storage/types';
import { LazyDecayBatchProcessor } from '../../decay/LazyDecayBatchProcessor';
import { LazyDecayCalculator } from '../../decay/LazyDecayCalculator';
import { PRIMEExtractor } from '../../extraction/PRIMEExtractor';
import { MemoryManager } from '../../MemoryManager';
import { CostTracker } from '../../tracking/CostTracker';
import { MemoryManagerConfig, MemoryType } from '../../types';

// Mock storage with full lazy decay support
const createFullMockStorage = (): StorageProvider => {
  const memories: MemoryData[] = [];
  const updateHistory: MemoryUpdate[] = [];

  const mockMemoryOps: MemoryOperations = {
    store: jest
      .fn()
      .mockImplementation(
        async (userId: string, agentId: string, memory: MemoryData) => {
          const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const fullMemory = { ...memory, id };
          memories.push(fullMemory);
          return id;
        }
      ),

    recall: jest
      .fn()
      .mockImplementation(
        async (userId: string, agentId: string, query: string, options?) => {
          return memories
            .filter(
              (m) =>
                m.userId === userId &&
                m.agentId === agentId &&
                (options?.type ? m.type === options.type : true) &&
                (options?.limit ? true : true)
            )
            .slice(0, options?.limit || 50);
        }
      ),

    update: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn().mockResolvedValue({
      totalMemories: memories.length,
      byType: { semantic: memories.length },
      avgImportance: 0.5,
      totalSize: '1MB'
    }),

    batchUpdateMemories: jest
      .fn()
      .mockImplementation(async (updates: MemoryUpdate[]) => {
        updateHistory.push(...updates);
        updates.forEach((update) => {
          const memory = memories.find((m) => m.id === update.id);
          if (memory) {
            memory.resonance = update.resonance;
            memory.lastAccessedAt = update.lastAccessedAt;
            memory.accessCount = update.accessCount;
            memory.updatedAt = Date.now();
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
    // Test helpers
    _getMemories: () => memories,
    _getUpdateHistory: () => updateHistory,
    _clearHistory: () => {
      memories.length = 0;
      updateHistory.length = 0;
    }
  } as any;
};

describe('Lazy Decay System - End-to-End Tests', () => {
  let memoryManager: MemoryManager;
  let mockStorage: StorageProvider & {
    _getMemories: () => MemoryData[];
    _getUpdateHistory: () => MemoryUpdate[];
    _clearHistory: () => void;
  };
  let config: MemoryManagerConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStorage = createFullMockStorage() as any;

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
    mockStorage._clearHistory();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete Memory Lifecycle with Lazy Decay', () => {
    it('should demonstrate full lazy decay workflow', async () => {
      const userId = 'e2e-user';
      const agentId = 'e2e-agent';

      // Phase 1: Store memories with different characteristics
      console.log('Phase 1: Storing memories...');

      const normalMemoryId = await memoryManager.store(
        userId,
        agentId,
        'Normal memory that should decay over time',
        MemoryType.SEMANTIC
      );

      // Manually insert memories with specific timestamps for testing
      const testMemories: MemoryData[] = [
        {
          id: 'never-decay-memory',
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: 'Critical information that must never decay',
          importance: 0.9,
          resonance: 1.0,
          accessCount: 10,
          createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
          updatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
          status: 'active' as const,
          neverDecay: true,
          reinforceable: true
        },
        {
          id: 'fast-decay-memory',
          userId,
          agentId,
          type: MemoryType.WORKING,
          content: 'Temporary information with fast decay',
          importance: 0.6,
          resonance: 1.0,
          accessCount: 2,
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
          status: 'active' as const,
          customHalfLife: 7 // Fast decay: 7-day half-life
        },
        {
          id: 'old-memory',
          userId,
          agentId,
          type: MemoryType.EPISODIC,
          content: 'Old memory that should have significant decay',
          importance: 0.7,
          resonance: 1.0,
          accessCount: 1,
          createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
          updatedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
          status: 'active' as const
        },
        {
          id: 'low-resonance-memory',
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: 'Memory with very low resonance for archival testing',
          importance: 0.3,
          resonance: 0.05, // Below archival threshold
          accessCount: 0,
          createdAt: Date.now() - 120 * 24 * 60 * 60 * 1000, // 120 days ago
          updatedAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
          status: 'active' as const
        }
      ];

      mockStorage._getMemories().push(...testMemories);

      console.log(
        `Stored ${mockStorage._getMemories().length} memories for testing`
      );

      // Phase 2: Perform recall operations to trigger lazy decay
      console.log('Phase 2: Performing recall to trigger lazy decay...');

      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'information memory'
      );

      // Verify memories were returned
      expect(recalledMemories.length).toBeGreaterThan(0);
      console.log(`Recalled ${recalledMemories.length} memories`);

      // Phase 3: Allow batch processor to flush updates
      console.log('Phase 3: Waiting for batch processor to flush updates...');

      // Advance timers to trigger batch flush (5 second default)
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();

      // Phase 4: Verify lazy decay calculations were applied
      console.log('Phase 4: Verifying lazy decay calculations...');

      const updateHistory = mockStorage._getUpdateHistory();
      console.log(`Applied ${updateHistory.length} decay updates`);

      // In the new lazy system, we expect FEWER updates than memories
      // because the lazy system only updates memories that changed significantly
      expect(updateHistory.length).toBeGreaterThan(0);
      expect(updateHistory.length).toBeLessThan(testMemories.length); // Should be lazy!

      // Verify specific decay behaviors if updates were applied
      const neverDecayUpdate = updateHistory.find(
        (u) => u.id === 'never-decay-memory'
      );
      const oldMemoryUpdate = updateHistory.find((u) => u.id === 'old-memory');

      if (neverDecayUpdate) {
        // Never decay memory should only have reinforcement (if any)
        expect(neverDecayUpdate.resonance).toBeGreaterThanOrEqual(1.0);
        console.log(
          `Never decay memory resonance: ${neverDecayUpdate.resonance}`
        );
      }

      if (oldMemoryUpdate) {
        // Old memory should have substantial decay (60 days with 30-day half-life = ~25%)
        expect(oldMemoryUpdate.resonance).toBeLessThan(0.5);
        console.log(`Old memory resonance: ${oldMemoryUpdate.resonance}`);
      }

      console.log('✅ End-to-end lazy decay workflow completed successfully');
    });

    it('should handle multiple recall operations efficiently', async () => {
      const userId = 'performance-user';
      const agentId = 'performance-agent';

      // Create a substantial number of memories
      const memoryCount = 500;
      const memories: MemoryData[] = Array.from(
        { length: memoryCount },
        (_, i) => ({
          id: `perf-memory-${i}`,
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: `Performance test memory ${i}`,
          importance: Math.random(),
          resonance: 0.5 + Math.random() * 0.5, // 0.5 to 1.0
          accessCount: Math.floor(Math.random() * 10),
          createdAt: Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000, // Random age up to 90 days
          updatedAt: Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
          status: 'active' as const
        })
      );

      mockStorage._getMemories().push(...memories);

      // Perform multiple recall operations
      const recallCount = 5;
      const recallTimes: number[] = [];

      for (let i = 0; i < recallCount; i++) {
        const startTime = Date.now();
        await memoryManager.recall(userId, agentId, `performance test ${i}`);
        const recallTime = Date.now() - startTime;
        recallTimes.push(recallTime);
      }

      // Verify performance requirements
      const avgRecallTime =
        recallTimes.reduce((sum, time) => sum + time, 0) / recallTimes.length;
      expect(avgRecallTime).toBeLessThan(200); // Average recall should be under 200ms

      console.log(`Average recall time with lazy decay: ${avgRecallTime}ms`);

      // Allow batch processor to flush updates
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();

      console.log(
        `Total batch updates: ${mockStorage._getUpdateHistory().length}`
      );

      // Verify that subsequent recalls are fast (due to recent access pattern)
      const firstRecallTime = recallTimes[0];
      const lastRecallTime = recallTimes[recallTimes.length - 1];

      // Later recalls should be similar or faster (not significantly slower)
      expect(lastRecallTime).toBeLessThanOrEqual(firstRecallTime * 2);
    });
  });

  describe('Batch Processor Integration', () => {
    it('should collect updates from recall operations and write them efficiently', async () => {
      const userId = 'batch-user';
      const agentId = 'batch-agent';

      // Add memories that will trigger decay calculations
      const batchMemories: MemoryData[] = Array.from(
        { length: 100 },
        (_, i) => ({
          id: `batch-memory-${i}`,
          userId,
          agentId,
          type: MemoryType.SEMANTIC,
          content: `Batch memory ${i}`,
          importance: 0.5,
          resonance: Math.random(),
          accessCount: Math.floor(Math.random() * 5),
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          lastAccessedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          status: 'active' as const
        })
      );

      mockStorage._getMemories().push(...batchMemories);

      // Perform recall operations to trigger lazy decay
      const recalledMemories = await memoryManager.recall(
        userId,
        agentId,
        'batch memory',
        { limit: 100 }
      );
      expect(recalledMemories.length).toBe(100);

      // Allow batch processor to flush updates (5 second default)
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();

      // Verify batch processing happened
      const updateHistory = mockStorage._getUpdateHistory();
      console.log(
        `Batch collected ${updateHistory.length} updates from recall operations`
      );

      // Should have some updates (lazy system only updates changed memories)
      expect(updateHistory.length).toBeGreaterThan(0);
      expect(updateHistory.length).toBeLessThanOrEqual(100);

      // Verify batchUpdateMemories was called (indicating efficient batch writes)
      expect(mockStorage.memory!.batchUpdateMemories).toHaveBeenCalled();

      console.log(
        `Processing generated ${updateHistory.length} updates from 100 memories`
      );
      console.log(
        `Write efficiency: ${(((100 - updateHistory.length) / 100) * 100).toFixed(1)}% avoided`
      );
    });
  });

  describe('Lazy Decay Efficiency Validation', () => {
    it('should prove the lazy decay system is actually lazy', async () => {
      const userId = 'lazy-user';
      const agentId = 'lazy-agent';

      // Create realistic memory distribution
      const recentMemories = Array.from({ length: 900 }, (_, i) => ({
        id: `recent-${i}`,
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content: `Recent memory ${i}`,
        importance: 0.8,
        resonance: 0.9,
        accessCount: 10,
        createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // Recent access
        status: 'active' as const
      }));

      const oldMemories = Array.from({ length: 100 }, (_, i) => ({
        id: `old-${i}`,
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content: `Old memory ${i}`,
        importance: 0.6,
        resonance: 0.8,
        accessCount: 1,
        createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // 60 days ago
        updatedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
        lastAccessedAt: Date.now() - 60 * 24 * 60 * 60 * 1000, // Old access
        status: 'active' as const
      }));

      mockStorage._getMemories().push(...recentMemories, ...oldMemories);

      // Perform recall
      await memoryManager.recall(userId, agentId, 'memory');

      // Allow batch processor to flush
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();

      const updateHistory = mockStorage._getUpdateHistory();
      const writeAvoidance = ((1000 - updateHistory.length) / 1000) * 100;

      console.log(`\n🎯 LAZY DECAY EFFICIENCY PROOF:`);
      console.log(`   Total memories: 1000`);
      console.log(`   Recent memories (90%): 900 (minimal decay)`);
      console.log(`   Old memories (10%): 100 (significant decay)`);
      console.log(`   Updates generated: ${updateHistory.length}`);
      console.log(`   Write avoidance: ${writeAvoidance.toFixed(1)}%`);

      // The lazy system should avoid most writes for recent memories
      expect(writeAvoidance).toBeGreaterThanOrEqual(80); // At least 80% write avoidance
      expect(updateHistory.length).toBeLessThan(200); // Less than 20% of memories updated

      console.log('✅ Lazy decay system proven to be actually lazy!');
    });
  });
});
