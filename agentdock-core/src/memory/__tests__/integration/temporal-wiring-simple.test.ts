/**
 * Simple integration test for temporal pattern wiring
 */
import { MemoryType } from '../../../shared/types/memory';
import { InMemoryStorageAdapter } from '../../../storage/adapters/InMemoryStorageAdapter';
import { TemporalPatternAnalyzer } from '../../intelligence/patterns/TemporalPatternAnalyzer';
import { CostTracker } from '../../tracking/CostTracker';

describe('Temporal Pattern Direct Test', () => {
  it('should detect patterns when memories exist', async () => {
    const storage = new InMemoryStorageAdapter();
    const userId = 'test-user';
    const agentId = 'test-agent';

    // Store 10 memories directly
    const memories = [];
    for (let i = 0; i < 10; i++) {
      const memory = {
        id: `test-memory-${i}`,
        content: `Test memory ${i}`,
        userId,
        agentId,
        type: MemoryType.WORKING,
        importance: 0.5,
        resonance: 1.0,
        accessCount: 0,
        createdAt: Date.now() - i * 1000, // 1 second apart
        updatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        sessionId: 'test-session',
        tokenCount: 10,
        metadata: {}
      };

      await storage.memory?.store?.(userId, agentId, memory);
      memories.push(memory);
    }

    // Verify memories were stored
    const recalled = await storage.memory?.recall?.(userId, agentId, '', {
      limit: 100
    });
    console.log('Memories in storage:', recalled?.length);

    // Create temporal analyzer directly
    const config = {
      temporal: { enabled: true },
      embedding: { enabled: false, similarityThreshold: 0.7 },
      connectionDetection: {
        enabled: true,
        method: 'embedding-only' as const,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 0.3
        }
      },
      costControl: {
        maxLLMCallsPerBatch: 10,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: true
      }
    };

    const costTracker = new CostTracker(storage);
    const analyzer = new TemporalPatternAnalyzer(storage, config, costTracker);

    // Debug: Try to recall directly with the temporal analyzer's method
    const analyzerStorage = (analyzer as any).storage;
    console.log('Analyzer storage exists:', !!analyzerStorage);
    console.log('Analyzer storage.memory exists:', !!analyzerStorage?.memory);
    console.log(
      'Analyzer storage.memory.recall exists:',
      !!analyzerStorage?.memory?.recall
    );

    // Try recalling with the exact same parameters the analyzer would use
    const testRecall = await analyzerStorage.memory?.recall?.(
      userId,
      agentId,
      '',
      { limit: 1000 }
    );
    console.log('Test recall found:', testRecall?.length, 'memories');

    // Analyze patterns
    const patterns = await analyzer.analyzePatterns(agentId, undefined, userId);
    console.log('Patterns found:', patterns);

    // Should detect burst pattern since we created 10 memories rapidly
    expect(patterns.length).toBeGreaterThan(0);

    const burstPattern = patterns.find((p) => p.type === 'burst');
    expect(burstPattern).toBeDefined();
  });
});
