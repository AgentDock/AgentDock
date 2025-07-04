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
 * @note Uses embedding-only for local dev (no external API calls)
 */
export const localIntelligenceConfig: IntelligenceLayerConfig = {
  embedding: {
    enabled: true,
    similarityThreshold: 0.7,
    model: 'text-embedding-3-small'
  },
  connectionDetection: {
    method: 'embedding-only',
    userRules: {
      enabled: true,
      patterns: []
    }
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
    provider: process.env.PRIME_PROVIDER || 'anthropic',
    apiKey: process.env.PRIME_API_KEY || '',
    maxTokens: 4000,
    defaultTier: 'fast',
    autoTierSelection: false,
    temperature: 0.3,
    defaultImportanceThreshold: 0.7,
    modelTiers: {
      fast: 'claude-3-haiku-20240307',
      balanced: 'claude-3-sonnet-20240229',
      accurate: 'claude-3-opus-20240229'
    }
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
