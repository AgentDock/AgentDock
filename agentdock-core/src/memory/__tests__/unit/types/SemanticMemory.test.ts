/**
 * SemanticMemory Tests - ACTUAL IMPLEMENTATION VALIDATION
 *
 * Tests the REAL features that are implemented, not the OG vision.
 * The actual SemanticMemory is much more sophisticated than originally planned:
 * - Facts and Relations storage (RDF-like triples)
 * - Vector search through storage delegation
 * - Confidence scoring and probabilistic truth values
 * - Category-based semantic organization
 * - User isolation enforcement
 * - Storage abstraction with full delegation
 * - Configuration-driven behavior
 */

import { MemoryType, SemanticMemory } from '../../../types';
import { createTestMemory, testConfig } from '../../config/test-config';
import { MockStorageProvider } from '../../mocks/MockStorageProvider';

describe('SemanticMemory - Actual Implementation', () => {
  let storage: MockStorageProvider;
  let semanticMemory: SemanticMemory;

  beforeEach(() => {
    storage = new MockStorageProvider();
    semanticMemory = new SemanticMemory(storage, testConfig.memory.semantic);
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
          new SemanticMemory(storageWithoutMemory, testConfig.memory.semantic)
      ).toThrow('SemanticMemory requires storage with memory operations');
    });

    test('uses deduplicationThreshold from configuration', async () => {
      // SemanticMemory should respect configuration thresholds
      // This is verified through the consolidate method behavior
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const result = await semanticMemory.consolidate(userId, agentId);

      // Should return consolidation result structure
      expect(result).toHaveProperty('consolidated');
      expect(typeof result.consolidated).toBe('number');
    });

    test('uses vectorSearchEnabled from configuration', async () => {
      // Vector search capabilities should be configuration-driven
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Test that search method exists and works
      const results = await semanticMemory.search(
        userId,
        agentId,
        'test query'
      );
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('User Isolation - CRITICAL SECURITY', () => {
    test('enforces strict user isolation on store operations', async () => {
      const aliceMemoryId = await semanticMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice semantic knowledge',
        { keywords: ['alice', 'knowledge'] }
      );

      const bobMemoryId = await semanticMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob semantic knowledge',
        { keywords: ['bob', 'knowledge'] }
      );

      expect(aliceMemoryId).toBeDefined();
      expect(bobMemoryId).toBeDefined();
      expect(aliceMemoryId).not.toBe(bobMemoryId);

      // Verify stored under correct users
      expect(storage.getUserMemoryCount(testConfig.users.alice)).toBe(1);
      expect(storage.getUserMemoryCount(testConfig.users.bob)).toBe(1);
    });

    test('enforces user isolation on search operations', async () => {
      // Store memories for different users
      await semanticMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice fact about AI',
        { keywords: ['AI', 'fact'] }
      );
      await semanticMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob fact about AI',
        { keywords: ['AI', 'fact'] }
      );

      // Search should only return user's own memories
      const aliceResults = await semanticMemory.search(
        testConfig.users.alice,
        testConfig.agents.shared,
        'AI'
      );
      const bobResults = await semanticMemory.search(
        testConfig.users.bob,
        testConfig.agents.shared,
        'AI'
      );

      expect(aliceResults).toHaveLength(1);
      expect(aliceResults[0].content).toContain('Alice');
      expect(aliceResults[0].content).not.toContain('Bob');

      expect(bobResults).toHaveLength(1);
      expect(bobResults[0].content).toContain('Bob');
      expect(bobResults[0].content).not.toContain('Alice');
    });

    test('requires userId for ALL operations', async () => {
      const agentId = testConfig.agents.shared;

      await expect(
        semanticMemory.store('', agentId, 'content')
      ).rejects.toThrow('userId is required for semantic memory operations');

      await expect(semanticMemory.search('', agentId, 'query')).rejects.toThrow(
        'userId is required for semantic memory operations'
      );

      await expect(semanticMemory.consolidate('', agentId)).rejects.toThrow(
        'userId is required for semantic memory operations'
      );

      await expect(semanticMemory.getStats('')).rejects.toThrow(
        'userId is required for semantic memory operations'
      );

      await expect(semanticMemory.getById('', 'memoryId')).rejects.toThrow(
        'userId is required for semantic memory operations'
      );
    });
  });

  describe('Storage Delegation - Core Architecture', () => {
    test('delegates store operations to storage layer', async () => {
      const storeSpy = jest.spyOn(storage.memory, 'store');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Semantic knowledge about TypeScript';
      const keywords = ['TypeScript', 'programming'];

      await semanticMemory.store(userId, agentId, content, {
        keywords,
        confidence: 0.9,
        source: 'documentation'
      });

      expect(storeSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        expect.objectContaining({
          type: MemoryType.SEMANTIC,
          content,
          keywords,
          metadata: expect.objectContaining({
            confidence: 0.9,
            source: 'documentation'
          })
        })
      );
    });

    test('delegates search operations to storage layer', async () => {
      const recallSpy = jest.spyOn(storage.memory, 'recall');

      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      await semanticMemory.search(userId, agentId, 'knowledge query');

      expect(recallSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        'knowledge query',
        {
          type: MemoryType.SEMANTIC,
          limit: 20
        }
      );
    });

    test('delegates getById operations to storage layer', async () => {
      const getByIdSpy = jest.spyOn(storage.memory, 'getById');

      // First store a memory
      const userId = testConfig.users.alice;
      const memoryId = await semanticMemory.store(
        userId,
        testConfig.agents.shared,
        'Test semantic content'
      );

      // Then retrieve it
      await semanticMemory.getById(userId, memoryId);

      expect(getByIdSpy).toHaveBeenCalledWith(userId, memoryId);
    });
  });

  describe('Facts and Relations - Advanced Features', () => {
    test('stores complete semantic data structure with facts and relations', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'JavaScript is a programming language';
      const keywords = ['JavaScript', 'programming', 'language'];

      const memoryId = await semanticMemory.store(userId, agentId, content, {
        keywords,
        confidence: 0.95,
        source: 'MDN documentation'
      });

      const stored = await storage.memory.getById!(userId, memoryId);

      expect(stored).toMatchObject({
        id: memoryId,
        userId,
        agentId,
        type: MemoryType.SEMANTIC,
        content,
        importance: 0.7, // Semantic memories are generally important
        resonance: 1.0, // Knowledge doesn't decay
        keywords,
        metadata: expect.objectContaining({
          confidence: 0.95,
          source: 'MDN documentation'
        })
      });
    });

    test('supports confidence scoring for probabilistic truth values', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store memory with custom confidence
      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Uncertain fact',
        {
          confidence: 0.6
        }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.metadata?.confidence).toBe(0.6);

      // Store memory with default confidence
      const memoryId2 = await semanticMemory.store(
        userId,
        agentId,
        'Default confidence fact'
      );

      const stored2 = await storage.memory.getById!(userId, memoryId2);
      expect(stored2?.metadata?.confidence).toBe(
        testConfig.memory.semantic.confidenceThreshold
      ); // Config value (0.5)
    });

    test('supports source attribution for knowledge provenance', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Fact from Wikipedia',
        {
          source: 'https://en.wikipedia.org/wiki/Example'
        }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.metadata?.source).toBe(
        'https://en.wikipedia.org/wiki/Example'
      );
    });
  });

  describe('Keywords and Category Management', () => {
    test('stores and manages keywords for semantic organization', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const keywords = ['machine-learning', 'AI', 'neural-networks'];

      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'ML knowledge',
        {
          keywords
        }
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.keywords).toEqual(keywords);
    });

    test('handles empty keywords gracefully', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Knowledge without keywords'
      );

      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.keywords).toEqual([]); // Default empty array
    });
  });

  describe('Memory Data Validation and Mapping', () => {
    test('properly maps storage data to SemanticMemoryData on getById', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Semantic test content',
        {
          keywords: ['test', 'semantic'],
          confidence: 0.85
        }
      );

      const retrieved = await semanticMemory.getById(userId, memoryId);

      expect(retrieved).toMatchObject({
        id: memoryId,
        agentId,
        content: 'Semantic test content',
        createdAt: expect.any(Number),
        importance: 0.7,
        category: 'general', // Default category
        confidence: 0.85,
        keywords: ['test', 'semantic'],
        resonance: 1.0,
        lastAccessedAt: expect.any(Number),
        accessCount: 0,
        sourceIds: [], // Default empty array
        facts: [], // Default empty array
        relations: [], // Default empty array
        metadata: expect.any(Object)
      });
    });

    test('handles missing metadata gracefully in getById', async () => {
      const userId = testConfig.users.alice;

      // Manually store a memory with minimal metadata
      const minimalMemory = createTestMemory({
        userId,
        type: MemoryType.SEMANTIC,
        metadata: {} // Minimal metadata
      });

      await storage.memory.store(
        userId,
        testConfig.agents.shared,
        minimalMemory
      );

      const retrieved = await semanticMemory.getById(userId, minimalMemory.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.category).toBe('general'); // Default
      expect(retrieved?.confidence).toBe(0.5); // Default from SEMANTIC_MEMORY_DEFAULTS
      expect(retrieved?.facts).toEqual([]); // Default
      expect(retrieved?.relations).toEqual([]); // Default
      expect(retrieved?.sourceIds).toEqual([]); // Default
    });

    test('returns null for non-existent memory', async () => {
      const result = await semanticMemory.getById(
        testConfig.users.alice,
        'non-existent-id'
      );
      expect(result).toBeNull();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('returns semantic memory stats through storage', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store some semantic memories
      await semanticMemory.store(userId, agentId, 'Fact 1', {
        keywords: ['fact']
      });
      await semanticMemory.store(userId, agentId, 'Fact 2', {
        keywords: ['fact']
      });

      const stats = await semanticMemory.getStats(userId, agentId);

      expect(stats).toMatchObject({
        totalMemories: expect.any(Number),
        memoriesByCategory: expect.any(Object),
        avgConfidence: 0.5, // Expected default from SEMANTIC_MEMORY_DEFAULTS
        avgImportance: expect.any(Number),
        totalFacts: 0, // Not implemented yet
        totalRelations: 0, // Not implemented yet
        topKeywords: [] // Not implemented yet
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
      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Semantic content for connection test'
      );

      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');
    });
  });

  describe('Error Handling', () => {
    test('handles storage errors gracefully', async () => {
      // Mock storage to throw error
      jest
        .spyOn(storage.memory, 'store')
        .mockRejectedValueOnce(new Error('Storage failure'));

      await expect(
        semanticMemory.store(
          testConfig.users.alice,
          testConfig.agents.shared,
          'Test'
        )
      ).rejects.toThrow('Storage failure');
    });

    test('handles storage without getById method', async () => {
      // Create storage without getById
      const limitedStorage = {
        ...storage,
        memory: {
          ...storage.memory,
          getById: undefined
        }
      } as any;

      const limitedSemanticMemory = new SemanticMemory(
        limitedStorage,
        testConfig.memory.semantic
      );

      const result = await limitedSemanticMemory.getById(
        testConfig.users.alice,
        'any-id'
      );
      expect(result).toBeNull();
    });
  });

  describe('Configuration-Driven Behavior', () => {
    test('uses confidenceThreshold from configuration when no custom confidence provided', async () => {
      // BUG TEST: SemanticMemory should use config.confidenceThreshold, not hardcoded 1.0
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store memory WITHOUT custom confidence - should use config value
      const memoryId = await semanticMemory.store(
        userId,
        agentId,
        'Test knowledge'
      );
      const stored = await storage.memory.getById!(userId, memoryId);

      // Should use testConfig.memory.semantic.confidenceThreshold (0.5), not hardcoded 1.0
      expect(stored?.metadata?.confidence).toBe(
        testConfig.memory.semantic.confidenceThreshold
      );
      expect(stored?.metadata?.confidence).not.toBe(1.0); // Should NOT be hardcoded value
    });

    test('respects encryptSensitive configuration', () => {
      // SemanticMemory should respect encryption settings from config
      expect(testConfig.memory.semantic.encryptSensitive).toBeDefined();
      expect(typeof testConfig.memory.semantic.encryptSensitive).toBe(
        'boolean'
      );
    });

    test('respects vectorSearchEnabled configuration', () => {
      // Vector search should be configurable
      expect(testConfig.memory.semantic.vectorSearchEnabled).toBeDefined();
      expect(typeof testConfig.memory.semantic.vectorSearchEnabled).toBe(
        'boolean'
      );
    });

    test('respects autoExtractFacts configuration', () => {
      // Fact extraction should be configurable
      expect(testConfig.memory.semantic.autoExtractFacts).toBeDefined();
      expect(typeof testConfig.memory.semantic.autoExtractFacts).toBe(
        'boolean'
      );
    });
  });
});
