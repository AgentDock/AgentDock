/**
 * @fileoverview Production configuration preset
 *
 * Default configuration for production deployments using PostgreSQL/pgvector.
 * These settings prioritize reliability, performance, and scalability.
 *
 * @note PRODUCTION READINESS: These configurations are PLACEHOLDERS
 * pending production testing. Values are based on best practices but
 * require validation with actual workloads.
 *
 * TODO: Update these values after production testing
 */

import { LLMProvider } from '../../llm/types';
import { PRIMEOrchestratorConfig } from '../../memory/extraction/PRIMEOrchestrator';
// FIVE_CORE_CONNECTION_TYPES are now built into the LLM classification system
import { IntelligenceLayerConfig } from '../../memory/intelligence/types';
import { LifecycleConfig } from '../../memory/lifecycle/types';
import { MemoryManagerConfig } from '../../memory/types';
import { StorageProviderOptions } from '../../storage/types';

/**
 * Validation functions for production configuration
 */
function validateDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Only throw in actual production environments
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DATABASE_URL environment variable is required for production configuration'
      );
    }
    // Return a placeholder for development/test environments
    return 'postgresql://localhost:5432/agentdock_dev';
  }
  return url;
}

function validateApiKey(): string {
  const apiKey = process.env.PRIME_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Only throw in actual production environments
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PRIME_API_KEY or OPENAI_API_KEY environment variable is required'
      );
    }
    // Return a placeholder for development/test environments
    return 'your-api-key-here';
  }
  return apiKey;
}

/**
 * PostgreSQL storage configuration for production
 *
 * @note Connection pooling settings are estimates - tune based on load
 * @note SSL is enabled by default for security
 */
export const productionStorageConfig: StorageProviderOptions = {
  type: 'postgresql',
  namespace: 'production',
  config: {
    // Connection string from environment (lazy evaluation)
    get connectionString() {
      return validateDatabaseUrl();
    },

    // Connection pool settings (PLACEHOLDER - needs tuning)
    pool: {
      max: 20, // Maximum connections
      min: 5, // Minimum connections
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 5000 // 5 seconds
    },

    // Security and performance
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Still use SSL but allow self-signed certs
    preparedStatements: true,

    // Schema settings
    schema: 'public'
  }
};

/**
 * PostgreSQL with pgvector configuration for production vector search
 *
 * @note pgvector extension must be installed in PostgreSQL
 * @note Index settings are placeholders - tune based on dataset size
 */
export const productionVectorStorageConfig: StorageProviderOptions = {
  type: 'postgresql-vector',
  namespace: 'production',
  config: {
    // Inherits PostgreSQL connection settings (lazy evaluation)
    get connectionString() {
      return validateDatabaseUrl();
    },
    pool: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    },
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Still use SSL but allow self-signed certs
    preparedStatements: true,
    schema: 'public',

    // Vector-specific settings (PLACEHOLDER - needs tuning)
    enableVector: true,
    defaultDimension: 1536, // OpenAI embedding dimension
    defaultMetric: 'cosine', // Most common for semantic similarity
    defaultIndexType: 'ivfflat', // Good balance of speed/accuracy

    // IVF index parameters (PLACEHOLDER - tune based on dataset)
    ivfflat: {
      lists: 100, // Number of clusters (sqrt(n) rule of thumb)
      probes: 10 // Clusters to search (accuracy vs speed tradeoff)
    }
  }
};

/**
 * Intelligence configuration for production
 *
 * @note Uses smart triage with LLM classification for 35% of connections
 */
export const productionIntelligenceConfig: IntelligenceLayerConfig = {
  embedding: {
    enabled: true,
    similarityThreshold: 0.3, // Base threshold for candidate discovery
    model: 'text-embedding-3-small'
  },
  connectionDetection: {
    enabled: true, // Simple on/off toggle for AgentDock Pro

    // LLM configuration follows PRIME pattern - shares API keys seamlessly
    // Uses CONNECTION_PROVIDER || PRIME_PROVIDER for seamless integration
    // Uses CONNECTION_API_KEY || {PROVIDER}_API_KEY for shared credentials
    enhancedModel: 'gpt-4o', // Optional quality upgrade for production

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
  costControl: {
    maxLLMCallsPerBatch: 10,
    preferEmbeddingWhenSimilar: true, // Use auto-classification when possible
    trackTokenUsage: true
  }
};

/**
 * Memory configuration for production
 *
 * @note These settings need validation through production testing
 * @note Consider adjusting based on:
 * - User volume
 * - Memory budget
 * - Response time requirements
 * - Cost constraints
 */
export const productionMemoryConfig: MemoryManagerConfig = {
  working: {
    maxTokens: 4000, // Conservative for performance
    ttlSeconds: 7200, // 2 hours
    maxContextItems: 50,
    compressionThreshold: 0.8,
    encryptSensitive: true
  },
  episodic: {
    maxMemoriesPerSession: 1000, // Balanced for cost/performance
    decayRate: 0.1,
    importanceThreshold: 0.4,
    compressionAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    encryptSensitive: true
  },
  semantic: {
    deduplicationThreshold: 0.85,
    maxMemoriesPerCategory: 5000, // Higher for knowledge base
    confidenceThreshold: 0.7,
    vectorSearchEnabled: true,
    encryptSensitive: true,
    autoExtractFacts: true
  },
  procedural: {
    minSuccessRate: 0.7, // Higher threshold for reliability
    maxPatternsPerCategory: 500, // More patterns for production
    decayRate: 0.05, // Conservative decay
    confidenceThreshold: 0.75,
    adaptiveLearning: true,
    patternMerging: true
  },
  intelligence: productionIntelligenceConfig
};

/**
 * Batch processing configuration for production
 *
 * @note Message batching provides 80-90% cost reduction by processing multiple messages per API call
 * @note extractionRate MUST be 1.0 to process all messages - batch sampling is deprecated
 */
export const productionPRIMEConfig: PRIMEOrchestratorConfig = {
  primeConfig: {
    provider: (process.env.PRIME_PROVIDER || 'openai') as LLMProvider,
    get apiKey() {
      return validateApiKey();
    },
    maxTokens: 4000,
    defaultTier: 'standard',
    autoTierSelection: true,
    standardModel: 'gpt-4o-mini',
    advancedModel: 'gpt-4o',
    temperature: 0.2,
    defaultImportanceThreshold: 0.7,
    tierThresholds: {
      advancedMinChars: 500,
      advancedMinRules: 5
    }
  },
  batchSize: 20,
  maxRetries: 3,
  retryDelay: 2000,
  enableMetrics: true
};

/**
 * Lifecycle configuration for production
 *
 * @note Optimized for long-term memory management
 */
export const productionLifecycleConfig: LifecycleConfig = {
  decayConfig: {
    agentId: 'production-agent',
    rules: [
      {
        id: 'critical-preservation',
        name: 'Critical Information Preservation',
        condition: 'importance > 0.9',
        decayRate: 0,
        minImportance: 0.8,
        neverDecay: true,
        enabled: true
      },
      {
        id: 'high-importance',
        name: 'High Importance Slow Decay',
        condition: 'importance > 0.7',
        decayRate: 0.02,
        minImportance: 0.5,
        neverDecay: false,
        enabled: true
      },
      {
        id: 'accessed-frequently',
        name: 'Frequently Accessed Preservation',
        condition: 'accessCount > 10',
        decayRate: 0.01,
        minImportance: 0.4,
        neverDecay: false,
        enabled: true
      }
    ],
    defaultDecayRate: 0.1,
    decayInterval: 24 * 60 * 60 * 1000, // Daily
    deleteThreshold: 0.05,
    verbose: false
  },
  promotionConfig: {
    episodicToSemanticDays: 30,
    minImportanceForPromotion: 0.7,
    minAccessCountForPromotion: 5,
    preserveOriginal: false // Save space in production
  },
  cleanupConfig: {
    deleteThreshold: 0.05,
    archiveEnabled: true,
    maxMemoriesPerAgent: 50000,
    archiveKeyPattern: 'archive:prod:{agentId}:{memoryId}',
    archiveTTL: 365 * 24 * 60 * 60, // 1 year
    compressArchive: true
  }
};

/**
 * Complete production preset
 *
 * @example
 * ```typescript
 * import { productionPreset } from '@agentdock/core/config/presets/production';
 *
 * // Basic usage
 * const storage = createStorageProvider(productionPreset.storage);
 * const memory = new MemoryManager(storage, productionPreset.memory);
 *
 * // With vector search
 * const vectorStorage = createStorageProvider(productionPreset.vectorStorage);
 * ```
 */
export const productionPreset = {
  storage: productionStorageConfig,
  vectorStorage: productionVectorStorageConfig,
  memory: productionMemoryConfig,
  intelligence: productionIntelligenceConfig,
  prime: productionPRIMEConfig,
  lifecycle: productionLifecycleConfig,

  // Production-specific settings
  settings: {
    enableDebugLogging: false,
    enableMetrics: true,
    enableTracing: true,
    autoBatch: true,
    autoLifecycle: true,
    autoConnections: true,

    // Performance settings (PLACEHOLDER)
    performance: {
      maxConcurrentRequests: 100,
      requestTimeoutMs: 60000, // 1 minute
      enableCaching: true,
      cacheTimeoutMs: 300000 // 5 minutes
    },

    // Security settings
    security: {
      enableEncryption: true,
      enableAuditLog: true,
      maxRequestSize: 1048576 // 1MB
    }
  }
};

/**
 * Production preset with auto-scaling considerations
 *
 * @note This is a PLACEHOLDER configuration for cloud deployments
 * with auto-scaling. Requires infrastructure-specific adjustments.
 */
export const productionAutoScalePreset = {
  ...productionPreset,
  storage: {
    ...productionStorageConfig,
    config: {
      ...productionStorageConfig.config,
      pool: {
        max: 10, // Lower per-instance for auto-scaling
        min: 2,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 3000
      }
    }
  },
  settings: {
    ...productionPreset.settings,
    performance: {
      ...productionPreset.settings.performance,
      maxConcurrentRequests: 50 // Lower per-instance
    }
  }
};

export default productionPreset;
