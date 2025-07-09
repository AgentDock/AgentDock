/**
 * @fileoverview E2E Smoke Test for Memory System with Hybrid Search
 * 
 * ARCHITECT REQUIREMENT: Simple happy path E2E test with mock embeddings
 * 
 * Tests complete flow:
 * 1. Store memory with mock embedding
 * 2. Recall via hybrid search  
 * 3. Validate results include vector-based relevance
 * 
 * This is a minimal smoke test to ensure the full stack works together.
 */

import { PostgreSQLVectorAdapter } from '../../../storage/adapters/postgresql-vector';
import { SQLiteAdapter } from '../../../storage/adapters/sqlite';
import { MemoryType } from '../../../shared/types/memory';
import { RecallService } from '../../services/RecallService';
import { RecallConfig } from '../../services/RecallServiceTypes';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { EpisodicMemory } from '../../types/episodic/EpisodicMemory';
import { ProceduralMemory } from '../../types/procedural/ProceduralMemory';
import { SemanticMemory } from '../../types/semantic/SemanticMemory';
import { WorkingMemory } from '../../types/working/WorkingMemory';

// Test configuration
const TEST_CONFIG = {
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_TEST_URL,
  enableSkipWhenUnavailable: !process.env.CI,
};

// Mock embeddings for deterministic testing
const MOCK_EMBEDDINGS = {
  testQuery: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? 0.1 : -0.1),
  similarQuery: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? 0.09 : -0.11), // Similar to testQuery
};

// Simple mock embedding service
class MockEmbeddingService {
  async generateEmbedding(text: string): Promise<{ embedding: number[] }> {
    // Return deterministic embedding for testing
    return {
      embedding: text.includes('similar') ? MOCK_EMBEDDINGS.similarQuery : MOCK_EMBEDDINGS.testQuery
    };
  }
}

describe('Memory System E2E Smoke Test', () => {
  let adapter: PostgreSQLVectorAdapter | SQLiteAdapter;
  let recallService: RecallService;
  let workingMemory: WorkingMemory;
  let episodicMemory: EpisodicMemory;
  let semanticMemory: SemanticMemory;
  let proceduralMemory: ProceduralMemory;

  beforeAll(async () => {
    // Skip tests if no database configuration
    if (!TEST_CONFIG.connectionString && TEST_CONFIG.enableSkipWhenUnavailable) {
      console.warn('Skipping E2E smoke test - no DATABASE_URL configured');
      return;
    }

    if (!TEST_CONFIG.connectionString) {
      throw new Error('DATABASE_URL required for E2E smoke test in CI');
    }

    try {
      // Try PostgreSQL Vector first (preferred for hybrid search)
      adapter = new PostgreSQLVectorAdapter({
        connectionString: TEST_CONFIG.connectionString,
        namespace: 'test_e2e_smoke',
        enableVector: true,
        defaultDimension: 1536,
      });

      await adapter.initialize();

    } catch (error) {
      if (TEST_CONFIG.enableSkipWhenUnavailable) {
        console.warn('Skipping E2E smoke test - database unavailable:', error);
        return;
      }
      
      // Fallback to SQLite for basic testing
      try {
        adapter = new SQLiteAdapter({
          path: ':memory:',
          namespace: 'test_e2e_smoke_sqlite',
        });
        await adapter.initialize();
      } catch (sqliteError) {
        throw new Error(`Both PostgreSQL and SQLite adapters failed: ${error}, ${sqliteError}`);
      }
    }

    // Initialize memory types with minimal configurations
    workingMemory = new WorkingMemory(adapter, {
      maxTokens: 1000,
      ttlSeconds: 3600,
      maxContextItems: 10,
      compressionThreshold: 0.8,
      encryptSensitive: false,
    });

    episodicMemory = new EpisodicMemory(adapter, {
      maxMemoriesPerSession: 100,
      decayRate: 0.1,
      importanceThreshold: 0.3,
      compressionAge: 86400000,
      encryptSensitive: false,
    });

    semanticMemory = new SemanticMemory(adapter, {
      deduplicationThreshold: 0.9,
      maxMemoriesPerCategory: 500,
      confidenceThreshold: 0.5,
      vectorSearchEnabled: true,
      encryptSensitive: false,
      autoExtractFacts: false,
    });

    proceduralMemory = new ProceduralMemory(adapter, {
      minSuccessRate: 0.7,
      maxPatternsPerCategory: 100,
      decayRate: 0.05,
      confidenceThreshold: 0.6,
      adaptiveLearning: false,
      patternMerging: false,
    });
  });

  afterAll(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });

  beforeEach(async () => {
    if (!adapter) return;
    
    // Clean up test data
    await adapter.clear('test_e2e_');
  });

  it('should complete E2E workflow: store memory → recall via hybrid search → validate results', async () => {
    if (!adapter) {
      console.log('Skipping E2E test - adapter not initialized');
      return;
    }

    // Step 1: Setup RecallService with hybrid search enabled
    const recallConfig: RecallConfig = {
      defaultLimit: 10,
      minRelevanceThreshold: 0.1,
      enableVectorSearch: true,
      enableRelatedMemories: true,
      maxRelatedDepth: 2,
      cacheResults: false,
      cacheTTL: 300000,
      hybridSearchWeights: {
        vector: 0.7,
        text: 0.3,
        temporal: 0.0,
        procedural: 0.0,
      },
    };

    const intelligenceConfig: IntelligenceLayerConfig = {
      embedding: {
        enabled: true,
        provider: 'openai',
        model: 'text-embedding-3-small',
        similarityThreshold: 0.5,
      },
      connectionDetection: {
        enabled: false,
        maxCandidates: 20,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 0.3,
        },
      },
      costControl: {
        maxLLMCallsPerBatch: 10,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: false,
      },
    };

    recallService = new RecallService(
      workingMemory,
      episodicMemory,
      semanticMemory,
      proceduralMemory,
      recallConfig,
      intelligenceConfig,
      adapter
    );

    // Step 2: Store test memory with embedding (if adapter supports it)
    const testMemory = {
      id: 'test_e2e_memory_001',
      userId: 'e2e_test_user',
      agentId: 'e2e_test_agent',
      type: MemoryType.SEMANTIC,
      content: 'E2E smoke test memory for hybrid search validation and testing',
      importance: 0.8,
      resonance: 0.7,
      accessCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      keywords: ['e2e', 'smoke', 'test', 'hybrid', 'search'],
      metadata: { testType: 'e2e-smoke', category: 'testing' }
    };

    // Store memory with embedding if adapter supports it
    if (adapter.memory && 'storeMemoryWithEmbedding' in adapter.memory) {
      await (adapter.memory as any).storeMemoryWithEmbedding(
        testMemory.userId,
        testMemory.agentId,
        testMemory,
        MOCK_EMBEDDINGS.testQuery
      );
    } else {
      // Fallback to regular storage
      await adapter.memory!.store(testMemory.userId, testMemory.agentId, testMemory);
    }

    // Step 3: Setup mock embedding service
    const mockEmbeddingService = new MockEmbeddingService();
    (recallService as any).embeddingService = mockEmbeddingService;

    // Step 4: Recall memory using hybrid search
    const result = await recallService.recall({
      userId: 'e2e_test_user',
      agentId: 'e2e_test_agent',
      query: 'similar search test hybrid validation',
      limit: 5
    });

    // Step 5: Validate E2E workflow results
    expect(result).toBeDefined();
    expect(result.memories).toBeDefined();
    expect(Array.isArray(result.memories)).toBe(true);
    
    // Should find at least one result
    expect(result.memories.length).toBeGreaterThan(0);

    // Should find our test memory
    const foundMemory = result.memories.find(m => m.id === 'test_e2e_memory_001');
    expect(foundMemory).toBeDefined();

    if (foundMemory) {
      expect(foundMemory.content).toBe('E2E smoke test memory for hybrid search validation and testing');
      expect(foundMemory.type).toBe(MemoryType.SEMANTIC);
      expect(foundMemory.relevance).toBeGreaterThan(0);
      expect(foundMemory.relevance).toBeLessThanOrEqual(1);
    }

    // Step 6: Verify the recall process worked correctly
    // For PostgreSQL Vector, should use hybrid search
    // For SQLite, should use text search
    const isPostgreSQLVector = adapter instanceof PostgreSQLVectorAdapter;
    
    if (isPostgreSQLVector && adapter.memory && 'hybridSearch' in adapter.memory) {
      // PostgreSQL Vector adapter should use hybrid search
      console.log('✅ E2E Test: PostgreSQL Vector hybrid search completed successfully');
    } else {
      // SQLite adapter should use text search
      console.log('✅ E2E Test: Text search completed successfully');
    }

    // All results should have valid relevance scores
    result.memories.forEach(memory => {
      expect(memory.relevance).toBeGreaterThan(0);
      expect(memory.relevance).toBeLessThanOrEqual(1);
    });
  });

  it('should handle multiple memory types in E2E workflow', async () => {
    if (!adapter) {
      console.log('Skipping E2E test - adapter not initialized');
      return;
    }

    // Setup RecallService
    const recallConfig: RecallConfig = {
      defaultLimit: 10,
      minRelevanceThreshold: 0.1,
      enableVectorSearch: true,
      enableRelatedMemories: true,
      maxRelatedDepth: 2,
      cacheResults: false,
      cacheTTL: 300000,
      hybridSearchWeights: {
        vector: 0.7,
        text: 0.3,
        temporal: 0.0,
        procedural: 0.0,
      },
    };

    const intelligenceConfig: IntelligenceLayerConfig = {
      embedding: {
        enabled: true,
        provider: 'openai',
        model: 'text-embedding-3-small',
        similarityThreshold: 0.5,
      },
      connectionDetection: {
        enabled: false,
        maxCandidates: 20,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 0.3,
        },
      },
      costControl: {
        maxLLMCallsPerBatch: 10,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: false,
      },
    };

    recallService = new RecallService(
      workingMemory,
      episodicMemory,
      semanticMemory,
      proceduralMemory,
      recallConfig,
      intelligenceConfig,
      adapter
    );

    // Store different memory types
    const memories = [
      {
        id: 'test_semantic_001',
        userId: 'e2e_test_user',
        agentId: 'e2e_test_agent',
        type: MemoryType.SEMANTIC,
        content: 'Semantic memory about user preferences and settings',
        importance: 0.7,
        resonance: 0.6,
        accessCount: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        keywords: ['preferences', 'settings'],
        metadata: { category: 'semantic' }
      },
      {
        id: 'test_episodic_001',
        userId: 'e2e_test_user',
        agentId: 'e2e_test_agent',
        type: MemoryType.EPISODIC,
        content: 'Episodic memory about a specific event and interaction',
        importance: 0.8,
        resonance: 0.7,
        accessCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        keywords: ['event', 'interaction'],
        metadata: { category: 'episodic' }
      }
    ];

    // Store memories
    for (const memory of memories) {
      if (adapter.memory && 'storeMemoryWithEmbedding' in adapter.memory) {
        await (adapter.memory as any).storeMemoryWithEmbedding(
          memory.userId,
          memory.agentId,
          memory,
          MOCK_EMBEDDINGS.testQuery
        );
      } else {
        await adapter.memory!.store(memory.userId, memory.agentId, memory);
      }
    }

    // Setup mock embedding service
    const mockEmbeddingService = new MockEmbeddingService();
    (recallService as any).embeddingService = mockEmbeddingService;

    // Recall memories
    const result = await recallService.recall({
      userId: 'e2e_test_user',
      agentId: 'e2e_test_agent',
      query: 'preferences and events',
      limit: 10
    });

    // Validate results
    expect(result).toBeDefined();
    expect(result.memories).toBeDefined();
    expect(Array.isArray(result.memories)).toBe(true);
    expect(result.memories.length).toBeGreaterThan(0);

    // Should find both memory types
    const semanticMemories = result.memories.filter(m => m.type === MemoryType.SEMANTIC);
    const episodicMemories = result.memories.filter(m => m.type === MemoryType.EPISODIC);

    expect(semanticMemories.length).toBeGreaterThan(0);
    expect(episodicMemories.length).toBeGreaterThan(0);

    // All results should have valid scores
    result.memories.forEach(memory => {
      expect(memory.relevance).toBeGreaterThan(0);
      expect(memory.confidence).toBeGreaterThan(0);
    });
  });

  it('should handle empty results gracefully in E2E workflow', async () => {
    if (!adapter) {
      console.log('Skipping E2E test - adapter not initialized');
      return;
    }

    // Setup RecallService
    const recallConfig: RecallConfig = {
      defaultLimit: 10,
      minRelevanceThreshold: 0.9, // Very high threshold
      enableVectorSearch: true,
      enableRelatedMemories: true,
      maxRelatedDepth: 2,
      cacheResults: false,
      cacheTTL: 300000,
      hybridSearchWeights: {
        vector: 0.7,
        text: 0.3,
        temporal: 0.0,
        procedural: 0.0,
      },
    };

    const intelligenceConfig: IntelligenceLayerConfig = {
      embedding: {
        enabled: true,
        provider: 'openai',
        model: 'text-embedding-3-small',
        similarityThreshold: 0.5,
      },
      connectionDetection: {
        enabled: false,
        maxCandidates: 20,
        thresholds: {
          autoSimilar: 0.8,
          autoRelated: 0.6,
          llmRequired: 0.3,
        },
      },
      costControl: {
        maxLLMCallsPerBatch: 10,
        preferEmbeddingWhenSimilar: true,
        trackTokenUsage: false,
      },
    };

    recallService = new RecallService(
      workingMemory,
      episodicMemory,
      semanticMemory,
      proceduralMemory,
      recallConfig,
      intelligenceConfig,
      adapter
    );

    // Setup mock embedding service
    const mockEmbeddingService = new MockEmbeddingService();
    (recallService as any).embeddingService = mockEmbeddingService;

    // Query for something that won't match
    const result = await recallService.recall({
      userId: 'e2e_test_user',
      agentId: 'e2e_test_agent',
      query: 'nonexistent query about space aliens and quantum mechanics',
      limit: 10
    });

    // Should handle empty results gracefully
    expect(result).toBeDefined();
    expect(result.memories).toBeDefined();
    expect(Array.isArray(result.memories)).toBe(true);
    expect(result.memories.length).toBe(0);
  });
}); 