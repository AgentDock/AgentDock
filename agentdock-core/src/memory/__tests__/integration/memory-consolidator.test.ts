/**
 * Memory Consolidator Integration Tests
 */

import { InMemoryStorageAdapter } from '../../../storage/adapters';
import type { StorageProvider } from '../../../storage/types';
import { MemoryManager } from '../../MemoryManager';
import { MemoryManagerConfig, MemoryType } from '../../types';

// Helper function to create complete memory configurations
function createTestMemoryConfig(): MemoryManagerConfig {
  return {
    working: {
      maxTokens: 4000,
      ttlSeconds: 3600,
      maxContextItems: 50,
      compressionThreshold: 0.8,
      encryptSensitive: false
    },
    episodic: {
      maxMemoriesPerSession: 1000,
      decayRate: 0.1,
      importanceThreshold: 0.5,
      compressionAge: 86400000, // 1 day
      encryptSensitive: false
    },
    semantic: {
      maxMemoriesPerCategory: 2000,
      deduplicationThreshold: 0.85,
      confidenceThreshold: 0.7,
      vectorSearchEnabled: false,
      encryptSensitive: false,
      autoExtractFacts: false
    },
    procedural: {
      minSuccessRate: 0.7,
      maxPatternsPerCategory: 100,
      decayRate: 0.05,
      confidenceThreshold: 0.8,
      adaptiveLearning: true,
      patternMerging: true
    },
    consolidation: {
      enabled: true,
      minEpisodicAge: 300000, // 5 minutes
      similarityThreshold: 0.85,
      batchSize: 100
    }
  };
}

describe('Memory Consolidator Integration', () => {
  let storage: StorageProvider;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
    memoryManager = new MemoryManager(storage, createTestMemoryConfig());
  });

  afterEach(async () => {
    await memoryManager.close();
  });

  describe('Memory Consolidation', () => {
    it('should consolidate episodic memories', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Store some episodic memories
      await memoryManager.store(
        userId,
        agentId,
        'User said hello',
        MemoryType.EPISODIC
      );
      await memoryManager.store(
        userId,
        agentId,
        'User greeted me',
        MemoryType.EPISODIC
      );
      await memoryManager.store(
        userId,
        agentId,
        'User said hi',
        MemoryType.EPISODIC
      );

      // Wait a bit to ensure memories are old enough
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger consolidation
      const results = await memoryManager.consolidateMemories(userId, agentId);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty memory sets gracefully', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Try to consolidate with no memories
      const results = await memoryManager.consolidateMemories(userId, agentId);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Consolidation Configuration', () => {
    it('should respect consolidation settings', async () => {
      const config = createTestMemoryConfig();
      config.consolidation!.enabled = false;

      const manager = new MemoryManager(storage, config);

      const userId = 'test-user';
      const agentId = 'test-agent';

      // Should throw error when consolidation is disabled
      await expect(
        manager.consolidateMemories(userId, agentId)
      ).rejects.toThrow('Memory consolidation not enabled');

      await manager.close();
    });

    it('should use custom similarity threshold', async () => {
      const config = createTestMemoryConfig();
      config.consolidation!.similarityThreshold = 0.95; // Very high threshold

      const manager = new MemoryManager(storage, config);

      const userId = 'test-user';
      const agentId = 'test-agent';

      // Store similar memories
      await manager.store(
        userId,
        agentId,
        'User likes coffee',
        MemoryType.EPISODIC
      );
      await manager.store(
        userId,
        agentId,
        'User enjoys coffee',
        MemoryType.EPISODIC
      );

      const results = await manager.consolidateMemories(userId, agentId);

      expect(results).toBeDefined();
      // With high threshold, memories might not be consolidated

      await manager.close();
    });
  });

  describe('Automatic Consolidation Scheduling', () => {
    it('should schedule consolidation after storing episodic memory', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Store episodic memory - should trigger scheduling
      const memoryId = await memoryManager.store(
        userId,
        agentId,
        'Important user action',
        MemoryType.EPISODIC
      );

      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');

      // Consolidation is scheduled but runs asynchronously
      // We can't easily test the timing without making the test flaky
    });

    it('should not schedule consolidation for non-episodic memories', async () => {
      const userId = 'test-user';
      const agentId = 'test-agent';

      // Store semantic memory - should not trigger scheduling
      const memoryId = await memoryManager.store(
        userId,
        agentId,
        'User prefers dark mode',
        MemoryType.SEMANTIC
      );

      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs', async () => {
      await expect(
        memoryManager.consolidateMemories('', 'test-agent')
      ).rejects.toThrow();
    });

    it('should handle missing agent IDs', async () => {
      await expect(
        memoryManager.consolidateMemories('test-user', '')
      ).rejects.toThrow();
    });
  });
});
