/**
 * Vector Operations Test
 *
 * Verifies that pgvector similarity search works correctly
 */

import { Pool } from 'pg';

import { MemoryOperations } from '../operations/memory';
import { initializeMemorySchema } from '../schema-memory';

// Test requires a PostgreSQL database with pgvector extension
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://localhost/agentdock_test';

describe('Vector Operations Test', () => {
  let pool: Pool;
  let memoryOps: MemoryOperations;
  const testSchema = 'test_memory';

  beforeAll(async () => {
    // Skip if no test database
    if (!process.env.DATABASE_URL && !process.env.CI) {
      console.warn('Skipping vector tests - no DATABASE_URL configured');
      return;
    }

    pool = new Pool({ connectionString: DATABASE_URL });

    try {
      // Create test schema
      await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await pool.query(`CREATE SCHEMA ${testSchema}`);

      // Initialize memory schema with pgvector
      await initializeMemorySchema(pool, testSchema);

      memoryOps = new MemoryOperations(pool, testSchema);
    } catch (error) {
      console.warn('Failed to setup test database:', error);
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
      await pool.end();
    }
  });

  test('should store and retrieve vectors', async () => {
    if (!pool) {
      return; // Skip if no database
    }

    const userId = 'test-user';
    const agentId = 'test-agent';

    // Create test memory
    const memory = {
      id: 'test-memory-1',
      agentId,
      userId,
      content: 'Test memory content for vector search',
      type: 'semantic' as any,
      importance: 0.8,
      resonance: 1.0,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      extractionMethod: 'test',
      sessionId: 'test-session'
    };

    // Store memory with vector
    const testVector = Array(1536)
      .fill(0)
      .map(() => Math.random());

    await memoryOps.batchCreateMemories(
      [memory],
      [
        {
          memoryId: memory.id,
          vector: testVector
        }
      ]
    );

    // Test vector similarity search
    const similarMemories = await memoryOps.findSimilar(
      userId,
      agentId,
      testVector,
      5,
      0.9 // High threshold since we're searching for the exact same vector
    );

    expect(similarMemories.length).toBeGreaterThan(0);
    expect(similarMemories[0].id).toBe(memory.id);
  });

  test('should handle vector similarity search with different thresholds', async () => {
    if (!pool) {
      return;
    }

    const userId = 'test-user';
    const agentId = 'test-agent';

    // Create multiple memories with similar vectors
    const baseVector = Array(1536)
      .fill(0)
      .map(() => Math.random());

    const memories = [
      {
        id: 'mem-1',
        content: 'First test memory',
        vector: baseVector
      },
      {
        id: 'mem-2',
        content: 'Second test memory',
        vector: baseVector.map((v) => v + 0.1) // Slightly different
      },
      {
        id: 'mem-3',
        content: 'Third test memory',
        vector: Array(1536)
          .fill(0)
          .map(() => Math.random()) // Very different
      }
    ];

    // Store all memories
    for (const mem of memories) {
      await memoryOps.batchCreateMemories(
        [
          {
            id: mem.id,
            agentId,
            userId,
            content: mem.content,
            type: 'semantic' as any,
            importance: 0.8,
            resonance: 1.0,
            accessCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessedAt: Date.now(),
            extractionMethod: 'test',
            sessionId: 'test-session'
          }
        ],
        [
          {
            memoryId: mem.id,
            vector: mem.vector
          }
        ]
      );
    }

    // Test with high threshold - should only find very similar
    const highThresholdResults = await memoryOps.findSimilar(
      userId,
      agentId,
      baseVector,
      10,
      0.95
    );

    // Test with low threshold - should find more
    const lowThresholdResults = await memoryOps.findSimilar(
      userId,
      agentId,
      baseVector,
      10,
      0.1
    );

    expect(lowThresholdResults.length).toBeGreaterThanOrEqual(
      highThresholdResults.length
    );
  });
});
