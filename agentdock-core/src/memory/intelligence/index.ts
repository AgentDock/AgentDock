/**
 * @fileoverview Intelligence Layer API - Clean Memory Connection System
 *
 * Rebuilt from scratch for AgentDock Pro. Uses content-to-content comparison
 * with smart triage for 65% cost optimization. LLM classifies relationships
 * into 5 research-based connection types.
 *
 * Features:
 * - PRIME-style environment configuration (shares API keys)
 * - Smart triage: 40% auto-similar, 25% auto-related, 35% LLM classification
 * - 5 connection types as classification targets (not configurable rules)
 * - Simple on/off toggle for AgentDock Pro
 *
 * @author AgentDock Core Team
 */

// Import connection types from storage layer
import type { ConnectionType } from '../../storage/types';
// Import ImportanceScore from memory base-types
import type { ImportanceScore } from '../base-types';
import type { ConsolidationConfig, IntelligenceLayerConfig } from './types';
import { FIVE_CORE_CONNECTION_TYPES } from './types';

// Core intelligence services
export { EmbeddingService } from './embeddings/EmbeddingService';
export { MemoryConnectionManager } from './connections/MemoryConnectionManager';
export { ConnectionGraph } from './graph/ConnectionGraph';
export { TemporalPatternAnalyzer } from './patterns/TemporalPatternAnalyzer';
export { MemoryConsolidator } from './consolidation/MemoryConsolidator';

// Utility functions for migration
export { MemoryConnectionManager as MemoryConnectionUtils } from './connections/MemoryConnectionManager';

// Type definitions - clean rebuild configuration
export type {
  // Configuration interfaces - Clean rebuild
  IntelligenceLayerConfig,

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

// Export the 5 connection types as the classification reality
export { FIVE_CORE_CONNECTION_TYPES } from './types';

// Re-export from memory base-types
export type { ConsolidationResult, ImportanceScore } from '../base-types';

/**
 * Default configuration - Clean rebuild for AgentDock Pro
 * Uses PRIME-style environment configuration with smart triage optimization
 */
export const DEFAULT_INTELLIGENCE_CONFIG: IntelligenceLayerConfig = {
  // Base layer - embedding similarity for candidate discovery
  embedding: {
    enabled: true,
    similarityThreshold: 0.3, // Base threshold for candidates (lower = more candidates)
    model: 'text-embedding-3-small' // Default embedding model
  },

  // Connection detection - Clean rebuild with smart triage
  connectionDetection: {
    enabled: true, // Simple on/off toggle for AgentDock Pro

    // LLM configuration follows PRIME pattern - environment-based
    // Uses CONNECTION_PROVIDER || PRIME_PROVIDER for seamless integration
    // Uses CONNECTION_API_KEY || {PROVIDER}_API_KEY for shared credentials

    // Smart triage thresholds for 65% cost optimization
    thresholds: {
      autoSimilar: 0.8, // 40% auto-classified as "similar" (FREE)
      autoRelated: 0.6, // 25% auto-classified as "related" (FREE)
      llmRequired: 0.3 // 35% LLM classifies into 5 research-based types (PAID)
    },

    // Processing configuration
    maxCandidates: 20, // Limit candidates to top-20 for efficiency
    batchSize: 10, // Batch LLM calls for cost efficiency
    temperature: 0.2, // Low temperature for consistent classification
    maxTokens: 500 // Concise prompts and responses
  },

  // Cost control
  costControl: {
    maxLLMCallsPerBatch: 10,
    preferEmbeddingWhenSimilar: true, // Use auto-classification when possible
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
 * Helper function to create intelligence layer config with user overrides
 * Simple configuration for AgentDock Pro - just merge with defaults
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
      thresholds: {
        ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.thresholds,
        ...overrides.connectionDetection?.thresholds
      }
    },
    costControl: {
      ...DEFAULT_INTELLIGENCE_CONFIG.costControl,
      ...overrides.costControl
    }
  };
}
