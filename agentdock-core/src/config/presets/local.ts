/**
 * @fileoverview Local development configuration preset
 *
 * Default configuration for local development using SQLite/SQLite-vec.
 * These settings prioritize ease of use and zero external dependencies.
 *
 * @note PRODUCTION READINESS: These configurations are placeholders
 * pending production testing. Adjust based on actual performance metrics.
 */

import { PRIMEOrchestratorConfig } from '../../memory/extraction/PRIMEOrchestrator';
// FIVE_CORE_CONNECTION_TYPES are now built into the LLM classification system
import { IntelligenceLayerConfig } from '../../memory/intelligence/types';
import { LifecycleConfig } from '../../memory/lifecycle/types';
import { MemoryManagerConfig } from '../../memory/types';
import { StorageProviderOptions } from '../../storage/types';

/**
 * SQLite storage configuration for local development
 *
 * @note Performance characteristics are estimates pending production testing
 */
export const localStorageConfig: StorageProviderOptions = {
  type: 'sqlite',
  namespace: 'local-dev',
  config: {
    path: './agentdock.db',
    walMode: true,
    verbose: false
  }
};

/**
 * SQLite-vec storage configuration for local development with vector search
 *
 * @note Requires sqlite-vec extension to be installed
 * @note Vector performance metrics are placeholders
 */
export const localVectorStorageConfig: StorageProviderOptions = {
  type: 'sqlite-vec',
  namespace: 'local-dev',
  config: {
    path: './agentdock.db',
    walMode: true,
    verbose: false,
    enableVector: true,
    defaultDimension: 1536,
    defaultMetric: 'cosine'
  }
};

/**
 * Intelligence configuration for local development
 *
 * @note Uses smart triage with auto-classification only (no LLM calls for local dev)
 */
export const localIntelligenceConfig: IntelligenceLayerConfig = {
  embedding: {
    enabled: true,
    similarityThreshold: 0.3, // Base threshold for candidate discovery
    model: 'text-embedding-3-small'
  },
  connectionDetection: {
    enabled: true, // Simple on/off toggle for AgentDock Pro

    // Smart triage thresholds (local dev uses only auto-classification - no LLM)
    thresholds: {
      autoSimilar: 0.8, // 40% auto-classified as "similar" (FREE)
      autoRelated: 0.6, // 25% auto-classified as "related" (FREE)
      llmRequired: 1.0 // Set to 1.0 to disable LLM calls for local dev
    },

    // Processing configuration
    maxCandidates: 20, // Limit candidates to top-20 for efficiency
    batchSize: 10, // Batch size for processing
    temperature: 0.2, // LLM temperature (not used in local)
    maxTokens: 500 // Max tokens (not used in local)
  },
  costControl: {
    maxLLMCallsPerBatch: 0, // No LLM calls for local
    preferEmbeddingWhenSimilar: true,
    trackTokenUsage: true
  }
};

/**
 * Memory configuration for local development
 *
 * @note These settings are conservative for local development.
 * Production testing needed to optimize thresholds.
 */
export const localMemoryConfig: MemoryManagerConfig = {
  working: {
    maxTokens: 8000,
    ttlSeconds: 3600,
    maxContextItems: 100,
    compressionThreshold: 0.8,
    encryptSensitive: false
  },
  episodic: {
    maxMemoriesPerSession: 500,
    decayRate: 0.05,
    importanceThreshold: 0.3,
    compressionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    encryptSensitive: false
  },
  semantic: {
    deduplicationThreshold: 0.8,
    maxMemoriesPerCategory: 1000,
    confidenceThreshold: 0.6,
    vectorSearchEnabled: false,
    encryptSensitive: false,
    autoExtractFacts: true
  },
  procedural: {
    minSuccessRate: 0.6,
    maxPatternsPerCategory: 100,
    decayRate: 0.1,
    confidenceThreshold: 0.7,
    adaptiveLearning: true,
    patternMerging: true
  },
  intelligence: localIntelligenceConfig
};

/**
 * Batch processing configuration for local development
 *
 * @note 100% extraction rate for local development, rules-only (no API costs)
 */
export const localPRIMEConfig: PRIMEOrchestratorConfig = {
  primeConfig: {
    provider: (process.env.PRIME_PROVIDER || 'openai') as any,
    apiKey: process.env.PRIME_API_KEY || process.env.OPENAI_API_KEY || '',
    maxTokens: 4000,
    defaultTier: 'standard',
    autoTierSelection: true,
    standardModel: 'gpt-4o-mini',
    advancedModel: 'gpt-4o',
    temperature: 0.3,
    defaultImportanceThreshold: 0.7
  },
  batchSize: 10,
  maxRetries: 2,
  enableMetrics: true
};

/**
 * Lifecycle configuration for local development
 *
 * @note Conservative settings for local testing
 */
export const localLifecycleConfig: LifecycleConfig = {
  decayConfig: {
    agentId: 'local-agent',
    rules: [
      {
        id: 'high-importance',
        name: 'High Importance Preservation',
        condition: 'importance > 0.8',
        decayRate: 0.01,
        minImportance: 0.5,
        neverDecay: false,
        enabled: true
      }
    ],
    defaultDecayRate: 0.05,
    decayInterval: 24 * 60 * 60 * 1000, // Daily
    deleteThreshold: 0.1,
    verbose: true
  },
  promotionConfig: {
    episodicToSemanticDays: 7,
    minImportanceForPromotion: 0.6,
    minAccessCountForPromotion: 3,
    preserveOriginal: true
  },
  cleanupConfig: {
    deleteThreshold: 0.1,
    archiveEnabled: true,
    maxMemoriesPerAgent: 10000,
    archiveKeyPattern: 'archive:local:{agentId}:{memoryId}',
    archiveTTL: 30 * 24 * 60 * 60, // 30 days
    compressArchive: false
  }
};

/**
 * Complete local development preset
 *
 * @example
 * ```typescript
 * import { localPreset } from '@agentdock/core/config/presets/local';
 *
 * const storage = createStorageProvider(localPreset.storage);
 * const memory = new MemoryManager(storage, localPreset.memory);
 * ```
 */
export const localPreset = {
  storage: localStorageConfig,
  vectorStorage: localVectorStorageConfig,
  memory: localMemoryConfig,
  intelligence: localIntelligenceConfig,
  prime: localPRIMEConfig,
  lifecycle: localLifecycleConfig,

  // Additional local development settings
  settings: {
    enableDebugLogging: true,
    enableMetrics: false,
    enableTracing: false,
    autoBatch: true,
    autoLifecycle: false, // Manual for local dev
    autoConnections: true
  }
};

export default localPreset;
