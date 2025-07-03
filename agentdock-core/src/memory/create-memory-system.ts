/**
 * @fileoverview Memory System Factory - Easy setup for complete memory system
 *
 * Provides a single function to create a fully configured memory system
 * using presets for local and production environments.
 */

import { localPreset, productionPreset } from '../config/presets';
import { createStorageProvider } from '../storage/factory';
import { StorageProvider } from '../storage/types';
import { getRecallPreset, RecallPresetName } from './config/recall-presets';
import {
  PRIMEOrchestrator,
  PRIMEOrchestratorConfig
} from './extraction/PRIMEOrchestrator';
import { MemoryLifecycleManager } from './lifecycle/MemoryLifecycleManager';
import { MemoryManager } from './MemoryManager';
import { RecallService } from './services/RecallService';
import { RecallConfig } from './services/RecallServiceTypes';

export interface MemorySystemOptions {
  environment?: 'local' | 'production';
  databaseUrl?: string;
  recallPreset?: RecallPresetName;
  overrides?: {
    storage?: any;
    memory?: any;
    prime?: any;
    lifecycle?: any;
    intelligence?: any;
    recall?: Partial<RecallConfig>;
  };
}

export interface MemorySystem {
  // Simple API
  store: (userId: string, content: string, type?: string) => Promise<string>;
  recall: (userId: string, query: string, options?: any) => Promise<any[]>;
  addMessage: (userId: string, message: any) => Promise<any[]>;

  // Direct access to components
  manager: MemoryManager;
  extraction: PRIMEOrchestrator;
  lifecycle: MemoryLifecycleManager;
  storage: StorageProvider;
  recallService: RecallService;
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
  const storage = await createStorageProvider(config.storage);

  // Initialize storage if needed
  if ('initialize' in storage && typeof storage.initialize === 'function') {
    await storage.initialize();
  }

  // Create memory manager with all configs including intelligence
  const manager = new MemoryManager(storage, config.memory);

  // Create PRIME orchestrator
  const extraction = new PRIMEOrchestrator(storage, {
    primeConfig: {
      provider: config.intelligence?.provider || 'anthropic',
      apiKey:
        config.intelligence?.apiKey || process.env.ANTHROPIC_API_KEY || '',
      maxTokens: config.intelligence?.maxTokens || 4000,
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
    batchSize: config.prime?.batchSize || 10,
    enableMetrics: true
  });

  // Create lifecycle manager
  const lifecycle = new MemoryLifecycleManager(storage, config.lifecycle);

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

  // Set up lifecycle scheduling if enabled
  if (preset.settings.autoLifecycle) {
    // Run lifecycle every 24 hours
    setInterval(
      async () => {
        try {
          await lifecycle.runLifecycle('system', 'default');
        } catch (error) {
          console.error('Lifecycle error:', error);
        }
      },
      24 * 60 * 60 * 1000
    );
  }

  // Return simple API
  return {
    // Core operations
    async store(userId: string, content: string, type: string = 'semantic') {
      return manager.store(userId, 'default', content, type as any);
    },

    async recall(userId: string, query: string, options = {}) {
      return manager.recall(userId, 'default', query, options);
    },

    async addMessage(userId: string, message: any) {
      const result = await extraction.processMessages(userId, 'default', [
        {
          id: message.id || Date.now().toString(),
          agentId: 'default',
          content: message.content,
          timestamp: message.timestamp || Date.now(),
          metadata: {
            role: message.role || 'user'
          }
        }
      ]);
      return result.memories;
    },

    // Direct access
    manager,
    extraction,
    lifecycle,
    storage,
    recallService
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
