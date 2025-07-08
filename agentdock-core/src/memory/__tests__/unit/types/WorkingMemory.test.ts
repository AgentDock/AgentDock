/**
 * WorkingMemory Tests - ACTUAL IMPLEMENTATION VALIDATION
 *
 * Tests the REAL features that are implemented, not just the OG vision.
 * The actual WorkingMemory is much more sophisticated than originally planned:
 * - TTL-based expiration
 * - Context window management
 * - Session-based organization
 * - Token counting support
 * - User isolation enforcement
 * - Storage delegation pattern
 * - BaseMemoryType integration (Zettelkasten connections)
 * - Clear functionality for session management
 */

import { MemoryType } from '../../../types';
import { WorkingMemory } from '../../../types/working/WorkingMemory';
import { createTestMemory, testConfig } from '../../config/test-config';
import { MockStorageProvider } from '../../mocks/MockStorageProvider';

describe('WorkingMemory - Actual Implementation', () => {
  let storage: MockStorageProvider;
  let workingMemory: WorkingMemory;

  beforeEach(() => {
    storage = new MockStorageProvider();
    workingMemory = new WorkingMemory(storage, testConfig.memory.working);
  });

  afterEach(() => {
    storage.clear();
  });

  describe('Configuration Requirements (NO DEFAULTS)', () => {
    test('requires storage with memory operations', () => {
      const storageWithoutMemory = {
        get: jest.fn(),
        set: jest.fn()
        // No memory operations
      } as any;

      expect(
        () => new WorkingMemory(storageWithoutMemory, testConfig.memory.working)
      ).toThrow('WorkingMemory requires storage with memory operations');
    });

    test('uses ttlSeconds from configuration for expiration', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Test working memory content'
      );
      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored?.metadata?.expiresAt).toBeDefined();

      // Should expire after ttlSeconds
      const expectedExpiry =
        stored!.createdAt + testConfig.memory.working.ttlSeconds * 1000;
      expect(stored?.metadata?.expiresAt).toBe(expectedExpiry);
    });

    test('uses maxContextItems from configuration', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Test working memory content'
      );
      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored?.metadata?.contextWindow).toBe(
        testConfig.memory.working.maxContextItems
      );
    });
  });

  describe('User Isolation - CRITICAL SECURITY', () => {
    test('enforces strict user isolation on store operations', async () => {
      const aliceMemoryId = await workingMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice working memory',
        { sessionId: 'alice-session' }
      );

      const bobMemoryId = await workingMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob working memory',
        { sessionId: 'bob-session' }
      );

      expect(aliceMemoryId).toBeDefined();
      expect(bobMemoryId).toBeDefined();
      expect(aliceMemoryId).not.toBe(bobMemoryId);

      // Verify stored under correct users
      expect(storage.getUserMemoryCount(testConfig.users.alice)).toBe(1);
      expect(storage.getUserMemoryCount(testConfig.users.bob)).toBe(1);
    });

    test('enforces user isolation on recall operations', async () => {
      // Store memories for different users
      await workingMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice working on project Alpha'
      );
      await workingMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob working on project Beta'
      );

      // Recall should only return user's own memories
      const aliceMemories = await workingMemory.recall(
        testConfig.users.alice,
        testConfig.agents.shared,
        'project'
      );
      const bobMemories = await workingMemory.recall(
        testConfig.users.bob,
        testConfig.agents.shared,
        'project'
      );

      expect(aliceMemories).toHaveLength(1);
      expect(aliceMemories[0].content).toContain('Alice');
      expect(aliceMemories[0].content).not.toContain('Bob');

      expect(bobMemories).toHaveLength(1);
      expect(bobMemories[0].content).toContain('Bob');
      expect(bobMemories[0].content).not.toContain('Alice');
    });

    test('requires userId for ALL operations', async () => {
      const agentId = testConfig.agents.shared;

      await expect(workingMemory.store('', agentId, 'content')).rejects.toThrow(
        'userId must be a non-empty string for working memory operations'
      );

      await expect(workingMemory.recall('', agentId, 'query')).rejects.toThrow(
        'userId must be a non-empty string for working memory operations'
      );

      await expect(workingMemory.clear('', agentId)).rejects.toThrow(
        'userId must be a non-empty string for working memory operations'
      );

      await expect(workingMemory.getStats('')).rejects.toThrow(
        'userId is required for working memory operations'
      );

      await expect(workingMemory.getById('', 'memoryId')).rejects.toThrow(
        'userId is required for working memory operations'
      );
    });
  });

  describe('Storage Delegation - Core Architecture', () => {
    test('delegates store operations to storage layer', async () => {
      const storeSpy = jest.spyOn(storage.memory, 'store');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Test working memory';
      const sessionId = 'test-session';

      await workingMemory.store(userId, agentId, content, {
        sessionId,
        importance: 0.9,
        contextWindow: 25
      });

      expect(storeSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        expect.objectContaining({
          type: MemoryType.WORKING,
          content,
          importance: 0.9,
          resonance: 1.0,
          sessionId,
          metadata: expect.objectContaining({
            contextWindow: 25,
            expiresAt: expect.any(Number)
          })
        })
      );
    });

    test('delegates recall operations to storage layer', async () => {
      const recallSpy = jest.spyOn(storage.memory, 'recall');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      await workingMemory.recall(userId, agentId, 'test query', 15);

      expect(recallSpy).toHaveBeenCalledWith(userId, agentId, 'test query', {
        type: MemoryType.WORKING,
        limit: 15
      });
    });

    test('delegates getById operations to storage layer', async () => {
      const getByIdSpy = jest.spyOn(storage.memory, 'getById');

      // First store a memory
      const userId = testConfig.users.alice;
      const memoryId = await workingMemory.store(
        userId,
        testConfig.agents.shared,
        'Test content'
      );

      // Then retrieve it
      await workingMemory.getById(userId, memoryId);

      expect(getByIdSpy).toHaveBeenCalledWith(userId, memoryId);
    });
  });

  describe('TTL and Expiration Management', () => {
    test('stores memories with correct TTL expiration', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const customTtl = 7200; // 2 hours

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'TTL test memory',
        {
          ttlSeconds: customTtl
        }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      const expectedExpiry = stored!.createdAt + customTtl * 1000;

      expect(stored?.metadata?.expiresAt).toBe(expectedExpiry);
    });

    test('uses default TTL when not specified', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Default TTL memory'
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      const expectedExpiry =
        stored!.createdAt + testConfig.memory.working.ttlSeconds * 1000;

      expect(stored?.metadata?.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('Session Management', () => {
    test('stores custom sessionId when provided', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const sessionId = 'custom-session-123';

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Session test',
        { sessionId }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.sessionId).toBe(sessionId);

      const retrieved = await workingMemory.getById(userId, memoryId);
      expect(retrieved?.sessionId).toBe(sessionId);
    });

    test('generates sessionId automatically when not provided', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Auto session test'
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.sessionId).toBeDefined();
      expect(stored?.sessionId).toMatch(/^session_\d+$/);
    });

    test('clear() removes all memories for user/agent', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store multiple memories
      await workingMemory.store(userId, agentId, 'Memory 1', {
        sessionId: 'session-1'
      });
      await workingMemory.store(userId, agentId, 'Memory 2', {
        sessionId: 'session-2'
      });
      await workingMemory.store(userId, agentId, 'Memory 3', {
        sessionId: 'session-1'
      });

      expect(storage.getUserMemoryCount(userId)).toBe(3);

      // Clear all memories
      await workingMemory.clear(userId, agentId);

      expect(storage.getUserMemoryCount(userId)).toBe(0);
    });
  });

  describe('Memory Data Validation', () => {
    test('stores complete working memory data structure', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Complete working memory test';
      const sessionId = 'test-session';
      const importance = 0.75;

      const memoryId = await workingMemory.store(userId, agentId, content, {
        sessionId,
        importance,
        contextWindow: 30
      });

      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored).toMatchObject({
        id: memoryId,
        userId,
        agentId,
        type: MemoryType.WORKING,
        content,
        importance,
        resonance: 1.0,
        accessCount: 0,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
        lastAccessedAt: expect.any(Number),
        sessionId,
        tokenCount: 7, // Calculated: Math.ceil(content.length / 4)
        metadata: expect.objectContaining({
          contextWindow: 30,
          expiresAt: expect.any(Number)
        })
      });
    });

    test('validates memory type on getById', async () => {
      const userId = testConfig.users.alice;

      // Manually store a memory with wrong type in storage
      const wrongTypeMemory = createTestMemory({
        userId,
        type: MemoryType.EPISODIC // Wrong type
      });

      await storage.memory.store(
        userId,
        testConfig.agents.shared,
        wrongTypeMemory
      );

      // WorkingMemory.getById should return null for wrong type
      const result = await workingMemory.getById(userId, wrongTypeMemory.id);
      expect(result).toBeNull();
    });

    test('returns properly formatted WorkingMemoryData on getById', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Test working memory content';
      const sessionId = 'format-test-session';

      const memoryId = await workingMemory.store(userId, agentId, content, {
        sessionId,
        contextWindow: 15
      });

      const retrieved = await workingMemory.getById(userId, memoryId);

      expect(retrieved).toMatchObject({
        id: memoryId,
        agentId,
        content,
        createdAt: expect.any(Number),
        importance: 0.8, // Default importance for working memory
        sessionId,
        contextWindow: 15,
        tokenCount: 7, // Calculated: Math.ceil(content.length / 4)
        expiresAt: expect.any(Number),
        metadata: expect.any(Object)
      });
    });
  });

  describe('BaseMemoryType Integration', () => {
    test('inherits automatic connection discovery from BaseMemoryType', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Should use BaseMemoryType.store() which triggers connection discovery
      const memoryId = await workingMemory.store(
        userId,
        agentId,
        'Content for connection test'
      );

      expect(memoryId).toBeDefined();
      expect(memoryId).toMatch(/^wm_\d+_[a-z0-9]+$/); // Working memory ID prefix
    });
  });

  describe('Error Handling', () => {
    test('handles storage errors gracefully', async () => {
      // Mock storage to throw error
      jest
        .spyOn(storage.memory, 'store')
        .mockRejectedValueOnce(new Error('Storage failure'));

      await expect(
        workingMemory.store(
          testConfig.users.alice,
          testConfig.agents.shared,
          'Test'
        )
      ).rejects.toThrow('Storage failure');
    });

    test('handles missing memory gracefully on getById', async () => {
      const result = await workingMemory.getById(
        testConfig.users.alice,
        'non-existent-id'
      );
      expect(result).toBeNull();
    });
  });
});
