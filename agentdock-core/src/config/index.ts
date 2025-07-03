/**
 * @fileoverview Configuration management for AgentDock
 *
 * Provides configuration factory functions for different deployment scenarios.
 * No auto-detection - parent application explicitly chooses configuration.
 */

import { MemoryManagerConfig } from '../memory/types';
import { StorageProviderOptions } from '../storage/types';

export * from './presets/local';
export * from './presets/production';
export * from './agents';

/**
 * Complete configuration object
 */
export interface AgentDockConfig {
  storage: StorageProviderOptions;
  vectorStorage?: StorageProviderOptions;
  memory: MemoryManagerConfig;
  settings: Record<string, any>;
}

/**
 * Configuration options for different storage types
 */
export interface StorageConfigOptions {
  sqlite?: {
    path?: string;
    walMode?: boolean;
    verbose?: boolean;
  };
  postgresql?: {
    connectionString: string;
    pool?: {
      max?: number;
      min?: number;
      idleTimeoutMillis?: number;
      connectionTimeoutMillis?: number;
    };
    ssl?: any;
    schema?: string;
  };
}

/**
 * Creates local development configuration (SQLite-based)
 *
 * @param options - Optional overrides
 * @returns Local configuration
 *
 * @example
 * ```typescript
 * // Basic local setup
 * const config = createLocalConfig();
 *
 * // Custom database path
 * const config = createLocalConfig({
 *   storage: { path: './custom.db' }
 * });
 * ```
 */
export function createLocalConfig(options?: {
  storage?: StorageConfigOptions['sqlite'];
  memory?: Partial<MemoryManagerConfig>;
  settings?: Record<string, any>;
}): AgentDockConfig {
  return {
    storage: {
      type: 'sqlite',
      namespace: 'local-dev',
      config: {
        path: './agentdock.db',
        walMode: true,
        verbose: false,
        ...options?.storage
      }
    },
    vectorStorage: {
      type: 'sqlite-vec',
      namespace: 'local-dev',
      config: {
        path: './agentdock.db',
        walMode: true,
        verbose: false,
        enableVector: true,
        defaultDimension: 1536,
        defaultMetric: 'cosine',
        ...options?.storage
      }
    },
    memory: {
      working: {
        maxTokens: 8000,
        ttlSeconds: 3600,
        maxContextItems: 100,
        compressionThreshold: 0.8,
        encryptSensitive: false,
        ...options?.memory?.working
      },
      episodic: {
        maxMemoriesPerSession: 500,
        decayRate: 0.05,
        importanceThreshold: 0.3,
        compressionAge: 7 * 24 * 60 * 60 * 1000,
        encryptSensitive: false,
        ...options?.memory?.episodic
      },
      semantic: {
        deduplicationThreshold: 0.8,
        maxMemoriesPerCategory: 1000,
        confidenceThreshold: 0.6,
        vectorSearchEnabled: false,
        encryptSensitive: false,
        autoExtractFacts: true,
        ...options?.memory?.semantic
      },
      procedural: {
        minSuccessRate: 0.6,
        maxPatternsPerCategory: 100,
        decayRate: 0.1,
        confidenceThreshold: 0.7,
        adaptiveLearning: true,
        patternMerging: true,
        ...options?.memory?.procedural
      }
    },
    settings: {
      enableDebugLogging: true,
      enableMetrics: false,
      enableTracing: false,
      batchProcessing: {
        enabled: false,
        maxBatchSize: 10,
        timeoutMs: 5000
      },
      ...options?.settings
    }
  };
}

/**
 * Creates production configuration (PostgreSQL-based)
 *
 * @param connectionString - PostgreSQL connection string
 * @param options - Optional overrides
 * @returns Production configuration
 *
 * @example
 * ```typescript
 * // Commercial usage
 * const config = createProductionConfig(process.env.SUPABASE_URL);
 *
 * // Open source with custom connection
 * const config = createProductionConfig('postgresql://...', {
 *   storage: { pool: { max: 10 } }
 * });
 * ```
 */
export function createProductionConfig(
  connectionString: string,
  options?: {
    storage?: Partial<StorageConfigOptions['postgresql']>;
    memory?: Partial<MemoryManagerConfig>;
    settings?: Record<string, any>;
  }
): AgentDockConfig {
  if (!connectionString) {
    throw new Error(
      'PostgreSQL connection string is required for production config'
    );
  }

  return {
    storage: {
      type: 'postgresql',
      namespace: 'production',
      config: {
        connectionString,
        pool: {
          max: 20,
          min: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        },
        ssl: { rejectUnauthorized: false },
        preparedStatements: true,
        schema: 'public',
        ...options?.storage
      }
    },
    vectorStorage: {
      type: 'postgresql-vector',
      namespace: 'production',
      config: {
        connectionString,
        pool: {
          max: 20,
          min: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        },
        ssl: { rejectUnauthorized: false },
        preparedStatements: true,
        schema: 'public',
        enableVector: true,
        defaultDimension: 1536,
        defaultMetric: 'cosine',
        defaultIndexType: 'ivfflat',
        ivfflat: {
          lists: 100,
          probes: 10
        },
        ...options?.storage
      }
    },
    memory: {
      working: {
        maxTokens: 4000,
        ttlSeconds: 7200,
        maxContextItems: 50,
        compressionThreshold: 0.8,
        encryptSensitive: true,
        ...options?.memory?.working
      },
      episodic: {
        maxMemoriesPerSession: 1000,
        decayRate: 0.1,
        importanceThreshold: 0.4,
        compressionAge: 30 * 24 * 60 * 60 * 1000,
        encryptSensitive: true,
        ...options?.memory?.episodic
      },
      semantic: {
        deduplicationThreshold: 0.85,
        maxMemoriesPerCategory: 5000,
        confidenceThreshold: 0.7,
        vectorSearchEnabled: true,
        encryptSensitive: true,
        autoExtractFacts: true,
        ...options?.memory?.semantic
      },
      procedural: {
        minSuccessRate: 0.7,
        maxPatternsPerCategory: 500,
        decayRate: 0.05,
        confidenceThreshold: 0.75,
        adaptiveLearning: true,
        patternMerging: true,
        ...options?.memory?.procedural
      }
    },
    settings: {
      enableDebugLogging: false,
      enableMetrics: true,
      enableTracing: true,
      batchProcessing: {
        enabled: true,
        maxBatchSize: 50,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      },
      costControl: {
        maxMonthlyBudget: 100,
        maxTokensPerRequest: 4000,
        enableCostAlerts: true,
        alertThreshold: 0.8
      },
      performance: {
        maxConcurrentRequests: 100,
        requestTimeoutMs: 60000,
        enableCaching: true,
        cacheTimeoutMs: 300000
      },
      security: {
        enableEncryption: true,
        enableAuditLog: true,
        maxRequestSize: 1048576
      },
      ...options?.settings
    }
  };
}

/**
 * Creates custom configuration from storage adapter and options
 *
 * @param storage - Storage configuration
 * @param options - Memory and settings overrides
 * @returns Custom configuration
 *
 * @example
 * ```typescript
 * // Full custom setup
 * const config = createCustomConfig(
 *   { type: 'mongodb', config: { uri: 'mongodb://...' } },
 *   { memory: { working: { maxTokens: 16000 } } }
 * );
 * ```
 */
export function createCustomConfig(
  storage: StorageProviderOptions,
  options?: {
    vectorStorage?: StorageProviderOptions;
    memory?: Partial<MemoryManagerConfig>;
    settings?: Record<string, any>;
  }
): AgentDockConfig {
  // Use local config as base, then override with provided storage
  const baseConfig = createLocalConfig();

  return {
    storage,
    vectorStorage: options?.vectorStorage || storage,
    memory: {
      working: {
        maxTokens:
          options?.memory?.working?.maxTokens ??
          baseConfig.memory.working!.maxTokens,
        ttlSeconds:
          options?.memory?.working?.ttlSeconds ??
          baseConfig.memory.working!.ttlSeconds,
        maxContextItems:
          options?.memory?.working?.maxContextItems ??
          baseConfig.memory.working!.maxContextItems,
        compressionThreshold:
          options?.memory?.working?.compressionThreshold ??
          baseConfig.memory.working!.compressionThreshold,
        encryptSensitive:
          options?.memory?.working?.encryptSensitive ??
          baseConfig.memory.working!.encryptSensitive
      },
      episodic: {
        maxMemoriesPerSession:
          options?.memory?.episodic?.maxMemoriesPerSession ??
          baseConfig.memory.episodic!.maxMemoriesPerSession,
        decayRate:
          options?.memory?.episodic?.decayRate ??
          baseConfig.memory.episodic!.decayRate,
        importanceThreshold:
          options?.memory?.episodic?.importanceThreshold ??
          baseConfig.memory.episodic!.importanceThreshold,
        compressionAge:
          options?.memory?.episodic?.compressionAge ??
          baseConfig.memory.episodic!.compressionAge,
        encryptSensitive:
          options?.memory?.episodic?.encryptSensitive ??
          baseConfig.memory.episodic!.encryptSensitive
      },
      semantic: {
        deduplicationThreshold:
          options?.memory?.semantic?.deduplicationThreshold ??
          baseConfig.memory.semantic!.deduplicationThreshold,
        maxMemoriesPerCategory:
          options?.memory?.semantic?.maxMemoriesPerCategory ??
          baseConfig.memory.semantic!.maxMemoriesPerCategory,
        confidenceThreshold:
          options?.memory?.semantic?.confidenceThreshold ??
          baseConfig.memory.semantic!.confidenceThreshold,
        vectorSearchEnabled:
          options?.memory?.semantic?.vectorSearchEnabled ??
          baseConfig.memory.semantic!.vectorSearchEnabled,
        encryptSensitive:
          options?.memory?.semantic?.encryptSensitive ??
          baseConfig.memory.semantic!.encryptSensitive,
        autoExtractFacts:
          options?.memory?.semantic?.autoExtractFacts ??
          baseConfig.memory.semantic!.autoExtractFacts
      },
      procedural: {
        minSuccessRate:
          options?.memory?.procedural?.minSuccessRate ??
          baseConfig.memory.procedural!.minSuccessRate,
        maxPatternsPerCategory:
          options?.memory?.procedural?.maxPatternsPerCategory ??
          baseConfig.memory.procedural!.maxPatternsPerCategory,
        decayRate:
          options?.memory?.procedural?.decayRate ??
          baseConfig.memory.procedural!.decayRate,
        confidenceThreshold:
          options?.memory?.procedural?.confidenceThreshold ??
          baseConfig.memory.procedural!.confidenceThreshold,
        adaptiveLearning:
          options?.memory?.procedural?.adaptiveLearning ??
          baseConfig.memory.procedural!.adaptiveLearning,
        patternMerging:
          options?.memory?.procedural?.patternMerging ??
          baseConfig.memory.procedural!.patternMerging
      }
    },
    settings: { ...baseConfig.settings, ...options?.settings }
  };
}

/**
 * Configuration validation helper
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: AgentDockConfig): void {
  if (!config.storage?.type) {
    throw new Error('Storage type is required');
  }

  if (!config.memory) {
    throw new Error('Memory configuration is required');
  }

  if (
    config.storage.type === 'postgresql' &&
    !config.storage.config?.connectionString
  ) {
    throw new Error('PostgreSQL connection string is required');
  }

  if (config.storage.type === 'sqlite' && !config.storage.config?.path) {
    throw new Error('SQLite database path is required');
  }
}
