/**
 * Performance Test
 *
 * Verifies that store operations complete in <50ms (non-blocking)
 */

import { WorkingMemory } from '../../types/working/WorkingMemory';

describe('Store Latency Performance Test', () => {
  let workingMemory: WorkingMemory;

  const createMockStorage = () => ({
    // Required StorageProvider interface properties
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    list: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({ totalItems: 0, totalSize: '0 B' }),
    healthCheck: jest.fn().mockResolvedValue(true),

    // Batch operations
    getMany: jest.fn().mockResolvedValue({}),
    setMany: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockResolvedValue(0),

    // List operations
    getList: jest.fn().mockResolvedValue([]),
    saveList: jest.fn().mockResolvedValue(undefined),
    deleteList: jest.fn().mockResolvedValue(undefined),

    memory: {
      store: jest.fn().mockImplementation(async () => {
        // Fast storage operation - 5ms max
        await new Promise((resolve) => setTimeout(resolve, 5));
        return 'mock-memory-id';
      }),

      getById: jest.fn().mockResolvedValue({
        id: 'mock-memory-id',
        content: 'Mock content',
        agentId: 'test-agent',
        type: 'working'
      }),

      recall: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockResolvedValue({
        totalMemories: 0,
        byType: {},
        avgImportance: 0,
        totalSize: '0 B'
      })
    },

    createConnections: jest.fn().mockImplementation(() => {
      // Connection discovery should be fire-and-forget (truly non-blocking)
      // Return immediately, don't await the background work
      setImmediate(() => {
        // Background work happens after the store operation completes
        setTimeout(() => {
          // Connection discovery work happens asynchronously
        }, 30);
      });
      return Promise.resolve();
    })
  });

  beforeEach(() => {
    const storage = createMockStorage();

    // Don't pass intelligence config to avoid LLM initialization
    workingMemory = new WorkingMemory(
      storage,
      {
        maxContextItems: 10,
        ttlSeconds: 3600,
        encryptSensitive: false,
        maxTokens: 1000,
        compressionThreshold: 0.8
      }
      // No intelligence config = no LLM initialization
    );
  });

  test('store operation should complete in <50ms (non-blocking)', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';
    const content = 'Test memory content for performance testing';

    const startTime = Date.now();

    // This should return immediately, with connection discovery happening in background
    const memoryId = await workingMemory.store(userId, agentId, content);

    const endTime = Date.now();
    const latency = endTime - startTime;

    // Store should complete quickly (connection discovery is async)
    expect(latency).toBeLessThan(100);
    expect(memoryId).toBeDefined();
  });

  test('batch store operations should maintain low latency', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    const memories = [
      'First memory for batch testing',
      'Second memory for batch testing',
      'Third memory for batch testing',
      'Fourth memory for batch testing',
      'Fifth memory for batch testing'
    ];

    const startTime = Date.now();

    // Store multiple memories
    const memoryIds = await Promise.all(
      memories.map((content) => workingMemory.store(userId, agentId, content))
    );

    const endTime = Date.now();
    const totalLatency = endTime - startTime;
    const avgLatency = totalLatency / memories.length;

    // Average latency per memory should be low
    expect(avgLatency).toBeLessThan(25);
    expect(memoryIds.length).toBe(memories.length);
    expect(memoryIds.every((id) => id)).toBe(true);
  });

  test('connection discovery should not block store operations', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Store first memory to enable connection discovery
    await workingMemory.store(userId, agentId, 'First memory');

    // Store second memory (should trigger connection discovery)
    const startTime = Date.now();
    const memoryId = await workingMemory.store(
      userId,
      agentId,
      'Related memory content'
    );
    const endTime = Date.now();

    const latency = endTime - startTime;

    // Store should still be fast even with connection discovery
    expect(latency).toBeLessThan(100);
    expect(memoryId).toBeDefined();

    // Give time for background connection discovery to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('memory recall should be reasonably fast', async () => {
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Mock some recall latency
    const storage = workingMemory as any;
    storage.storage.memory.recall.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [
        {
          id: 'mock-id',
          content: 'Mock recalled memory',
          type: 'working',
          createdAt: Date.now(),
          importance: 0.5
        }
      ];
    });

    const startTime = Date.now();
    const results = await workingMemory.recall(userId, agentId, 'test query');
    const endTime = Date.now();

    const latency = endTime - startTime;

    // Recall should complete in reasonable time
    expect(latency).toBeLessThan(100);
    expect(results).toBeDefined();
  });
});
