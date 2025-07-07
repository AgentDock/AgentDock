// Import config types for MemoryManagerConfig
import { LogCategory, logger } from '../../logging';
import { MemoryOperations, VectorMemoryOperations } from '../../storage/types';
/**
 * Memory utilities initialization and services
 * Works with memory-enabled adapters only
 */

import { EmbeddingService } from '../intelligence/embeddings/EmbeddingService';
import type { IntelligenceLayerConfig } from '../intelligence/types';
import type { EpisodicMemoryConfig } from './episodic/EpisodicMemoryTypes';
import { initializeEpisodicMemoryServices } from './episodic/EpisodicMemoryUtils';
import type { ProceduralMemoryConfig } from './procedural/ProceduralMemoryTypes';
import type { SemanticMemoryConfig } from './semantic/SemanticMemoryTypes';
// Import initialization functions from all utility files
import { initializeSemanticServices } from './semantic/SemanticMemoryUtils';
import type { WorkingMemoryConfig } from './working/WorkingMemoryTypes';
import { initializeWorkingMemoryServices } from './working/WorkingMemoryUtils';

/**
 * @fileoverview Memory Types - Production-Ready Memory Adapter Support
 *
 * PRODUCTION MEMORY ADAPTERS:
 * ✅ PostgreSQL-Vector (hybrid search + ACID transactions)
 * ✅ SQLite-Vec (hybrid search + local development)
 * ✅ PostgreSQL (text search + ACID transactions)
 * ✅ SQLite (text search + local development)
 *
 * STORAGE-ONLY ADAPTERS (No Memory Operations):
 * ❌ ChromaDB, Pinecone, Qdrant (vector similarity + KV only)
 *
 * Note: Vector adapters can be extended to support memory operations in the future.
 */

// Type exports - Keep interfaces
export type {
  WorkingMemoryData,
  WorkingMemoryConfig,
  StoreOptions as WorkingMemoryOptions
} from './working/WorkingMemoryTypes';

export type {
  EpisodicMemoryData,
  EpisodicMemoryConfig,
  StoreEpisodicOptions as EpisodicMemoryOptions,
  ConsolidationResult,
  DecayResult
} from './episodic/EpisodicMemoryTypes';

export type {
  SemanticMemoryData,
  SemanticMemoryConfig,
  StoreSemanticOptions as SemanticMemoryOptions,
  VectorSearchResult
} from './semantic/SemanticMemoryTypes';

export type {
  ProceduralMemoryData,
  ProceduralMemoryConfig,
  StoreProceduralOptions as ProceduralMemoryOptions,
  ProceduralPattern,
  LearningResult
} from './procedural/ProceduralMemoryTypes';

// Class exports - Will create these as thin wrappers
export { WorkingMemory } from './working/WorkingMemory';
export { EpisodicMemory } from './episodic/EpisodicMemory';
export { SemanticMemory } from './semantic/SemanticMemory';
export { ProceduralMemory } from './procedural/ProceduralMemory';

// Common types - export the actual enum and interfaces
export { MemoryType } from './common';
export type { Memory, MemoryMessage } from './common';

export interface MemoryManagerConfig {
  working?: WorkingMemoryConfig;
  episodic?: EpisodicMemoryConfig;
  semantic?: SemanticMemoryConfig;
  procedural?: ProceduralMemoryConfig;
  intelligence?: IntelligenceLayerConfig;
  debug?: boolean;
}

/**
 * Memory adapter capabilities interface
 */
export interface AdapterCapabilities {
  hasMemoryOps: boolean;
  hasVectorSearch: boolean;
  hasHybridSearch: boolean;
  adapterType: 'vector+hybrid' | 'vector-only' | 'text-only';
}

/**
 * Memory adapter interface for type safety
 */
interface MemoryAdapter {
  memory?: {
    recall?: (...args: any[]) => any;
    store?: (...args: any[]) => any;
    getStats?: (...args: any[]) => any;
    searchByVector?: (...args: any[]) => any;
    hybridSearch?: (...args: any[]) => any;
    storeMemoryWithEmbedding?: (...args: any[]) => any;
    [key: string]: unknown;
  };
}

/**
 * Validate that an adapter supports memory operations
 * @param adapter - Storage adapter to validate
 * @param adapterName - Name of adapter for error messages
 * @throws Error if adapter doesn't support memory operations
 */
export function validateMemoryAdapter(
  adapter: unknown,
  adapterName: string = 'unknown'
): asserts adapter is MemoryAdapter {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error(
      `Memory adapter is null, undefined, or not an object. Please provide a valid memory adapter.`
    );
  }

  const adapterObj = adapter as Record<string, unknown>;

  if (!adapterObj.memory || typeof adapterObj.memory !== 'object') {
    logger.error(
      LogCategory.STORAGE,
      'MemoryUtilities',
      'Incompatible adapter - no memory operations',
      { adapterName }
    );

    throw new Error(
      `Adapter '${adapterName}' does not support memory operations. ` +
        `Supported: PostgreSQL, PostgreSQL-Vector, SQLite, SQLite-Vec. ` +
        `Vector adapters (ChromaDB, Pinecone, Qdrant) require memory operation extensions.`
    );
  }

  const memory = adapterObj.memory as Record<string, unknown>;
  if (typeof memory.recall !== 'function') {
    logger.error(
      LogCategory.STORAGE,
      'MemoryUtilities',
      'Incomplete memory operations - missing recall method',
      { adapterName }
    );

    throw new Error(
      `Adapter '${adapterName}' memory operations are incomplete. Missing required 'recall' method.`
    );
  }

  logger.info(
    LogCategory.STORAGE,
    'MemoryUtilities',
    'Memory adapter validation passed',
    {
      adapterName,
      hasVectorSearch: typeof memory.searchByVector === 'function',
      hasHybridSearch: typeof memory.hybridSearch === 'function'
    }
  );
}

/**
 * Detect adapter capabilities safely with informative logging
 * @param adapter - Validated memory adapter
 * @param adapterName - Name of adapter for logging
 * @returns Adapter capabilities
 */
export function detectAdapterCapabilities(
  adapter: MemoryAdapter,
  adapterName: string = 'unknown'
): AdapterCapabilities {
  const memoryOps = adapter.memory; // Safe after validation
  
  if (!memoryOps) {
    throw new Error(`Adapter '${adapterName}' memory operations not found after validation`);
  }

  const capabilities: AdapterCapabilities = {
    hasMemoryOps: true, // Validated by this point
    hasVectorSearch: typeof memoryOps.searchByVector === 'function',
    hasHybridSearch: typeof memoryOps.hybridSearch === 'function',
    adapterType: 'text-only'
  };

  if (capabilities.hasHybridSearch) {
    capabilities.adapterType = 'vector+hybrid';
  } else if (capabilities.hasVectorSearch) {
    capabilities.adapterType = 'vector-only';
  }

  logger.info(
    LogCategory.STORAGE,
    'MemoryUtilities',
    'Adapter capabilities detected',
    { adapterName, capabilities }
  );

  return capabilities;
}

/**
 * Initialize all memory utility services with memory-enabled adapter
 *
 * SUPPORTED ADAPTERS:
 * ✅ PostgreSQL-Vector (hybrid search + ACID transactions)
 * ✅ SQLite-Vec (hybrid search + local development)
 * ✅ PostgreSQL (text search + ACID transactions)
 * ✅ SQLite (text search + local development)
 *
 * Uses tiered fallback system within memory adapters:
 * - Tier 1: Hybrid search (PostgreSQL-Vector, SQLite-Vec)
 * - Tier 2: Vector search (if supported by memory adapter)
 * - Tier 3: Text search (all memory adapters)
 * - Tier 4: Simple analysis (fallback)
 *
 * @param embeddingService - Embedding service for semantic operations
 * @param adapter - Storage adapter with memory operations
 * @param adapterName - Name of adapter for logging and error messages
 * @throws Error if adapter doesn't support memory operations
 */
export function initializeMemoryUtilities(
  embeddingService: EmbeddingService,
  adapter: unknown,
  adapterName: string = 'unknown'
): void {
  // Validate adapter before using - will throw on incompatible adapters
  validateMemoryAdapter(adapter, adapterName);

  // Detect capabilities with logging
  const capabilities = detectAdapterCapabilities(adapter, adapterName);

  // Initialize all services with validated adapter
  initializeSemanticServices(embeddingService, adapter, adapterName);
  initializeWorkingMemoryServices(embeddingService, adapter, adapterName);
  initializeEpisodicMemoryServices(embeddingService, adapter, adapterName);

  logger.info(
    LogCategory.STORAGE,
    'MemoryUtilities',
    'All memory utilities initialized successfully',
    { adapterName, capabilities }
  );
}

// TODO: Vector Adapter Memory Operations Support
// When ready to support ChromaDB/Pinecone/Qdrant for memory operations:
// 1. Create VectorMemoryWrapper classes that implement MemoryOperations
// 2. Use vector similarity search for recall operations
// 3. Store memory metadata in vector payload/metadata fields
// 4. Handle user isolation through vector namespacing
// 5. Implement memory connections through vector relationships
//
// Current blocker: Vector DBs lack ACID transactions needed for complex memory operations
