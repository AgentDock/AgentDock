/**
 * @fileoverview Memory Types - Clean exports with full type safety
 * 
 * NO any types - Full type safety enforced
 * Simple delegation to storage layer
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

// Import config types for MemoryManagerConfig
import type { WorkingMemoryConfig } from './working/WorkingMemoryTypes';
import type { EpisodicMemoryConfig } from './episodic/EpisodicMemoryTypes';
import type { SemanticMemoryConfig } from './semantic/SemanticMemoryTypes';
import type { ProceduralMemoryConfig } from './procedural/ProceduralMemoryTypes';

export interface MemoryManagerConfig {
  working?: WorkingMemoryConfig;
  episodic?: EpisodicMemoryConfig;
  semantic?: SemanticMemoryConfig;
  procedural?: ProceduralMemoryConfig;
  debug?: boolean;
} 