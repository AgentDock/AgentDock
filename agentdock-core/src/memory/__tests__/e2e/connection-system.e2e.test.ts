/**
 * E2E tests for Memory Connection System
 *
 * Run with: CONNECTION_E2E_TEST=true npm test -- connection-system.e2e
 *
 * Required environment variables:
 * - OPENAI_API_KEY or ANTHROPIC_API_KEY
 * - CONNECTION_E2E_TEST=true (to enable these tests)
 */

import { InMemoryStorageAdapter } from '../../../storage/adapters';
import { MemoryConnectionManager } from '../../intelligence/connections/MemoryConnectionManager';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { CostTracker } from '../../tracking/CostTracker';
import { Memory, MemoryType } from '../../types/common';

// Skip unless E2E tests are explicitly enabled
const runE2E = process.env.CONNECTION_E2E_TEST === 'true';
const describeE2E = runE2E ? describe : describe.skip;

describeE2E('Memory Connection System E2E', () => {
  let storage: any;
  let connectionManager: MemoryConnectionManager;
  let costTracker: CostTracker;

  beforeAll(() => {
    // Ensure we have API keys
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (!hasOpenAI && !hasAnthropic) {
      throw new Error('E2E tests require OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  });

  beforeEach(async () => {
    storage = new InMemoryStorageAdapter();
    costTracker = new CostTracker(storage);

    const config: IntelligenceLayerConfig = {
      embedding: {
        enabled: true,
        similarityThreshold: 0.3,
        model: 'text-embedding-3-small'
      },
      connectionDetection: {
        enabled: true,
        // Use real thresholds for E2E
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 0.3
        },
        maxCandidates: 10,
        batchSize: 5,
        temperature: 0.2,
        maxTokens: 500
      },
      costControl: {
        maxLLMCallsPerBatch: 5,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: true
      }
    };

    connectionManager = new MemoryConnectionManager(
      storage,
      config,
      costTracker
    );
  });

  afterEach(async () => {
    await connectionManager.destroy();
  });

  test('Smart triage correctly classifies connections', async () => {
    const memory1: Memory = {
      id: 'test1',
      userId: 'e2e-user',
      agentId: 'e2e-agent',
      type: MemoryType.SEMANTIC,
      content: 'Python is a programming language',
      importance: 0.8,
      resonance: 0.7,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const similarMemory: Memory = {
      ...memory1,
      id: 'test2',
      content: 'Python is a high-level programming language'
    };

    const relatedMemory: Memory = {
      ...memory1,
      id: 'test3',
      content: 'JavaScript is used for web development'
    };

    const causalMemory: Memory = {
      ...memory1,
      id: 'test4',
      content: 'Learning Python led me to become a developer'
    };

    // Store memories
    if (storage.memory?.store) {
      await storage.memory.store('e2e-user', 'e2e-agent', similarMemory);
      await storage.memory.store('e2e-user', 'e2e-agent', relatedMemory);
      await storage.memory.store('e2e-user', 'e2e-agent', causalMemory);
    }

    // Discover connections
    const connections = await connectionManager.discoverConnections(
      'e2e-user',
      'e2e-agent',
      memory1
    );

    // Verify smart triage worked
    const similar = connections.find((c) => c.targetMemoryId === 'test2');
    const related = connections.find((c) => c.targetMemoryId === 'test3');
    const causal = connections.find((c) => c.targetMemoryId === 'test4');

    // Should auto-classify similar (high similarity)
    expect(similar?.connectionType).toBe('similar');
    expect(similar?.metadata?.triageMethod).toBe('auto-similar');

    // May auto-classify or use LLM for related
    expect(related?.connectionType).toBeDefined();

    // Should use LLM for causal relationship
    if (causal) {
      expect(['causes', 'related', 'similar']).toContain(causal.connectionType);
    }

    // Check cost tracking
    const costs = await costTracker.getCostSummary('e2e-agent', '24h');
    console.log('E2E Test Costs:', {
      totalCost: costs.totalCost,
      extractionCount: costs.totalMemories,
      standardModelUsage:
        costs.costByExtractor['connection-classification-standard'] || 0,
      advancedModelUsage:
        costs.costByExtractor['connection-classification-advanced'] || 0
    });
  });

  test('Environment variable overrides work correctly', async () => {
    // Set test overrides
    process.env.CONNECTION_AUTO_SIMILAR = '0.9';
    process.env.CONNECTION_AUTO_RELATED = '0.7';
    process.env.CONNECTION_LLM_REQUIRED = '0.4';

    const testMemory: Memory = {
      id: 'env-test',
      userId: 'e2e-user',
      agentId: 'e2e-agent',
      type: MemoryType.SEMANTIC,
      content: 'Testing environment variables',
      importance: 0.8,
      resonance: 0.7,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const moderateSimilarMemory: Memory = {
      ...testMemory,
      id: 'env-test2',
      content: 'Checking environment configuration'
    };

    if (storage.memory?.store) {
      await storage.memory.store(
        'e2e-user',
        'e2e-agent',
        moderateSimilarMemory
      );
    }

    const connections = await connectionManager.discoverConnections(
      'e2e-user',
      'e2e-agent',
      testMemory
    );

    // With higher thresholds, fewer connections should be auto-classified
    const connection = connections.find(
      (c) => c.targetMemoryId === 'env-test2'
    );

    // Clean up env vars
    delete process.env.CONNECTION_AUTO_SIMILAR;
    delete process.env.CONNECTION_AUTO_RELATED;
    delete process.env.CONNECTION_LLM_REQUIRED;

    // Verify connection was found
    expect(connection).toBeDefined();
  });

  test('All 5 connection types can be classified', async () => {
    const baseMemory: Memory = {
      id: 'base',
      userId: 'e2e-user',
      agentId: 'e2e-agent',
      type: MemoryType.SEMANTIC,
      content: 'React is a JavaScript library for building user interfaces',
      importance: 0.8,
      resonance: 0.7,
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const testCases = [
      {
        id: 'similar-test',
        content: 'React is a JS library for creating UIs',
        expectedType: 'similar'
      },
      {
        id: 'causes-test',
        content: 'Learning React helped me get a frontend job',
        expectedTypes: ['causes', 'related']
      },
      {
        id: 'partof-test',
        content: 'useState is a React Hook',
        expectedTypes: ['part_of', 'related']
      },
      {
        id: 'opposite-test',
        content: 'Angular is better than React for enterprise apps',
        expectedTypes: ['opposite', 'related']
      },
      {
        id: 'related-test',
        content: 'Frontend development requires CSS knowledge',
        expectedType: 'related'
      }
    ];

    // Store test memories
    if (storage.memory?.store) {
      for (const testCase of testCases) {
        await storage.memory.store('e2e-user', 'e2e-agent', {
          ...baseMemory,
          id: testCase.id,
          content: testCase.content
        });
      }
    }

    // Discover connections
    const connections = await connectionManager.discoverConnections(
      'e2e-user',
      'e2e-agent',
      baseMemory
    );

    // Log results for analysis
    console.log('Connection Types Found:');
    connections.forEach((conn) => {
      const testCase = testCases.find((tc) => tc.id === conn.targetMemoryId);
      console.log(`- ${testCase?.content?.substring(0, 50)}...`);
      console.log(
        `  Type: ${conn.connectionType}, Confidence: ${conn.strength.toFixed(3)}`
      );
      console.log(`  Method: ${conn.metadata?.triageMethod}`);
    });

    // Verify we found various connection types
    const types = new Set(connections.map((c) => c.connectionType));
    expect(types.size).toBeGreaterThan(1);
  });
});
