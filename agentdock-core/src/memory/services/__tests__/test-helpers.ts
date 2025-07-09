/**
 * Test helpers for RecallService tests
 */

import { WorkingMemoryConfig } from '../../types/working/WorkingMemoryTypes';
import { EpisodicMemoryConfig } from '../../types/episodic/EpisodicMemoryTypes';
import { SemanticMemoryConfig } from '../../types/semantic/SemanticMemoryTypes';
import { ProceduralMemoryConfig } from '../../types/procedural/ProceduralMemoryTypes';
import { IntelligenceLayerConfig } from '../../intelligence/types';

export function createTestWorkingMemoryConfig(overrides?: Partial<WorkingMemoryConfig>): WorkingMemoryConfig {
  return {
    maxTokens: 8192,
    ttlSeconds: 3600,
    maxContextItems: 50,
    compressionThreshold: 0.8,
    encryptSensitive: false,
    ...overrides
  };
}

export function createTestEpisodicMemoryConfig(overrides?: Partial<EpisodicMemoryConfig>): EpisodicMemoryConfig {
  return {
    maxMemoriesPerSession: 1000,
    decayRate: 0.01,
    importanceThreshold: 0.3,
    compressionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    encryptSensitive: false,
    ...overrides
  };
}

export function createTestSemanticMemoryConfig(overrides?: Partial<SemanticMemoryConfig>): SemanticMemoryConfig {
  return {
    deduplicationThreshold: 0.9,
    maxMemoriesPerCategory: 1000,
    confidenceThreshold: 0.7,
    vectorSearchEnabled: true,
    autoExtractFacts: false,
    encryptSensitive: false,
    ...overrides
  };
}

export function createTestProceduralMemoryConfig(overrides?: Partial<ProceduralMemoryConfig>): ProceduralMemoryConfig {
  return {
    minSuccessRate: 0.7,
    maxPatternsPerCategory: 100,
    decayRate: 0.001,
    confidenceThreshold: 0.8,
    adaptiveLearning: false,
    patternMerging: false,
    ...overrides
  };
}

export function createTestIntelligenceLayerConfig(overrides?: Partial<IntelligenceLayerConfig>): IntelligenceLayerConfig {
  return {
    temporal: {
      enabled: false,
      analysisFrequency: 'hourly' as const,
      minMemoriesForAnalysis: 5,
      enableLLMEnhancement: false,
      ...overrides
    },
    embedding: {
      enabled: false,
      provider: 'openai',
      model: 'text-embedding-3-small',
      similarityThreshold: 0.7
    },
    connectionDetection: {
      enabled: false,
      thresholds: {
        autoSimilar: 0.9,
        autoRelated: 0.7,
        llmRequired: 0.5
      }
    },
    costControl: {
      maxLLMCallsPerBatch: 10,
      preferEmbeddingWhenSimilar: true,
      trackTokenUsage: true
    },
    ...overrides
  };
}