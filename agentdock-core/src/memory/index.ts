/**
 * @fileoverview AgentDock Memory System - Complete memory architecture
 *
 * Provides a comprehensive, multi-layered memory system for AI agents including:
 * - Working Memory (fast, ephemeral context)
 * - Episodic Memory (time-ordered experiences)
 * - Semantic Memory (long-term knowledge)
 * - Procedural Memory (learned patterns)
 *
 * Plus supporting services for recall, processing, and encryption.
 *
 * @example Current usage (explicit configuration required)
 * ```typescript
 * const storage = new SQLiteAdapter('./memory.db');
 * const memoryConfig = { working: {...}, episodic: {...}, semantic: {...}, procedural: {...} };
 * const memoryManager = new MemoryManager(storage, memoryConfig);
 * const recallService = new RecallService(...memoryManager.types, recallConfig);
 * ```
 *
 * @todo SUGGESTED: Add convenience factory functions for easier setup
 * ```typescript
 * // Export convenience factory functions that would make setup much simpler:
 *
 * export async function createMemorySystem(options: {
 *   storage?: 'sqlite' | 'memory' | 'postgresql' | StorageProvider;
 *   dbPath?: string;
 *   features?: {
 *     vectorSearch?: boolean;
 *     encryption?: boolean;
 *     caching?: boolean;
 *     relationships?: boolean;
 *   };
 * }): Promise<{
 *   memoryManager: MemoryManager;
 *   recallService: RecallService;
 *   conversationProcessor: ConversationProcessor;
 * }> {
 *   // Implementation would:
 *   // 1. Create appropriate storage provider
 *   // 2. Initialize all memory types with sensible defaults
 *   // 3. Create RecallService with optimized configuration
 *   // 4. Create ConversationProcessor for message handling
 *   // 5. Return complete, ready-to-use memory system
 * }
 *
 * // Quick setup examples:
 * const { memoryManager, recallService } = await createMemorySystem({
 *   features: { vectorSearch: true }
 * });
 *
 * const { memoryManager, recallService } = await createMemorySystem({
 *   storage: 'postgresql',
 *   features: { vectorSearch: true, encryption: true }
 * });
 *
 * // For specific memory type shortcuts:
 * export function createQuickRecall(): Promise<RecallService>;
 * export function createMemoryManager(): Promise<MemoryManager>;
 * ```
 */

// Memory Types - All memory implementations
export * from './types';

// Memory Services - Processing and orchestration
export * from './services';

// PRIME Extraction System - Intelligent memory extraction
export * from './extraction';

// Tracking System - Cost and performance tracking
export * from './tracking';

// Main Memory System
export { MemoryManager } from './MemoryManager';

// Factory functions for easy setup
export {
  createMemorySystem,
  createLocalMemory,
  createProductionMemory,
  type MemorySystem,
  type MemorySystemOptions
} from './create-memory-system';

// Preset configurations for RecallService
export {
  RECALL_CONFIG_PRESETS,
  getRecallPreset,
  validateHybridWeights,
  type RecallPresetName
} from './config/recall-presets';
