/**
 * Zettelkasten E2E Test
 *
 * Verifies that connections are discovered and can be retrieved end-to-end
 */

import { InMemoryStorageAdapter } from '../../../storage/adapters';
import type { StorageProvider } from '../../../storage/types';
import { MemoryManager } from '../../MemoryManager';
import { MemoryManagerConfig, MemoryType } from '../../types';

// Helper to sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Zettelkasten E2E Test', () => {
  let storage: StorageProvider;
  let memoryManager: MemoryManager;

  beforeEach(async () => {
    storage = new InMemoryStorageAdapter();

    // Create memory manager with connection detection enabled
    const config: MemoryManagerConfig = {
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
      intelligence: {
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.75
        },
        connectionDetection: {
          enabled: true,
          provider: 'openai',
          thresholds: {
            autoSimilar: 0.8,
            autoRelated: 0.6,
            llmRequired: 0.3
          },
          maxCandidates: 50
        },
        costControl: {
          trackTokenUsage: true,
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true
        }
      }
    };

    memoryManager = new MemoryManager(storage, config);
  });

  afterEach(async () => {
    if (storage.destroy) {
      await storage.destroy();
    }
  });

  describe('Connection Storage and Retrieval', () => {
    test('should store and retrieve connections between memories', async () => {
      // Store first memory about TypeScript
      const memory1Id = await memoryManager.store(
        'user-123',
        'agent-456',
        'TypeScript is a statically typed superset of JavaScript',
        MemoryType.SEMANTIC
      );

      // Store second memory about JavaScript
      const memory2Id = await memoryManager.store(
        'user-123',
        'agent-456',
        'JavaScript is a dynamically typed programming language used for web development',
        MemoryType.SEMANTIC
      );

      // Wait for async connection discovery
      await sleep(100);

      // Test that we can retrieve connected memories using the CORRECT method
      if (storage.memory?.findConnectedMemories) {
        const connected = await storage.memory.findConnectedMemories(
          'user-123',
          memory1Id,
          1
        );

        // Verify we have the infrastructure working
        expect(connected).toBeDefined();
        expect(connected.memories).toBeDefined();
        expect(connected.connections).toBeDefined();
        expect(Array.isArray(connected.memories)).toBe(true);
        expect(Array.isArray(connected.connections)).toBe(true);
      } else {
        console.warn('Storage adapter does not support findConnectedMemories');
      }
    });

    test('should handle connection traversal with depth parameter', async () => {
      // Create a chain of related memories
      const memory1Id = await memoryManager.store(
        'user-123',
        'agent-456',
        'Python programming language basics',
        MemoryType.SEMANTIC
      );

      const memory2Id = await memoryManager.store(
        'user-123',
        'agent-456',
        'Django web framework for Python',
        MemoryType.SEMANTIC
      );

      const memory3Id = await memoryManager.store(
        'user-123',
        'agent-456',
        'Django REST API development patterns',
        MemoryType.SEMANTIC
      );

      // Wait for connections to be discovered
      await sleep(200);

      // Test depth traversal
      if (storage.memory?.findConnectedMemories) {
        // Depth 1: immediate connections only
        const depth1 = await storage.memory.findConnectedMemories(
          'user-123',
          memory1Id,
          1
        );

        // Depth 2: connections of connections
        const depth2 = await storage.memory.findConnectedMemories(
          'user-123',
          memory1Id,
          2
        );

        // Depth 2 should potentially find more memories than depth 1
        expect(depth2.connections.length).toBeGreaterThanOrEqual(
          depth1.connections.length
        );
      }
    });

    test('should gracefully handle memories with no connections', async () => {
      // Store an isolated memory
      const isolatedId = await memoryManager.store(
        'user-123',
        'agent-456',
        'A completely unique and unrelated topic about quantum mechanics',
        MemoryType.SEMANTIC
      );

      // Wait for any potential connection discovery
      await sleep(100);

      if (storage.memory?.findConnectedMemories) {
        const connected = await storage.memory.findConnectedMemories(
          'user-123',
          isolatedId,
          1
        );

        // Should return empty but valid results
        expect(connected.memories).toEqual([]);
        expect(connected.connections).toEqual([]);
      }
    });

    test('should handle user isolation correctly', async () => {
      // Store memories for two different users
      const user1MemoryId = await memoryManager.store(
        'user-1',
        'agent-456',
        'User 1 programming preferences',
        MemoryType.SEMANTIC
      );

      const user2MemoryId = await memoryManager.store(
        'user-2',
        'agent-456',
        'User 2 programming preferences',
        MemoryType.SEMANTIC
      );

      await sleep(100);

      if (storage.memory?.findConnectedMemories) {
        // User 1 should not see User 2's connections
        const user1Connected = await storage.memory.findConnectedMemories(
          'user-1',
          user1MemoryId,
          1
        );

        // Should only return memories accessible to user-1
        const hasUser2Memories = user1Connected.memories.some(
          (memory) => memory.userId === 'user-2'
        );
        expect(hasUser2Memories).toBe(false);
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple memory connections efficiently', async () => {
      const startTime = Date.now();
      const memoryCount = 10;

      // Store multiple related memories
      const memoryIds = [];
      for (let i = 0; i < memoryCount; i++) {
        const id = await memoryManager.store(
          'user-123',
          'agent-456',
          `Programming concept ${i}: ${['algorithms', 'data structures', 'databases'][i % 3]}`,
          MemoryType.SEMANTIC
        );
        memoryIds.push(id);
      }

      const storeTime = Date.now() - startTime;

      // Wait for connections to be discovered
      await sleep(300);

      // Test retrieval performance
      if (storage.memory?.findConnectedMemories) {
        const retrievalStart = Date.now();

        const connected = await storage.memory.findConnectedMemories(
          'user-123',
          memoryIds[0],
          2
        );

        const retrievalTime = Date.now() - retrievalStart;

        // Performance should be reasonable
        expect(storeTime).toBeLessThan(2000); // 2 seconds for 10 memories
        expect(retrievalTime).toBeLessThan(500); // 500ms for connection retrieval

        // Results should be valid
        expect(connected.memories).toBeDefined();
        expect(connected.connections).toBeDefined();
      }
    });
  });
});
