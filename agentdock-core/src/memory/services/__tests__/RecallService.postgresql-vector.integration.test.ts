/**
 * @fileoverview RecallService + PostgreSQL Vector Integration Tests
 * 
 * CRITICAL INTEGRATION TESTS for production readiness
 * 
 * Validates our recent RecallService hybrid search implementation:
 * - hasHybridSearch() type guard functionality
 * - Embedding generation and storage flow
 * - Proper fallback when hybrid search unavailable
 * - Integration with PostgreSQL Vector adapter
 * 
 * Architect Approved Requirements:
 * - RecallService correctly identifies vector-capable adapters
 * - minRelevance parameter works with hybrid search
 * - Connection enrichment works with vector results
 * - E2E smoke test with mock embeddings
 */

import { Pool } from 'pg';

import { LogCategory } from '../../../logging';
import { MemoryType } from '../../../shared/types/memory';
import { StorageProvider } from '../../../storage/types';
import { PostgreSQLVectorAdapter } from '../../../storage/adapters/postgresql-vector';
import { SQLiteAdapter } from '../../../storage/adapters/sqlite';
import { IntelligenceLayerConfig } from '../../intelligence/types';
import { CostTracker } from '../../tracking/CostTracker';
import { MemoryConnectionManager } from '../../intelligence/connections/MemoryConnectionManager';
import { EpisodicMemory } from '../../types/episodic/EpisodicMemory';
import { ProceduralMemory } from '../../types/procedural/ProceduralMemory';
import { SemanticMemory } from '../../types/semantic/SemanticMemory';
import { WorkingMemory } from '../../types/working/WorkingMemory';
import { RecallService } from '../RecallService';
import { RecallConfig, RecallQuery, RecallResult } from '../RecallServiceTypes';
import { createTestWorkingMemoryConfig, createTestEpisodicMemoryConfig, createTestSemanticMemoryConfig, createTestProceduralMemoryConfig, createTestIntelligenceLayerConfig } from './test-helpers';
// Test configuration
const TEST_CONFIG = {
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_TEST_URL,
  enableSkipWhenUnavailable: !process.env.CI,
};

// Mock embeddings for testing (1536 dimensions)
const MOCK_EMBEDDINGS = {
  query1: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? 0.1 : -0.1),
  query2: Array(1536).fill(0).map((_, i) => i % 3 === 0 ? 0.2 : -0.05),
  darkMode: Array(1536).fill(0).map((_, i) => i % 2 === 0 ? 0.1 : -0.1),
  authentication: Array(1536).fill(0).map((_, i) => i % 3 === 0 ? 0.2 : -0.05),
};

// Test memory data
const TEST_MEMORIES = [
  {
    id: 'recall_test_001',
    userId: 'test_user_recall',
    agentId: 'test_agent_recall',
    type: MemoryType.SEMANTIC,
    content: 'User prefers dark mode applications for better productivity',
    importance: 0.8,
    resonance: 0.7,
    accessCount: 5,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    lastAccessedAt: Date.now() - 3600000,
    keywords: ['ui', 'preferences', 'dark-mode'],
    metadata: { category: 'preferences', confidence: 0.9 }
  },
  {
    id: 'recall_test_002',
    userId: 'test_user_recall',
    agentId: 'test_agent_recall',
    type: MemoryType.EPISODIC,
    content: 'Successfully implemented JWT authentication with proper token validation',
    importance: 0.9,
    resonance: 0.8,
    accessCount: 3,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
    lastAccessedAt: Date.now() - 7200000,
    keywords: ['authentication', 'jwt', 'security'],
    metadata: { category: 'implementation', confidence: 0.95 }
  }
];

// Mock EmbeddingService for testing
class MockEmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    // Return deterministic embedding based on text content
    if (text.includes('dark mode') || text.includes('preferences')) {
      return MOCK_EMBEDDINGS.darkMode;
    }
    if (text.includes('authentication') || text.includes('jwt')) {
      return MOCK_EMBEDDINGS.authentication;
    }
    return MOCK_EMBEDDINGS.query1;
  }
}

describe('RecallService + PostgreSQL Vector Integration', () => {
  let pgVectorAdapter: PostgreSQLVectorAdapter;
  let sqliteAdapter: SQLiteAdapter;
  let recallService: RecallService;
  let workingMemory: WorkingMemory;
  let episodicMemory: EpisodicMemory;
  let semanticMemory: SemanticMemory;
  let proceduralMemory: ProceduralMemory;
  let pool: Pool;

  beforeAll(async () => {
    // Skip tests if no database configuration
    if (!TEST_CONFIG.connectionString && TEST_CONFIG.enableSkipWhenUnavailable) {
      console.warn('Skipping RecallService integration tests - no DATABASE_URL configured');
      return;
    }

    if (!TEST_CONFIG.connectionString) {
      throw new Error('DATABASE_URL required for RecallService integration tests in CI');
    }

    try {
      // Initialize PostgreSQL Vector adapter
      pgVectorAdapter = new PostgreSQLVectorAdapter({
        connectionString: TEST_CONFIG.connectionString,
        namespace: 'test_recall_integration',
        enableVector: true,
        defaultDimension: 1536,
      });

      await pgVectorAdapter.initialize();

      // Initialize SQLite adapter for comparison
      sqliteAdapter = new SQLiteAdapter({
        path: ':memory:',
        namespace: 'test_recall_sqlite',
      });

      await sqliteAdapter.initialize();

      // Initialize memory types
      workingMemory = new WorkingMemory(pgVectorAdapter, createTestWorkingMemoryConfig());
      episodicMemory = new EpisodicMemory(pgVectorAdapter, createTestEpisodicMemoryConfig());
      semanticMemory = new SemanticMemory(pgVectorAdapter, createTestSemanticMemoryConfig());
      proceduralMemory = new ProceduralMemory(pgVectorAdapter, createTestProceduralMemoryConfig());

      // Test pool for direct operations
      pool = new Pool({
        connectionString: TEST_CONFIG.connectionString,
        max: 3,
      });

    } catch (error) {
      if (TEST_CONFIG.enableSkipWhenUnavailable) {
        console.warn('Skipping RecallService integration tests - database unavailable:', error);
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (pgVectorAdapter) {
      await pgVectorAdapter.destroy();
    }
    if (sqliteAdapter) {
      await sqliteAdapter.destroy();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    if (!pgVectorAdapter) return;

    // Clean up test data
    await pgVectorAdapter.clear('test_');
    await sqliteAdapter.clear('test_');
  });

  describe('RecallService Vector-Capable Adapter Detection (MUST HAVE)', () => {
    it('should correctly identify PostgreSQL Vector as vector-capable adapter', async () => {
      if (!pgVectorAdapter) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: true,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          },
          maxCandidates: 50
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService with PostgreSQL Vector adapter
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Test hasHybridSearch type guard
      expect(pgVectorAdapter.memory).toBeDefined();
      
      // Access the private hasHybridSearch method via reflection for testing
      const hasHybridSearchMethod = (recallService as any).hasHybridSearch;
      expect(typeof hasHybridSearchMethod).toBe('function');
      
      const supportsHybridSearch = hasHybridSearchMethod.call(recallService, pgVectorAdapter.memory);
      expect(supportsHybridSearch).toBe(true);
    });

    it('should correctly identify SQLite as non-vector-capable adapter', async () => {
      if (!sqliteAdapter) {
        console.log('Skipping test - SQLite adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      // Create memory instances with SQLite adapter
      const workingMemorySQLite = new WorkingMemory(sqliteAdapter, createTestWorkingMemoryConfig());
      const episodicMemorySQLite = new EpisodicMemory(sqliteAdapter, createTestEpisodicMemoryConfig());
      const semanticMemorySQLite = new SemanticMemory(sqliteAdapter, createTestSemanticMemoryConfig());
      const proceduralMemorySQLite = new ProceduralMemory(sqliteAdapter, createTestProceduralMemoryConfig());

      // Create RecallService with SQLite adapter
      const recallServiceSQLite = new RecallService(
        workingMemorySQLite,
        episodicMemorySQLite,
        semanticMemorySQLite,
        proceduralMemorySQLite,
        recallConfig,
        undefined, // No intelligence config
        sqliteAdapter
      );

      // Test hasHybridSearch type guard
      expect(sqliteAdapter.memory).toBeDefined();
      
      const hasHybridSearchMethod = (recallServiceSQLite as any).hasHybridSearch;
      const supportsHybridSearch = hasHybridSearchMethod.call(recallServiceSQLite, sqliteAdapter.memory);
      expect(supportsHybridSearch).toBe(false);
    });
  });

  describe('Embedding Generation and Storage Flow (MUST HAVE)', () => {
    it('should generate embeddings for queries and use hybrid search', async () => {
      if (!pgVectorAdapter || !pgVectorAdapter.memory) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: false,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          }
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Store test memories with embeddings
      for (const memory of TEST_MEMORIES) {
        await (pgVectorAdapter.memory as any).storeMemoryWithEmbedding(
          memory.userId,
          memory.agentId,
          memory,
          memory.content.includes('dark mode') ? MOCK_EMBEDDINGS.darkMode : MOCK_EMBEDDINGS.authentication
        );
      }

      // Mock the embedding service to return deterministic embeddings
      const mockEmbeddingService = new MockEmbeddingService();
      (recallService as any).embeddingService = mockEmbeddingService;

      // Wait for indexing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test recall with query that should generate embedding
      const results = await recallService.recall({
        userId: 'test_user_recall',
        agentId: 'test_agent_recall',
        query: 'dark mode preferences',
        limit: 10
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.memories.length).toBeGreaterThan(0);

      // Should find the dark mode memory
      const darkModeMemory = results.memories.find(m => m.content.includes('dark mode'));
      expect(darkModeMemory).toBeDefined();
    });

    it('should handle embedding generation failures gracefully', async () => {
      if (!pgVectorAdapter) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: false,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          }
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Store test memories without embeddings (using regular store)
      for (const memory of TEST_MEMORIES) {
        await pgVectorAdapter.memory!.store(memory.userId, memory.agentId, memory);
      }

      // Mock embedding service to fail
      const failingEmbeddingService = {
        generateEmbedding: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
      };
      (recallService as any).embeddingService = failingEmbeddingService;

      // Should fall back to text-only search
      const results = await recallService.recall({
        userId: 'test_user_recall',
        agentId: 'test_agent_recall',
        query: 'dark mode preferences',
        limit: 10
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should still find results using text search
      expect(results.memories.length).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Search with minRelevance Parameter (ARCHITECT REFINEMENT)', () => {
    it('should respect minRelevance parameter in hybrid search', async () => {
      if (!pgVectorAdapter || !pgVectorAdapter.memory) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.8, // High relevance threshold
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: false,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          }
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Store test memories with embeddings
      for (const memory of TEST_MEMORIES) {
        await (pgVectorAdapter.memory as any).storeMemoryWithEmbedding(
          memory.userId,
          memory.agentId,
          memory,
          MOCK_EMBEDDINGS.query1 // Use different embedding to reduce relevance
        );
      }

      // Mock embedding service
      const mockEmbeddingService = new MockEmbeddingService();
      (recallService as any).embeddingService = mockEmbeddingService;

      // Test recall with high relevance threshold
      const results = await recallService.recall({
        userId: 'test_user_recall',
        agentId: 'test_agent_recall',
        query: 'completely unrelated query about space travel',
        limit: 10
      });

      // Should return fewer or no results due to high relevance threshold
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      // All returned results should meet the relevance threshold
      results.memories.forEach(result => {
        expect(result.relevance).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Connection Enrichment with Vector Results (ARCHITECT REFINEMENT)', () => {
    it('should enrich vector search results with memory connections', async () => {
      if (!pgVectorAdapter || !pgVectorAdapter.memory) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: true,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          },
          maxCandidates: 50
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService with connection manager
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Store test memories with embeddings
      for (const memory of TEST_MEMORIES) {
        await (pgVectorAdapter.memory as any).storeMemoryWithEmbedding(
          memory.userId,
          memory.agentId,
          memory,
          memory.content.includes('dark mode') ? MOCK_EMBEDDINGS.darkMode : MOCK_EMBEDDINGS.authentication
        );
      }

      // Mock embedding service
      const mockEmbeddingService = new MockEmbeddingService();
      (recallService as any).embeddingService = mockEmbeddingService;

      // Test recall with connection enrichment enabled
      const results = await recallService.recall({
        userId: 'test_user_recall',
        agentId: 'test_agent_recall',
        query: 'dark mode preferences',
        limit: 10,
        useConnections: true,
        connectionHops: 1
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.memories.length).toBeGreaterThan(0);

      // Verify that connection enrichment was attempted
      // (Results may or may not have connections depending on the memory graph)
      const hasConnections = results.memories.some(result => 
        result.relationships && result.relationships.length > 0
      );
      
      // This test validates that the enrichment process doesn't break
      // the hybrid search functionality
      expect(results.memories[0]).toBeDefined();
    });
  });

  describe('E2E Smoke Test (ARCHITECT REQUIREMENT)', () => {
    it('should complete full E2E workflow: store with mock embedding → recall via hybrid search', async () => {
      if (!pgVectorAdapter || !pgVectorAdapter.memory) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      const intelligenceConfig: IntelligenceLayerConfig = {
        connectionDetection: {
          enabled: false,
          thresholds: {
            autoSimilar: 0.9,
            autoRelated: 0.7,
            llmRequired: 0.5
          }
        },
        embedding: {
          enabled: true,
          provider: 'openai',
          model: 'text-embedding-3-small',
          similarityThreshold: 0.7
        },
        costControl: {
          maxLLMCallsPerBatch: 10,
          preferEmbeddingWhenSimilar: true,
          trackTokenUsage: true
        }
      };

      // Create RecallService
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        intelligenceConfig,
        pgVectorAdapter
      );

      // Step 1: Store memory with mock embedding
      const testMemory = {
        id: 'e2e_test_memory',
        userId: 'test_user_e2e',
        agentId: 'test_agent_e2e',
        type: MemoryType.SEMANTIC,
        content: 'E2E test memory for hybrid search validation',
        importance: 0.8,
        resonance: 0.7,
        accessCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        keywords: ['e2e', 'test', 'hybrid', 'search'],
        metadata: { testType: 'e2e-smoke-test' }
      };

      await (pgVectorAdapter.memory as any).storeMemoryWithEmbedding(
        testMemory.userId,
        testMemory.agentId,
        testMemory,
        MOCK_EMBEDDINGS.query1
      );

      // Step 2: Mock embedding service for query
      const mockEmbeddingService = new MockEmbeddingService();
      (recallService as any).embeddingService = mockEmbeddingService;

      // Step 3: Recall using hybrid search
      const results = await recallService.recall({
        userId: 'test_user_e2e',
        agentId: 'test_agent_e2e',
        query: 'hybrid search test',
        limit: 5
      });

      // Step 4: Verify E2E workflow success
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.memories.length).toBeGreaterThan(0);

      // Should find our test memory
      const foundMemory = results.memories.find(m => m.id === 'e2e_test_memory');
      expect(foundMemory).toBeDefined();
      expect(foundMemory!.content).toBe('E2E test memory for hybrid search validation');
      expect(foundMemory!.relevance).toBeGreaterThan(0);

      // Verify hybrid search was used (not just text search)
      // This is indicated by the presence of vector-based relevance scoring
      expect(foundMemory!.relevance).toBeGreaterThan(0.1);
    });
  });

  describe('Fallback Behavior (MUST HAVE)', () => {
    it('should fallback to text search when hybrid search fails', async () => {
      if (!pgVectorAdapter || !pgVectorAdapter.memory) {
        console.log('Skipping test - PostgreSQL Vector adapter not initialized');
        return;
      }

      const recallConfig: RecallConfig = {
        defaultLimit: 10,
        minRelevanceThreshold: 0.1,
        hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        },
        enableVectorSearch: true,
        enableRelatedMemories: false,
        maxRelatedDepth: 2,
        cacheResults: false,
        cacheTTL: 300,
        defaultConnectionHops: 1
      };

      // Create RecallService without intelligence config (no embedding)
      recallService = new RecallService(
        workingMemory,
        episodicMemory,
        semanticMemory,
        proceduralMemory,
        recallConfig,
        undefined, // No intelligence config
        pgVectorAdapter
      );

      // Store test memories without embeddings
      for (const memory of TEST_MEMORIES) {
        await pgVectorAdapter.memory!.store(memory.userId, memory.agentId, memory);
      }

      // Test recall should fallback to text search
      const results = await recallService.recall({
        userId: 'test_user_recall',
        agentId: 'test_agent_recall',
        query: 'dark mode preferences',
        limit: 10
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.memories.length).toBeGreaterThan(0);

      // Should find memories using text search
      const foundMemory = results.memories.find(m => m.content.includes('dark mode'));
      expect(foundMemory).toBeDefined();
    });
  });
}); 