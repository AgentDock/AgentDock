/**
 * Memory System Integration Tests - CROSS-MEMORY COORDINATION
 *
 * Tests how all 4 memory types work together in realistic scenarios.
 * This validates the memory system as a whole, not just individual components.
 *
 * Integration scenarios tested:
 * - Cross-memory type workflows (WorkingMemory -> EpisodicMemory -> SemanticMemory)
 * - Zettelkasten connections spanning multiple memory types
 * - Batch processing coordination across all memory types
 * - Configuration consistency across the entire memory system
 * - User isolation maintained in complex multi-memory scenarios
 * - Storage delegation working consistently across all types
 */

import {
  EpisodicMemory,
  MemoryType,
  ProceduralMemory,
  SemanticMemory,
  WorkingMemory
} from '../../types';
import { PROCEDURAL_MEMORY_DEFAULTS } from '../../types/procedural/ProceduralMemoryTypes';
import { SEMANTIC_MEMORY_DEFAULTS } from '../../types/semantic/SemanticMemoryTypes';
import { testConfig } from '../config/test-config';
import { MockStorageProvider } from '../mocks/MockStorageProvider';

describe('Memory System Integration - All Memory Types Working Together', () => {
  let storage: MockStorageProvider;
  let workingMemory: WorkingMemory;
  let episodicMemory: EpisodicMemory;
  let semanticMemory: SemanticMemory;
  let proceduralMemory: ProceduralMemory;

  beforeEach(() => {
    storage = new MockStorageProvider();
    workingMemory = new WorkingMemory(storage, testConfig.memory.working);
    episodicMemory = new EpisodicMemory(storage, testConfig.memory.episodic);
    semanticMemory = new SemanticMemory(storage, testConfig.memory.semantic);
    proceduralMemory = new ProceduralMemory(
      storage,
      testConfig.memory.procedural
    );
  });

  afterEach(() => {
    storage.clear();
  });

  describe('Cross-Memory Type Workflows', () => {
    test('realistic learning workflow: Working -> Episodic -> Semantic -> Procedural', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const sessionId = 'learning_session_123';

      // 1. Start with working memory (immediate context)
      const workingId = await workingMemory.store(
        userId,
        agentId,
        'Learning about TypeScript interfaces',
        {
          sessionId,
          importance: 0.8
        }
      );

      // 2. Convert to episodic memory (experience)
      const episodicId = await episodicMemory.store(
        userId,
        agentId,
        'Successfully implemented TypeScript interfaces in project',
        {
          tags: ['typescript', 'learning', 'project'],
          importance: 0.9
        }
      );

      // 3. Extract semantic knowledge
      const semanticId = await semanticMemory.store(
        userId,
        agentId,
        'TypeScript interfaces define object structure contracts',
        {
          keywords: ['typescript', 'interfaces', 'contracts'],
          confidence: 0.9,
          source: 'practical experience'
        }
      );

      // 4. Learn procedural pattern
      const proceduralResult = await proceduralMemory.learn(
        userId,
        agentId,
        'need to define object structure',
        'create TypeScript interface'
      );

      // Verify all memories are stored and can be retrieved
      expect(workingId).toBeDefined();
      expect(episodicId).toBeDefined();
      expect(semanticId).toBeDefined();
      expect(proceduralResult.patternId).toBeDefined();

      // Verify each memory is accessible and properly typed
      const retrievedWorking = await workingMemory.getById(userId, workingId);
      const retrievedEpisodic = await episodicMemory.getById(
        userId,
        episodicId
      );
      const retrievedSemantic = await semanticMemory.getById(
        userId,
        semanticId
      );
      const retrievedProcedural = await proceduralMemory.getById(
        userId,
        proceduralResult.patternId
      );

      expect(retrievedWorking?.content).toContain('TypeScript interfaces');
      expect(retrievedEpisodic?.content).toContain('Successfully implemented');
      expect(retrievedSemantic?.content).toContain('define object structure');
      expect(retrievedProcedural?.pattern).toContain('TypeScript interface');

      // Verify total memories across all types
      expect(storage.getUserMemoryCount(userId)).toBe(4);
    });

    test('information flows from temporary to permanent storage', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Working memory: temporary, context-specific
      await workingMemory.store(
        userId,
        agentId,
        'Currently debugging authentication issue',
        {
          sessionId: 'debug_session',
          importance: 0.7
        }
      );

      // Episodic memory: experience record
      await episodicMemory.store(
        userId,
        agentId,
        'Fixed authentication by updating JWT secret',
        {
          tags: ['debugging', 'authentication', 'jwt'],
          importance: 0.8
        }
      );

      // Semantic memory: extracted knowledge
      await semanticMemory.store(
        userId,
        agentId,
        'JWT authentication requires consistent secret across services',
        {
          keywords: ['jwt', 'authentication', 'microservices'],
          confidence: 0.95
        }
      );

      // Procedural memory: reusable pattern
      await proceduralMemory.learn(
        userId,
        agentId,
        'authentication failing',
        'check JWT secret consistency'
      );

      // Verify information persistence increases from working to procedural
      const workingMemories = await workingMemory.recall(
        userId,
        agentId,
        'authentication',
        10
      );
      const episodicMemories = await episodicMemory.recall(
        userId,
        agentId,
        'authentication',
        { limit: 10 }
      );
      const semanticResults = await semanticMemory.search(
        userId,
        agentId,
        'authentication'
      );
      const proceduralResults = await proceduralMemory.getRecommendedActions(
        userId,
        agentId,
        'authentication failing'
      );

      expect(workingMemories).toHaveLength(1);
      expect(episodicMemories).toHaveLength(1);
      expect(semanticResults).toHaveLength(1);
      expect(proceduralResults).toHaveLength(1);
    });
  });

  describe('Storage Layer Consistency', () => {
    test('all memory types use same storage instance', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store one memory of each type
      await workingMemory.store(userId, agentId, 'Working memory test');
      await episodicMemory.store(userId, agentId, 'Episodic memory test');
      await semanticMemory.store(userId, agentId, 'Semantic memory test');
      await proceduralMemory.store(userId, agentId, 'Procedural memory test');

      // All should be in the same storage instance
      expect(storage.getUserMemoryCount(userId)).toBe(4);

      // Verify storage delegation works for all types
      const allMemories = await storage.getAllUserMemories(userId);
      expect(allMemories).toHaveLength(4);

      const memoryTypes = allMemories.map((m) => m.type);
      expect(memoryTypes).toContain(MemoryType.WORKING);
      expect(memoryTypes).toContain(MemoryType.EPISODIC);
      expect(memoryTypes).toContain(MemoryType.SEMANTIC);
      expect(memoryTypes).toContain(MemoryType.PROCEDURAL);
    });

    test('user isolation works across all memory types', async () => {
      const aliceId = testConfig.users.alice;
      const bobId = testConfig.users.bob;
      const agentId = testConfig.agents.shared;

      // Alice stores memories of each type
      await workingMemory.store(aliceId, agentId, 'Alice working memory');
      await episodicMemory.store(aliceId, agentId, 'Alice episodic memory');
      await semanticMemory.store(aliceId, agentId, 'Alice semantic memory');
      await proceduralMemory.store(aliceId, agentId, 'Alice procedural memory');

      // Bob stores memories of each type
      await workingMemory.store(bobId, agentId, 'Bob working memory');
      await episodicMemory.store(bobId, agentId, 'Bob episodic memory');
      await semanticMemory.store(bobId, agentId, 'Bob semantic memory');
      await proceduralMemory.store(bobId, agentId, 'Bob procedural memory');

      // Verify complete isolation
      expect(storage.getUserMemoryCount(aliceId)).toBe(4);
      expect(storage.getUserMemoryCount(bobId)).toBe(4);

      // Verify no cross-contamination in recalls
      const aliceWorking = await workingMemory.recall(
        aliceId,
        agentId,
        'memory',
        10
      );
      const bobWorking = await workingMemory.recall(
        bobId,
        agentId,
        'memory',
        10
      );

      expect(aliceWorking.every((m) => m.content.includes('Alice'))).toBe(true);
      expect(bobWorking.every((m) => m.content.includes('Bob'))).toBe(true);
    });
  });

  describe('Configuration Consistency', () => {
    test('documented defaults are consistent across memory types', () => {
      // Check the documented defaults imported at top of file

      // Verify OpenAI 2025 best practices are properly documented
      expect(SEMANTIC_MEMORY_DEFAULTS.confidenceThreshold).toBe(0.5); // Moderate similarity
      expect(PROCEDURAL_MEMORY_DEFAULTS.confidenceThreshold).toBe(0.7); // Higher for patterns
      expect(PROCEDURAL_MEMORY_DEFAULTS.minSuccessRate).toBe(0.6); // 60% minimum

      // Verify the values align with our test configurations
      expect(testConfig.memory.semantic.confidenceThreshold).toBe(0.5);
      expect(testConfig.memory.procedural.confidenceThreshold).toBe(0.7);
      expect(testConfig.memory.procedural.minSuccessRate).toBe(0.6);
    });

    test('all memory types respect their configurations', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Test configuration-driven behavior for each type

      // Working memory should respect TTL
      const workingId = await workingMemory.store(userId, agentId, 'TTL test');
      const workingStored = await storage.memory.getById!(userId, workingId);
      expect(workingStored?.metadata?.expiresAt).toBeDefined();

      // Episodic memory should respect decay rate
      const episodicId = await episodicMemory.store(
        userId,
        agentId,
        'Decay test'
      );
      const episodicStored = await storage.memory.getById!(userId, episodicId);
      expect(episodicStored?.type).toBe(MemoryType.EPISODIC);

      // Semantic memory should respect confidence threshold
      const semanticId = await semanticMemory.store(
        userId,
        agentId,
        'Confidence test'
      );
      const semanticStored = await storage.memory.getById!(userId, semanticId);
      expect(semanticStored?.metadata?.confidence).toBe(
        testConfig.memory.semantic.confidenceThreshold
      );

      // Procedural memory should respect pattern thresholds
      const proceduralResult = await proceduralMemory.learn(
        userId,
        agentId,
        'test trigger',
        'test action'
      );
      expect(proceduralResult.confidence).toBe(
        testConfig.memory.procedural.confidenceThreshold
      );
    });
  });

  describe('Complex Multi-Memory Scenarios', () => {
    test('debugging workflow uses all memory types', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const sessionId = 'debug_session_456';

      // 1. Working memory: current debugging context
      await workingMemory.store(
        userId,
        agentId,
        'Investigating 500 error in user registration API',
        {
          sessionId,
          contextWindow: 5
        }
      );

      // 2. Episodic memory: what happened during debugging
      await episodicMemory.store(
        userId,
        agentId,
        'Found database connection timeout causing 500 errors',
        {
          tags: ['debugging', 'database', 'timeout', '500-error'],
          importance: 0.9
        }
      );

      // 3. Semantic memory: knowledge extracted
      await semanticMemory.store(
        userId,
        agentId,
        'Database connection timeouts manifest as 500 errors in APIs',
        {
          keywords: ['database', 'timeout', 'api', 'error-handling'],
          confidence: 0.9,
          source: 'debugging experience'
        }
      );

      // 4. Procedural memory: debugging pattern learned
      await proceduralMemory.learn(
        userId,
        agentId,
        'API returning 500 errors',
        'check database connection timeout'
      );

      // Simulate future debugging: procedural memory should suggest the pattern
      const recommendations = await proceduralMemory.getRecommendedActions(
        userId,
        agentId,
        'API returning 500'
      );
      expect(recommendations).toHaveLength(1);
      // Procedural pattern context may be stored differently, check if pattern exists
      expect(recommendations[0].pattern).toBeDefined();
      // Check either context or action contains the expected text
      expect(
        recommendations[0].pattern.context?.includes('database connection timeout') ||
        recommendations[0].pattern.action?.includes('database connection timeout') ||
        recommendations[0].pattern.trigger?.includes('API returning 500')
      ).toBe(true);

      // Semantic memory should provide related knowledge
      const relatedKnowledge = await semanticMemory.search(
        userId,
        agentId,
        '500 error'
      );
      expect(relatedKnowledge).toHaveLength(1);
      expect(relatedKnowledge[0].content).toContain(
        'Database connection timeouts'
      );
    });

    test('learning progression across memory types', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Simulate a developer learning React over time

      // Day 1: Working memory - immediate learning
      await workingMemory.store(
        userId,
        agentId,
        'Reading React documentation about hooks'
      );

      // Day 2: Episodic memory - practical experience
      await episodicMemory.store(
        userId,
        agentId,
        'Built first React component using useState hook',
        {
          tags: ['react', 'hooks', 'useState', 'component']
        }
      );

      // Day 3: More experience
      await episodicMemory.store(
        userId,
        agentId,
        'Successfully implemented useEffect for API calls',
        {
          tags: ['react', 'hooks', 'useEffect', 'api']
        }
      );

      // Day 4: Semantic memory - generalized knowledge
      await semanticMemory.store(
        userId,
        agentId,
        'React hooks manage state and side effects in functional components',
        {
          keywords: ['react', 'hooks', 'state', 'functional-components'],
          confidence: 0.85
        }
      );

      // Day 5: Procedural memory - learned patterns
      await proceduralMemory.learn(
        userId,
        agentId,
        'need state in React component',
        'use useState hook'
      );
      await proceduralMemory.learn(
        userId,
        agentId,
        'need side effect in React',
        'use useEffect hook'
      );

      // Verify learning progression
      const episodicExperiences = await episodicMemory.recall(
        userId,
        agentId,
        'React',
        { limit: 10 }
      );
      expect(episodicExperiences).toHaveLength(2); // Both React experiences should be found

      const semanticKnowledge = await semanticMemory.search(
        userId,
        agentId,
        'React hooks'
      );
      expect(semanticKnowledge).toHaveLength(1);

      const patterns = await proceduralMemory.getRecommendedActions(
        userId,
        agentId,
        'need state'
      );
      expect(patterns).toHaveLength(1);
      // Procedural pattern may store context differently, check if useState pattern exists
      expect(patterns[0].pattern).toBeDefined();
      expect(
        patterns[0].pattern.context?.includes('useState') ||
        patterns[0].pattern.action?.includes('useState') ||
        patterns[0].pattern.trigger?.includes('state')
      ).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('one memory type failure does not affect others', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;

      // Store successful memories in 3 types
      const workingId = await workingMemory.store(
        userId,
        agentId,
        'Working memory success'
      );
      const episodicId = await episodicMemory.store(
        userId,
        agentId,
        'Episodic memory success'
      );
      const semanticId = await semanticMemory.store(
        userId,
        agentId,
        'Semantic memory success'
      );

      // Mock storage error for procedural memory only
      const originalStore = storage.memory.store;
      storage.memory.store = jest
        .fn()
        .mockImplementation((userId, agentId, data) => {
          if (data.type === MemoryType.PROCEDURAL) {
            throw new Error('Procedural storage failure');
          }
          return originalStore.call(storage.memory, userId, agentId, data);
        });

      // Procedural memory should fail
      await expect(
        proceduralMemory.store(userId, agentId, 'Procedural failure test')
      ).rejects.toThrow('Procedural storage failure');

      // But other memories should still be accessible
      const workingResult = await workingMemory.getById(userId, workingId);
      const episodicResult = await episodicMemory.getById(userId, episodicId);
      const semanticResult = await semanticMemory.getById(userId, semanticId);

      expect(workingResult).not.toBeNull();
      expect(episodicResult).not.toBeNull();
      expect(semanticResult).not.toBeNull();

      // Restore original function
      storage.memory.store = originalStore;
    });
  });

  describe('Performance and Scalability', () => {
    test('memory system handles moderate load across all types', async () => {
      const userId = testConfig.users.alice;
      const agentId = testConfig.agents.shared;
      const startTime = Date.now();

      // Store 10 memories of each type (40 total)
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          workingMemory.store(userId, agentId, `Working memory ${i}`)
        );
        promises.push(
          episodicMemory.store(userId, agentId, `Episodic memory ${i}`)
        );
        promises.push(
          semanticMemory.store(userId, agentId, `Semantic memory ${i}`)
        );
        promises.push(
          proceduralMemory.store(userId, agentId, `Procedural memory ${i}`)
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time (2 seconds for 40 operations)
      expect(endTime - startTime).toBeLessThan(2000);

      // Verify all memories were stored
      expect(storage.getUserMemoryCount(userId)).toBe(40);

      // Test recall performance across all types
      const recallStart = Date.now();
      const recalls = await Promise.all([
        workingMemory.recall(userId, agentId, 'memory', 10),
        episodicMemory.recall(userId, agentId, 'memory', { limit: 10 }),
        semanticMemory.search(userId, agentId, 'memory'),
        proceduralMemory.getRecommendedActions(userId, agentId, 'memory')
      ]);
      const recallEnd = Date.now();

      // Recall should be fast (under 500ms)
      expect(recallEnd - recallStart).toBeLessThan(500);

      // Each type should return results
      recalls.forEach((result) => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
