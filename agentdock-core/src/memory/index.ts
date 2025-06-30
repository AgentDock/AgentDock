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
 *   preset?: 'fast' | 'balanced' | 'accurate' | 'production';
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
 *   // 2. Apply preset configurations from MEMORY_CONFIG_PRESETS
 *   // 3. Initialize all memory types with sensible defaults
 *   // 4. Create RecallService with preset configuration
 *   // 5. Create ConversationProcessor for message handling
 *   // 6. Return complete, ready-to-use memory system
 * }
 *
 * // Quick setup examples:
 * const { memoryManager, recallService } = await createMemorySystem({
 *   preset: 'production'
 * });
 *
 * const { memoryManager, recallService } = await createMemorySystem({
 *   storage: 'postgresql',
 *   preset: 'accurate',
 *   features: { vectorSearch: true, encryption: true }
 * });
 *
 * // For specific memory type shortcuts:
 * export function createQuickRecall(preset: 'fast' | 'balanced' = 'balanced'): Promise<RecallService>;
 * export function createMemoryManager(preset: 'fast' | 'balanced' = 'balanced'): Promise<MemoryManager>;
 * ```
 */

// Memory Types - All memory implementations
export * from './types';

// Memory Services - Processing and orchestration
export * from './services';

// Batch Processing System - Cost optimization and extraction
export * from './batch';

// Main Memory System
export { MemoryManager } from './MemoryManager';
