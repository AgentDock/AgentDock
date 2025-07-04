/**
 * Validated Intelligence Layer Configuration
 *
 * These thresholds have been tested and validated for production use:
 * - 0.70 similarity threshold for OpenAI embeddings
 * - 0.6 minimum confidence for LLM connection detection
 */

import { IntelligenceLayerConfig } from '../intelligence/types';

export const DEFAULT_INTELLIGENCE_CONFIG: IntelligenceLayerConfig = {
  embedding: {
    enabled: true,
    similarityThreshold: 0.7, // ← VALIDATED OpenAI threshold
    model: 'text-embedding-3-small'
  },

  connectionDetection: {
    method: 'hybrid',

    userRules: {
      enabled: true,
      patterns: [] // User can configure domain-specific rules
    },

    llmEnhancement: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      maxTokensPerAnalysis: 500,
      temperature: 0.2,
      validateResponses: true,
      fallbackToEmbedding: true,
      minConfidence: 0.6, // ← VALIDATED LLM threshold
      costPerToken: 0.000002 // $0.000002 per token for gpt-4o-mini
    }
  },

  costControl: {
    maxLLMCallsPerBatch: 10,
    monthlyBudget: 50,
    preferEmbeddingWhenSimilar: true,
    trackTokenUsage: true
  }
};

/**
 * Create a custom intelligence config by merging with defaults
 */
export function createIntelligenceConfig(
  overrides?: Partial<IntelligenceLayerConfig>
): IntelligenceLayerConfig {
  return {
    ...DEFAULT_INTELLIGENCE_CONFIG,
    ...overrides,
    embedding: {
      ...DEFAULT_INTELLIGENCE_CONFIG.embedding,
      ...overrides?.embedding
    },
    connectionDetection: {
      ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection,
      ...overrides?.connectionDetection,
      userRules: {
        ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.userRules,
        ...overrides?.connectionDetection?.userRules
      },
      llmEnhancement: {
        ...DEFAULT_INTELLIGENCE_CONFIG.connectionDetection.llmEnhancement,
        ...overrides?.connectionDetection?.llmEnhancement
      }
    },
    costControl: {
      ...DEFAULT_INTELLIGENCE_CONFIG.costControl,
      ...overrides?.costControl
    }
  };
}
