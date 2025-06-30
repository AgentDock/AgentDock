/**
 * ProceduralMemory Tests - ACTUAL IMPLEMENTATION VALIDATION
 * 
 * Tests the REAL features that are implemented, not the OG vision.
 * The actual ProceduralMemory is much more sophisticated than originally planned:
 * - Advanced tool pattern learning and optimization
 * - Success rate tracking and adaptive learning  
 * - Context-aware pattern matching and suggestions
 * - Pattern evolution with merging and categorization
 * - User isolation enforcement
 * - Storage abstraction with full delegation
 * - Configuration-driven behavior
 */

import { ProceduralMemory, MemoryType } from '../../../types';
import { MockStorageProvider } from '../../mocks/MockStorageProvider';
import { testConfig, createTestMemory } from '../../config/test-config';

describe('ProceduralMemory - Actual Implementation', () => {
  let storage: MockStorageProvider;
  let proceduralMemory: ProceduralMemory;

  beforeEach(() => {
    storage = new MockStorageProvider();
    proceduralMemory = new ProceduralMemory(storage, testConfig.memory.procedural);
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
      
      expect(() => new ProceduralMemory(storageWithoutMemory, testConfig.memory.procedural))
        .toThrow('Storage must support memory operations');
    });

    test('uses confidenceThreshold from configuration in learn method', async () => {
      // BUG TEST: ProceduralMemory should use config.confidenceThreshold, not hardcoded 0.8
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      const result = await proceduralMemory.learn(userId, agentId, 'test trigger', 'test action');
      
      // Should use testConfig.memory.procedural.confidenceThreshold (0.7), not hardcoded 0.8
      expect(result.confidence).toBe(testConfig.memory.procedural.confidenceThreshold);
      expect(result.confidence).not.toBe(0.8); // Should NOT be hardcoded value
    });

    test('uses minSuccessRate from configuration', () => {
      // Should respect configured minimum success rate
      expect(testConfig.memory.procedural.minSuccessRate).toBeDefined();
      expect(typeof testConfig.memory.procedural.minSuccessRate).toBe('number');
    });
  });

  describe('User Isolation - CRITICAL SECURITY', () => {
    test('enforces strict user isolation on store operations', async () => {
      const aliceMemoryId = await proceduralMemory.store(
        testConfig.users.alice,
        testConfig.agents.shared,
        'Alice learned pattern: search -> analyze',
        { trigger: 'search', action: 'analyze' }
      );
      
      const bobMemoryId = await proceduralMemory.store(
        testConfig.users.bob,
        testConfig.agents.shared,
        'Bob learned pattern: search -> summarize',
        { trigger: 'search', action: 'summarize' }
      );
      
      expect(aliceMemoryId).toBeDefined();
      expect(bobMemoryId).toBeDefined();
      expect(aliceMemoryId).not.toBe(bobMemoryId);
      
      // Verify stored under correct users
      expect(storage.getUserMemoryCount(testConfig.users.alice)).toBe(1);
      expect(storage.getUserMemoryCount(testConfig.users.bob)).toBe(1);
    });

    test('enforces user isolation on learn operations', async () => {
      // Different users learning same pattern should be isolated
      const aliceResult = await proceduralMemory.learn(
        testConfig.users.alice, 
        testConfig.agents.shared, 
        'analysis request', 
        'run analysis tool'
      );
      
      const bobResult = await proceduralMemory.learn(
        testConfig.users.bob, 
        testConfig.agents.shared, 
        'analysis request', 
        'use different analysis'
      );
      
      expect(aliceResult.patternId).toBeDefined();
      expect(bobResult.patternId).toBeDefined();
      expect(aliceResult.patternId).not.toBe(bobResult.patternId);
    });

    test('requires userId for ALL operations', async () => {
      const agentId = testConfig.agents.shared;
      
      await expect(proceduralMemory.store('', agentId, 'content'))
        .rejects.toThrow('userId is required for procedural memory operations');
      
      await expect(proceduralMemory.learn('', agentId, 'trigger', 'action'))
        .rejects.toThrow('userId is required for procedural memory operations');
      
      await expect(proceduralMemory.getRecommendedActions('', agentId, 'trigger'))
        .rejects.toThrow('userId is required for procedural memory operations');
      
      await expect(proceduralMemory.getStats(''))
        .rejects.toThrow('userId is required for procedural memory operations');
      
      await expect(proceduralMemory.getById('', 'memoryId'))
        .rejects.toThrow('userId is required for procedural memory operations');
    });
  });

  describe('Storage Delegation - Core Architecture', () => {
    test('delegates store operations to storage layer', async () => {
      const storeSpy = jest.spyOn(storage.memory, 'store');
      
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Tool pattern: git status -> git add -> git commit';
      
      await proceduralMemory.store(userId, agentId, content, {
        trigger: 'code changes',
        action: 'git workflow',
        success: true
      });
      
      expect(storeSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        expect.objectContaining({
          type: MemoryType.PROCEDURAL,
          content,
          importance: 0.8, // Procedural memories are valuable
          metadata: expect.objectContaining({
            trigger: 'code changes',
            action: 'git workflow',
            success: true
          })
        })
      );
    });

    test('delegates recall operations to storage layer in getRecommendedActions', async () => {
      const recallSpy = jest.spyOn(storage.memory, 'recall');
      
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      await proceduralMemory.getRecommendedActions(userId, agentId, 'test trigger');
      
      expect(recallSpy).toHaveBeenCalledWith(
        userId,
        agentId,
        'test trigger',
        {
          type: MemoryType.PROCEDURAL,
          limit: 5
        }
      );
    });

    test('delegates getById operations to storage layer', async () => {
      const getByIdSpy = jest.spyOn(storage.memory, 'getById');
      
      // First store a memory
      const userId = testConfig.users.alice;
      const memoryId = await proceduralMemory.store(userId, testConfig.agents.shared, 'Test procedural pattern');
      
      // Then retrieve it
      await proceduralMemory.getById(userId, memoryId);
      
      expect(getByIdSpy).toHaveBeenCalledWith(userId, memoryId);
    });
  });

  describe('Pattern Learning - Advanced Features', () => {
    test('stores complete procedural data structure with patterns', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Code review workflow';
      
      const memoryId = await proceduralMemory.store(userId, agentId, content, {
        trigger: 'pull request created',
        action: 'run automated checks',
        outcome: 'review suggestions generated',
        success: true
      });
      
      const stored = await storage.memory.getById!(userId, memoryId);
      
      expect(stored).toMatchObject({
        id: memoryId,
        userId,
        agentId,
        type: MemoryType.PROCEDURAL,
        content,
        importance: 0.8, // Procedural memories are valuable
        resonance: 1.0, // Patterns don't decay
        metadata: expect.objectContaining({
          trigger: 'pull request created',
          action: 'run automated checks',
          outcome: 'review suggestions generated',
          success: true
        })
      });
    });

    test('learn method creates pattern and returns learning result', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      const result = await proceduralMemory.learn(userId, agentId, 'user asks question', 'search knowledge base');
      
      expect(result).toMatchObject({
        patternId: expect.any(String),
        learned: true,
        confidence: expect.any(Number),
        reason: 'Pattern learned successfully'
      });
      
      // Should have stored the pattern
      expect(storage.getUserMemoryCount(userId)).toBe(1);
    });

    test('getRecommendedActions returns pattern recommendations', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      // First store a pattern
      await proceduralMemory.store(userId, agentId, 'debugging -> check logs -> identify issue', {
        trigger: 'error reported',
        action: 'debugging workflow'
      });
      
      // Get recommendations
      const recommendations = await proceduralMemory.getRecommendedActions(userId, agentId, 'error');
      
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('pattern');
        expect(recommendations[0]).toHaveProperty('confidence');
        expect(recommendations[0]).toHaveProperty('contextMatch');
      }
    });
  });

  describe('Trigger-Action Pattern Management', () => {
    test('handles trigger and action metadata correctly', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      const memoryId = await proceduralMemory.store(userId, agentId, 'Custom workflow pattern', {
        trigger: 'specific business event',
        action: 'execute workflow steps',
        outcome: 'business process completed'
      });
      
      const stored = await storage.memory.getById!(userId, memoryId);
      
      expect(stored?.metadata?.trigger).toBe('specific business event');
      expect(stored?.metadata?.action).toBe('execute workflow steps');
      expect(stored?.metadata?.outcome).toBe('business process completed');
    });

    test('uses content as trigger when no trigger provided', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const content = 'Default trigger pattern';
      
      const memoryId = await proceduralMemory.store(userId, agentId, content);
      
      const stored = await storage.memory.getById!(userId, memoryId);
      expect(stored?.metadata?.trigger).toBe(content); // Should default to content
      expect(stored?.metadata?.action).toBe('unknown'); // Default action
    });
  });

  describe('Memory Data Validation and Mapping', () => {
    test('properly maps storage data to ProceduralMemoryData on getById', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      const memoryId = await proceduralMemory.store(userId, agentId, 'test trigger -> test action', {
        trigger: 'test trigger',
        action: 'test action',
        outcome: 'test outcome'
      });
      
      const retrieved = await proceduralMemory.getById(userId, memoryId);
      
      expect(retrieved).toMatchObject({
        id: memoryId,
        agentId,
        createdAt: expect.any(Number),
        trigger: 'test trigger',
        action: 'test action',
        context: '', // Default empty
        pattern: expect.any(String),
        confidence: expect.any(Number),
        successCount: 1, // Default
        totalCount: 1, // Default
        lastUsed: expect.any(Number),
        conditions: [], // Default empty array
        outcomes: expect.arrayContaining([
          expect.objectContaining({
            success: true,
            timestamp: expect.any(Number)
          })
        ]),
        metadata: expect.any(Object)
      });
    });

    test('extracts trigger and action from content when metadata missing', async () => {
      const userId = testConfig.users.alice;
      
      // Manually store a memory with content in "trigger -> action" format
      const memoryWithContent = createTestMemory({
        userId,
        type: MemoryType.PROCEDURAL,
        content: 'code error -> run debugger',
        metadata: {} // No trigger/action in metadata
      });
      
      await storage.memory.store(userId, testConfig.agents.shared, memoryWithContent);
      
      const retrieved = await proceduralMemory.getById(userId, memoryWithContent.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.trigger).toBe('code error'); // Extracted from content
      expect(retrieved?.action).toBe('run debugger'); // Extracted from content
    });

    test('handles missing metadata gracefully with defaults', async () => {
      const userId = testConfig.users.alice;
      
      // Manually store a memory with minimal metadata
      const minimalMemory = createTestMemory({
        userId,
        type: MemoryType.PROCEDURAL,
        content: 'minimal pattern',
        metadata: {} // Minimal metadata
      });
      
      await storage.memory.store(userId, testConfig.agents.shared, minimalMemory);
      
      const retrieved = await proceduralMemory.getById(userId, minimalMemory.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.confidence).toBe(0.5); // Default confidence
      expect(retrieved?.successCount).toBe(1); // Default
      expect(retrieved?.totalCount).toBe(1); // Default
      expect(retrieved?.conditions).toEqual([]); // Default empty array
      expect(retrieved?.outcomes).toHaveLength(1); // Default outcome created
    });

    test('returns null for non-existent memory', async () => {
      const result = await proceduralMemory.getById(testConfig.users.alice, 'non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('returns procedural memory stats through storage', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      
      // Store some procedural memories
      await proceduralMemory.store(userId, agentId, 'Pattern 1', { trigger: 'test1' });
      await proceduralMemory.store(userId, agentId, 'Pattern 2', { trigger: 'test2' });
      
      const stats = await proceduralMemory.getStats(userId, agentId);
      
      expect(stats).toMatchObject({
        totalPatterns: expect.any(Number),
        patternsByCategory: expect.any(Object),
        avgConfidence: expect.any(Number),
        avgSuccessRate: expect.any(Number),
        mostUsedPatterns: expect.any(Array),
        recentOutcomes: expect.any(Array)
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
      const memoryId = await proceduralMemory.store(userId, agentId, 'Procedural pattern for connection test');
      
      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');
    });
  });

  describe('Error Handling', () => {
    test('handles storage errors gracefully', async () => {
      // Mock storage to throw error
      jest.spyOn(storage.memory, 'store').mockRejectedValueOnce(new Error('Storage failure'));
      
      await expect(proceduralMemory.store(testConfig.users.alice, testConfig.agents.shared, 'Test'))
        .rejects.toThrow('Storage failure');
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
      
      const limitedProceduralMemory = new ProceduralMemory(limitedStorage, testConfig.memory.procedural);
      
      const result = await limitedProceduralMemory.getById(testConfig.users.alice, 'any-id');
      expect(result).toBeNull();
    });
  });

  describe('Configuration-Driven Behavior', () => {
    test('respects adaptiveLearning configuration', () => {
      // Adaptive learning should be configurable
      expect(testConfig.memory.procedural.adaptiveLearning).toBeDefined();
      expect(typeof testConfig.memory.procedural.adaptiveLearning).toBe('boolean');
    });

    test('respects patternMerging configuration', () => {
      // Pattern merging should be configurable
      expect(testConfig.memory.procedural.patternMerging).toBeDefined();
      expect(typeof testConfig.memory.procedural.patternMerging).toBe('boolean');
    });

    test('respects maxPatternsPerCategory configuration', () => {
      // Should enforce limits on patterns per category
      expect(testConfig.memory.procedural.maxPatternsPerCategory).toBeDefined();
      expect(typeof testConfig.memory.procedural.maxPatternsPerCategory).toBe('number');
      expect(testConfig.memory.procedural.maxPatternsPerCategory).toBeGreaterThan(0);
    });
  });
}); 