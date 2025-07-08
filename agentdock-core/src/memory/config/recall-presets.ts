import { LogCategory, logger } from '../../logging';
import { RecallConfig } from '../services/RecallServiceTypes';

/**
 * Production-ready preset configurations for RecallService
 * Based on BEIR benchmark analysis and conversational AI patterns
 */

/**
 * Default configuration matching current production settings
 * Proven balanced approach for broad applicability
 */
const defaultPreset: RecallConfig = {
  hybridSearchWeights: {
    vector: 0.3, // Semantic understanding (current production)
    text: 0.3, // BEIR-validated safety threshold
    temporal: 0.2, // Conversation continuity (current production)
    procedural: 0.2 // Pattern learning (current production)
  },
  defaultLimit: 10,
  minRelevanceThreshold: 0.3,
  enableVectorSearch: true,
  enableRelatedMemories: true,
  maxRelatedDepth: 2,
  cacheResults: true,
  cacheTTL: 300 // 5 minutes (seconds, not milliseconds)
};

/**
 * High-precision configuration for safety-critical domains
 * Medical, legal, financial applications requiring exact terminology
 */
const precisionPreset: RecallConfig = {
  hybridSearchWeights: {
    vector: 0.25, // Conservative for safety-critical applications
    text: 0.45, // Enhanced exact-match for codes, dosages, regulations
    temporal: 0.2, // Historical context importance for compliance
    procedural: 0.1 // Controlled learning patterns for safety
  },
  defaultLimit: 8,
  minRelevanceThreshold: 0.4,
  enableVectorSearch: true,
  enableRelatedMemories: true,
  maxRelatedDepth: 2,
  cacheResults: true,
  cacheTTL: 600 // 10 minutes for stability (seconds)
};

/**
 * Performance-optimized configuration for high-volume applications
 * Customer support, real-time assistance with throughput priority
 */
const performancePreset: RecallConfig = {
  hybridSearchWeights: {
    vector: 0.2, // Reduced computational overhead
    text: 0.5, // Fast keyword-based retrieval
    temporal: 0.25, // Recent context prioritization
    procedural: 0.05 // Minimal learning overhead
  },
  defaultLimit: 6,
  minRelevanceThreshold: 0.35,
  enableVectorSearch: true,
  enableRelatedMemories: false, // Disabled for performance
  maxRelatedDepth: 1,
  cacheResults: true,
  cacheTTL: 180 // 3 minutes for faster updates (seconds)
};

/**
 * Research and analysis configuration for semantic-heavy applications
 * Academic research, content discovery, complex analysis tasks
 */
const researchPreset: RecallConfig = {
  hybridSearchWeights: {
    vector: 0.45, // Enhanced semantic understanding and connections
    text: 0.25, // BEIR minimum safety threshold maintained
    temporal: 0.2, // Connection discovery across conversation history
    procedural: 0.1 // Pattern recognition for insights and trends
  },
  defaultLimit: 15,
  minRelevanceThreshold: 0.15,
  enableVectorSearch: true,
  enableRelatedMemories: true,
  maxRelatedDepth: 4,
  cacheResults: true,
  cacheTTL: 900 // 15 minutes for deep analysis (seconds)
};

/**
 * Available preset configurations
 */
export const RECALL_CONFIG_PRESETS = {
  default: defaultPreset,
  precision: precisionPreset,
  performance: performancePreset,
  research: researchPreset
} as const;

export type RecallPresetName = keyof typeof RECALL_CONFIG_PRESETS;

/**
 * Validate hybrid search weights and provide helpful feedback
 */
export function validateHybridWeights(
  weights: RecallConfig['hybridSearchWeights']
): void {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (Math.abs(sum - 1.0) > 0.01) {
    throw new Error(
      `Hybrid search weights must sum to 1.0, got ${sum.toFixed(3)}. ` +
        `Current weights: ${JSON.stringify(weights, null, 2)}`
    );
  }

  // Helpful warnings based on BEIR research
  if (weights.text < 0.25) {
    logger.warn(
      LogCategory.CONFIG,
      'RecallPresets',
      'Text weight below safety threshold',
      {
        textWeight: weights.text,
        threshold: 0.25,
        risk: 'May cause catastrophic failures on specialized domains (medical, legal, technical)',
        recommendation: 'BEIR research recommends minimum 0.25 for safety'
      }
    );
  }

  if (weights.vector < 0.2) {
    logger.warn(
      LogCategory.CONFIG,
      'RecallPresets',
      'Vector weight below threshold',
      {
        vectorWeight: weights.vector,
        threshold: 0.2,
        risk: 'May significantly reduce semantic understanding capabilities'
      }
    );
  }

  if (weights.temporal < 0.1) {
    logger.warn(
      LogCategory.CONFIG,
      'RecallPresets',
      'Temporal weight below threshold',
      {
        temporalWeight: weights.temporal,
        threshold: 0.1,
        risk: 'May reduce conversation continuity in multi-turn interactions'
      }
    );
  }
}

/**
 * Get preset configuration with optional overrides
 */
export function getRecallPreset(
  presetName: RecallPresetName = 'default',
  overrides?: Partial<RecallConfig>
): RecallConfig {
  const basePreset = RECALL_CONFIG_PRESETS[presetName];

  if (!overrides) {
    return { ...basePreset };
  }

  const config = {
    ...basePreset,
    ...overrides,
    hybridSearchWeights: {
      ...basePreset.hybridSearchWeights,
      ...overrides.hybridSearchWeights
    }
  };

  // Validate the final configuration
  validateHybridWeights(config.hybridSearchWeights);

  return config;
}
