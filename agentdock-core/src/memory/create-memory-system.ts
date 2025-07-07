/**
 * @fileoverview Memory System Factory - Easy setup for complete memory system
 *
 * Provides a single function to create a fully configured memory system
 * using presets for local and production environments.
 */

import { localPreset, productionPreset } from '../config/presets';
import { createStorageProvider } from '../storage/factory';
import { StorageProvider, MemoryData, StorageProviderOptions } from '../storage/types';
import { getRecallPreset, RecallPresetName } from './config/recall-presets';
import {
  PRIMEOrchestrator,
  PRIMEOrchestratorConfig
} from './extraction/PRIMEOrchestrator';
// TEMP: MemoryLifecycleManager removed for lazy decay implementation
// import { MemoryLifecycleManager } from './lifecycle/MemoryLifecycleManager';
import { MemoryManager } from './MemoryManager';
import { RecallService } from './services/RecallService';
import { RecallConfig, RecallQuery } from './services/RecallServiceTypes';
import { MemoryType } from '../shared/types/memory';
import { LogCategory, logger } from '../logging';
import { MemoryMessage, Memory } from './types/common';
import { MemoryManagerConfig } from './types';
import { LifecycleConfig } from './lifecycle/types';
import { IntelligenceLayerConfig } from './intelligence/types';

function isValidMemoryType(type: string): type is MemoryType {
  return Object.values(MemoryType).includes(type as MemoryType);
}

export interface MemorySystemOptions {
  environment?: 'local' | 'production';
  databaseUrl?: string;
  recallPreset?: RecallPresetName;
  overrides?: {
    storage?: Partial<StorageProviderOptions>;
    memory?: Partial<MemoryManagerConfig>;
    prime?: Partial<PRIMEOrchestratorConfig>;
    lifecycle?: Partial<LifecycleConfig>;
    intelligence?: Partial<IntelligenceLayerConfig>;
    recall?: Partial<RecallConfig>;
  };
}

export interface MemorySystem {
  // Simple API
  store: (userId: string, content: string, type?: string) => Promise<string>;
  recall: (userId: string, query: string, options?: Partial<RecallQuery>) => Promise<MemoryData[]>;
  addMessage: (userId: string, message: MemoryMessage) => Promise<Memory[]>;

  // Direct access to components
  manager: MemoryManager;
  extraction: PRIMEOrchestrator;
  // TEMP: lifecycle: MemoryLifecycleManager; // Removed for lazy decay implementation
  storage: StorageProvider;
  recallService: RecallService;

  // Cleanup method
  close: () => Promise<void>;
}

/**
 * Create a complete memory system with a single function call
 *
 * @example
 * ```typescript
 * // Local development
 * const memory = await createMemorySystem({ environment: 'local' });
 *
 * // Production with database URL
 * const memory = await createMemorySystem({
 *   environment: 'production',
 *   databaseUrl: process.env.DATABASE_URL
 * });
 *
 * // Use it
 * await memory.store(userId, "Important fact about user preferences");
 * const memories = await memory.recall(userId, "user preferences");
 * ```
 */
export async function createMemorySystem(
  options: MemorySystemOptions = {}
): Promise<MemorySystem> {
  const {
    environment = 'local',
    databaseUrl,
    recallPreset,
    overrides = {}
  } = options;

  // Select preset based on environment
  const preset = environment === 'production' ? productionPreset : localPreset;

  // Apply overrides
  const config = {
    storage: { ...preset.storage, ...overrides.storage },
    memory: { ...preset.memory, ...overrides.memory },
    prime: { ...preset.prime, ...overrides.prime },
    lifecycle: { ...preset.lifecycle, ...overrides.lifecycle },
    intelligence: { ...preset.intelligence, ...overrides.intelligence },
    recall: { ...overrides.recall }
  };

  // Handle production database URL
  if (environment === 'production' && databaseUrl) {
    config.storage.config = {
      ...config.storage.config,
      connectionString: databaseUrl
    };
  }

  // Create storage provider
  const storage = await createStorageProvider({
    ...config.storage,
    namespace: config.storage.namespace || 'default'
  });

  // Initialize storage if needed
  if ('initialize' in storage && typeof storage.initialize === 'function') {
    await storage.initialize();
  }

  // Create memory manager with all configs including intelligence
  const manager = new MemoryManager(storage, config.memory);

  // Create PRIME orchestrator
  const extraction = new PRIMEOrchestrator(storage, config.prime || {
    primeConfig: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      maxTokens: 4000,
      autoTierSelection: false,
      defaultTier: 'balanced',
      defaultImportanceThreshold: 0.7,
      temperature: 0.3,
      modelTiers: {
        fast: 'gpt-3.5-turbo',
        balanced: 'gpt-4o-mini',
        accurate: 'gpt-4o'
      }
    },
    batchSize: 10,
    enableMetrics: true
  });

  // TEMP: Create lifecycle manager - Removed for lazy decay implementation
  // const lifecycle = new MemoryLifecycleManager(storage, config.lifecycle);

  // Create recall service with preset configuration
  // @todo Add traceability: Log preset selection and performance metrics
  // - Track which presets are used most frequently
  // - Monitor preset performance across different agent types
  // - Add automatic preset recommendation based on usage patterns
  const recallConfig = getRecallPreset(recallPreset || 'default', {
    enableVectorSearch: config.storage.type.includes('vector'),
    cacheResults: environment === 'production',
    ...config.recall
  });

  const recallService = new RecallService(
    manager['working'],
    manager['episodic'],
    manager['semantic'],
    manager['procedural'],
    recallConfig
  );

  // Track cleanup resources
  let lifecycleIntervalId: NodeJS.Timeout | null = null;

  // Set up lifecycle scheduling if enabled
  if (preset.settings.autoLifecycle) {
    // Run lifecycle every 24 hours
    lifecycleIntervalId = setInterval(
      async () => {
        try {
          // TEMP: Lifecycle execution disabled for lazy decay implementation
          // await lifecycle.runLifecycle('system', 'default');
          logger.debug(LogCategory.STORAGE, 'MemorySystem', 'Lifecycle execution skipped (lazy decay mode)');
        } catch (error) {
          logger.error(LogCategory.STORAGE, 'MemorySystem', 'Lifecycle execution failed', {
            error: error instanceof Error ? error.message : String(error),
            userId: 'system',
            agentId: 'default'
          });
        }
      },
      24 * 60 * 60 * 1000
    );
  }

  // Return simple API
  return {
    // Core operations
    async store(userId: string, content: string, type: string = 'semantic') {
      if (!isValidMemoryType(type)) {
        throw new Error(`Invalid memory type: ${type}. Valid types: ${Object.values(MemoryType).join(', ')}`);
      }
      return manager.store(userId, 'default', content, type);
    },

    async recall(userId: string, query: string, options = {}) {
      return manager.recall(userId, 'default', query, options);
    },

    async addMessage(userId: string, message: MemoryMessage) {
      const result = await extraction.processMessages(userId, 'default', [
        {
          id: message.id || Date.now().toString(),
          agentId: message.agentId || 'default',
          content: message.content,
          timestamp: message.timestamp,
          role: message.role,
          metadata: {
            ...message.metadata,
            role: message.role || 'user'
          }
        }
      ]);
      return result.memories;
    },

    // Direct access
    manager,
    extraction,
    // TEMP: lifecycle, // Removed for lazy decay implementation
    storage,
    recallService,

    // Cleanup method
    async close() {
      // Clear the lifecycle interval if it exists
      if (lifecycleIntervalId) {
        clearInterval(lifecycleIntervalId);
        lifecycleIntervalId = null;
      }

      // Close the manager (which should clean up memory types)
      if (manager.close) {
        await manager.close();
      }

      // Clean up recall service if it has a destroy method
      if (recallService && typeof recallService.destroy === 'function') {
        await recallService.destroy();
      }

      // Note: Lifecycle schedulers are managed internally by LifecycleScheduler
      // and cleaned up via storage.destroy() if needed
    }
  };
}

/**
 * Quick setup for local development
 */
export async function createLocalMemory() {
  return createMemorySystem({ environment: 'local' });
}

/**
 * Quick setup for production
 */
export async function createProductionMemory(databaseUrl: string) {
  return createMemorySystem({
    environment: 'production',
    databaseUrl
  });
}
