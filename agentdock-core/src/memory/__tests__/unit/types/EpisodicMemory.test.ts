/**
 * EpisodicMemory Tests - ACTUAL IMPLEMENTATION VALIDATION
 *
 * Tests the REAL features that are implemented, not just the OG vision.
 * The actual EpisodicMemory is much more sophisticated than originally planned:
 * - Tags and context support
 * - Session-based organization
 * - Time range queries
 * - Decay and compression functionality
 * - User isolation enforcement
 * - Storage delegation pattern
 * - BaseMemoryType integration (Zettelkasten connections)
 */

import { MemoryType } from '../../../types';
import { EpisodicMemory } from '../../../types/episodic/EpisodicMemory';
import { createTestMemory, testConfig } from '../../config/test-config';
import { MockStorageProvider } from '../../mocks/MockStorageProvider';

describe('EpisodicMemory - Actual Implementation', () => {
  let storage: MockStorageProvider;
  let episodicMemory: EpisodicMemory;

  beforeEach(() => {
    storage = new MockStorageProvider();
    episodicMemory = new EpisodicMemory(storage, testConfig.memory.episodic);
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
        () =>
          new EpisodicMemory(storageWithoutMemory, testConfig.memory.episodic)
      ).toThrow('Storage must support memory operations');
    });

    test('uses compressionAge from configuration for expiration', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await episodicMemory.store(
        userId,
        agentId,
        'Test episodic content',
        { tags: ['test'] }
      );
      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored?.metadata?.expiresAt).toBeDefined();

      // Should expire after compressionAge days
      const expectedExpiry =
        stored!.createdAt +
        testConfig.memory.episodic.compressionAge * 86400000;
      expect(stored?.metadata?.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('User Isolation - CRITICAL SECURITY', () => {
    test('enforces strict user isolation on store operations', async () => {
      const aliceMemoryId = await episodicMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice episodic experience',
        { tags: ['alice-tag'] }
      );

      const bobMemoryId = await episodicMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob episodic experience',
        { tags: ['bob-tag'] }
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
      await episodicMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice learned something important',
        { tags: ['learning'] }
      );
      await episodicMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob learned something different',
        { tags: ['learning'] }
      );

      // Recall should only return user's own memories
      const aliceMemories = await episodicMemory.recall(
        testConfig.users.alice,
        testConfig.agents.shared,
        'learned'
      );
      const bobMemories = await episodicMemory.recall(
        testConfig.users.bob,
        testConfig.agents.shared,
        'learned'
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

      await expect(
        episodicMemory.store('', agentId, 'content', { tags: ['tag'] })
      ).rejects.toThrow('userId is required for episodic memory operations');

      await expect(episodicMemory.recall('', agentId, 'query')).rejects.toThrow(
        'userId is required for episodic memory operations'
      );

      await expect(episodicMemory.getStats('')).rejects.toThrow(
        'userId is required for episodic memory operations'
      );

      await expect(episodicMemory.getById('', 'memoryId')).rejects.toThrow(
        'userId is required for episodic memory operations'
      );
    });
  });

  describe('Storage Delegation - Core Architecture', () => {
    test('delegates store operations to storage layer', async () => {
      const storeSpy = jest.spyOn(storage.memory, 'store');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Test episodic memory';
      const tags = ['test', 'experience'];

      await episodicMemory.store(userId, agentId, content, { tags });

      expect(storeSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        expect.objectContaining({
          type: MemoryType.EPISODIC,
          content,
          importance: 0.5, // Episodic memories start neutral
          resonance: 1.0,
          metadata: expect.objectContaining({
            tags,
            expiresAt: expect.any(Number)
          })
        })
      );
    });

    test('delegates recall operations to storage layer', async () => {
      const recallSpy = jest.spyOn(storage.memory, 'recall');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const timeRange = {
        start: new Date(Date.now() - 86400000),
        end: new Date()
      };

      await episodicMemory.recall(userId, agentId, 'test query', {
        limit: 10,
        timeRange
      });

      expect(recallSpy).toHaveBeenCalledWith(userId, agentId, 'test query', {
        type: MemoryType.EPISODIC,
        limit: 10,
        timeRange
      });
    });

    test('delegates getById operations to storage layer', async () => {
      const getByIdSpy = jest.spyOn(storage.memory, 'getById');

      // First store a memory
      const userId = testConfig.users.alice;
      const memoryId = await episodicMemory.store(
        userId,
        testConfig.agents.shared,
        'Test content',
        { tags: ['test'] }
      );

      // Then retrieve it
      await episodicMemory.getById(userId, memoryId);

      expect(getByIdSpy).toHaveBeenCalledWith(userId, memoryId);
    });
  });

  describe('Tags and Context Management', () => {
    test('stores and retrieves tags correctly', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const tags = ['learning', 'important', 'coding'];

      const memoryId = await episodicMemory.store(
        userId,
        agentId,
        'Learning about React hooks',
        { tags }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.metadata?.tags).toEqual(tags);

      const retrieved = await episodicMemory.getById(userId, memoryId);
      expect(retrieved?.tags).toEqual(tags);
    });

    test('handles empty or missing tags gracefully', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // No tags provided
      const memoryId1 = await episodicMemory.store(
        userId,
        agentId,
        'Memory without tags'
      );

      const stored1 = await storage.memory.getById!(userId, memoryId1);
      expect(stored1?.metadata?.tags).toEqual([]);

      // Empty tags array
      const memoryId2 = await episodicMemory.store(
        userId,
        agentId,
        'Memory with empty tags',
        { tags: [] }
      );

      const stored2 = await storage.memory.getById!(userId, memoryId2);
      expect(stored2?.metadata?.tags).toEqual([]);
    });
  });

  describe('Session Management', () => {
    test('generates sessionId automatically', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await episodicMemory.store(
        userId,
        agentId,
        'Session test content',
        { tags: ['session'] }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.sessionId).toBeDefined();
      expect(stored?.sessionId).toMatch(/^session_\d+$/);

      const retrieved = await episodicMemory.getById(userId, memoryId);
      expect(retrieved?.sessionId).toBeDefined();
      expect(retrieved?.sessionId).toBe(stored?.sessionId);
    });
  });

  describe('Memory Data Validation', () => {
    test('stores complete episodic memory data structure', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Complete episodic memory test';
      const tags = ['complete', 'test'];

      const memoryId = await episodicMemory.store(userId, agentId, content, {
        tags
      });

      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored).toMatchObject({
        id: memoryId,
        userId,
        agentId,
        type: MemoryType.EPISODIC,
        content,
        importance: 0.5, // Neutral starting importance
        resonance: 1.0, // Full resonance when fresh
        accessCount: 0,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
        lastAccessedAt: expect.any(Number),
        sessionId: expect.stringMatching(/^session_\d+$/),
        tokenCount: 8, // Calculated: Math.ceil("Test data".length / 4)
        metadata: expect.objectContaining({
          tags,
          expiresAt: expect.any(Number)
        })
      });
    });

    test('validates memory type on getById', async () => {
      const userId = testConfig.users.alice;

      // Manually store a memory with wrong type in storage
      const wrongTypeMemory = createTestMemory({
        userId,
        type: MemoryType.WORKING // Wrong type
      });

      await storage.memory.store(
        userId,
        testConfig.agents.shared,
        wrongTypeMemory
      );

      // EpisodicMemory.getById should return null for wrong type
      const result = await episodicMemory.getById(userId, wrongTypeMemory.id);
      expect(result).toBeNull();
    });

    test('returns properly formatted EpisodicMemoryData on getById', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Test episodic content';
      const tags = ['test', 'episodic'];

      const memoryId = await episodicMemory.store(userId, agentId, content, {
        tags
      });

      const retrieved = await episodicMemory.getById(userId, memoryId);

      expect(retrieved).toMatchObject({
        id: memoryId,
        agentId,
        content,
        createdAt: expect.any(Number),
        importance: 0.5,
        sessionId: expect.stringMatching(/^session_\d+$/),
        context: '', // Default empty context
        resonance: 1.0,
        lastAccessedAt: expect.any(Number),
        accessCount: 0,
        sourceMessageIds: [], // Default empty array
        tags,
        embeddingId: undefined, // Not set by default
        metadata: expect.any(Object)
      });
    });
  });

  describe('BaseMemoryType Integration', () => {
    test('inherits automatic connection discovery from BaseMemoryType', async () => {
      // The actual test for connection discovery is in zettelkasten-e2e.test.ts
      // This test just verifies the integration is set up correctly

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Should use BaseMemoryType.store() which triggers connection discovery
      const memoryId = await episodicMemory.store(
        userId,
        agentId,
        'Content for connection test',
        { tags: ['connection'] }
      );

      expect(memoryId).toBeDefined();
      // Note: EpisodicMemory uses generateId() instead of custom prefix
      expect(memoryId).toMatch(/^[a-z0-9_]+$/);
    });
  });

  describe('Error Handling', () => {
    test('handles storage errors gracefully', async () => {
      // Mock storage to throw error
      jest
        .spyOn(storage.memory, 'store')
        .mockRejectedValueOnce(new Error('Storage failure'));

      await expect(
        episodicMemory.store(
          testConfig.users.alice,
          testConfig.agents.shared,
          'Test',
          { tags: ['error'] }
        )
      ).rejects.toThrow('Storage failure');
    });

    test('handles missing memory gracefully on getById', async () => {
      const result = await episodicMemory.getById(
        testConfig.users.alice,
        'non-existent-id'
      );
      expect(result).toBeNull();
    });
  });
});
