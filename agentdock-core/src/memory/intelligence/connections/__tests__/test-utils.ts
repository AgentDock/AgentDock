/**
 * Test utilities for MemoryConnectionManager
 */

import type { StorageProvider } from '../../../../storage/types';
import { CostTracker } from '../../../tracking/CostTracker';
import type { IntelligenceLayerConfig } from '../../types';
import { MemoryConnectionManager } from '../MemoryConnectionManager';
import { MockEmbeddingProvider } from '../MockEmbeddingProvider';

/**
 * Create test-friendly connection manager with dependency injection
 */
export function createTestConnectionManager(
  storage: StorageProvider,
  options?: {
    useRealEmbeddings?: boolean;
    mockSimilarityThreshold?: number;
    enableLLM?: boolean;
  }
): MemoryConnectionManager {
  // Set mock embedding provider in environment for tests
  if (!options?.useRealEmbeddings) {
    process.env.EMBEDDING_PROVIDER = 'mock';
    process.env.MOCK_EMBEDDINGS = 'true';
  }

  const config: IntelligenceLayerConfig = {
    embedding: {
      enabled: true,
      provider: options?.useRealEmbeddings ? 'openai' : ('mock' as any), // Use mock for tests
      similarityThreshold: options?.mockSimilarityThreshold || 0.3,
      model: 'mock-embedding-model'
    },
    connectionDetection: {
      enabled: true, // Simple on/off toggle for AgentDock Pro

      // Smart triage thresholds - disable LLM for tests by default
      thresholds: {
        autoSimilar: 0.8, // 40% auto-classified as "similar" (FREE)
        autoRelated: 0.6, // 25% auto-classified as "related" (FREE)
        llmRequired: options?.enableLLM ? 0.3 : 1.0 // Disable LLM unless explicitly enabled
      },

      // Processing configuration
      maxCandidates: 20, // Limit candidates to top-20 for efficiency
      batchSize: 10, // Batch size for processing
      temperature: 0.2, // LLM temperature
      maxTokens: 500 // Max tokens
    },
    costControl: {
      maxLLMCallsPerBatch: options?.enableLLM ? 10 : 0, // No LLM in tests unless enabled
      trackTokenUsage: false,
      preferEmbeddingWhenSimilar: true
    }
  };

  // Create mock embedding service for tests (dependency injection pattern)
  let embeddingService: any = undefined;
  if (!options?.useRealEmbeddings) {
    const mockProvider = new MockEmbeddingProvider(1536);
    embeddingService = {
      async generateEmbedding(content: string): Promise<number[]> {
        const result = await mockProvider.doEmbed({ values: [content] });
        return result.embeddings[0];
      },
      async findSimilarMemories(
        content: string,
        memories: any[],
        threshold: number = 0.7
      ) {
        // Simple mock similarity based on string matching
        return memories.filter(
          (memory) =>
            memory.content.toLowerCase().includes(content.toLowerCase()) ||
            content.toLowerCase().includes(memory.content.toLowerCase())
        );
      }
    };
  }

  return new MemoryConnectionManager(storage, config, new CostTracker(storage));
}

/**
 * Create a test memory with defaults
 */
export function createTestMemory(overrides: {
  id?: string;
  content: string;
  userId?: string;
  agentId?: string;
  metadata?: Record<string, any>;
  createdAt?: number;
  type?: 'working' | 'episodic' | 'semantic' | 'procedural';
}) {
  return {
    id: overrides.id || `mem-${Date.now()}-${Math.random()}`,
    userId: overrides.userId || 'test-user',
    agentId: overrides.agentId || 'test-agent',
    content: overrides.content,
    type: overrides.type || 'episodic',
    metadata: overrides.metadata || {},
    createdAt: overrides.createdAt || Date.now(),
    updatedAt: Date.now(),
    accessCount: 0,
    lastAccessedAt: null,
    importance: 0.5,
    resonance: 0.5
  };
}
