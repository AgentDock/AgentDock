/**
 * @fileoverview Shared memory type definitions
 *
 * Central location for types shared between storage and memory modules.
 * This breaks circular dependencies and provides a single source of truth.
 *
 * @author AgentDock Core Team
 */

/**
 * Memory type enumeration - defines the four types of memory
 */
export enum MemoryType {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural'
}

/**
 * Base interface for any consolidatable memory item
 * This minimal interface defines what ALL memory items must have
 * to be eligible for consolidation operations.
 *
 * KISS Principle: Only include fields absolutely necessary for consolidation
 */
export interface BaseMemoryItem {
  /** Unique identifier */
  id: string;

  /** Content that can be consolidated */
  content: string;

  /** Importance score (0-1) used in consolidation decisions */
  importance: number;

  /** Type of memory for consolidation strategies */
  type: MemoryType;

  /** Creation timestamp for age-based consolidation */
  createdAt: number;
}
