/**
 * MemoryManager Tests - CRITICAL USER ISOLATION & CONFIGURATION VALIDATION
 *
 * These tests validate the core promises of the memory system:
 * 1. User isolation is ENFORCED at every level
 * 2. NO hardcoded defaults exist
 * 3. Configuration drives ALL behavior
 * 4. Memory type delegation works correctly
 */

import { MemoryManager } from '../../MemoryManager';
import { MemoryType } from '../../types';
import { createTestMemory, testConfig } from '../config/test-config';
import { MockStorageProvider } from '../mocks/MockStorageProvider';

describe('MemoryManager - Core Functionality', () => {
  let storage: MockStorageProvider;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    memoryManager = new MemoryManager(storage, testConfig.memory);
  });

  afterEach(() => {
    storage.clear();
  });

  describe('Configuration Requirements (NO DEFAULTS)', () => {
    test('requires working memory configuration', () => {
      expect(() => new MemoryManager(storage, {})).toThrow(
        'Working memory configuration is required'
      );
    });

    test('requires all memory type configurations', () => {
      expect(
        () => new MemoryManager(storage, { working: testConfig.memory.working })
      ).toThrow('Episodic memory configuration is required');
    });

    test('requires semantic memory configuration', () => {
      expect(
        () =>
          new MemoryManager(storage, {
            working: testConfig.memory.working,
            episodic: testConfig.memory.episodic
          })
      ).toThrow('Semantic memory configuration is required');
    });

    test('requires procedural memory configuration', () => {
      expect(
        () =>
          new MemoryManager(storage, {
            working: testConfig.memory.working,
            episodic: testConfig.memory.episodic,
            semantic: testConfig.memory.semantic
          })
      ).toThrow('Procedural memory configuration is required');
    });

    test('accepts complete configuration without errors', () => {
      expect(() => new MemoryManager(storage, testConfig.memory)).not.toThrow();
    });

    test('applies default values correctly when not specified', () => {
      // Test that default values are properly applied from configuration
      const configWithDefaults = {
        working: { ...testConfig.memory.working },
        episodic: { ...testConfig.memory.episodic },
        semantic: { ...testConfig.memory.semantic },
        procedural: { ...testConfig.memory.procedural }
      };

      const manager = new MemoryManager(storage, configWithDefaults);
      expect(manager).toBeDefined();

      // Verify internal configuration has expected default values
      const internalConfig = (manager as any).config;
      expect(internalConfig.working.ttlSeconds).toBe(
        testConfig.memory.working.ttlSeconds
      );
      expect(internalConfig.working.maxContextItems).toBe(
        testConfig.memory.working.maxContextItems
      );
    });
  });

  describe('User Isolation - CRITICAL SECURITY TEST', () => {
    test('stores memories with strict user isolation', async () => {
      const aliceMemoryId = await memoryManager.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice private data',
        MemoryType.SEMANTIC
      );

      const bobMemoryId = await memoryManager.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob private data',
        MemoryType.SEMANTIC
      );

      expect(aliceMemoryId).toBeDefined();
      expect(bobMemoryId).toBeDefined();
      expect(aliceMemoryId).not.toBe(bobMemoryId);

      // Verify memories are stored under correct users
      expect(storage.getUserMemoryCount(testConfig.users.alice)).toBe(1);
      expect(storage.getUserMemoryCount(testConfig.users.bob)).toBe(1);
    });

    test('ENFORCES complete user isolation on recall', async () => {
      await memoryManager.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice secret password'
      );
      await memoryManager.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob secret password'
      );

      const aliceRecall = await memoryManager.recall(
        testConfig.users.alice,
        testConfig.agents.shared,
        'secret'
      );
      const bobRecall = await memoryManager.recall(
        testConfig.users.bob,
        testConfig.agents.shared,
        'secret'
      );

      expect(aliceRecall).toHaveLength(1);
      expect(aliceRecall[0].content).toContain('Alice');
      expect(aliceRecall[0].content).not.toContain('Bob');

      expect(bobRecall).toHaveLength(1);
      expect(bobRecall[0].content).toContain('Bob');
      expect(bobRecall[0].content).not.toContain('Alice');
    });

    test('REQUIRES userId for ALL operations', async () => {
      await expect(
        memoryManager.store('', testConfig.agents.shared, 'content')
      ).rejects.toThrow(
        'userId must be a non-empty string for memory operations'
      );

      await expect(
        memoryManager.recall('', testConfig.agents.shared, 'query')
      ).rejects.toThrow(
        'userId must be a non-empty string for memory operations'
      );

      await expect(memoryManager.getStats('')).rejects.toThrow(
        'userId must be a non-empty string for memory operations'
      );
    });

    test('cross-agent isolation within same user', async () => {
      const userId = testConfig.users.alice;

      // Store data in different agents for same user
      await memoryManager.store(
        userId,
        testConfig.agents.personal,
        'Personal agent data'
      );
      await memoryManager.store(
        userId,
        testConfig.agents.shared,
        'Shared agent data'
      );

      // Recall should be agent-specific
      const personalMemories = await memoryManager.recall(
        userId,
        testConfig.agents.personal,
        'data'
      );
      const sharedMemories = await memoryManager.recall(
        userId,
        testConfig.agents.shared,
        'data'
      );

      expect(personalMemories).toHaveLength(1);
      expect(personalMemories[0].content).toContain('Personal');
      expect(personalMemories[0].content).not.toContain('Shared');

      expect(sharedMemories).toHaveLength(1);
      expect(sharedMemories[0].content).toContain('Shared');
      expect(sharedMemories[0].content).not.toContain('Personal');
    });
  });

  describe('Memory Type Delegation', () => {
    test('delegates to correct memory type', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const workingId = await memoryManager.store(
        userId,
        agentId,
        'Working',
        MemoryType.WORKING
      );
      const episodicId = await memoryManager.store(
        userId,
        agentId,
        'Episodic',
        MemoryType.EPISODIC
      );
      const semanticId = await memoryManager.store(
        userId,
        agentId,
        'Semantic',
        MemoryType.SEMANTIC
      );
      const proceduralId = await memoryManager.store(
        userId,
        agentId,
        'Procedural',
        MemoryType.PROCEDURAL
      );

      expect(workingId).toBeDefined();
      expect(episodicId).toBeDefined();
      expect(semanticId).toBeDefined();
      expect(proceduralId).toBeDefined();

      const ids = [workingId, episodicId, semanticId, proceduralId];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);

      // Verify they're stored with correct types
      const memories = storage.getAllMemoriesForUser(userId);
      expect(memories).toHaveLength(4);

      const workingMemory = memories.find((m) => m.id === workingId);
      const episodicMemory = memories.find((m) => m.id === episodicId);
      const semanticMemory = memories.find((m) => m.id === semanticId);
      const proceduralMemory = memories.find((m) => m.id === proceduralId);

      expect(workingMemory?.type).toBe(MemoryType.WORKING);
      expect(episodicMemory?.type).toBe(MemoryType.EPISODIC);
      expect(semanticMemory?.type).toBe(MemoryType.SEMANTIC);
      expect(proceduralMemory?.type).toBe(MemoryType.PROCEDURAL);
    });

    test('defaults to semantic type when not specified', async () => {
      const memoryId = await memoryManager.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Memory without explicit type'
      );

      const memories = storage.getAllMemoriesForUser(testConfig.users.alice);
      const memory = memories.find((m) => m.id === memoryId);

      expect(memory?.type).toBe(MemoryType.SEMANTIC);
    });
  });

  describe('Basic Operations Validation', () => {
    test('requires agentId and content for store operations', async () => {
      const userId = testConfig.users.alice;

      await expect(memoryManager.store(userId, '', 'content')).rejects.toThrow(
        'Agent ID and content are required'
      );

      await expect(
        memoryManager.store(userId, testConfig.agents.shared, '')
      ).rejects.toThrow('Agent ID and content are required');

      await expect(
        memoryManager.store(userId, testConfig.agents.shared, '   ')
      ).rejects.toThrow('Agent ID and content are required');
    });

    test('requires agentId and query for recall operations', async () => {
      const userId = testConfig.users.alice;

      await expect(memoryManager.recall(userId, '', 'query')).rejects.toThrow(
        'Agent ID and query are required'
      );

      await expect(
        memoryManager.recall(userId, testConfig.agents.shared, '')
      ).rejects.toThrow('Agent ID and query are required');
    });

    test('getStats works with and without agentId', async () => {
      const userId = testConfig.users.alice;

      // Store memories in different agents
      await memoryManager.store(
        userId,
        testConfig.agents.personal,
        'Personal memory'
      );
      await memoryManager.store(
        userId,
        testConfig.agents.shared,
        'Shared memory'
      );

      // User-level stats (all agents)
      const userStats = await memoryManager.getStats(userId);
      expect(userStats.totalMemories).toBe(2);

      // Agent-level stats (specific agent)
      const agentStats = await memoryManager.getStats(
        userId,
        testConfig.agents.personal
      );
      expect(agentStats.totalMemories).toBe(1);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    test('handles concurrent operations for different users', async () => {
      const operations = [];

      // Simulate concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          memoryManager.store(
            testConfig.users.alice,
            testConfig.agents.shared,
            `Alice memory ${i}`
          ),
          memoryManager.store(
            testConfig.users.bob,
            testConfig.agents.shared,
            `Bob memory ${i}`
          )
        );
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);
      expect(results).toHaveLength(20);
      expect(results.every((id) => id)).toBe(true);

      // Verify isolation is maintained
      expect(storage.getUserMemoryCount(testConfig.users.alice)).toBe(10);
      expect(storage.getUserMemoryCount(testConfig.users.bob)).toBe(10);

      // Verify no cross-contamination
      const aliceMemories = await memoryManager.recall(
        testConfig.users.alice,
        testConfig.agents.shared,
        'memory'
      );
      const bobMemories = await memoryManager.recall(
        testConfig.users.bob,
        testConfig.agents.shared,
        'memory'
      );

      expect(aliceMemories.every((m) => m.content.includes('Alice'))).toBe(
        true
      );
      expect(bobMemories.every((m) => m.content.includes('Bob'))).toBe(true);
    });
  });
});
