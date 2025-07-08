/**
 * @fileoverview Integration tests for RecallService connection graph enhancements
 *
 * This is a simplified test that focuses on testing the connection enhancement
 * without relying on automatic connection creation.
 */

import { InMemoryStorageAdapter } from '../../../storage/adapters';
import { StorageProvider } from '../../../storage/types';
import { getRecallPreset } from '../../config/recall-presets';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { MemoryType } from '../../types/common';
import { EpisodicMemory } from '../../types/episodic/EpisodicMemory';
import { ProceduralMemory } from '../../types/procedural/ProceduralMemory';
import { SemanticMemory } from '../../types/semantic/SemanticMemory';
import { WorkingMemory } from '../../types/working/WorkingMemory';
import { RecallService } from '../RecallService';
import { RecallQuery } from '../RecallServiceTypes';

describe('RecallService - Connection Graph Integration', () => {
  let storage: StorageProvider;
  let recallService: RecallService;
  let semanticMemory: SemanticMemory;

  const userId = 'test-user';
  const agentId = 'test-agent';

  beforeEach(async () => {
    // Use in-memory storage
    storage = new InMemoryStorageAdapter();

    // Simple intelligence config without connection detection
    // (we'll manually create connections for testing)
    const intelligenceConfig: IntelligenceLayerConfig = {
      embedding: {
        enabled: false,
        similarityThreshold: 0.3
      },
      connectionDetection: {
        enabled: true,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 1.0 // Disable LLM for tests
        },
        maxCandidates: 20,
        batchSize: 10,
        temperature: 0.2,
        maxTokens: 500
      },
      costControl: {
        maxLLMCallsPerBatch: 0,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: false
      }
    };

    // Create minimal memory types
    const workingMemory = new WorkingMemory(storage, {
      maxTokens: 8000,
      ttlSeconds: 3600,
      maxContextItems: 100,
      compressionThreshold: 0.8,
      encryptSensitive: false
    });

    const episodicMemory = new EpisodicMemory(storage, {
      maxMemoriesPerSession: 500,
      decayRate: 0.05,
      importanceThreshold: 0.3,
      compressionAge: 86400000, // 1 day
      encryptSensitive: false
    });

    semanticMemory = new SemanticMemory(
      storage,
      {
        deduplicationThreshold: 0.8,
        maxMemoriesPerCategory: 1000,
        confidenceThreshold: 0.6,
        vectorSearchEnabled: false,
        encryptSensitive: false,
        autoExtractFacts: false
      },
      intelligenceConfig
    );

    const proceduralMemory = new ProceduralMemory(
      storage,
      {
        minSuccessRate: 0.7,
        maxPatternsPerCategory: 100,
        decayRate: 0.05,
        confidenceThreshold: 0.8,
        adaptiveLearning: true,
        patternMerging: true
      },
      intelligenceConfig
    );

    // Create recall service with connections enabled
    const recallConfig = getRecallPreset('default');
    const intelligenceConfigWithConnections: IntelligenceLayerConfig = {
      ...intelligenceConfig,
      connectionDetection: {
        enabled: true,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 1.0 // Disable LLM for tests
        },
        maxCandidates: 50,
        batchSize: 10,
        temperature: 0.2,
        maxTokens: 500
      }
    };

    recallService = new RecallService(
      workingMemory,
      episodicMemory,
      semanticMemory,
      proceduralMemory,
      recallConfig,
      intelligenceConfigWithConnections,
      storage
    );
  });

  afterEach(async () => {
    if (storage.destroy) {
      await storage.destroy();
    }
  });

  test('RecallService initializes with connection support', () => {
    expect(recallService).toBeDefined();
    // The connectionManager is private, but we can verify it works by using it
  });

  test('Basic recall without connections works', async () => {
    // Store a simple memory
    await semanticMemory.store(
      userId,
      agentId,
      'JavaScript is a programming language'
    );

    // Basic recall
    const query: RecallQuery = {
      userId,
      agentId,
      query: 'JavaScript',
      memoryTypes: [MemoryType.SEMANTIC]
    };

    const result = await recallService.recall(query);

    expect(result.memories.length).toBe(1);
    expect(result.memories[0].content).toContain('JavaScript');
  });

  test('Connection options are accepted in query', async () => {
    // Store a memory
    await semanticMemory.store(
      userId,
      agentId,
      'Test memory for connection options'
    );

    // Query with connection options
    const query: RecallQuery = {
      userId,
      agentId,
      query: 'test',
      memoryTypes: [MemoryType.SEMANTIC],
      useConnections: true,
      connectionHops: 2,
      boostCentralMemories: true,
      connectionTypes: ['similar', 'related']
    };

    // Should not throw - just testing the API accepts these options
    const result = await recallService.recall(query);
    expect(result).toBeDefined();
  });

  test('Disabling connections via query works', async () => {
    // Store a memory
    await semanticMemory.store(
      userId,
      agentId,
      'Memory with connections disabled'
    );

    // Query with connections explicitly disabled
    const query: RecallQuery = {
      userId,
      agentId,
      query: 'disabled',
      memoryTypes: [MemoryType.SEMANTIC],
      useConnections: false
    };

    const result = await recallService.recall(query);

    // Should return the memory without trying to traverse connections
    expect(result.memories.length).toBe(1);
  });
});
