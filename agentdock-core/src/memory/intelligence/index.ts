/**
 * @fileoverview Intelligence Layer API - Language-agnostic memory intelligence
 *
 * Provides configurable memory intelligence features following CTO's hybrid approach:
 * - Base embedding similarity (free)
 * - Optional user-configurable rules (free)
 * - Optional LLM enhancement (cost-controlled)
 *
 * @author AgentDock Core Team
 */

// Import types for internal use

// Import connection types from storage layer
import type { ConnectionType } from '../../storage/types';
// Import ImportanceScore from memory base-types
import type { ImportanceScore } from '../base-types';
import type {
  ConnectionRule,
  ConsolidationConfig,
  IntelligenceLayerConfig
} from './types';

// Core intelligence services
export { EmbeddingService } from './embeddings/EmbeddingService';
export { MemoryConnectionManager } from './connections/MemoryConnectionManager';
export { ConnectionGraph } from './graph/ConnectionGraph';
export { TemporalPatternAnalyzer } from './patterns/TemporalPatternAnalyzer';
export { MemoryConsolidator } from './consolidation/MemoryConsolidator';

// Utility functions for migration
export { MemoryConnectionManager as MemoryConnectionUtils } from './connections/MemoryConnectionManager';

// Type definitions - all configuration interfaces from types.ts
export type {
  // Configuration interfaces (CTO's hybrid approach)
  IntelligenceLayerConfig,
  ConnectionRule,

  // Service configurations
  EmbeddingConfig,
  EmbeddingResult,
  ConsolidationConfig,

  // Pattern analysis types
  TemporalPattern,
  ActivityCluster,

  // Graph types
  ConnectionGraph as ConnectionGraphInterface
} from './types';

// Re-export from memory base-types
export type { ConsolidationResult, ImportanceScore } from '../base-types';

/**
 * Default configuration following CTO's progressive enhancement pattern
 */
export const DEFAULT_INTELLIGENCE_CONFIG: IntelligenceLayerConfig = {
  // Base layer - always enabled, zero cost
  embedding: {
    enabled: true,
    similarityThreshold: 0.7,
    model: 'text-embedding-3-small' // Default embedding model
  },

  // Progressive enhancement configuration
  connectionDetection: {
    method: 'hybrid', // Use all available methods

    // User rules (free, configurable)
    userRules: {
      enabled: true,
      patterns: [] // Users can add their own patterns
    },

    // LLM enhancement (optional, cost-aware)
    llmEnhancement: {
      enabled: false, // Disabled by default - user must opt-in
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307', // Small, cost-effective model
      maxTokensPerAnalysis: 150,
      temperature: 0.2,
      validateResponses: true,
      fallbackToEmbedding: true,
      costPerToken: 0.00000025 // User should configure based on their pricing
    }
  },

  // Cost control - following batch processing patterns
  costControl: {
    maxLLMCallsPerBatch: 50,
    monthlyBudget: 10.0, // $10 monthly budget default
    preferEmbeddingWhenSimilar: true, // Skip LLM if embedding > 0.9
    trackTokenUsage: true
  }
};

/**
 * Default consolidation configuration
 */
export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  similarityThreshold: 0.85,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for episodic->semantic
  preserveOriginals: false,
  strategies: ['merge', 'synthesize'],
  batchSize: 20,
  enableLLMSummarization: false, // Disabled by default
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    costPerToken: 0.00000025,
    maxTokensPerSummary: 200
  }
};

/**
 * Example user-configurable connection rules (language-agnostic semantic approach)
 */
export const EXAMPLE_CONNECTION_RULES: ConnectionRule[] = [
  {
    id: 'contradiction-pattern',
    name: 'Contradiction Detection',
    description: 'Detect contradictory information',
    semanticDescription:
      'content that contradicts, opposes, or states the opposite of previous information',
    connectionType: 'opposite',
    confidence: 0.7,
    semanticThreshold: 0.75,
    requiresBothMemories: true,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'reference-pattern',
    name: 'Reference Detection',
    description: 'Detect explicit references',
    semanticDescription:
      'content that references, mentions, or discusses something from previous conversations',
    connectionType: 'related',
    confidence: 0.6,
    semanticThreshold: 0.7,
    requiresBothMemories: false,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  },
  {
    id: 'causal-pattern',
    name: 'Causal Detection',
    description: 'Detect cause-effect relationships',
    semanticDescription:
      'content that shows one thing causing, leading to, or resulting in another',
    connectionType: 'causes',
    confidence: 0.8,
    semanticThreshold: 0.8,
    requiresBothMemories: true,
    enabled: true,
    createdBy: 'system',
    createdAt: new Date()
  }
];

/**
 * Helper function to create intelligence layer config with user overrides
 */
export function createIntelligenceConfig(
  overrides: Partial<IntelligenceLayerConfig> = {}
): IntelligenceLayerConfig {
  return {
    ...DEFAULT_INTELLIGENCE_CONFIG,
    ...overrides,
    embedding: {
      ...DEFAULT_INTELLIGENCE_CONFIG.embedding,
      ...overrides.embedding
    },
    connectionDetection: {
      ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection,
      ...overrides.connectionDetection,
      userRules: overrides.connectionDetection?.userRules
        ? {
            ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.userRules,
            ...overrides.connectionDetection.userRules
          }
        : DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.userRules,
      llmEnhancement: overrides.connectionDetection?.llmEnhancement
        ? {
            ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.llmEnhancement,
            ...overrides.connectionDetection.llmEnhancement
          }
        : DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.llmEnhancement
    },
    costControl: {
      ...DEFAULT_INTELLIGENCE_CONFIG.costControl,
      ...overrides.costControl
    }
  };
}
